from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel

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
    test_cases: Optional[List[TestCase]] = []
    tags: Optional[List[str]] = []
    is_approved: Optional[bool] = False

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
    pass
