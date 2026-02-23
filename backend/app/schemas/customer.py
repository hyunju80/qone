from typing import Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, EmailStr

# Shared properties
class CustomerBase(BaseModel):
    company_name: Optional[str] = None
    business_number: Optional[str] = None
    plan: Optional[str] = "Pro"
    billing_email: Optional[EmailStr] = None
    admin_email: Optional[EmailStr] = None
    usage: Optional[Dict[str, Any]] = None

# Properties to receive on creation
class CustomerCreate(CustomerBase):
    company_name: str
    admin_email: EmailStr

# Properties to receive on update
class CustomerUpdate(CustomerBase):
    pass

# Properties shared by models stored in DB
class CustomerInDBBase(CustomerBase):
    id: str
    created_at: datetime

    class Config:
        from_attributes = True

# Properties to return to client
class Customer(CustomerInDBBase):
    pass
