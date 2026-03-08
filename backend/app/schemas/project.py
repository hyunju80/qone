from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, field_validator

class CategoryNode(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    parentId: Optional[str] = None
    managerId: Optional[str] = None

# Shared properties
class ProjectBase(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    domain: Optional[str] = None
    target_devices: Optional[List[str]] = None
    environments: Optional[Dict[str, str]] = None
    object_repo: Optional[List[Dict[str, Any]]] = None
    mobile_config: Optional[Dict[str, str]] = None
    categories: List[CategoryNode] = [{"id": "default_common", "name": "Common"}]

    @field_validator('categories', mode='before')
    def set_categories(cls, v):
        print(f"DEBUG_CATEGORIES: Incoming value of categories is type={type(v)}, value={v}", flush=True)
        if not v:
            return [{"id": "default_common", "name": "Common"}]
            
        import json
        if isinstance(v, str):
            try:
                v = json.loads(v)
            except Exception as e:
                print(f"DEBUG_CATEGORIES: JSON decode error {e}", flush=True)
                pass

        if not isinstance(v, list):
            return [{"id": "default_common", "name": "Common"}]

        # Handle legacy simple strings by converting them to objects
        parsed = []
        for cat in v:
            if isinstance(cat, str):
                parsed.append({"id": f"cat_{cat.lower()}", "name": cat})
            elif isinstance(cat, dict):
                parsed.append(cat)
            elif hasattr(cat, 'model_dump'):
                parsed.append(cat.model_dump())
            else:
                 parsed.append({"id": "default_common", "name": "Common"})
        print(f"DEBUG_CATEGORIES: Returning {parsed}", flush=True)
        return parsed

# Create
class ProjectCreate(ProjectBase):
    name: str

# Update
class ProjectUpdate(ProjectBase):
    pass

# DB Base
class ProjectInDBBase(ProjectBase):
    id: str
    customer_account_id: str
    created_at: datetime

    class Config:
        from_attributes = True

# Return
class Project(ProjectInDBBase):
    pass
