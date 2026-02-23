
from typing import Any, Dict, Optional, List
from sqlalchemy.orm import Session
from fastapi import APIRouter, HTTPException, Depends
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel
from app.api import deps
import uuid

from app.services.crawler import CrawlerService
from app.core.config import settings

router = APIRouter()
crawler_service = CrawlerService()

# --- Pydantic Models ---

class SaveRequest(BaseModel):
    session_id: str
    project_id: str
    url: str
    goal: str
    persona_id: Optional[str] = None
    persona_name: Optional[str] = None
    history: List[Dict[str, Any]]
    final_status: str # passed / failed

class StartRequest(BaseModel):
    url: str

class StepRequest(BaseModel):
    session_id: str
    goal: str
    history: List[Dict[str, Any]] # Previous steps context
    username: Optional[str] = None
    password: Optional[str] = None

class StopRequest(BaseModel):
    session_id: str

class ScoreBreakdown(BaseModel):
    Goal_Alignment: int = 0
    Page_Relevance: int = 0
    Action_Confidence: int = 0

class ExplorationStep(BaseModel):
    step_number: int
    matching_score: int = 0
    score_breakdown: ScoreBreakdown = ScoreBreakdown()
    thought: str = "Thinking..."
    action_type: str = "wait" # click, type, scroll, wait, navigate, finish
    action_target: str = "" # selector or url
    action_value: str = "" # input value
    description: str
    status: str # In-Progress, Completed, Failed
    expectation: str = "" 
    observation: str = ""

# --- API Endpoints ---

@router.post("/start")
async def start_session(req: StartRequest):
    """
    Starts a browser session.
    """
    session_id = str(uuid.uuid4())
    
    import asyncio
    print(f"[DEBUG] Current Event Loop Type: {type(asyncio.get_running_loop())}")

    try:
        initial_state = await crawler_service.start_session(session_id, req.url)
        return {"session_id": session_id, "state": initial_state}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/step", response_model=ExplorationStep)
async def next_step(req: StepRequest):
    """
    Decides and Executes the next step suitable for the goal.
    """
    if not settings.GOOGLE_API_KEY:
        raise HTTPException(status_code=500, detail="Server Configuration Error")

    # 1. Get Current State (or result of last action)
    try:
         state = await crawler_service.get_state(req.session_id)
    except ValueError:
         raise HTTPException(status_code=404, detail="Session expired or not found")

    # 2. Build Prompt
    # Sanitize credentials
    user_context_str = "No user credentials provided."
    if req.username and req.password:
        user_context_str = "Authorized User Context Available. Use placeholder {{USERNAME}} for the ID/Email field and {{PASSWORD}} for the password field."

    prompt = f"""
    You are a Self-Driving Browser Agent.
    Goal: {req.goal}
    My Context: {user_context_str}
    
    Current Page: {state['title']} ({state['url']})
    HTML Structure (Simplified):
    {state['html_structure']}
    
    History:
    {req.history}
    
    Task:
    Determine the NEXT interaction to move towards the goal.
    
    CRITICAL RULES for Action Selection:
    1. **FAIL-FAST**: If the previous 2 steps were 'wait' or if the page state has not changed after an action, you MUST change strategy or declare 'Failed'. Do NOT loop 'wait'.
    2. **STUCK PREVENTION**: If you cannot find a suitable element to interact with, do NOT guess. Mark status as 'Failed' with a clear thought explaining why.
    3. **LOGIN**: If your goal is to login and you are on a login page, prioritize finding the ID/Password inputs.
    4. **MULTI-STEP GOALS**: If the user provided a numbered list or sequence of tasks, you MUST complete ALL of them. Do not set status to 'Completed' until the final step is done.
    5. **LANGUAGE**: All 'thought' and 'description' fields in the JSON output MUST be written in Korean (한국어).
    
    Safety Instruction:
    - Never hallucinate passwords.
    - If the field assumes an ID/Email, set action_value to '{{USERNAME}}'.
    - If the field assumes a Password, set action_value to '{{PASSWORD}}'.
    
    JSON Output Schema:
    {{
        "step_number": {len(req.history) + 1},
        "matching_score": 0-100 (Overall Progress based on Observation),
        "score_breakdown": {{
            "Goal_Alignment": 0-100,
            "Page_Relevance": 0-100,
            "Action_Confidence": 0-100
        }},
        "observation": "What do you see on the current page? (Actual Outcome of previous step)",
        "thought": "Reasoning...",
        "action_type": "click/type/scroll/wait/finish",
        "action_target": "css_selector",
        "action_value": "text_to_type_or_placeholder",
        "expectation": "What should happen after this action? (Expected Outcome)",
        "description": "Short description for UI",
        "status": "In-Progress/Completed/Failed"
    }}
    """

    # 3. Call LLM
    from google import genai
    from google.genai import types
    client = genai.Client(api_key=settings.GOOGLE_API_KEY)
    
    # Generate content (Async?)
    # Validating if google-genai supports async. It does via client.aio...
    # But here we used sync calls inside async def?
    # If the library is sync, we should use run_in_threadpool for THIS part if it blocks?
    # Actually, google-genai new SDK has async support?
    # Let's keep it sync for now as it's just an HTTP call, or use client.aio if available.
    # To minimize risk, I will wrap LLM call in threadpool if it's sync.
    
    def _call_llm():
        return client.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=ExplorationStep
            )
        )
    
    response = await run_in_threadpool(_call_llm)
    
    if not response.parsed:
         raise ValueError("LLM failed to return JSON")
         
    plan: ExplorationStep = response.parsed
    
    # 4. Execute Action (in backend)
    # Inject credentials
    if plan.action_type == "type":
        if "{{PASSWORD}}" in plan.action_value and req.password:
            plan.action_value = plan.action_value.replace("{{PASSWORD}}", req.password)
        if "{{USERNAME}}" in plan.action_value and req.username:
            plan.action_value = plan.action_value.replace("{{USERNAME}}", req.username)
        
    # Execute via Crawler
    # Execute via Crawler
    if plan.action_type in ["click", "type", "scroll", "wait", "navigate"]:
        try:
            await crawler_service.perform_action(
                req.session_id, 
                plan.action_type, 
                plan.action_target, 
                plan.action_value
            )
        except Exception as e:
            # If browser closed (Target closed), assume it was a terminal action (like logout closing window)
            msg = str(e)
            if "Target closed" in msg or "Session closed" in msg:
                print(f"[INFO] Browser closed during action {plan.action_type}. Marking as Completed.")
                plan.status = "Completed"
                plan.description += " (Browser Closed - Task Finished)"
            else:
                raise e
        
    return plan

