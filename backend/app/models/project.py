from sqlalchemy import Column, String, ForeignKey, DateTime, JSON, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base_class import Base

class ProjectInsight(Base):
    __tablename__ = "projectinsight"
    id = Column(String, primary_key=True, index=True)
    project_id = Column(String, ForeignKey("project.id"), index=True)
    insight_type = Column(String, default='EXECUTIVE_SUMMARY')
    title = Column(String)
    content_markdown = Column(Text)
    insight_metadata = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    project = relationship("Project", back_populates="insights")

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
    categories = Column(JSON, default=["Common"])
    
    customer_account = relationship("CustomerAccount", back_populates="projects")
    scripts = relationship("TestScript", back_populates="project")
    personas = relationship("Persona", back_populates="project")
    scenarios = relationship("Scenario", back_populates="project")
    insights = relationship("ProjectInsight", back_populates="project", cascade="all, delete-orphan")
    schedules = relationship("TestSchedule", back_populates="project")
    access = relationship("ProjectAccess", back_populates="project")

class ProjectAccess(Base):
    id = Column(String, primary_key=True, index=True) # Composite key might be better, but surrogate ID is simple
    user_id = Column(String, ForeignKey("user.id"))
    project_id = Column(String, ForeignKey("project.id"))
    access_role = Column(String)
    
    user = relationship("User", back_populates="project_access")
    project = relationship("Project", back_populates="access")
