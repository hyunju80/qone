from typing import Any, List
import os
import os
# from google.generativeai import ... (Removed) 
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app import crud, models, schemas
from app.api import deps



router = APIRouter()

# --- Tool Definitions ---
from app.core.config import settings

def get_golden_scripts(filter_tag: str = None):
    """Get the list of all certified Golden Script test assets."""
    # This is a placeholder for actual DB logic. 
    # Since we can't easily pass the DB session into this function when called by Gemini,
    # we usually execute logic *after* Gemini returns the function call request.
    pass

def get_test_schedules():
    """List the currently active/configured recurring test jobs."""
    pass

def create_test_schedule(name: str, scriptNames: List[str], cronExpression: str, frequencyLabel: str):
    """Create a new automated test schedule (Batch Job)."""
    pass

def summarize_test_results(reportType: str):
    """Summarize past execution outcomes/reports with key metrics. reportType: 'failures' or 'all'."""
    pass

def recommend_tests(keyword: str):
    """Suggest relevant tests based on functional area or keyword/tag."""
    pass

def run_test_script(scriptName: str):
    """Trigger immediate execution of a test script."""
    pass

tools_list = [
    get_golden_scripts,
    get_test_schedules,
    create_test_schedule,
    summarize_test_results,
    recommend_tests,
    run_test_script
]

@router.post("/chat", response_model=schemas.ChatResponse)
async def chat_with_oracle(
    *,
    db: Session = Depends(deps.get_db),
    chat_in: schemas.ChatRequest,
    current_user: models.User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Chat with Oracle (Gemini).
    """
    if not settings.GOOGLE_API_KEY:
        return schemas.ChatResponse(error="Server Configuration Error: GOOGLE_API_KEY is missing.")

    try:
        from google import genai
        from google.genai import types
        
        client = genai.Client(api_key=settings.GOOGLE_API_KEY)
        
        # Convert History
        # New SDK expects 'contents' list for context if not using ChatSession, 
        # or we just make a single generation call with full history if we want stateless (which this endpoint seems to be, effectively)
        # But this endpoint takes whole history? "chat_in.messages". 
        # Yes, it rebuilds history every time.
        
        contents = []
        for msg in chat_in.messages[:-1]:
            role = 'user' if msg.role == 'user' else 'model'
            contents.append(types.Content(role=role, parts=[types.Part.from_text(text=msg.content)]))
            
        last_msg_text = chat_in.messages[-1].content
        if chat_in.context:
            last_msg_text = f"Context: {chat_in.context}\n\nUser Request: {last_msg_text}"
            
        contents.append(types.Content(role='user', parts=[types.Part.from_text(text=last_msg_text)]))

        # Config with Tools
        # The new SDK supports passing python functions directly in `tools` list in the config.
        # It automatically extracts schemas.
        
        config = types.GenerateContentConfig(
            tools=tools_list,
            temperature=0.7
        )
        
        # Determine model
        model_name = settings.GEMINI_MODEL
        
        response = await client.aio.models.generate_content(
            model=model_name,
            contents=contents,
            config=config
        )
        
        # Check for function calls
        # response.candidates[0].content.parts[0].function_call
        
        if not response.candidates:
             return schemas.ChatResponse(error="No response candidates from Gemini.")
             
        # Helper extraction
        part = response.candidates[0].content.parts[0]
        fc = part.function_call
        
        if fc:
            fname = fc.name
            fargs = fc.args # expected to be dict-like or object
            
            # Simple handling for specific read-only tools
            if fname in ['get_golden_scripts', 'get_test_schedules', 'recommend_tests', 'summarize_test_results']:
                 return schemas.ChatResponse(
                    text=None,
                    function_call={"name": fname, "args": fargs}
                )
            
            elif fname in ['create_test_schedule', 'run_test_script']:
                return schemas.ChatResponse(
                    text=None,
                    function_call={"name": fname, "args": fargs}
                )
                
            # Fallback if unhandled function
            return schemas.ChatResponse(text=f"[System] Call {fname} detected but not handled.")
            
        # Text response
        return schemas.ChatResponse(text=part.text)

    except Exception as e:
        import traceback
        trace = traceback.format_exc()
        print(f"Gemini Error: {e}\n{trace}")
        return schemas.ChatResponse(error=str(e))

@router.post("/generate-data", response_model=schemas.DataGenerationResponse)
async def generate_test_data(
    *,
    request: schemas.DataGenerationRequest,
    current_user: models.User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Generate synthetic test data based on scenarios using Gemini.
    """
    if not settings.GOOGLE_API_KEY:
        return schemas.DataGenerationResponse(data=[], error="Server Configuration Error: GOOGLE_API_KEY is missing.")

    try:
        from google import genai
        from google.genai import types
        import json

        client = genai.Client(api_key=settings.GOOGLE_API_KEY)

        # Construct Prompt
        scenarios_text = json.dumps(request.scenarios, indent=2)
        data_types_text = ", ".join(request.data_types)
        
        prompt = f"""
        Act as a Test Data Engineer. Generate synthetic test data for the following test scenarios.
        
        Target Scenarios:
        {scenarios_text}
        
        Required Data Types: {data_types_text}
        
        Output Format: JSON Array of Objects with keys: 'field', 'value', 'type', 'description'.
        
        Constraints:
        1. 'field' should match the input fields mentioned in the scenarios.
        2. 'type' should be one of the required data types.
        3. 'value' should be realistic and appropriate for the type.
        4. 'description' should explain why this value is chosen (e.g., "Valid email format", "SQL Injection pattern").
        5. Generate at least {request.count} variations per field/type if applicable, but aim for a comprehensive set.
        
        Example Output:
        [
            {{ "field": "email", "value": "test@example.com", "type": "VALID", "description": "Standard valid email" }},
            {{ "field": "age", "value": "-1", "type": "INVALID", "description": "Negative age boundary value" }}
        ]
        
        Return ONLY the JSON array.
        """

        response = client.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json"
            )
        )
        
        if not response.text:
             return schemas.DataGenerationResponse(data=[], error="No data generated.")

        generated_data = json.loads(response.text)
        
        # Validate/Transform if necessary
        result_data = []
        for item in generated_data:
            result_data.append(schemas.TestDataRow(
                field=item.get('field', 'unknown'),
                value=str(item.get('value', '')),
                type=item.get('type', 'VALID'),
                description=item.get('description', '')
            ))
            
        return schemas.DataGenerationResponse(data=result_data)

    except Exception as e:
        print(f"Data Generation Error: {e}")
        return schemas.DataGenerationResponse(data=[], error=str(e))
