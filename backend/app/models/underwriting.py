"""
UnderwritingModel — stores saved underwriting assumptions per property.
One active model per property. V1 does not support multiple saved models.
"""

import uuid

from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.database import Base


class UnderwritingModel(Base):
    __tablename__ = "underwriting_models"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    property_id = Column(Integer, ForeignKey("properties.id"), nullable=False, index=True)
    inputs_json = Column(Text, nullable=False)  # Complete UWInputs serialized as JSON
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    is_active = Column(Boolean, default=True)
