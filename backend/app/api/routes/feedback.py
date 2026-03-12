from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func as sa_func
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta, timezone

from app.database import get_db
from app.models.user import User
from app.models.feedback import FeedbackReport, FeedbackReply
from app.api.deps import get_current_user, get_current_user_any_status, get_admin_user

router = APIRouter(prefix="/feedback", tags=["Feedback"])

# Rate limit: 10 submissions per hour per user
RATE_LIMIT_MAX = 10
RATE_LIMIT_WINDOW_HOURS = 1


# --- Schemas ---

class FeedbackCreateRequest(BaseModel):
    category: str = "bug"
    severity: str = "medium"
    title: str
    description: Optional[str] = None
    screenshot_url: Optional[str] = None
    current_url: Optional[str] = None
    active_property_id: Optional[str] = None
    active_tab: Optional[str] = None
    active_filters_json: Optional[str] = None
    browser_info: Optional[str] = None
    viewport_size: Optional[str] = None


class FeedbackReplyRequest(BaseModel):
    message: str


class FeedbackStatusUpdateRequest(BaseModel):
    status: str  # open, in_progress, resolved, closed


class FeedbackReplyResponse(BaseModel):
    id: str
    report_id: str
    user_id: str
    user_email: Optional[str] = None
    user_name: Optional[str] = None
    message: str
    created_at: datetime

    class Config:
        from_attributes = True


class FeedbackReportResponse(BaseModel):
    id: str
    user_id: str
    user_email: Optional[str] = None
    user_name: Optional[str] = None
    category: str
    severity: str
    status: str
    title: str
    description: Optional[str] = None
    screenshot_url: Optional[str] = None
    current_url: Optional[str] = None
    active_property_id: Optional[str] = None
    active_tab: Optional[str] = None
    active_filters_json: Optional[str] = None
    browser_info: Optional[str] = None
    viewport_size: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    replies: list[FeedbackReplyResponse] = []

    class Config:
        from_attributes = True


# --- Endpoints ---

@router.post("/reports", status_code=status.HTTP_201_CREATED)
def create_feedback(
    request: FeedbackCreateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user_any_status),
):
    """Submit a feedback report. Rate limited to 10/hour per user."""
    # Rate limiting check
    window_start = datetime.now(timezone.utc) - timedelta(hours=RATE_LIMIT_WINDOW_HOURS)
    recent_count = db.query(sa_func.count(FeedbackReport.id)).filter(
        FeedbackReport.user_id == user.id,
        FeedbackReport.created_at >= window_start,
    ).scalar()

    if recent_count >= RATE_LIMIT_MAX:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Rate limit exceeded. Maximum {RATE_LIMIT_MAX} submissions per hour.",
        )

    # Validate category and severity
    valid_categories = {"bug", "feature", "other"}
    valid_severities = {"low", "medium", "high", "critical"}
    if request.category not in valid_categories:
        raise HTTPException(status_code=400, detail=f"category must be one of: {valid_categories}")
    if request.severity not in valid_severities:
        raise HTTPException(status_code=400, detail=f"severity must be one of: {valid_severities}")

    report = FeedbackReport(
        user_id=user.id,
        category=request.category,
        severity=request.severity,
        title=request.title,
        description=request.description,
        screenshot_url=request.screenshot_url,
        current_url=request.current_url,
        active_property_id=request.active_property_id,
        active_tab=request.active_tab,
        active_filters_json=request.active_filters_json,
        browser_info=request.browser_info,
        viewport_size=request.viewport_size,
    )
    db.add(report)
    db.commit()
    db.refresh(report)

    return {"message": "Feedback submitted", "id": report.id}


@router.get("/reports")
def list_feedback(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    List feedback reports.
    Admins see all reports. Regular users see only their own.
    """
    query = db.query(FeedbackReport).options(
        joinedload(FeedbackReport.user),
        joinedload(FeedbackReport.replies).joinedload(FeedbackReply.user),
    )

    if not user.is_admin:
        query = query.filter(FeedbackReport.user_id == user.id)

    reports = query.order_by(FeedbackReport.created_at.desc()).all()

    result = []
    for r in reports:
        report_dict = {
            "id": r.id,
            "user_id": r.user_id,
            "user_email": r.user.email if r.user else None,
            "user_name": r.user.full_name if r.user else None,
            "category": r.category,
            "severity": r.severity,
            "status": r.status,
            "title": r.title,
            "description": r.description,
            "screenshot_url": r.screenshot_url,
            "current_url": r.current_url,
            "active_property_id": r.active_property_id,
            "active_tab": r.active_tab,
            "active_filters_json": r.active_filters_json,
            "browser_info": r.browser_info,
            "viewport_size": r.viewport_size,
            "created_at": r.created_at,
            "updated_at": r.updated_at,
            "replies": [
                {
                    "id": reply.id,
                    "report_id": reply.report_id,
                    "user_id": reply.user_id,
                    "user_email": reply.user.email if reply.user else None,
                    "user_name": reply.user.full_name if reply.user else None,
                    "message": reply.message,
                    "created_at": reply.created_at,
                }
                for reply in r.replies
            ],
        }
        result.append(report_dict)

    return {"reports": result, "total": len(result)}


@router.post("/reports/{report_id}/replies", status_code=status.HTTP_201_CREATED)
def add_reply(
    report_id: str,
    request: FeedbackReplyRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Add a reply to a feedback report. Bidirectional — both admin and report author can reply."""
    report = db.query(FeedbackReport).filter(FeedbackReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    # Only the report author or an admin can reply
    if report.user_id != user.id and not user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized to reply to this report")

    reply = FeedbackReply(
        report_id=report_id,
        user_id=user.id,
        message=request.message,
    )
    db.add(reply)
    db.commit()
    db.refresh(reply)

    return {
        "message": "Reply added",
        "reply": {
            "id": reply.id,
            "report_id": reply.report_id,
            "user_id": reply.user_id,
            "user_email": user.email,
            "user_name": user.full_name,
            "message": reply.message,
            "created_at": reply.created_at,
        }
    }


@router.patch("/reports/{report_id}/status")
def update_feedback_status(
    report_id: str,
    request: FeedbackStatusUpdateRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    """Update feedback report status. Admin only."""
    valid_statuses = {"open", "in_progress", "resolved", "closed"}
    if request.status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"status must be one of: {valid_statuses}")

    report = db.query(FeedbackReport).filter(FeedbackReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    report.status = request.status
    db.commit()

    return {"message": f"Report status updated to '{request.status}'"}
