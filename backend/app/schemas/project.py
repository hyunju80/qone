from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel

# Shared properties
class ProjectBase(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    domain: Optional[str] = None
    target_devices: Optional[List[str]] = None
    environments: Optional[Dict[str, str]] = None
    object_repo: Optional[List[Dict[str, Any]]] = None
    mobile_config: Optional[Dict[str, str]] = None

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
