from typing import Any, List, Optional, Dict
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
import json
from app.api import deps
from app.services.crawler import CrawlerService
from app.services.action_mapper import action_mapper
from app.core.config import settings
import json
import os
from datetime import datetime
import traceback
from app.models.test import Scenario as ScenarioModel, ActionMap as ActionMapModel
from app.schemas.scenario import (
    ActionMap as ActionMapSchema, 
    ActionMapCreate, 
    ActionMapUpdate,
    ScenarioUpdate as UpdateScenarioRequest,
    Scenario as ScenarioSchema
)
from app.db.session import SessionLocal
import uuid

router = APIRouter()
crawler = CrawlerService()
# import nest_asyncio
# nest_asyncio.apply()

@router.get("/", response_model=List[ScenarioSchema])
def read_scenarios(
    db: Any = Depends(deps.get_db),
    project_id: Optional[str] = None,
    is_approved: Optional[bool] = None,
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """
    Retrieve scenarios.
    """
    query = db.query(ScenarioModel)
    if project_id:
        query = query.filter(ScenarioModel.project_id == project_id)
    if is_approved is not None:
        query = query.filter(ScenarioModel.is_approved == is_approved)
    
    return query.offset(skip).limit(limit).all()

class AnalyzeUrlRequest(BaseModel):
    url: str
    prompt: Optional[str] = None
    project_id: Optional[str] = None
    persona_id: Optional[str] = None

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
    platform: Optional[str] = "WEB"
    target: Optional[str] = None
    tags: List[str] = []
    category: Optional[str] = None
    try_count: Optional[int] = 1
    enable_ai_test: Optional[bool] = False



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
    db: Any = Depends(deps.get_db),
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

        categories_context = ""
        if request.project_id:
            from app.models.project import Project
            from app.schemas.project import Project as ProjectSchema
            proj = db.query(Project).filter(Project.id == request.project_id).first()
            if proj:
                pschema = ProjectSchema.model_validate(proj)
                if pschema.categories:
                    cats_str = ", ".join([f"'{c.name}'" + (f" (Desc: {c.description})" if c.description else "") for c in pschema.categories])
                    categories_context = f"\n\n[Project Categories Context]\nThis project uses the following predefined categories for taxonomy: {cats_str}.\nYou MUST carefully assign exactly one of these categories to each generated scenario based on its purpose. If none fit perfectly, pick the closest match. Put this value in the 'category' field."

        persona_context = ""
        if request.persona_id:
            from app.models.test import Persona
            persona = db.query(Persona).filter(Persona.id == request.persona_id).first()
            if persona:
                persona_context = f"\n\n[Testing Persona Context]\nYou are acting as the following user persona:\n- Name: {persona.name}\n- Goal: {persona.description}\n- Skill Level: {persona.skill_level}\n\n[Instruction]\nTailor the test scenarios and steps to match this persona's perspective, knowledge level, and specific testing goals. Provide thoughts and edge cases that this persona would likely find important."

        # 3. Construct Prompt for ONE-STEP Generation
        system_prompt = """You are an Expert QA Automation Engineer.
            Analyze the provided web page context (Screenshot + DOM Structure).
            
            First, internally identify critical business flows and functional features.
            Then, DIRECTLY design a comprehensive Test Scenario Suite based on those findings.

            [CRITICAL INSTRUCTION]
            The generated 'steps' MUST NOT be implementation-specific UI actions (e.g., "Click button X", "Type Y into field").
            Instead, the 'steps' MUST be high-level User Intents or Business Logic goals (e.g., "Authenticate as an Admin", "Navigate to the billing section").
            These scenarios will be executed by an Autonomous AI Browser Agent that will figure out the actual UI interactions on its own. Focus strictly on WHAT needs to be done and verified, not HOW to do it.

            [Design Rules]
            1. Output must be a valid JSON object with a single key 'scenarios'.
            2. 'scenarios' is a list of objects, each MUST have:
               - "title": (string) Scenario Name
               - "description": (string) Purpose
               - "category": (string) The specific domain module or division this scenario belongs to (e.g., "Authentication", "Checkout").
               - "testCases": (list of objects)
            3. Each "testCases" item MUST have:
               - "title": (string) Case Name
               - "preCondition": (string)
               - "inputData": (string)
               - "steps": (list of strings) - High-level intents only!
               - "expectedResult": (string)
               - "selectors": (list of objects) List of { "name": "ElementName", "value": "CSS/XPath" }

            [Selector Strategy]
            - Analyze the DOM structure deeply to find robust selectors for Key elements.
            - Prioritize finding SPECIFIC functional elements (e.g. Navigation Links, GNB items, Submit Buttons).
            - Prefer ID > Name > TestId > CSS Classes > XPath.
            - Ensure selectors are unique and precise.

            Return the result as a JSON object with a 'scenarios' array.
            Language: Korean.
            """
            
        if request.prompt:
            system_prompt += f"\n\n[Additional User Context]\n{request.prompt}"
        
        system_prompt += categories_context
        system_prompt += persona_context

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
                response_json_schema={
                    "type": "OBJECT",
                    "properties": {
                        "scenarios": {
                            "type": "ARRAY",
                            "items": {
                                "type": "OBJECT",
                                "properties": {
                                    "title": {"type": "STRING"},
                                    "description": {"type": "STRING"},
                                    "category": {"type": "STRING"},
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
        raise HTTPException(500, f"Generation Error: {str(e)}")

# --- Action Map Persistence ---

@router.post("/maps", response_model=ActionMapSchema)
def save_action_map(
    *,
    db: Any = Depends(deps.get_db),
    map_in: ActionMapCreate
):
    db_obj = ActionMapModel(
        id=f"map_{uuid.uuid4().hex[:8]}",
        project_id=map_in.project_id,
        url=map_in.url,
        title=map_in.title,
        map_json=map_in.map_json
    )
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj

@router.get("/maps", response_model=List[ActionMapSchema])
def list_action_maps(
    project_id: str,
    db: Any = Depends(deps.get_db)
):
    return db.query(ActionMapModel).filter(ActionMapModel.project_id == project_id).all()

@router.delete("/maps/{map_id}")
def delete_action_map(
    map_id: str,
    db: Any = Depends(deps.get_db)
):
    db_obj = db.query(ActionMapModel).filter(ActionMapModel.id == map_id).first()
    if not db_obj:
        raise HTTPException(404, "Map not found")
    db.delete(db_obj)
    db.commit()
    return {"status": "success"}

@router.put("/maps/{map_id}", response_model=ActionMapSchema)
def update_action_map(
    *,
    db: Any = Depends(deps.get_db),
    map_id: str,
    map_in: ActionMapUpdate
):
    db_obj = db.query(ActionMapModel).filter(ActionMapModel.id == map_id).first()
    if not db_obj:
        raise HTTPException(404, "Map not found")
    
    update_data = map_in.dict(exclude_unset=True)
    for field in update_data:
        setattr(db_obj, field, update_data[field])
    
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj


# --- UPLOAD ANALYSIS ENDPOINT (ONE-STEP) ---

class UploadedFile(BaseModel):
    name: str
    type: str  # mime type
    data: str  # base64 encoded content

class AnalyzeUploadRequest(BaseModel):
    files: List[UploadedFile]
    prompt: str = ""
    project_id: Optional[str] = None
    persona_id: Optional[str] = None

@router.post("/analyze-upload", response_model=AnalyzeUrlResponse)
async def analyze_upload(
    *,
    request: AnalyzeUploadRequest,
    db: Any = Depends(deps.get_db),
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

        categories_context = ""
        if request.project_id:
            from app.models.project import Project
            from app.schemas.project import Project as ProjectSchema
            proj = db.query(Project).filter(Project.id == request.project_id).first()
            if proj:
                pschema = ProjectSchema.model_validate(proj)
                if pschema.categories:
                    cats_str = ", ".join([f"'{c.name}'" + (f" (Desc: {c.description})" if c.description else "") for c in pschema.categories])
                    categories_context = f"\n\n[Project Categories Context]\nThis project uses the following predefined categories for taxonomy: {cats_str}.\nYou MUST carefully assign exactly one of these categories to each generated scenario based on its purpose. If none fit perfectly, pick the closest match. Put this value in the 'category' field."

        persona_context = ""
        if request.persona_id:
            from app.models.test import Persona
            persona = db.query(Persona).filter(Persona.id == request.persona_id).first()
            if persona:
                persona_context = f"\n\n[Testing Persona Context]\nYou are acting as the following user persona:\n- Name: {persona.name}\n- Goal: {persona.description}\n- Skill Level: {persona.skill_level}\n\n[Instruction]\nTailor the test scenarios and steps to match this persona's perspective, knowledge level, and specific testing goals."
        
        # 3. Construct Prompt
        prompt_parts = []
        system_prompt = """You are an Expert QA Automation Engineer.
            Analyze the provided user uploads (Images/Mockups/Specs).
            
            First, internally understand the features and requirements.
            Then, DIRECTLY design a comprehensive Test Scenario Suite.
            
            [CRITICAL INSTRUCTION]
            The generated 'steps' MUST NOT be implementation-specific UI actions (e.g., "Click button X", "Type Y into field").
            Instead, the 'steps' MUST be high-level User Intents or Business Logic goals (e.g., "Authenticate as an Admin", "Navigate to the billing section").
            These scenarios will be executed by an Autonomous AI Browser Agent that will figure out the actual UI interactions on its own. Focus strictly on WHAT needs to be done and verified, not HOW to do it.

            [Design Rules]
            1. Output must be a valid JSON object with a single key 'scenarios'.
            2. 'scenarios' is a list of objects, each MUST have:
               - "title": (string) Scenario Name
               - "description": (string) Purpose
               - "category": (string) The specific domain module or division this scenario belongs to (e.g., "Authentication", "Checkout").
               - "testCases": (list of objects)
            3. Each "testCases" item MUST have:
               - "title": (string) Case Name
               - "preCondition": (string)
               - "inputData": (string)
               - "steps": (list of strings) - High-level intents only!
               - "expectedResult": (string)

            Return the result as a JSON object with a 'scenarios' array.
            Language: Korean.
            """
        prompt_parts.append(system_prompt)
        
        if request.prompt:
            prompt_parts.append(f"Additional User Context: {request.prompt}")
            
        prompt_parts.append(categories_context)
        if persona_context:
            prompt_parts.append(persona_context)

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

        for p in prompt_parts:
            if isinstance(p, str):
                print(f"DEBUG_PROMPT_PART (String): {p[:500]}...", flush=True)
            else:
                print(f"DEBUG_PROMPT_PART (Part): {type(p)}", flush=True)

        # 4. Generate Content
        response = await client.aio.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=prompt_parts,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_json_schema={
                    "type": "OBJECT",
                    "properties": {
                        "scenarios": {
                            "type": "ARRAY",
                            "items": {
                                "type": "OBJECT",
                                "properties": {
                                    "title": {"type": "STRING"},
                                    "description": {"type": "STRING"},
                                    "category": {"type": "STRING"},
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
        print(f"DEBUG_GENERATED_JSON: {json.dumps(result, ensure_ascii=False, indent=2)}", flush=True)
        
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
    project_id: Optional[str] = None

# Definitions moved to top of file

class ScenarioGenerationResponse(BaseModel):
    scenarios: List[Scenario]

@router.post("/generate-scenarios", response_model=ScenarioGenerationResponse)
async def generate_scenarios(
    *,
    request: ScenarioGenerationRequest,
    db: Any = Depends(deps.get_db),
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

        categories_context = ""
        if request.project_id:
            from app.models.project import Project
            from app.schemas.project import Project as ProjectSchema
            proj = db.query(Project).filter(Project.id == request.project_id).first()
            if proj:
                pschema = ProjectSchema.model_validate(proj)
                if pschema.categories:
                    cats_str = ", ".join([f"'{c.name}'" + (f" (Desc: {c.description})" if c.description else "") for c in pschema.categories])
                    categories_context = f"\n[Project Categories Context]\nThis project uses the following predefined categories for taxonomy: {cats_str}.\nYou MUST carefully assign exactly one of these categories to each generated scenario based on its purpose. If none fit perfectly, pick the closest match. Put this value in the 'category' field."

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
        
        {categories_context}

        [CRITICAL INSTRUCTION]
        The generated 'steps' MUST NOT be implementation-specific UI actions (e.g., "Click button X", "Type Y into field").
        Instead, the 'steps' MUST be high-level User Intents or Business Logic goals (e.g., "Authenticate as an Admin", "Navigate to the billing section").
        These scenarios will be executed by an Autonomous AI Browser Agent that will figure out the actual UI interactions on its own. Focus strictly on WHAT needs to be done and verified, not HOW to do it.

        [Design Rules]
        1. Output must be a valid JSON object with a single key 'scenarios'.
        2. 'scenarios' is a list of objects, each MUST have:
           - "title": (string) Scenario Name
           - "description": (string) Purpose
           - "category": (string) The specific domain module or division this scenario belongs to.
           - "testCases": (list of objects)
        3. Each "testCases" item MUST have:
           - "title": (string) Case Name
           - "preCondition": (string)
           - "inputData": (string)
           - "steps": (list of strings) - High-level intents only!
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
                response_json_schema={
                    "type": "OBJECT",
                    "properties": {
                        "scenarios": {
                            "type": "ARRAY",
                            "items": {
                                "type": "OBJECT",
                                "properties": {
                                    "title": {"type": "STRING"},
                                    "description": {"type": "STRING"},
                                    "category": {"type": "STRING"},
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

class AnalyzeKnowledgeRequest(BaseModel):
    item_ids: List[str]
    prompt: str = ""
    project_id: str
    persona_id: Optional[str] = None

@router.post("/analyze-knowledge", response_model=AnalyzeUrlResponse)
async def analyze_knowledge(
    *,
    request: AnalyzeKnowledgeRequest,
    db: Any = Depends(deps.get_db),
) -> Any:
    """
    Generate scenarios from selected KnowledgeItems (RAG).
    """
    if not settings.GOOGLE_API_KEY:
        raise HTTPException(500, "Server Configuration Error: GOOGLE_API_KEY is missing.")

    try:
        # 1. Fetch KnowledgeItems
        from app.models.knowledge import KnowledgeItem
        items = db.query(KnowledgeItem).filter(KnowledgeItem.id.in_(request.item_ids)).all()
        
        if not items:
            raise HTTPException(400, "No valid KnowledgeItems found for the given IDs.")

        # 2. Extract and merge content
        knowledge_context = ""
        for it in items:
            # Construct a descriptive header for each item
            header = f"\n[Document Item: {it.title or 'Untitled'}]"
            path_info = f"\nPath: {it.classification or ''} > {it.depth_1 or ''} > {it.depth_2 or ''} > {it.depth_3 or ''}"
            
            # Get description from content JSON
            description = ""
            if isinstance(it.content, dict):
                description = it.content.get("Description", it.content.get("raw_text_snippet", ""))
            
            knowledge_context += f"{header}{path_info}\nDescription: {description}\n"

        persona_context = ""
        if request.persona_id:
            from app.models.test import Persona
            persona = db.query(Persona).filter(Persona.id == request.persona_id).first()
            if persona:
                persona_context = f"\n\n[Testing Persona Context]\nYou are acting as the following user persona:\n- Name: {persona.name}\n- Goal: {persona.description}\n- Skill Level: {persona.skill_level}\n\n[Instruction]\nTailor the test scenarios and steps to match this persona's perspective and expertise."

        # 3. Call Gemini
        from google import genai
        from google.genai import types
        client = genai.Client(api_key=settings.GOOGLE_API_KEY)

        system_prompt = f"""You are an Expert QA Automation Engineer.
            Analyze the following technical documentation retrieved from the project's Knowledge Repository.
            Your goal is to design a comprehensive Test Scenario Suite based strictly on these requirements.

            [TECHNICAL DOCUMENTATION]
            {knowledge_context}

            [CRITICAL INSTRUCTION]
            The generated 'steps' MUST NOT be implementation-specific UI actions.
            Instead, the 'steps' MUST be high-level User Intents or Business Logic goals.
            Language: Korean.
            """

        if request.prompt:
            system_prompt += f"\n\n[Additional User Context]\n{request.prompt}"

        if persona_context:
            system_prompt += persona_context

        response = await client.aio.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=system_prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_json_schema={
                    "type": "OBJECT",
                    "properties": {
                        "scenarios": {
                            "type": "ARRAY",
                            "items": {
                                "type": "OBJECT",
                                "properties": {
                                    "title": {"type": "STRING"},
                                    "description": {"type": "STRING"},
                                    "category": {"type": "STRING"},
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
        
        result = json.loads(response.text)
        return AnalyzeUrlResponse(
            scenarios=result.get('scenarios', []),
            dom_context=""
        )

    except Exception as e:
        import traceback
        trace_str = traceback.format_exc()
        print(f"Knowledge Analysis Error: {e}\n{trace_str}")
        raise HTTPException(500, f"Error: {str(e)}")

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
                platform=s.platform or "WEB",
                target=s.target,
                created_at=s.created_at,  # Pydantic should handle DateTime
                tags=s.tags if s.tags is not None else [],
                category=s.category
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
    category: Optional[str] = None
    testCases: List[TestCase]
    persona_id: str
    is_approved: bool = True
    platform: Optional[str] = "WEB"
    target: Optional[str] = None
    tags: List[str] = []
    try_count: Optional[int] = 1
    enable_ai_test: Optional[bool] = False

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
            category=scenario_in.category,
            test_cases=[tc.dict() for tc in scenario_in.testCases], # Store as JSON
            persona_id=scenario_in.persona_id,
            is_approved=scenario_in.is_approved,
            platform=scenario_in.platform,
            target=scenario_in.target,
            tags=scenario_in.tags or []
        )
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        
        return Scenario(
            id=db_obj.id,
            title=db_obj.title,
            description=db_obj.description,
            category=db_obj.category,
            testCases=db_obj.test_cases,
            project_id=db_obj.project_id,
            persona_id=db_obj.persona_id,
            is_approved=db_obj.is_approved,
            platform=db_obj.platform,
            target=db_obj.target
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
    if update_in.try_count is not None:
        s.try_count = update_in.try_count
    if update_in.enable_ai_test is not None:
        s.enable_ai_test = update_in.enable_ai_test
    if update_in.category is not None:
        s.category = update_in.category
    if update_in.title is not None:
        s.title = update_in.title
    if update_in.description is not None:
        s.description = update_in.description
    if update_in.tags is not None:
        s.tags = update_in.tags
        
    db.commit()
    return {"status": "success", "id": s.id}

class MapActionFlowRequest(BaseModel):
    url: str
    max_depth: int = 1
    max_siblings: int = 30
    exclude_selectors: Optional[List[str]] = None
    include_selector: Optional[str] = None
    content_selector: Optional[str] = None

class GenerateFromMapRequest(BaseModel):
    action_map: Dict[str, Any]
    prompt: Optional[str] = None
    project_id: Optional[str] = None
    persona_id: Optional[str] = None

@router.post("/map-action-flow")
async def map_action_flow(req: MapActionFlowRequest):
    try:
        result = await action_mapper.map_url(
            url=req.url, 
            max_depth=req.max_depth, 
            max_siblings=req.max_siblings, 
            exclude_selectors=req.exclude_selectors, 
            include_selector=req.include_selector,
            content_selector=req.content_selector
        )
        return {"status": "success", "map": result}
    except Exception as e:
        raise HTTPException(500, f"Mapping Error: {str(e)}")

@router.post("/generate-from-map", response_model=AnalyzeUrlResponse)
async def generate_from_map(
    *,
    request: GenerateFromMapRequest,
    db: Any = Depends(deps.get_db),
):
    if not settings.GOOGLE_API_KEY:
        raise HTTPException(500, "Server Configuration Error: GOOGLE_API_KEY is missing.")

    try:
        from google import genai
        from google.genai import types
        client = genai.Client(api_key=settings.GOOGLE_API_KEY)

        categories_context = ""
        if request.project_id:
            from app.models.project import Project
            from app.schemas.project import Project as ProjectSchema
            proj = db.query(Project).filter(Project.id == request.project_id).first()
            if proj:
                pschema = ProjectSchema.model_validate(proj)
                if pschema.categories:
                    cats_str = ", ".join([f"'{c.name}'" + (f" (Desc: {c.description})" if c.description else "") for c in pschema.categories])
                    categories_context = f"\n\n[Project Categories Context]\nThis project uses the following predefined categories for taxonomy: {cats_str}.\nYou MUST carefully assign exactly one of these categories to each generated scenario based on its purpose. If none fit perfectly, pick the closest match. Put this value in the 'category' field."

        persona_context = ""
        if request.persona_id:
            from app.models.test import Persona
            persona = db.query(Persona).filter(Persona.id == request.persona_id).first()
            if persona:
                persona_context = f"\n\n[Testing Persona Context]\nYou are acting as the following user persona:\n- Name: {persona.name}\n- Goal: {persona.description}\n- Skill Level: {persona.skill_level}\n\n[Instruction]\nTailor the test cases to match this persona's perspective and expertise. If the persona is an 'Expert', generate more rigorous and detailed edge cases."

        system_prompt = """You are an Expert QA Automation Engineer.
            Analyze the provided JSON 'Action Flow Map' which details the interactable elements of a Web Application up to a certain depth.
            
            Based on the User's Intent (if provided) and the Map, directly design a comprehensive Test Scenario Suite.

            [CRITICAL INSTRUCTION - LOCATORS]
            You MUST ONLY use the 'selector' strings exactly as they appear in the Action Flow Map for your test cases. Do not invent or hallucinate CSS locators like '.login-btn' if they aren't in the map.
            If you need to click an element from the map, find its 'selector' in the JSON and place it in the 'selectors' array of the TestCase.
            
            [CRITICAL INSTRUCTION - INTENTS]
            The generated 'steps' MUST NOT be low-level UI actions. The 'steps' MUST be high-level User Intents or Business Logic goals (e.g., "Authenticate as an Admin").
            The AI Runner will use the selectors you provide along with its own context.

            [Design Rules]
            1. Output must be a valid JSON object with a single key 'scenarios'.
            2. 'scenarios' is a list of objects, each MUST have:
               - "title": (string) Scenario Name
               - "description": (string) Purpose
               - "category": (string) Category name
               - "testCases": (list of objects)
            3. Each "testCases" item MUST have:
               - "title": (string) Case Name
               - "preCondition": (string)
               - "inputData": (string) Dataset requirements
               - "steps": (list of strings) - High-level intents only!
               - "expectedResult": (string)
               - "selectors": (list of objects) List of { "name": "Element Purpose", "value": "Exact CSS Selector from JSON Map" }

            Return the result as a JSON object with a 'scenarios' array.
            Language: Korean.
            """
            
        if request.prompt:
            system_prompt += f"\n\n[Additional User Context]\n{request.prompt}"
            
        system_prompt += categories_context
        if persona_context:
            system_prompt += persona_context

        map_json_str = json.dumps(request.action_map, ensure_ascii=False)
        prompt_contents = [
            system_prompt,
            f"Action Flow Map (JSON):\n{map_json_str}"
        ]

        response = await client.aio.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=prompt_contents,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_json_schema={
                    "type": "OBJECT",
                    "properties": {
                        "scenarios": {
                            "type": "ARRAY",
                            "items": {
                                "type": "OBJECT",
                                "properties": {
                                    "title": {"type": "STRING"},
                                    "description": {"type": "STRING"},
                                    "category": {"type": "STRING"},
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
        
        for scenario in result.get('scenarios', []):
            for tc in scenario.get('testCases', []):
                if 'selectors' in tc and isinstance(tc['selectors'], list):
                    tc['selectors'] = {item['name']: item['value'] for item in tc['selectors'] if 'name' in item and 'value' in item}

        return AnalyzeUrlResponse(
            scenarios=result.get('scenarios', []),
            dom_context="[Action Map Used instead of DOM]"
        )

    except Exception as e:
        print(f"Map Generate Error: {e}")
        raise HTTPException(500, f"Error: {str(e)}")
