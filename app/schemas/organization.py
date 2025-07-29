from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class AgentEntry(BaseModel):
    assistant_id: str
    documents: List[str]

class QuotaInfo(BaseModel):
    total_limit: int = Field(default=100000)
    used: Optional[int] = Field(default=0, ge=0)  # Ensure used is non-negative
    reset_date: Optional[datetime] = None

class OrganizationBase(BaseModel):
    name: str

class OrganizationCreate(OrganizationBase):
    head_user_id: str

class OrganizationResponse(OrganizationBase):
    id: str
    head_user_id: Optional[str] = None # Can be None if admin creates it without immediate assignment
    usage_quota: QuotaInfo
    agents: List[AgentEntry]
    created_at: datetime
    is_active: bool


# Schemas for Admin CRUD operations
class AdminOrganizationCreate(BaseModel):
    name: str
    head_user_email: Optional[str] = None
    head_user_name: Optional[str] = None
    head_user_password: Optional[str] = None

class AdminOrganizationUpdate(BaseModel):
    name: Optional[str] = None
    head_user_id: Optional[str] = None
    usage_quota: Optional[QuotaInfo] = None  # Admin can update quota if needed
    # We might want to update other fields like quota in the future,
    # but for now, let's stick to name and head_user_id as per typical admin actions.

class AdminOrganizationResponse(OrganizationResponse):
    # Inherits all fields from OrganizationResponse
    # If OrganizationResponse is updated to include created_at, this can be pass
    # For now, assuming OrganizationResponse might not have it for all use cases.
    # Let's ensure created_at is part of the base OrganizationResponse for consistency.
    member_count: Optional[int] = Field(None, description="Number of users in this organization")

class AdminOrganizationQuotaUpdate(BaseModel):
    total_limit: Optional[int] = Field(default=None, ge=0, description="New total quota limit for the organization. Must be non-negative if provided.")
    # used: Optional[int] = Field(default=None, ge=0) # Example if we wanted to allow resetting 'used' amount by admin
    # reset_date: Optional[datetime] = None # Example for admin setting reset date


# Models for GET /org/{org_id}/quota-details endpoint
class UserQuotaInfo(BaseModel):
    id: str
    name: Optional[str] = "N/A"
    email: str
    monthly_limit: int
    monthly_used: int

class OrgQuotaInfo(BaseModel):
    id: str
    name: str
    total_quota_limit: int
    total_quota_used: int

class OrgQuotaDetailsResponse(BaseModel):
    organization: OrgQuotaInfo
    users: List[UserQuotaInfo]

# Model for PATCH /org/{org_id}/users/{user_db_id}/quota endpoint
class UserQuotaUpdatePayload(BaseModel):
    monthly_limit: int = Field(..., ge=0) # Ensure non-negative

class OrganizationUsageResponse(BaseModel):
    total_limit: int
    used: int
