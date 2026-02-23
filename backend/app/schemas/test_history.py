from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel

class LogEntry(BaseModel):
    msg: str
    type: str # info, success, error, cmd

class TestHistoryBase(BaseModel):
    status: Optional[str] = None
    duration: Optional[str] = None
    failure_reason: Optional[str] = None
    ai_summary: Optional[str] = None
    logs: Optional[List[LogEntry]] = []

class TestHistoryCreate(TestHistoryBase):
    script_id: str
    script_name: str
    trigger: str = "manual"
    persona_name: Optional[str] = "Default"

class TestHistoryUpdate(TestHistoryBase):
    pass

class TestHistoryInDBBase(TestHistoryBase):
    id: str
    script_id: str
    script_name: str
    run_date: datetime
    trigger: str
    persona_name: Optional[str] = None
    deployment_version: Optional[str] = None
    commit_hash: Optional[str] = None
    schedule_id: Optional[str] = None
    schedule_name: Optional[str] = None
    
    class Config:
        from_attributes = True

class TestHistory(TestHistoryInDBBase):
    pass
