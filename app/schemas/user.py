from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime

class UserCreate(BaseModel):
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserOut(BaseModel):
    id: str
    email: str
    role: str
class UserQuota(BaseModel):
    monthly_limit: int = Field(default=10000)
    used: int = Field(default=0)
    reset_date: Optional[datetime] = None

class UserBase(BaseModel):
    email: str
    role: str = "user"

class UserResponse(UserBase):
    id: str
    organization_id: Optional[str] = None
    agent_id: Optional[str] = None
    quota: UserQuota

class AdminUserResponse(BaseModel):
    id: str
    email: EmailStr
    name: Optional[str] = None
    role: str
    organization_id: Optional[str] = None
    organization_name: Optional[str] = None
    created_at: Optional[datetime] = None
    status: Optional[str] = None # e.g., "active", "invited", "inactive"
    # is_active: Optional[bool] = None # Alternative to string status
    # is_verified: Optional[bool] = None # Alternative to string status