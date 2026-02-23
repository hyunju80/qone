from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, ForeignKey, JSON, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base_class import Base

class Persona(Base):
    id = Column(String, primary_key=True, index=True)
    project_id = Column(String, ForeignKey("project.id"), nullable=True) # or global if null
    name = Column(String)
    description = Column(String)
    traits = Column(JSON, default=[])
    skill_level = Column(String)
    speed = Column(String)
    goal = Column(String)
    is_active = Column(Boolean, default=True)
    advanced_logic = Column(JSON, default=[])
    
    project = relationship("Project", back_populates="personas")
    scripts = relationship("TestScript", back_populates="persona")

class TestScript(Base):
    id = Column(String, primary_key=True, index=True)
    project_id = Column(String, ForeignKey("project.id"))
    name = Column(String)
    description = Column(String)
    status = Column(String) # CERTIFIED, PENDING
    last_run = Column(DateTime(timezone=True))
    run_count = Column(Integer, default=0)
    success_rate = Column(Float, default=0.0)
    code = Column(Text) # The actual script
    origin = Column(String) # MANUAL, AI
    tags = Column(JSON, default=[])
    is_favorite = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    persona_id = Column(String, ForeignKey("persona.id"), nullable=True)
    dataset = Column(JSON, default=[])
    engine = Column(String) # Playwright, Appium
    platform = Column(String) # WEB, APP (New for Step Runner)

    project = relationship("Project", back_populates="scripts")
    persona = relationship("Persona", back_populates="scripts")
    history = relationship("TestHistory", back_populates="script")
    match_schedules = relationship("ScheduleScript", back_populates="script")
    steps = relationship("TestStep", back_populates="script", cascade="all, delete-orphan")

class Scenario(Base):
    id = Column(String, primary_key=True, index=True)
    project_id = Column(String, ForeignKey("project.id"))
    title = Column(String)
    description = Column(String)
    test_cases = Column(JSON, default=[]) # TestCase[]
    persona_id = Column(String, ForeignKey("persona.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    is_approved = Column(Boolean, default=False)
    golden_script_id = Column(String, ForeignKey("testscript.id"), nullable=True)
    tags = Column(JSON, default=[])
    
    project = relationship("Project", back_populates="scenarios")
    golden_script = relationship("TestScript") # Optional relationship for access

class TestHistory(Base):
    id = Column(String, primary_key=True, index=True)
    script_id = Column(String, ForeignKey("testscript.id"))
    script_name = Column(String) # Denormalized for ease
    run_date = Column(DateTime(timezone=True), server_default=func.now())
    status = Column(String) # passed, failed
    duration = Column(String)
    persona_name = Column(String)
    trigger = Column(String) # manual, pipeline, scheduled
    failure_reason = Column(String)
    ai_summary = Column(String)
    logs = Column(JSON, default=[]) # LogEntry[]
    deployment_version = Column(String)
    commit_hash = Column(String)
    schedule_id = Column(String, ForeignKey("testschedule.id"), nullable=True)
    schedule_name = Column(String)
    
    script = relationship("TestScript", back_populates="history")
    schedule = relationship("TestSchedule", back_populates="history_entries")
    ai_session = relationship("AiExplorationSession", uselist=False, back_populates="history")

class TestSchedule(Base):
    id = Column(String, primary_key=True, index=True)
    project_id = Column(String, ForeignKey("project.id"))
    name = Column(String)
    # script_ids kept as relation or JSON. Let's do M2M for integrity
    cron_expression = Column(String)
    frequency_label = Column(String)
    last_run = Column(DateTime(timezone=True))
    next_run = Column(DateTime(timezone=True))
    is_active = Column(Boolean, default=True)
    alert_config = Column(JSON, default={})
    priority = Column(String)
    trigger_strategy = Column(String)
    incident_history = Column(JSON, default=[])
    
    project = relationship("Project", back_populates="schedules")
    history_entries = relationship("TestHistory", back_populates="schedule")
    scripts = relationship("ScheduleScript", back_populates="schedule")

    @property
    def script_ids(self):
        return [s.script_id for s in self.scripts]

class ScheduleScript(Base):
    id = Column(Integer, primary_key=True, index=True)
    schedule_id = Column(String, ForeignKey("testschedule.id"))
    script_id = Column(String, ForeignKey("testscript.id"))
    
    schedule = relationship("TestSchedule", back_populates="scripts")
    script = relationship("TestScript", back_populates="match_schedules")

class TestStep(Base):
    __tablename__ = "teststep"
    
    id = Column(String, primary_key=True, index=True)
    script_id = Column(String, ForeignKey("testscript.id"))
    step_number = Column(Integer)
    action = Column(String)
    selector_type = Column(String)
    selector_value = Column(String)
    option = Column(String)
    
    # App specific fields
    step_name = Column(String)
    description = Column(String)
    mandatory = Column(Boolean, default=False)
    skip_on_error = Column(Boolean, default=False)
    screenshot = Column(Boolean, default=False)
    sleep = Column(Float, default=0.0)
    
    script = relationship("TestScript", back_populates="steps")

class TestObject(Base):
    """
    Independent Selector/Locator Asset
    Replaces Project.object_repo
    """
    __tablename__ = "testobject"
    id = Column(String, primary_key=True, index=True)
    project_id = Column(String, ForeignKey("project.id"))
    name = Column(String, index=True)
    description = Column(String, nullable=True)
    selector_type = Column(String) # css, xpath, id, etc.
    value = Column(String)
    is_active = Column(Boolean, default=True)
    usage_count = Column(Integer, default=0)
    last_verified_at = Column(DateTime(timezone=True), nullable=True)
    
    project = relationship("Project")

class TestAction(Base):
    """
    Reusable Action Function Asset
    """
    __tablename__ = "testaction"
    id = Column(String, primary_key=True, index=True)
    project_id = Column(String, ForeignKey("project.id"), nullable=True) # Null = Global/System Action
    name = Column(String, index=True)
    description = Column(String, nullable=True)
    category = Column(String) # Common, Custom, etc
    code_content = Column(Text) # The actual python/playwright function body
    parameters = Column(JSON, default=[]) # [{name, type, required, description}]
    is_active = Column(Boolean, default=True)
    
    project = relationship("Project")

class TestDataset(Base):
    """
    Key-Value Test Data Asset
    """
    __tablename__ = "testdataset"
    id = Column(String, primary_key=True, index=True)
    project_id = Column(String, ForeignKey("project.id"))
    name = Column(String, index=True)
    description = Column(String, nullable=True)
    data = Column(JSON, default=[]) # [{key, value, type, description}]
    classification = Column(String) # VALID, INVALID, SECURITY, EDGE_CASE
    is_active = Column(Boolean, default=True)
    generation_source = Column(String) # MANUAL, LLM
    
    project = relationship("Project")
