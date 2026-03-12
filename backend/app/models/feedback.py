from sqlalchemy import Column, String, Text, DateTime, Integer, ForeignKey, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
import enum
from app.database import Base


class FeedbackCategory(str, enum.Enum):
    BUG = "bug"
    FEATURE = "feature"
    OTHER = "other"


class FeedbackSeverity(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class FeedbackStatus(str, enum.Enum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
    CLOSED = "closed"


class FeedbackReport(Base):
    __tablename__ = "feedback_reports"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    category = Column(String(20), nullable=False, default="bug")
    severity = Column(String(20), nullable=False, default="medium")
    status = Column(String(20), nullable=False, default="open")
    title = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)
    screenshot_url = Column(Text, nullable=True)

    # Auto-captured app state snapshot
    current_url = Column(String(1000), nullable=True)
    active_property_id = Column(String(36), nullable=True)
    active_tab = Column(String(100), nullable=True)
    active_filters_json = Column(Text, nullable=True)
    browser_info = Column(String(500), nullable=True)
    viewport_size = Column(String(50), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    user = relationship("User", backref="feedback_reports")
    replies = relationship("FeedbackReply", back_populates="report", order_by="FeedbackReply.created_at")


class FeedbackReply(Base):
    __tablename__ = "feedback_replies"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    report_id = Column(String(36), ForeignKey("feedback_reports.id"), nullable=False)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    message = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    report = relationship("FeedbackReport", back_populates="replies")
    user = relationship("User")
