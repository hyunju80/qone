from typing import List, Optional, Any, Dict
from pydantic import BaseModel
from datetime import datetime

class TestObjectBase(BaseModel):
    name: str
    description: Optional[str] = None
    selector_type: str
    value: str
    platform: str = "WEB"
    is_active: bool = True

class TestObjectCreate(TestObjectBase):
    project_id: str

class TestObjectUpdate(TestObjectBase):
    pass

class TestObjectResponse(TestObjectBase):
    id: str
    project_id: str
    usage_count: int
    last_verified_at: Optional[datetime]
    
    class Config:
        from_attributes = True

class TestActionBase(BaseModel):
    name: str
    description: Optional[str] = None
    category: str
    code_content: str
    parameters: List[Dict[str, Any]] = []
    platform: str = "WEB"
    is_active: bool = True

class TestActionCreate(TestActionBase):
    project_id: Optional[str] = None

class TestActionUpdate(TestActionBase):
    pass

class TestActionResponse(TestActionBase):
    id: str
    project_id: Optional[str]
    
    class Config:
        from_attributes = True

class TestDatasetBase(BaseModel):
    name: str
    description: Optional[str] = None
    data: List[Dict[str, Any]] = []
    classification: str
    platform: str = "WEB"
    is_active: bool = True
    generation_source: str = 'MANUAL'

class TestDatasetCreate(TestDatasetBase):
    project_id: str

class TestDatasetUpdate(TestDatasetBase):
    pass

class TestDatasetResponse(TestDatasetBase):
    id: str
    project_id: str
    
    class Config:
        from_attributes = True
