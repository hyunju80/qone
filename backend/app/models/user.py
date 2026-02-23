from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base_class import Base

class CustomerAccount(Base):
    id = Column(String, primary_key=True, index=True)
    company_name = Column(String, nullable=False)
    business_number = Column(String, unique=True, index=True)
    plan = Column(String, default="Pro") # Free, Pro, Enterprise
    billing_email = Column(String)
    admin_email = Column(String)
    usage = Column(JSON, default={}) # UsageStats
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    users = relationship("User", back_populates="customer_account")
    projects = relationship("Project", back_populates="customer_account")

class User(Base):
    id = Column(String, primary_key=True, index=True)
    customer_account_id = Column(String, ForeignKey("customeraccount.id"))
    name = Column(String)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(String, default="Viewer") # Admin, Manager, etc
    is_saas_super_admin = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    
    customer_account = relationship("CustomerAccount", back_populates="users")
    # Access control can be a separate table or implicit
    project_access = relationship("ProjectAccess", back_populates="user")
