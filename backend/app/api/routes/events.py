import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func as sa_func, text
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta, timezone

from app.database import get_db
from app.models.user import User
from app.models.event import UserEvent
from app.api.deps import get_current_user_any_status, get_admin_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/events", tags=["Events"])

# Server-side session timeout: 15 minutes of inactivity = new session
SESSION_TIMEOUT_MINUTES = 15


# --- Schemas ---

class EventPayload(BaseModel):
    event_type: str
    session_id: str
    event_data_json: Optional[str] = None
    page_url: Optional[str] = None
    component: Optional[str] = None
    duration_ms: Optional[int] = None
    timestamp: Optional[str] = None  # Client-side timestamp (for ordering)


class BatchEventsRequest(BaseModel):
    events: list[EventPayload]


# --- Endpoints ---

@router.post("/batch", status_code=status.HTTP_201_CREATED)
def batch_events(
    request: BatchEventsRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user_any_status),
):
    """
    Batch-submit user events. Validates session_id against server-side timeout.
    If the session has been idle > 15 min, we auto-close the old session and
    treat the first event as a new session_start.
    """
    if not request.events:
        return {"message": "No events to process", "count": 0}

    if len(request.events) > 100:
        raise HTTPException(status_code=400, detail="Maximum 100 events per batch")

    # Check the last event from this user to validate session continuity
    last_event = db.query(UserEvent).filter(
        UserEvent.user_id == user.id
    ).order_by(UserEvent.created_at.desc()).first()

    active_session_id = request.events[0].session_id

    if last_event:
        time_since_last = datetime.now(timezone.utc) - (last_event.created_at.replace(tzinfo=timezone.utc) if last_event.created_at.tzinfo is None else last_event.created_at)
        if time_since_last > timedelta(minutes=SESSION_TIMEOUT_MINUTES):
            # Auto-close old session
            if last_event.session_id != active_session_id:
                timeout_event = UserEvent(
                    user_id=user.id,
                    session_id=last_event.session_id,
                    event_type="session_timeout",
                    event_data_json=f'{{"timeout_minutes": {SESSION_TIMEOUT_MINUTES}}}',
                )
                db.add(timeout_event)
                logger.info(f"Session timeout for user {user.email}: {last_event.session_id}")

    # Insert all events
    for evt in request.events:
        db_event = UserEvent(
            user_id=user.id,
            session_id=evt.session_id,
            event_type=evt.event_type,
            event_data_json=evt.event_data_json,
            page_url=evt.page_url,
            component=evt.component,
            duration_ms=evt.duration_ms,
        )
        db.add(db_event)

    db.commit()
    return {"message": "Events recorded", "count": len(request.events)}


@router.get("/summary")
def event_summary(
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    """
    CEO dashboard summary — key metrics for demo tracking.
    Admin only.
    """
    now = datetime.now(timezone.utc)
    last_24h = now - timedelta(hours=24)
    last_7d = now - timedelta(days=7)

    # Total events
    total_events = db.query(sa_func.count(UserEvent.id)).scalar() or 0

    # Unique users last 7 days
    active_users_7d = db.query(sa_func.count(sa_func.distinct(UserEvent.user_id))).filter(
        UserEvent.created_at >= last_7d
    ).scalar() or 0

    # Unique sessions last 24h
    sessions_24h = db.query(sa_func.count(sa_func.distinct(UserEvent.session_id))).filter(
        UserEvent.created_at >= last_24h
    ).scalar() or 0

    # Top event types
    top_events = db.query(
        UserEvent.event_type,
        sa_func.count(UserEvent.id).label("count")
    ).group_by(UserEvent.event_type).order_by(sa_func.count(UserEvent.id).desc()).limit(10).all()

    # Error count last 7 days
    error_count_7d = db.query(sa_func.count(UserEvent.id)).filter(
        UserEvent.event_type == "error",
        UserEvent.created_at >= last_7d,
    ).scalar() or 0

    return {
        "total_events": total_events,
        "active_users_7d": active_users_7d,
        "sessions_24h": sessions_24h,
        "error_count_7d": error_count_7d,
        "top_event_types": [{"event_type": e[0], "count": e[1]} for e in top_events],
    }
