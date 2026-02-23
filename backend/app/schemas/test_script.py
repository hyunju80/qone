from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel
from .user import User

# Shared properties
class TestScriptBase(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = "PENDING"
    code: Optional[str] = None
    tags: Optional[List[str]] = []
    is_favorite: Optional[bool] = False
    is_active: Optional[bool] = True
    dataset: Optional[List[Dict[str, Any]]] = []
    engine: Optional[str] = "Playwright"
    origin: Optional[str] = "MANUAL"

# Creation
class TestScriptCreate(TestScriptBase):
    name: str
    project_id: str
    code: str

# Update
class TestScriptUpdate(TestScriptBase):
    run_count: Optional[int] = None
    success_rate: Optional[float] = None
    last_run: Optional[datetime] = None

# DB
class TestScriptInDBBase(TestScriptBase):
    id: str
    project_id: str
    last_run: Optional[datetime] = None
    run_count: int = 0
    success_rate: float = 0.0
    persona_id: Optional[str] = None

    class Config:
        from_attributes = True

class TestScript(TestScriptInDBBase):
    pass