@router.post("/stop")
async def stop_session(req: StopRequest):
    await crawler_service.close_session(req.session_id)
    return {"status": "cost-stopped"}

@router.post("/save")
async def save_history(req: SaveRequest):
    """
    Saves the full exploration history to DB.
    """
    from app.services.history_service import history_service
    from app.db.session import SessionLocal

    db = SessionLocal()
    try:
        session_data = {
            "url": req.url,
            "goal": req.goal,
            "persona_id": req.persona_id,
            "persona_name": req.persona_name
        }
        
        history_id = history_service.save_ai_session(
            db, 
            req.dict(), 
            req.history, 
            req.final_status,
            project_id=req.project_id
        )
        return {"status": "saved", "history_id": history_id}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()

@router.post("/{session_id}/assetize")
def assetize_session(session_id: str, db: Session = Depends(deps.get_db)):
    """
    Converts an AI session into a reusable Scenario and Script.
    """
    from app.services.asset_manager import AssetManager
    
    manager = AssetManager()
    try:
        scenario, script = manager.convert_session_to_scenario(db, session_id)
        return {
            "status": "success",
            "scenario_id": scenario.id,
            "script_id": script.id,
            "message": "Successfully assetized AI session."
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

# --- Report Generation Models ---

class ReportStats(BaseModel):
    totalRuns: int
    passRate: int
    diagnosis: Dict[str, int]
    topFailures: List[Dict[str, Any]]
    goldenSummary: Dict[str, Any]

class ReportRequest(BaseModel):
    project_name: str
    period: str
    stats: ReportStats

@router.post("/analyze_report")
async def analyze_report(req: ReportRequest):
    """
    Generates an Executive Intelligence Report based on aggregated stats.
    """
    if not settings.GOOGLE_API_KEY:
        raise HTTPException(status_code=500, detail="Server Configuration Error")

    from google import genai
    from google.genai import types
    client = genai.Client(api_key=settings.GOOGLE_API_KEY)

    prompt = f"""
    You are a QA Intelligence Analyst. Your task is to write an "Executive QA Intelligence Report" in Markdown format based on the provided test telemetry data.

    **Context:**
    - Project: {req.project_name}
    - Period: {req.period}

    **Telemetry Data:**
    - Total Executions: {req.stats.totalRuns}
    - Overall Success Rate: {req.stats.passRate}%
    - Failure Patterns:
        - UI/Selector Issues: {req.stats.diagnosis.get('ui', 0)}
        - Network/API Issues: {req.stats.diagnosis.get('network', 0)}
        - Logic/Process Issues: {req.stats.diagnosis.get('logic', 0)}

    **Golden Path (Key Scenarios) Status:**
    - AI Exploration (Auto-Discovery): {len(req.stats.goldenSummary.get('exploration', []))} key assets tracked.
    - Generator (AI-Converted): {len(req.stats.goldenSummary.get('generator', []))} key assets tracked.
    - Manual (Core Flows): {len(req.stats.goldenSummary.get('manual', []))} key assets tracked.
    - Step Builder (Modular Assets): {len(req.stats.goldenSummary.get('step', []))} key assets tracked.

    **Recent Critical Failures (Top 5):**
    {req.stats.topFailures}

    **Instruction:**
    Write a professional, concise executive summary in Korean (한국어). The report should include:
    1.  **Executive Summary:** High-level assessment of the QA health. (e.g., "Stable", "Needs Attention", "Critical")
    2.  **Key Risk Areas:** Analyze the 'Failure Patterns' and 'Recent Critical Failures'. Explain *why* these might be happening based on the error messages (root cause hypothesis).
    3.  **Stability Trends:** Comment on the {req.stats.passRate}% success rate. Is it acceptable?
    4.  **Actionable Recommendations:** Suggest 2-3 concrete steps to improve stability (e.g., "Review UI selectors for [Script Name]", "Investigate network timeout on [Goal]").

    **Format:**
    - Use standard Markdown headers (##, ###).
    - Use bullet points for readability.
    - Bold key metrics.
    - Tone: Professional, analytical, objective.
    - **Do NOT** include any introductory text like "Here is the report". Start directly with the report title using a single #.
    """

    def _call_llm_report():
        return client.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=prompt,
             config=types.GenerateContentConfig(
                response_mime_type="text/plain", # We want Markdown text, not JSON
            )
        )

    try:
        response = await run_in_threadpool(_call_llm_report)
        return {"report_markdown": response.text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
