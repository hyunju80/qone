
from typing import Any, Dict, Optional, List
from sqlalchemy.orm import Session
from fastapi import APIRouter, HTTPException, Depends
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel
from app.api import deps
import uuid

from app.services.crawler import CrawlerService
from app.services.app_runner import app_step_runner
from app.services.device_service import device_service
from app.core.config import settings
from selenium.common.exceptions import InvalidSessionIdException
import logging
logger = logging.getLogger(__name__)

router = APIRouter()
crawler_service = CrawlerService()

# --- Pydantic Models ---

class SaveRequest(BaseModel):
    session_id: str
    project_id: str
    url: str
    goal: str
    scenario_id: Optional[str] = None
    persona_id: Optional[str] = None
    persona_name: Optional[str] = None
    platform: str = "WEB"
    history: List[Dict[str, Any]]
    final_status: str # passed / failed
    capture_screenshots: bool = False

class StartRequest(BaseModel):
    url: Optional[str] = None
    platform: str = "WEB"
    device_id: Optional[str] = None
    app_package: Optional[str] = None
    capture_screenshots: bool = False

class StepRequest(BaseModel):
    session_id: str
    goal: str
    platform: str = "WEB"
    history: List[Dict[str, Any]] # Previous steps context
    username: Optional[str] = None
    password: Optional[str] = None
    user_feedback: Optional[str] = None
    persona_context: Optional[str] = None
    override_step: Optional[Dict[str, Any]] = None
    capture_screenshots: bool = False

class StopRequest(BaseModel):
    session_id: str
    platform: str = "WEB"

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
    expected_text: str = ""
    actual_observed_text: str = ""
    screenshot_data: Optional[str] = None

# --- API Endpoints ---

