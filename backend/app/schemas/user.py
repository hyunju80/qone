from typing import Optional
from pydantic import BaseModel, EmailStr

# Shared properties
class UserBase(BaseModel):
    email: Optional[EmailStr] = None
    is_saas_super_admin: bool = False
    name: Optional[str] = None
    role: str = "Viewer"
    is_active: bool = True

# Properties to receive via API on creation
class UserCreate(UserBase):
    email: EmailStr
    password: str
    customer_account_id: Optional[str] = None

# Properties to receive via API on update
class UserUpdate(UserBase):
    password: Optional[str] = None

# Properties to return via API
class User(UserBase):
    id: Optional[str] = None
    customer_account_id: Optional[str] = None
    
    class Config:
        from_attributes = True

# Additional properties stored in DB
class UserInDB(User):
    hashed_password: str

class UserInvite(BaseModel):
    email: EmailStr
    name: str
    role: str # 'Manager' or 'QA Engineer'

class UserPasswordUpdate(BaseModel):
    current_password: str
    new_password: str
