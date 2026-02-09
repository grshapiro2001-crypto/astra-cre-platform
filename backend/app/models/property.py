"""
Property model for storing analyzed property data
"""
from sqlalchemy import Column, Integer, String, Text, Float, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.database import Base


class Property(Base):
    """Property model - stores analyzed property data to avoid re-analyzing PDFs"""
    __tablename__ = "properties"

    # Core identifiers
    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    deal_folder_id = Column(Integer, ForeignKey("deal_folders.id"), nullable=True)  # Phase 3A - folder organization
    deal_name = Column(String(255), nullable=False)
    uploaded_filename = Column(String(255))
    upload_date = Column(DateTime(timezone=True), server_default=func.now())
    document_type = Column(String(50))  # OM, BOV, Unknown
    document_subtype = Column(String(50), nullable=True)  # Phase 3A - "OM", "BOV", "Rent Roll", "T-12", "Other"

    # Property information
    property_address = Column(Text)
    property_type = Column(String(100))  # Office, Retail, Industrial, Multifamily
    submarket = Column(String(255))
    year_built = Column(Integer)
    total_units = Column(Integer)
    total_residential_sf = Column(Integer)
    average_market_rent = Column(Float)
    average_inplace_rent = Column(Float)

    # Financials stored as JSON (simpler MVP)
    t12_financials_json = Column(Text)  # JSON string
    t3_financials_json = Column(Text)   # JSON string
    y1_financials_json = Column(Text)   # JSON string

    # Extracted NOI for sorting/filtering (denormalized for performance)
    t12_noi = Column(Float)
    t3_noi = Column(Float)
    y1_noi = Column(Float)

    # Market sentiment (Phase 4 - AI populated, nullable until then)
    market_sentiment_score = Column(Float, nullable=True)  # 0-100
    market_sentiment_rationale = Column(Text, nullable=True)
    market_sentiment_updated_at = Column(DateTime(timezone=True), nullable=True)

    # Metadata
    raw_pdf_path = Column(Text)  # Relative path like "uploads/user123/file.pdf"
    analysis_date = Column(DateTime(timezone=True))
    last_viewed_date = Column(DateTime(timezone=True))
    analysis_count = Column(Integer, default=1)
    last_analyzed_at = Column(DateTime(timezone=True))
    analysis_model = Column(String(100))  # e.g. "claude-sonnet-4-5-20250929"
    analysis_status = Column(String(50))  # success, failed, needs_review
    search_text = Column(Text)  # Lowercase concatenation for search


class AnalysisLog(Base):
    """Log of all analysis operations for auditing and debugging"""
    __tablename__ = "analysis_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    property_id = Column(Integer, ForeignKey("properties.id"))
    user_id = Column(String(36), ForeignKey("users.id"))
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    action = Column(String(50))  # "initial_analysis" or "reanalyze"
    model = Column(String(100))
    status = Column(String(50))  # "success" or "failed"
    error_message = Column(Text)
