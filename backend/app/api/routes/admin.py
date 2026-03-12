from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from uuid import UUID

from app.database import get_db
from app.models.user import User
from app.api.deps import get_admin_user

router = APIRouter(prefix="/admin", tags=["Admin"])


# --- Schemas ---

class AdminUserResponse(BaseModel):
    id: UUID
    email: str
    full_name: Optional[str]
    is_active: bool
    account_status: str
    is_admin: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AdminUserListResponse(BaseModel):
    users: list[AdminUserResponse]
    total: int


class UpdateUserStatusRequest(BaseModel):
    account_status: str  # "active" | "suspended"


# --- Endpoints ---

@router.get("/users", response_model=AdminUserListResponse)
def list_users(
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    """List all users with their approval status. Admin only."""
    users = db.query(User).order_by(User.created_at.desc()).all()
    return AdminUserListResponse(users=users, total=len(users))


@router.patch("/users/{user_id}/status")
def update_user_status(
    user_id: str,
    request: UpdateUserStatusRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    """Approve or suspend a user. Admin only."""
    if request.account_status not in ("active", "suspended", "pending"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="account_status must be 'active', 'suspended', or 'pending'"
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Don't allow admins to suspend themselves
    if user.id == admin.id and request.account_status != "active":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot change your own status"
        )

    old_status = user.account_status
    user.account_status = request.account_status
    db.commit()
    db.refresh(user)

    return {
        "message": f"User {user.email} status changed from '{old_status}' to '{request.account_status}'",
        "user": AdminUserResponse.model_validate(user),
    }
