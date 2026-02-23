from typing import Any, List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.api import deps

router = APIRouter()

@router.get("/", response_model=List[schemas.TestScript])
def read_scripts(
    db: Session = Depends(deps.get_db),
    project_id: str = "",
    skip: int = 0,
    limit: int = 100,
    current_user: models.User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Retrieve scripts. Filter by project_id is recommended.
    """
    if project_id:
        return crud.script.get_by_project(db, project_id=project_id, skip=skip, limit=limit)
    # If no project_id, maybe list all accessible (complex)? 
    # For now return none to encourage filtering or all if admin
    if current_user.is_saas_super_admin:
        return crud.script.get_multi(db, skip=skip, limit=limit)
    return []

@router.post("/", response_model=schemas.TestScript)
def create_script(
    *,
    db: Session = Depends(deps.get_db),
    script_in: schemas.TestScriptCreate,
    current_user: models.User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Create new script.
    """
    script = crud.script.create(db, obj_in=script_in)
    return script

@router.put("/{script_id}", response_model=schemas.TestScript)
def update_script(
    *,
    db: Session = Depends(deps.get_db),
    script_id: str,
    script_in: schemas.TestScriptUpdate,
    current_user: models.User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Update a script.
    """
    script = crud.script.get(db, id=script_id)
    if not script:
        raise HTTPException(status_code=404, detail="Script not found")
    script = crud.script.update(db, db_obj=script, obj_in=script_in)
    return script

from pydantic import BaseModel
class GenerateScriptRequest(BaseModel):
    scenarios: List[Any] # Flexible validation
    persona: dict
    projectContext: str = ""
    projectId: str = ""

class GenerateScriptResponse(BaseModel):
    code: str
    tags: List[str]

@router.post("/generate", response_model=GenerateScriptResponse)
async def generate_script(
    request: GenerateScriptRequest,
    current_user: models.User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Generate Playwright script from scenarios using Gemini.
    """
    from app.core.config import settings
    if not settings.GOOGLE_API_KEY:
        raise HTTPException(500, "Server Configuration Error: GOOGLE_API_KEY is missing.")

    import json
    from google import genai
    from google.genai import types

    try:
        # Fetch Project to get configuration
        project = None
        base_urls = "Not Context."
        if request.projectId:
            project = crud.project.get(db=deps.get_db().__next__(), id=request.projectId)
            if project and project.environments:
                # Format: {'Development': 'url', 'Production': 'url'}
                base_urls = json.dumps(project.environments, indent=2)

        client = genai.Client(api_key=settings.GOOGLE_API_KEY)

        prompt = f"""
        You are an Expert playwright Automation Engineer.
        Convert the following Test Scenarios into a flexible, robust Playwright (Python) Test Script.

        PROJECT CONTEXT:
        {request.projectContext}

        BASE URLS (Use these as `base_url` or starting point):
        {base_urls}

        USER PERSONA:
        name: {request.persona.get('name')}
        goal: {request.persona.get('goal')}

        [Few-Shot Example (Style Reference)]
        ```python
        def test_skt_brand_navigation(page: Page):
            # 1. Navigate
            page.goto("https://sktmembership.tworld.co.kr/")
            
            # 2. Interact (Use get_by_role where possible)
            # "혜택 브랜드" link might appear multiple times, use .first if needed
            menu_link = page.get_by_role("link", name="혜택 브랜드").first
            expect(menu_link).to_be_visible(timeout=10000)
            menu_link.click()
            
            # 3. Verify
            page.wait_for_load_state("networkidle")
            assert "혜택 브랜드" in page.title() or page.url != "about:blank"
        ```

        SCENARIOS TO IMPLEMENT:
        {json.dumps(request.scenarios, ensure_ascii=False, indent=2)}

        [Coding Standards]
        1. Use 'playwright.sync_api' and 'pytest' style.
        2. Handle authentications if mentioned (assume login helper exists or write inline).
        3. Use Robust Selectors (Locators).
           - IF 'selectors' field is provided in the scenario test cases, USE THEM directly.
           - Otherwise, infer best locators (ID > Name > TestId > Text).
        4. Add comprehensive assertions.
           - For example, 'assert "혜택 브랜드" in page.title() or page.url != "about:blank"'.
        5. Return ONLY the Python code block (no markdown).
        6. Also suggest 3-5 tags for this script.

        Output JSON format:
        {{
            "code": "import pytest...",
            "tags": ["tag1", "tag2"]
        }}
        """

        response = await client.aio.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema={
                    "type": "OBJECT",
                    "properties": {
                        "code": {"type": "STRING"},
                        "tags": {"type": "ARRAY", "items": {"type": "STRING"}}
                    },
                    "required": ["code", "tags"]
                }
            )
        )

        raw_text = response.text
        if raw_text.startswith("```json"):
            raw_text = raw_text.replace("```json", "", 1).replace("```", "", 1)
        elif raw_text.startswith("```"):
            raw_text = raw_text.replace("```", "", 1).replace("```", "", 1)
            
        result = json.loads(raw_text)
        return GenerateScriptResponse(code=result['code'], tags=result['tags'])

    except Exception as e:
        print(f"Script Generation Error: {e}")
        raise HTTPException(500, f"Generation Error: {str(e)}")
