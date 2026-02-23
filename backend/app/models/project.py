from sqlalchemy import Column, String, ForeignKey, DateTime, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base_class import Base

class Project(Base):
    id = Column(String, primary_key=True, index=True)
    customer_account_id = Column(String, ForeignKey("customeraccount.id"))
    name = Column(String, nullable=False)
    description = Column(String)
    domain = Column(String) # Fintech, E-commerce, etc
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    target_devices = Column(JSON, default=[]) # List of TargetDevice
    environments = Column(JSON, default={}) # Dev, Stage, Prod URLs
    object_repo = Column(JSON, default=[]) # ObjectElement[]
    mobile_config = Column(JSON, default={})
    
    customer_account = relationship("CustomerAccount", back_populates="projects")
    scripts = relationship("TestScript", back_populates="project")
    personas = relationship("Persona", back_populates="project")
    scenarios = relationship("Scenario", back_populates="project")
    schedules = relationship("TestSchedule", back_populates="project")
    access = relationship("ProjectAccess", back_populates="project")

class ProjectAccess(Base):
    id = Column(String, primary_key=True, index=True) # Composite key might be better, but surrogate ID is simple
    user_id = Column(String, ForeignKey("user.id"))
    project_id = Column(String, ForeignKey("project.id"))
    access_role = Column(String)
    
    user = relationship("User", back_populates="project_access")
    project = relationship("Project", back_populates="access")
