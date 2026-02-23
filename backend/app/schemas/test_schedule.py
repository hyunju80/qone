from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel

class Incident(BaseModel):
    id: str
    timestamp: str
    scriptName: str
    channel: str
    summary: str
    details: str

class TestScheduleBase(BaseModel):
    name: Optional[str] = None
    cron_expression: Optional[str] = None
    frequency_label: Optional[str] = None
    is_active: Optional[bool] = True
    alert_config: Optional[Dict[str, Any]] = None
    priority: Optional[str] = "Normal"
    trigger_strategy: Optional[str] = "SCHEDULE"
    script_ids: Optional[List[str]] = []

class TestScheduleCreate(TestScheduleBase):
    name: str
    project_id: str
    cron_expression: str

class TestScheduleUpdate(TestScheduleBase):
    pass

class TestScheduleInDBBase(TestScheduleBase):
    id: str
    project_id: str
    last_run: Optional[datetime] = None
    next_run: Optional[datetime] = None
    incident_history: Optional[List[Incident]] = []
    
    class Config:
        from_attributes = True

class TestSchedule(TestScheduleInDBBase):
    pass