@router.post("/start")
async def start_session(req: StartRequest):
    """
    Starts a browser or mobile session.
    """
    session_id = str(uuid.uuid4())
    
    import asyncio
    print(f"[DEBUG] Current Event Loop Type: {type(asyncio.get_running_loop())}")

    try:
        if req.platform.upper() == "APP":
            device_id = req.device_id
            if not device_id:
                connected = device_service.get_connected_devices()
                if connected:
                    device_id = connected[0]["id"]
            
            if not device_id:
                raise HTTPException(status_code=400, detail="No connected devices found for App testing.")
                
            caps = {
                "platformName": "Android",
                "udid": device_id,
                "automationName": "UiAutomator2"
            }
            if req.app_package:
                caps["appPackage"] = req.app_package
                
            success, err = app_step_runner.start_session(caps)
            if not success:
                raise HTTPException(status_code=500, detail=f"Appium session failed: {err}")
                
            # Explicitly bring the app to the foreground if a package was provided
            if req.app_package and app_step_runner.driver:
                try:
                    app_step_runner.driver.activate_app(req.app_package)
                except Exception as activate_e:
                    print(f"Warning: Core activate_app failed for {req.app_package}: {activate_e}")
                
            # Add a small delay and capture state
            await asyncio.sleep(4)
            xml_source = app_step_runner.get_clean_source()
            initial_state = {
                "title": f"App ({req.app_package or 'Device'})",
                "url": "App Interface",
                "html_structure": xml_source
            }
            if req.capture_screenshots:
                initial_state["screenshot"] = app_step_runner.get_screenshot() or ""
            return {"session_id": session_id, "state": initial_state}
            
        else:
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
        if req.platform.upper() == "APP":
            xml_source = app_step_runner.get_clean_source()
            state = {
                "title": "Mobile App UI",
                "url": "App Interface",
                "html_structure": xml_source
            }
            if req.capture_screenshots:
                state["screenshot"] = app_step_runner.get_screenshot() or ""
        else:
            state = await crawler_service.get_state(req.session_id)
            if not req.capture_screenshots and "screenshot" in state:
                state["screenshot"] = "" # Clear if not requested to save bandwidth
    except (ValueError, InvalidSessionIdException):
         raise HTTPException(status_code=404, detail="Mobile session expired or Appium connection lost. Please restart the session.")
    except Exception as e:
        logger.error(f"Error captured in exploration step: {e}")
        raise HTTPException(status_code=500, detail=str(e))

    # 2. Build Prompt
    # Sanitize credentials
    user_context_str = "No user credentials provided."
    if req.username and req.password:
        user_context_str = "Authorized User Context Available. Use placeholder {{USERNAME}} for the ID/Email field and {{PASSWORD}} for the password field."

    persona_str = ""
    if req.persona_context:
        persona_str = f"Persona Context: {req.persona_context}\n    (Adopt this persona's traits, skill level, and typing speed when generating thoughts and actions.)"

    feedback_str = ""
    if req.user_feedback:
        feedback_str = f"User's Latest Feedback / Instruction: {req.user_feedback}\n    (Prioritize this instruction over general goals. Overcome the previous failure with this context.)"

    prompt = f"""
    You are a Self-Driving Browser Agent.
    Goal: {req.goal}
    {persona_str}
    {feedback_str}

    My Context: {user_context_str}
    
    Current Page: {state['title']} ({state['url']})
    UI Structure (Simplified HTML/XML):
    {state['html_structure']}
    
    History:
    {req.history}
    
    Task:
    Determine the NEXT interaction to move towards the goal.
    
    CRITICAL RULES for Action Selection:
    1. **LOADING WAIT**: If an app was just launched or a button was clicked, the next screen might be loading. It is OK to output a 'wait' action (e.g., 3-5 seconds) before declaring failure.
    2. **STUCK PREVENTION**: If you cannot find a suitable element to interact with and the page is fully loaded, do NOT guess. Mark status as 'Failed' with a clear thought explaining why.
    3. **MISSING ELEMENTS (SCROLLING)**: If your target element (e.g., a specific menu, text, or button) is not visible in the current UI structure, you MUST output a 'scroll' action (e.g., action_target='', action_value='down', 'up', 'left', or 'right') to search for it before declaring failure.
    4. **LOGIN**: If your goal is to login and you are on a login page, prioritize finding the ID/Password inputs.
    5. **MULTI-STEP GOALS**: If the user provided a numbered list or sequence of tasks, you MUST complete ALL of them. Do not set status to 'Completed' until the final step is done.
    6. **APP SELECTORS (IMPORTANT)**: If platform is APP, prefer using 'accessibility_id' if available. If not, use exact text for 'action_target'. E.g. "Search", "Login", or basic IDs like "com.example:id/button". DO NOT GUESS complex XPaths if you see simple text.
    7. **LANGUAGE**: All 'thought' and 'description' fields in the JSON output MUST be written in Korean (한국어).
    8. **ASSERTION PREDICTION (expected_text)**: Predict an EXACT text string that you *expect* to see on the NEXT screen after your action (Step N) succeeds. (e.g., 'Search Results' or 'My Page'). This is a forecast.
    9. **ASSERTION VERIFICATION (actual_observed_text)**: You MUST identify a DIFFERENT, UNIQUE literal text string that you ACTUALLY SEE on the **CURRENT** screen (Turn N) which confirms that the **PREVIOUS** action (Turn N-1) was successful. Extract this bit-for-bit from the "UI Structure" or "Current Page". Output this in `actual_observed_text`. (For Turn 1, identify a landmark on the landing page). **THIS IS THE MOST IMPORTANT FIELD FOR ACCURACY.**
    
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
        "action_target": "{'xpath, element_id, accessibility_id or EXACT text' if req.platform.upper() == 'APP' else 'css_selector'}",
        "action_value": "text_to_type_or_placeholder",
        "expectation": "What should happen after this action? (Expected Outcome)",
        "expected_text": "PREDICTED literal text string expected on the next screen (Next State Assertion)",
        "actual_observed_text": "ACTUAL literal text string found on the current screen (Landmark verifying Previous Step)",
        "description": "Short description for UI",
        "status": "In-Progress/Completed/Failed"
    }}
    """

    # 3. Call LLM OR Use Override
    if req.override_step:
        # User manually provided the next step parameters
        op = req.override_step
        plan = ExplorationStep(
            step_number=len(req.history) + 1,
            matching_score=100,
            observation="Manual Override",
            thought=op.get("thought", "User explicitly requested this action."),
            action_type=op.get("action_type", "wait"),
            action_target=op.get("action_target", ""),
            action_value=op.get("action_value", ""),
            description="Manual Step: " + op.get("action_type", "action") + " on " + op.get("action_target", ""),
            status="In-Progress"
        )
    else:
        from google import genai
        from google.genai import types
        client = genai.Client(api_key=settings.GOOGLE_API_KEY)
        
        def _call_llm():
            return client.models.generate_content(
                model=settings.GEMINI_MODEL,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_json_schema=ExplorationStep.model_json_schema()
                )
            )
        
        response = await run_in_threadpool(_call_llm)
        
        if not response.parsed:
             raise ValueError("LLM failed to return JSON")
             
        # Support both dict and object return from SDK
        plan = ExplorationStep.model_validate(response.parsed)
    
    # 4. Execute Action (in backend)
    # Inject credentials
    if plan.action_type:
        plan.action_type = plan.action_type.lower()
        
    if plan.action_type == "type":
        if "{{PASSWORD}}" in plan.action_value and req.password:
            plan.action_value = plan.action_value.replace("{{PASSWORD}}", req.password)
        if "{{USERNAME}}" in plan.action_value and req.username:
            plan.action_value = plan.action_value.replace("{{USERNAME}}", req.username)
        
    # Execute via Runner
    if plan.action_type in ["click", "type", "scroll", "wait", "navigate"]:
        try:
            if req.platform.upper() == "APP":
                # Heuristic mapping for Appium Action execution (with fallback in app_runner)
                s_type = "XPATH"
                
                target = plan.action_target or ""
                if not target.startswith("/"):
                    if ":id/" in target or "id/" in target:
                        s_type = "ID"
                    elif "scroll" not in plan.action_type and target:
                        # If it's pure text without xpath characters, we'll let app_runner handle it via XPATH fallback
                        s_type = "XPATH"
                        
                step_dict = {
                    "action": plan.action_type,
                    "selector_type": s_type,
                    "selector_value": target,
                    "option": plan.action_value
                }
                action_res = app_step_runner.execute_step(step_dict)
            else:
                action_res = await crawler_service.perform_action(
                    req.session_id, 
                    plan.action_type, 
                    plan.action_target, 
                    plan.action_value
                )
                
            if action_res and "error" in action_res and action_res["error"]:
                err_msg = action_res['error']
                if "Target closed" in err_msg or "has been closed" in err_msg:
                    print(f"[INFO] Browser/Popup closed after action {plan.action_type}. Marking as Completed.")
                    plan.status = "Completed"
                    plan.observation = "Action successful (Target page or popup closed)."
                else:
                    print(f"[runner error] {err_msg}")
                    plan.status = "Failed"
                    plan.observation = f"Execution Error: {err_msg}"
            else:
                plan.observation = "Action executed successfully."
                
        except Exception as e:
            # If browser closed (Target closed), assume it was a terminal action (like logout closing window)
            msg = str(e)
            if "Target closed" in msg or "Session closed" in msg:
                print(f"[INFO] Browser closed during action {plan.action_type}. Marking as Completed.")
                plan.status = "Completed"
                plan.description += " (Browser Closed - Task Finished)"
            else:
                raise e
        
        # Finally, attach screenshot after action if requested
        if req.capture_screenshots:
            if req.platform.upper() == "APP":
                plan.screenshot_data = app_step_runner.get_screenshot() or ""
            else:
                final_state = await crawler_service.get_state(req.session_id)
                plan.screenshot_data = final_state.get("screenshot", "")

    return plan

