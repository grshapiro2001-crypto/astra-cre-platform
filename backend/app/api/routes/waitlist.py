"""Waitlist endpoint for landing page email capture."""
import logging
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.database import get_db
from app.models.waitlist import WaitlistEntry
from app.services.email_service import send_waitlist_confirmation

logger = logging.getLogger(__name__)

router = APIRouter(tags=["waitlist"])

# Simple in-memory rate limiting (per-IP)
_rate_limit: dict[str, list[datetime]] = {}
RATE_LIMIT_MAX = 5
RATE_LIMIT_WINDOW = timedelta(hours=1)


class WaitlistRequest(BaseModel):
    email: EmailStr
    name: Optional[str] = None
    company: Optional[str] = None
    source: Optional[str] = "landing_page"


class WaitlistResponse(BaseModel):
    message: str
    already_registered: bool = False


def _check_rate_limit(ip: str) -> bool:
    """Return True if the IP is within rate limits."""
    now = datetime.utcnow()
    cutoff = now - RATE_LIMIT_WINDOW

    if ip not in _rate_limit:
        _rate_limit[ip] = []

    # Clean old entries
    _rate_limit[ip] = [t for t in _rate_limit[ip] if t > cutoff]

    if len(_rate_limit[ip]) >= RATE_LIMIT_MAX:
        return False

    _rate_limit[ip].append(now)
    return True


@router.post("/waitlist", response_model=WaitlistResponse)
async def join_waitlist(
    body: WaitlistRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """Add an email to the waitlist."""
    client_ip = request.client.host if request.client else "unknown"

    if not _check_rate_limit(client_ip):
        raise HTTPException(status_code=429, detail="Too many requests. Try again later.")

    # Check if already registered
    existing = db.query(WaitlistEntry).filter(WaitlistEntry.email == body.email.lower()).first()
    if existing:
        return WaitlistResponse(message="You're already on the list!", already_registered=True)

    # Add to waitlist
    entry = WaitlistEntry(
        email=body.email.lower(),
        name=body.name,
        company=body.company,
        source=body.source,
    )
    try:
        db.add(entry)
        db.commit()
    except IntegrityError:
        db.rollback()
        return WaitlistResponse(message="You're already on the list!", already_registered=True)

    # Send confirmation email (non-blocking — don't fail the request if email fails)
    try:
        await send_waitlist_confirmation(body.email, body.name)
    except Exception as e:
        logger.warning(f"Waitlist confirmation email failed for {body.email}: {e}")

    logger.info(f"Waitlist signup: {body.email}")
    return WaitlistResponse(message="You're on the list!")
