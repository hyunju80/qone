from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel
from .persona import Persona

class TestCase(BaseModel):
    id: str
    title: str
    description: Optional[str] = ""
    status: Optional[str] = "pending"
    preCondition: Optional[str] = ""
    inputData: Optional[str] = ""
    steps: List[str] = []
    expectedResult: Optional[str] = ""

class ScenarioBase(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    test_cases: Optional[List[TestCase]] = []
    tags: Optional[List[str]] = []
    is_approved: Optional[bool] = False
    platform: Optional[str] = "WEB"
    target: Optional[str] = None
    persona_id: Optional[str] = None

class ScenarioCreate(ScenarioBase):
    title: str
    project_id: str

class ScenarioUpdate(ScenarioBase):
    pass

class ScenarioInDBBase(ScenarioBase):
    id: str
    project_id: str
    persona_id: Optional[str] = None
    golden_script_id: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

class Scenario(ScenarioInDBBase):
    persona: Optional[Persona] = None

class ActionMapBase(BaseModel):
    url: Optional[str] = None
    title: Optional[str] = None
    map_json: Optional[Dict[str, Any]] = None

class ActionMapCreate(ActionMapBase):
    project_id: str
    url: str
    title: str
    map_json: Dict[str, Any]

class ActionMapUpdate(ActionMapBase):
    pass

class ActionMap(ActionMapBase):
    id: str
    project_id: str
    created_at: datetime

    class Config:
        from_attributes = True
