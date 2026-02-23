from typing import Any, List, Optional, Dict
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
import json
from app.api import deps
from app.services.crawler import CrawlerService
from app.core.config import settings
import json
import os
from datetime import datetime
import traceback

router = APIRouter()
crawler = CrawlerService()
# import nest_asyncio
# nest_asyncio.apply()

class AnalyzeUrlRequest(BaseModel):
    url: str
    prompt: Optional[str] = None

class TestCase(BaseModel):
    id: Optional[str] = None
    title: str = "Untitled Case"
    preCondition: str = ""
    inputData: str = ""
    steps: List[str] = []
    expectedResult: str = ""
    status: str = "draft"
    selectors: Optional[Dict[str, str]] = {}

class Scenario(BaseModel):
    id: Optional[str] = None
    title: str
    description: str
    testCases: List[TestCase]
    project_id: Optional[str] = None
    persona_id: Optional[str] = None
    is_approved: bool = False
    golden_script_id: Optional[str] = None
    created_at: Any = None
    tags: List[str] = []



class FeatureFlow(BaseModel):
    name: str
    description: str
    flows: List[str]

class AnalyzeUrlResponse(BaseModel):
    scenarios: List[Scenario] = []
    dom_context: str = ""

@router.post("/analyze-url", response_model=AnalyzeUrlResponse)
async def analyze_url(
    *,
    request: AnalyzeUrlRequest,
) -> Any:
    """
    Analyze a URL using Playwright and Gemini to DIRECTLY generate Scenarios.
    """
    if not settings.GOOGLE_API_KEY:
        raise HTTPException(500, "Server Configuration Error: GOOGLE_API_KEY is missing.")

    try:
        # 1. Crawl (existing code)
        # 1. Crawl (Async)
        crawl_result = await crawler.crawl(request.url)
        
        # --- PERSISTENCE (existing code) ---
        import base64
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        log_dir = os.path.join("logs", "scenarios", timestamp)
        os.makedirs(log_dir, exist_ok=True)
        with open(os.path.join(log_dir, "screenshot.jpg"), "wb") as f:
            f.write(base64.b64decode(crawl_result['screenshot']))
        with open(os.path.join(log_dir, "dom.html"), "w", encoding="utf-8") as f:
            f.write(crawl_result['html_structure'])
        # -----------------------------------
        
        # 2. Configure Gemini
        from google import genai
        from google.genai import types
        client = genai.Client(api_key=settings.GOOGLE_API_KEY)

        # 3. Construct Prompt for ONE-STEP Generation
        system_prompt = """You are an Expert QA Automation Engineer.
            Analyze the provided web page context (Screenshot + DOM Structure).
            
            First, internally identify critical business flows and functional features.
            Then, DIRECTLY design a comprehensive Test Scenario Suite based on those findings.

            [Design Rules]
            1. Output must be a valid JSON object with a single key 'scenarios'.
            2. 'scenarios' is a list of objects, each MUST have:
               - "title": (string) Scenario Name
               - "description": (string) Purpose
               - "testCases": (list of objects)
            3. Each "testCases" item MUST have:
               - "title": (string) Case Name
               - "preCondition": (string)
               - "inputData": (string)
               - "inputData": (string)
               - "steps": (list of strings) - Be specific, use clear actions.
               - "expectedResult": (string)
               - "selectors": (list of objects) List of { "name": "ElementName", "value": "CSS/XPath" }
                 e.g. [{"name": "LoginButton", "value": "#login-submit"}]

            [Selector Strategy]
            - Analyze the DOM structure deeply to find robust selectors.
            - Prioritize finding SPECIFIC functional elements (e.g. Navigation Links, GNB items, Submit Buttons).
            - Prefer ID > Name > TestId > CSS Classes > XPath.
            - Ensure selectors are unique and precise.

            Return the result as a JSON object with a 'scenarios' array.
            Language: Korean.
            """
            
        if request.prompt:
            system_prompt += f"\n\n[Additional User Context]\n{request.prompt}"

        decoded_image = base64.b64decode(crawl_result['screenshot'])
        prompt_contents = [
            system_prompt,
            types.Part.from_bytes(data=decoded_image, mime_type="image/jpeg"),
            f"Page Title: {crawl_result['title']}\n\nSimplified DOM Structure:\n{crawl_result['html_structure'][:150000]}" # Increase limit
        ]

        # 4. Generate Content
        response = await client.aio.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=prompt_contents,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema={
                    "type": "OBJECT",
                    "properties": {
                        "scenarios": {
                            "type": "ARRAY",
                            "items": {
                                "type": "OBJECT",
                                "properties": {
                                    "title": {"type": "STRING"},
                                    "description": {"type": "STRING"},
                                    "testCases": {
                                        "type": "ARRAY",
                                        "items": {
                                            "type": "OBJECT",
                                            "properties": {
                                                "title": {"type": "STRING"},
                                                "preCondition": {"type": "STRING"},
                                                "inputData": {"type": "STRING"},
                                                "steps": {"type": "ARRAY", "items": {"type": "STRING"}},
                                                "expectedResult": {"type": "STRING"},
                                                "selectors": {
                                                    "type": "ARRAY",
                                                    "items": {
                                                        "type": "OBJECT",
                                                        "properties": {
                                                            "name": {"type": "STRING"},
                                                            "value": {"type": "STRING"}
                                                        },
                                                        "required": ["name", "value"]
                                                    },
                                                    "nullable": True
                                                }
                                            },
                                            "required": ["title", "preCondition", "inputData", "steps", "expectedResult"]
                                        }
                                    }
                                },
                                "required": ["title", "description", "testCases"]
                            }
                        }
                    },
                    "required": ["scenarios"]
                }
            )
        )
        
        raw_text = response.text
        if raw_text.startswith("```json"):
            raw_text = raw_text.replace("```json", "", 1).replace("```", "", 1)
        elif raw_text.startswith("```"):
            raw_text = raw_text.replace("```", "", 1).replace("```", "", 1)
            
        result = json.loads(raw_text)
        
        # Transform selectors list to dict for compatibility
        for scenario in result.get('scenarios', []):
            for tc in scenario.get('testCases', []):
                if 'selectors' in tc and isinstance(tc['selectors'], list):
                    # Convert [{"name": "k", "value": "v"}] -> {"k": "v"}
                    tc['selectors'] = {item['name']: item['value'] for item in tc['selectors'] if 'name' in item and 'value' in item}

        return AnalyzeUrlResponse(
            scenarios=result.get('scenarios', []),
            dom_context=crawl_result['html_structure']
        )

    except Exception as e:
        import traceback
        trace_str = traceback.format_exc()
        print(f"Analysis Error: {e}")
        os.makedirs("logs/scenarios", exist_ok=True)
        with open("logs/scenarios/last_error.log", "w", encoding="utf-8") as f:
            f.write(trace_str)
        raise HTTPException(500, f"Error: {str(e)}")


