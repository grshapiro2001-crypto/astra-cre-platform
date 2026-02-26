"""
Organization CRUD endpoints
NO LLM CALLS - Pure database operations only
"""
import logging
import secrets
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models.user import User
from app.models.organization import Organization, OrganizationMember, OrgRole, OrgMemberStatus
from app.models.property import Property
from app.models.deal_folder import DealFolder
from app.schemas.organization import (
    OrganizationCreate,
    OrganizationResponse,
    MemberResponse,
    JoinRequest,
    ApproveMemberRequest,
    MigrateDealRequest,
)
from app.api.deps import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/organizations", tags=["Organizations"])


def _get_user_approved_membership(db: Session, user_id: str):
    """Get the user's approved org membership, or None."""
    return db.query(OrganizationMember).filter(
        OrganizationMember.user_id == user_id,
        OrganizationMember.status == OrgMemberStatus.approved,
    ).first()


def _get_user_org_id(db: Session, user_id: str):
    """Return the organization ID for the user's approved membership, or None."""
    membership = _get_user_approved_membership(db, user_id)
    return membership.organization_id if membership else None


def _build_org_response(org: Organization, role: OrgRole, db: Session) -> OrganizationResponse:
    """Build OrganizationResponse with member count."""
    member_count = db.query(OrganizationMember).filter(
        OrganizationMember.organization_id == org.id,
        OrganizationMember.status == OrgMemberStatus.approved,
    ).count()
    return OrganizationResponse(
        id=org.id,
        name=org.name,
        invite_code=org.invite_code,
        created_at=org.created_at,
        member_count=member_count,
        your_role=role,
    )


# ==================== CREATE ORG ====================

@router.post("", response_model=OrganizationResponse, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=OrganizationResponse, status_code=status.HTTP_201_CREATED)
def create_organization(
    org_data: OrganizationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new organization. Caller becomes owner. One org per user enforced."""
    # Check user not already in an org
    existing = _get_user_approved_membership(db, str(current_user.id))
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You are already a member of an organization. Leave your current org first.",
        )

    # Also check for pending memberships
    pending = db.query(OrganizationMember).filter(
        OrganizationMember.user_id == str(current_user.id),
        OrganizationMember.status == OrgMemberStatus.pending,
    ).first()
    if pending:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You have a pending join request. Cancel it before creating a new org.",
        )

    org = Organization(name=org_data.name.strip())
    db.add(org)
    db.flush()  # Get org.id

    membership = OrganizationMember(
        organization_id=org.id,
        user_id=str(current_user.id),
        role=OrgRole.owner,
        status=OrgMemberStatus.approved,
    )
    db.add(membership)
    db.commit()
    db.refresh(org)

    return _build_org_response(org, OrgRole.owner, db)


# ==================== GET MY ORG ====================

@router.get("/me", response_model=OrganizationResponse)
def get_my_organization(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get current user's org + role + member list."""
    membership = _get_user_approved_membership(db, str(current_user.id))
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="You are not a member of any organization.",
        )

    org = db.query(Organization).filter(Organization.id == membership.organization_id).first()
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")

    return _build_org_response(org, membership.role, db)


# ==================== GET MEMBERS ====================

@router.get("/me/members", response_model=List[MemberResponse])
def get_org_members(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get all approved members of the user's org."""
    membership = _get_user_approved_membership(db, str(current_user.id))
    if not membership:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not in an organization.")

    members = db.query(OrganizationMember).filter(
        OrganizationMember.organization_id == membership.organization_id,
        OrganizationMember.status == OrgMemberStatus.approved,
    ).all()

    result = []
    for m in members:
        user = db.query(User).filter(User.id == m.user_id).first()
        result.append(MemberResponse(
            id=m.id,
            user_id=m.user_id,
            user_email=user.email if user else "unknown",
            user_name=user.full_name if user else None,
            role=m.role,
            status=m.status,
            joined_at=m.joined_at,
        ))
    return result


# ==================== GET PENDING ====================

@router.get("/me/pending", response_model=List[MemberResponse])
def get_pending_requests(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Owner only: list pending join requests."""
    membership = _get_user_approved_membership(db, str(current_user.id))
    if not membership:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not in an organization.")
    if membership.role != OrgRole.owner:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the owner can view pending requests.")

    pending = db.query(OrganizationMember).filter(
        OrganizationMember.organization_id == membership.organization_id,
        OrganizationMember.status == OrgMemberStatus.pending,
    ).all()

    result = []
    for m in pending:
        user = db.query(User).filter(User.id == m.user_id).first()
        result.append(MemberResponse(
            id=m.id,
            user_id=m.user_id,
            user_email=user.email if user else "unknown",
            user_name=user.full_name if user else None,
            role=m.role,
            status=m.status,
            joined_at=m.joined_at,
        ))
    return result


# ==================== JOIN ====================

@router.post("/join")
def join_organization(
    join_data: JoinRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Submit invite code to request joining (status=pending)."""
    # Check user not already in an org
    existing = _get_user_approved_membership(db, str(current_user.id))
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You are already a member of an organization.",
        )

    # Check not already pending somewhere
    pending = db.query(OrganizationMember).filter(
        OrganizationMember.user_id == str(current_user.id),
        OrganizationMember.status == OrgMemberStatus.pending,
    ).first()
    if pending:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You already have a pending join request.",
        )

    # Look up org by invite code
    org = db.query(Organization).filter(Organization.invite_code == join_data.invite_code.strip()).first()
    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid invite code.",
        )

    membership = OrganizationMember(
        organization_id=org.id,
        user_id=str(current_user.id),
        role=OrgRole.member,
        status=OrgMemberStatus.pending,
    )
    db.add(membership)
    db.commit()

    return {"message": "Join request submitted. Awaiting owner approval.", "organization_name": org.name}