@router.post("/stop")
async def stop_session(req: StopRequest):
    if req.platform.upper() == "APP":
        app_step_runner.stop_session()
    else:
        await crawler_service.close_session(req.session_id)
    return {"status": "cost-stopped"}

@router.post("/save")
async def save_history(req: SaveRequest):
    """
    Saves the exploration session and directly converts it into a TestScript Asset.
    Bypasses TestHistory and Scenario generation.
    """
    from app.db.session import SessionLocal
    from app.models.ai import AiExplorationSession
    from app.services.asset_manager import AssetManager
    import uuid

    db = SessionLocal()
    try:
        session_id = str(uuid.uuid4())
        
        # Calculate simple score average if available
        final_score = 0
        if req.history:
            scores = [s.get("matching_score", 0) for s in req.history if "matching_score" in s]
            if scores:
                final_score = int(sum(scores) / len(scores))

        # 1. Create AiExplorationSession
        ai_session = AiExplorationSession(
            id=session_id,
            target_url=req.url,
            goal=req.goal,
            persona_id=req.persona_id,
            steps_data=req.history,
            final_score=final_score
        )
        db.add(ai_session)
        db.flush()
        
        # 2. Assetize into Scenario and TestScript immediately
        manager = AssetManager()
        
        # Determine category automatically
        category = manager.determine_category(db, req.project_id, req.goal, req.history)
        print(f"[DEBUG] AI Exploration Auto-categorized as: {category}")
        
        scenario, script = manager.convert_session_to_scenario(
            db, ai_session, req.project_id, req.platform, req.capture_screenshots, category=category, scenario_id=req.scenario_id
        )
        
        return {"status": "saved", "scenario_id": scenario.id, "script_id": script.id, "session_id": session_id}
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
