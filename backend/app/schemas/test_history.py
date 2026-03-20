from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel
from app.schemas.self_healing import SelfHealingLog

class LogEntry(BaseModel):
    msg: str
    type: str # info, success, error, cmd

class TestHistoryBase(BaseModel):
    project_id: Optional[str] = None
    status: Optional[str] = None
    duration: Optional[str] = None
    failure_reason: Optional[str] = None
    ai_summary: Optional[str] = None
    failure_analysis: Optional[Dict[str, Any]] = None
    logs: Optional[List[LogEntry]] = []
    step_results: Optional[List[Dict[str, Any]]] = []
    jira_id: Optional[str] = None

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
    script_origin: Optional[str] = None
    script_category: Optional[str] = "Common"
    
    class Config:
        from_attributes = True

class TestHistory(TestHistoryInDBBase):
    healing_logs: List[SelfHealingLog] = []
