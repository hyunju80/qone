from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel

class SelfHealingLogBase(BaseModel):
    status: Optional[str] = "started"
    error_detected: Optional[str] = None
    healing_steps: Optional[List[Dict[str, Any]]] = []
    modified_steps: Optional[List[Dict[str, Any]]] = []

class SelfHealingLogCreate(SelfHealingLogBase):
    id: str
    history_id: str
    script_id: str

class SelfHealingLogUpdate(SelfHealingLogBase):
    pass

class SelfHealingLog(SelfHealingLogBase):
    id: str
    history_id: str
    script_id: str
    created_at: datetime

    class Config:
        from_attributes = True
