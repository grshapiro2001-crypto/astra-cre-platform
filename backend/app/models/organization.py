"""
Organization models for team workspace feature
"""
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
import secrets

from app.database import Base


class OrgRole(str, enum.Enum):
    owner = "owner"
    member = "member"


class OrgMemberStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"


class Organization(Base):
    __tablename__ = "organizations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    invite_code = Column(String(255), unique=True, nullable=False, default=lambda: secrets.token_urlsafe(8))
    pipeline_template = Column(String(50), nullable=False, server_default="acquisitions")  # "broker", "acquisitions", "dispositions"
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    members = relationship("OrganizationMember", back_populates="organization", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Organization(id={self.id}, name={self.name})>"


class OrganizationMember(Base):
    __tablename__ = "organization_members"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    role = Column(Enum(OrgRole), nullable=False, default=OrgRole.member)
    status = Column(Enum(OrgMemberStatus), nullable=False, default=OrgMemberStatus.pending)
    joined_at = Column(DateTime(timezone=True), server_default=func.now())

    organization = relationship("Organization", back_populates="members")
    user = relationship("User", back_populates="org_memberships")

    def __repr__(self):
        return f"<OrganizationMember(org_id={self.organization_id}, user_id={self.user_id}, role={self.role})>"
