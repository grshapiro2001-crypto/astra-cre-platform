from sqlalchemy import Column, String, Text, DateTime, Integer, ForeignKey, Float
from sqlalchemy.sql import func
import uuid
from app.database import Base


class UserEvent(Base):
    """Tracks user activity for demo analytics — page views, uploads, feature usage, errors."""
    __tablename__ = "user_events"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    session_id = Column(String(36), nullable=False, index=True)
    event_type = Column(String(100), nullable=False, index=True)
    # e.g. "page_view", "upload_om", "extract_financials", "score_deal", "error", "session_start", "session_end"
    event_data_json = Column(Text, nullable=True)  # Arbitrary payload
    page_url = Column(String(1000), nullable=True)
    component = Column(String(200), nullable=True)  # Which component/feature
    duration_ms = Column(Integer, nullable=True)     # Time spent (for page views)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