# --- UPLOAD ANALYSIS ENDPOINT (ONE-STEP) ---

class UploadedFile(BaseModel):
    name: str
    type: str  # mime type
    data: str  # base64 encoded content

class AnalyzeUploadRequest(BaseModel):
    files: List[UploadedFile]
    prompt: str = ""

@router.post("/analyze-upload", response_model=AnalyzeUrlResponse)
async def analyze_upload(
    *,
    request: AnalyzeUploadRequest,
) -> Any:
    """
    Analyze uploaded files and DIRECTLY generate Scenarios.
    """
    if not settings.GOOGLE_API_KEY:
        raise HTTPException(500, "Server Configuration Error: GOOGLE_API_KEY is missing.")

    try:
        # 1. Setup Logging
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        log_dir = os.path.join("logs", "scenarios", f"upload_{timestamp}")
        os.makedirs(log_dir, exist_ok=True)
        
        # 2. Prepare Gemini Client
        from google import genai
        from google.genai import types
        import base64
        client = genai.Client(api_key=settings.GOOGLE_API_KEY)
        
        # 3. Construct Prompt
        prompt_parts = []
        system_prompt = """You are an Expert QA Automation Engineer.
            Analyze the provided user uploads (Images/Mockups/Specs).
            
            First, internally understand the features and requirements.
            Then, DIRECTLY design a comprehensive Test Scenario Suite.
            
            [Design Rules]
             1. Output must be a valid JSON object with a single key 'scenarios'.
            2. 'scenarios' is a list of objects, each MUST have:
               - "title": (string) Scenario Name
               - "description": (string) Purpose
               - "testCases": (list of objects)
            3. Each "testCases" item MUST have:
               - "title": (string) Case Name
               - "preCondition": (string)
               - "inputData": (string)
               - "steps": (list of strings)
               - "expectedResult": (string)

            Return the result as a JSON object with a 'scenarios' array.
            Language: Korean.
            """
        prompt_parts.append(system_prompt)
        
        if request.prompt:
            prompt_parts.append(f"Additional User Context: {request.prompt}")

        for idx, file in enumerate(request.files):
            try:
                file_bytes = base64.b64decode(file.data)
                # Save artifact
                safe_name = "".join(x for x in file.name if x.isalnum() or x in "._-")
                with open(os.path.join(log_dir, safe_name), "wb") as f:
                    f.write(file_bytes)
                
                if file.type.startswith("image/"):
                    prompt_parts.append(types.Part.from_bytes(data=file_bytes, mime_type=file.type))
                else:
                    try:
                        text_content = file_bytes.decode('utf-8')
                        prompt_parts.append(f"[Text File: {file.name}]\n{text_content}")
                    except:
                         prompt_parts.append(f"[File: {file.name}] (Binary content)")
            except Exception as fe:
                print(f"Error processing file {file.name}: {fe}")

        # 4. Generate Content
        response = await client.aio.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=prompt_parts,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema={
                    "type": "OBJECT",
                    "properties": {
                        "scenarios": {
                            "type": "ARRAY",
                            "items": {
                                "type": "OBJECT",
                                "properties": {
                                    "title": {"type": "STRING"},
                                    "description": {"type": "STRING"},
                                    "testCases": {
                                        "type": "ARRAY",
                                        "items": {
                                            "type": "OBJECT",
                                            "properties": {
                                                "title": {"type": "STRING"},
                                                "preCondition": {"type": "STRING"},
                                                "inputData": {"type": "STRING"},
                                                "steps": {"type": "ARRAY", "items": {"type": "STRING"}},
                                                "expectedResult": {"type": "STRING"}
                                            },
                                            "required": ["title", "preCondition", "inputData", "steps", "expectedResult"]
                                        }
                                    }
                                },
                                "required": ["title", "description", "testCases"]
                            }
                        }
                    },
                    "required": ["scenarios"]
                }
            )
        )
        
        raw_text = response.text
        if raw_text.startswith("```json"):
            raw_text = raw_text.replace("```json", "", 1).replace("```", "", 1)
        elif raw_text.startswith("```"):
            raw_text = raw_text.replace("```", "", 1).replace("```", "", 1)

        result = json.loads(raw_text)
        
        with open(os.path.join(log_dir, "scenarios.json"), "w", encoding="utf-8") as f:
            json.dump(result, f, ensure_ascii=False, indent=2)

        return AnalyzeUrlResponse(
            scenarios=result.get('scenarios', []),
            dom_context=""
        )

    except Exception as e:
        trace_str = traceback.format_exc()
        print(f"Upload Analysis Error: {e}")
        with open("logs/scenarios/last_upload_error.log", "w", encoding="utf-8") as f:
            f.write(trace_str)
        raise HTTPException(500, f"Error: {str(e)}")

