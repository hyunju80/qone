from typing import List, Optional, Any, Dict, Union
from pydantic import BaseModel

class ChatMessage(BaseModel):
    role: str # 'user' or 'model'
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    context: Optional[str] = None # Optional context about current project/view

class ChatResponse(BaseModel):
    text: Optional[str] = None
    function_call: Optional[Dict[str, Any]] = None # Name and args
    report_data: Optional[Dict[str, Any]] = None # For frontend rendering
    error: Optional[str] = None

class TestDataRow(BaseModel):
    field: str
    value: str
    type: str # 'VALID', 'INVALID', 'SECURITY', etc.
    description: str

class DataGenerationRequest(BaseModel):
    scenarios: List[Dict[str, Any]] # title, description, inputData, etc.
    data_types: List[str] # ['VALID', 'INVALID']
    count: int = 1

class DataGenerationResponse(BaseModel):
    data: List[TestDataRow]
    error: Optional[str] = None