# ==================== APPROVE / REJECT ====================

@router.post("/approve")
def approve_member(
    data: ApproveMemberRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Owner only: approve or reject a pending member."""
    my_membership = _get_user_approved_membership(db, str(current_user.id))
    if not my_membership or my_membership.role != OrgRole.owner:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the owner can approve members.")

    target = db.query(OrganizationMember).filter(
        OrganizationMember.id == data.member_id,
        OrganizationMember.organization_id == my_membership.organization_id,
        OrganizationMember.status == OrgMemberStatus.pending,
    ).first()

    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pending member not found.")

    if data.approve:
        target.status = OrgMemberStatus.approved
        db.commit()
        return {"message": "Member approved."}
    else:
        db.delete(target)
        db.commit()
        return {"message": "Member rejected."}


# ==================== LEAVE ====================

@router.delete("/leave")
def leave_organization(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Leave org. Owner cannot leave if other approved members exist."""
    membership = _get_user_approved_membership(db, str(current_user.id))
    if not membership:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not in an organization.")

    if membership.role == OrgRole.owner:
        other_approved = db.query(OrganizationMember).filter(
            OrganizationMember.organization_id == membership.organization_id,
            OrganizationMember.status == OrgMemberStatus.approved,
            OrganizationMember.user_id != str(current_user.id),
        ).count()
        if other_approved > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Owner cannot leave while other approved members exist. Disband the org or transfer ownership first.",
            )

    # Unscope user's properties from org
    db.query(Property).filter(
        Property.user_id == str(current_user.id),
        Property.organization_id == membership.organization_id,
    ).update({Property.organization_id: None})

    db.query(DealFolder).filter(
        DealFolder.user_id == str(current_user.id),
        DealFolder.organization_id == membership.organization_id,
    ).update({DealFolder.organization_id: None})

    db.delete(membership)
    db.commit()
    return {"message": "You have left the organization."}


# ==================== MIGRATE DEALS ====================

@router.post("/migrate-deals")
def migrate_deals(
    data: MigrateDealRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Move specified personal property IDs to org (set organization_id)."""
    membership = _get_user_approved_membership(db, str(current_user.id))
    if not membership:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Not in an organization.")

    updated = 0
    for prop_id in data.property_ids:
        prop = db.query(Property).filter(
            Property.id == prop_id,
            Property.user_id == str(current_user.id),
            Property.organization_id == None,  # noqa: E711
        ).first()
        if prop:
            prop.organization_id = membership.organization_id
            updated += 1

    db.commit()
    return {"message": f"Migrated {updated} deals to organization."}


# ==================== DISBAND ====================

@router.delete("")
@router.delete("/")
def disband_organization(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Owner only: disband entire org. Sets all members' properties organization_id=null."""
    membership = _get_user_approved_membership(db, str(current_user.id))
    if not membership or membership.role != OrgRole.owner:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the owner can disband the organization.")

    org_id = membership.organization_id

    # Unscope all properties
    db.query(Property).filter(Property.organization_id == org_id).update({Property.organization_id: None})
    db.query(DealFolder).filter(DealFolder.organization_id == org_id).update({DealFolder.organization_id: None})

    # Delete org (cascades to members)
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if org:
        db.delete(org)
    db.commit()
    return {"message": "Organization disbanded."}


# ==================== REGENERATE CODE ====================

@router.post("/regenerate-code", response_model=OrganizationResponse)
def regenerate_invite_code(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Owner only: generate new invite code."""
    membership = _get_user_approved_membership(db, str(current_user.id))
    if not membership or membership.role != OrgRole.owner:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the owner can regenerate the invite code.")

    org = db.query(Organization).filter(Organization.id == membership.organization_id).first()
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")

    org.invite_code = secrets.token_urlsafe(8)
    db.commit()
    db.refresh(org)

    return _build_org_response(org, OrgRole.owner, db)
