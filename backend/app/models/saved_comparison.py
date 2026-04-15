"""
Saved Comparison model for persisting property comparisons
BUG-006 fix: Save Comparison feature now writes to database
"""
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON
from sqlalchemy.sql import func
from app.database import Base


class SavedComparison(Base):
    """Saved Comparison model - persists user's property comparison sets"""
    __tablename__ = "saved_comparisons"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=True, index=True)
    name = Column(String(255), nullable=False)
    property_ids = Column(JSON, nullable=False)          # List[int]
    subject_property_id = Column(Integer, nullable=True)
    tags = Column(JSON, nullable=True)                   # List[str]
    notes = Column(Text, nullable=True)
    preset_key = Column(String(50), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