# --- SCENARIO GENERATION ENDPOINT ---

class ScenarioGenerationRequest(BaseModel):
    features: List[FeatureFlow]
    persona: dict # {name, goal}
    additional_context: str = ""
    dom_context: str = ""

# Definitions moved to top of file

class ScenarioGenerationResponse(BaseModel):
    scenarios: List[Scenario]

@router.post("/generate-scenarios", response_model=ScenarioGenerationResponse)
async def generate_scenarios(
    *,
    request: ScenarioGenerationRequest,
) -> Any:
    """
    Generate detailed test scenarios based on extracted features and persona.
    """
    if not settings.GOOGLE_API_KEY:
        raise HTTPException(500, "Server Configuration Error: GOOGLE_API_KEY is missing.")

    try:
        print("1. Configuring Gemini Client...", flush=True)
        from google import genai
        from google.genai import types
        
        client = genai.Client(api_key=settings.GOOGLE_API_KEY)
        
        print(f"2. Using Model: {settings.GEMINI_MODEL}", flush=True)
        # No model instantiation needed, passed to generate_content

        prompt = f"""
        You are an Expert QA Automation Engineer.
        Based on the provided extracted features, design a comprehensive Test Scenario Suite.

        FEATURES:
        {json.dumps([f.dict() for f in request.features], ensure_ascii=False, indent=2)}

        USER PERSONA:
        Name: {request.persona.get('name')}
        Goal: {request.persona.get('goal')}

        CONTEXT:
        {request.additional_context}

        SIMPLIFIED DOM STRUCTURE (Use this to find REAL Selectors/IDs):
        {request.dom_context[:50000]} 

        [Design Rules]
        1. Output must be a valid JSON object with a single key 'scenarios'.
        2. 'scenarios' is a list of objects, each MUST have:
           - "title": (string) Scenario Name
           - "description": (string) Purpose
           - "testCases": (list of objects)
        3. Each "testCases" item MUST have:
           - "title": (string) Case Name
           - "preCondition": (string)
           - "inputData": (string)
           - "steps": (list of strings)
           - "expectedResult": (string)

        Return a JSON object with a 'scenarios' array.
        Language: Korean.
        """

        print("3. Sending Request to Gemini (This may take 10-20 seconds)...", flush=True)
        response = await client.aio.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema={
                    "type": "OBJECT",
                    "properties": {
                        "scenarios": {
                            "type": "ARRAY",
                            "items": {
                                "type": "OBJECT",
                                "properties": {
                                    "title": {"type": "STRING"},
                                    "description": {"type": "STRING"},
                                    "testCases": {
                                        "type": "ARRAY",
                                        "items": {
                                            "type": "OBJECT",
                                            "properties": {
                                                "title": {"type": "STRING"},
                                                "preCondition": {"type": "STRING"},
                                                "inputData": {"type": "STRING"},
                                                "steps": {"type": "ARRAY", "items": {"type": "STRING"}},
                                                "expectedResult": {"type": "STRING"}
                                            },
                                            "required": ["title", "preCondition", "inputData", "steps", "expectedResult"]
                                        }
                                    }
                                },
                                "required": ["title", "description", "testCases"]
                            }
                        }
                    },
                    "required": ["scenarios"]
                }
            )
        )
        
        print("4. Received Response from Gemini. Parsing...", flush=True)
        raw_text = response.text
        if raw_text.startswith("```json"):
            raw_text = raw_text.replace("```json", "", 1).replace("```", "", 1)
        elif raw_text.startswith("```"):
            raw_text = raw_text.replace("```", "", 1).replace("```", "", 1)

        result = json.loads(raw_text)
        
        # Validating structure manually to avoid strict Pydantic crash if possible
        # or relying on Pydantic's error mapping
        
        return ScenarioGenerationResponse(scenarios=result.get('scenarios', []))

    except Exception as e:
        import traceback
        trace_str = traceback.format_exc()
        print(f"Scenario Generation Error: {e}")
        with open("logs/scenarios/last_gen_error.log", "w", encoding="utf-8") as f:
            f.write(trace_str)
        raise HTTPException(500, f"Generation Error: {str(e)}")

