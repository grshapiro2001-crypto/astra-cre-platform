"""
Pydantic schemas for Organization feature
"""
from pydantic import BaseModel
from datetime import datetime
from enum import Enum
from typing import Optional, List


class OrgRole(str, Enum):
    owner = "owner"
    member = "member"


class OrgMemberStatus(str, Enum):
    pending = "pending"
    approved = "approved"


class OrganizationCreate(BaseModel):
    name: str


class OrganizationResponse(BaseModel):
    id: int
    name: str
    invite_code: str
    pipeline_template: str = "acquisitions"
    created_at: datetime
    member_count: int
    your_role: OrgRole

    class Config:
        from_attributes = True


class MemberResponse(BaseModel):
    id: int
    user_id: str
    user_email: str
    user_name: Optional[str] = None
    role: OrgRole
    status: OrgMemberStatus
    joined_at: datetime


class JoinRequest(BaseModel):
    invite_code: str


class ApproveMemberRequest(BaseModel):
    member_id: int
    approve: bool  # True = approve, False = reject


class MigrateDealRequest(BaseModel):
    property_ids: List[int]  # IDs of personal deals to move to org


class PipelineTemplateRequest(BaseModel):
    template: str  # "broker", "acquisitions", "dispositions"


class PipelineTemplateResponse(BaseModel):
    template: str
