from sqlalchemy import Column, String, Text, DateTime, Float, Integer, ForeignKey
from sqlalchemy.sql import func
import uuid
from app.database import Base


class ExtractionLog(Base):
    """
    Logs every Claude extraction attempt with confidence scores and field-level results.
    Used for the AI Learning Pipeline — tracks which document patterns produce
    reliable extractions and where the model struggles.
    """
    __tablename__ = "extraction_logs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    property_id = Column(Integer, ForeignKey("properties.id"), nullable=True, index=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=True)

    # Document identification
    filename = Column(String(500), nullable=False)
    document_type = Column(String(50), nullable=True)  # OM, BOV, Rent Roll, etc.
    document_fingerprint = Column(String(128), nullable=True)  # Hash of first 2000 chars for dedup

    # Confidence scores
    overall_confidence = Column(String(20), nullable=True)  # high, medium, low
    confidence_score = Column(Float, nullable=True)  # 0.0 to 1.0 numeric equivalent

    # Field-level extraction results
    fields_extracted = Column(Integer, nullable=True)  # Count of non-null fields
    fields_expected = Column(Integer, nullable=True)   # Count of expected fields for doc type
    field_confidence_json = Column(Text, nullable=True)  # Per-field confidence breakdown

    # Extraction metadata
    pdf_text_length = Column(Integer, nullable=True)
    was_truncated = Column(Integer, nullable=True, default=0)  # 1 if truncated
    model_used = Column(String(100), nullable=True)
    extraction_time_ms = Column(Integer, nullable=True)
    error_message = Column(Text, nullable=True)  # If extraction failed

    # AI Learning — pattern tracking
    broker_name = Column(String(255), nullable=True)  # For pattern library grouping
    extraction_data_json = Column(Text, nullable=True)  # Full Claude response (for debugging)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