# --- PERSISTENCE CRUD ---

from app.models.test import Scenario as ScenarioModel
from app.db.session import SessionLocal

@router.get("/", response_model=List[Scenario])
def get_scenarios(
    project_id: str,
    pending_asset: bool = False,
    db: Any = Depends(deps.get_db)
):
    """
    Get scenarios for a project.
    If pending_asset is True, return only approved scenarios NOT linked to a golden script.
    """
    query = db.query(ScenarioModel).filter(ScenarioModel.project_id == project_id)
    
    if pending_asset:
        query = query.filter(
            ScenarioModel.is_approved == True,
            ScenarioModel.golden_script_id == None
        )
    
    scenarios = query.all()
    # Convert DB model to Pydantic
    results = []
    for s in scenarios:
        try:
            results.append(Scenario(
                id=s.id,
                title=s.title,
                description=s.description or "",
                testCases=s.test_cases or [],
                project_id=s.project_id,
                persona_id=s.persona_id,
                is_approved=s.is_approved if s.is_approved is not None else False,
                golden_script_id=s.golden_script_id,
                created_at=s.created_at,  # Pydantic should handle DateTime
                tags=s.tags if s.tags is not None else []
            ))
        except Exception as e:
            print(f"Skipping malformed scenario {s.id}: {e}")
            continue
    return results

