from typing import Optional, List, Dict, Any
from pydantic import BaseModel

# Shared properties
class PersonaBase(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    traits: Optional[List[str]] = []
    skill_level: Optional[str] = "Intermediate"
    speed: Optional[str] = "Moderate"
    goal: Optional[str] = None
    is_active: Optional[bool] = True
    advanced_logic: Optional[List[str]] = []
    project_id: Optional[str] = None # can be 'global' or project id

# Creation
class PersonaCreate(PersonaBase):
    name: str
    goal: str

# Update
class PersonaUpdate(PersonaBase):
    pass

# DB
class PersonaInDBBase(PersonaBase):
    id: str

    class Config:
        from_attributes = True

class Persona(PersonaInDBBase):
    pass