class CreateScenarioRequest(BaseModel):
    id: str
    project_id: str
    title: str
    description: str
    testCases: List[TestCase]
    persona_id: str
    is_approved: bool = True
    created_at: Any = None
    tags: List[str] = []

@router.post("/", response_model=Scenario)
def create_scenario(
    *,
    db: Any = Depends(deps.get_db),
    scenario_in: CreateScenarioRequest
):
    """
    Save specific scenario (e.g. on Approval).
    """
    try:
        db_obj = ScenarioModel(
            id=scenario_in.id,
            project_id=scenario_in.project_id,
            title=scenario_in.title,
            description=scenario_in.description,
            test_cases=[tc.dict() for tc in scenario_in.testCases], # Store as JSON
            persona_id=scenario_in.persona_id,
            is_approved=scenario_in.is_approved
        )
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        
        return Scenario(
            id=db_obj.id,
            title=db_obj.title,
            description=db_obj.description,
            testCases=db_obj.test_cases,
            project_id=db_obj.project_id,
            persona_id=db_obj.persona_id,
            is_approved=db_obj.is_approved
        )
    except Exception as e:
        import traceback
        import os
        trace_str = traceback.format_exc()
        print(f"Scenario Creation Error: {e}")
        os.makedirs("logs/scenarios", exist_ok=True)
        with open("logs/scenarios/creation_error.log", "w", encoding="utf-8") as f:
            f.write(trace_str)
        raise HTTPException(500, f"Creation Error: {str(e)}")

class UpdateScenarioRequest(BaseModel):
    golden_script_id: str = None
    is_approved: bool = None

@router.put("/{scenario_id}", response_model=Any) # Return simple dict or model
def update_scenario(
    scenario_id: str,
    update_in: UpdateScenarioRequest,
    db: Any = Depends(deps.get_db)
):
    """
    Update scenario (e.g. link to Golden Script).
    """
    s = db.query(ScenarioModel).filter(ScenarioModel.id == scenario_id).first()
    if not s:
        raise HTTPException(404, "Scenario not found")
        
    if update_in.golden_script_id is not None:
        s.golden_script_id = update_in.golden_script_id
    if update_in.is_approved is not None:
        s.is_approved = update_in.is_approved
        
    db.commit()
    return {"status": "success", "id": s.id}
