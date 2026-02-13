"""
Property model for storing analyzed property data
"""
from sqlalchemy import Column, Integer, String, Text, Float, Numeric, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
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

    # Geography (fixes comp matching — metro was missing)
    metro = Column(String, nullable=True)  # e.g. "Atlanta" — MSA-level

    # Renovation assumptions (from value-add OMs/BOVs)
    renovation_cost_per_unit = Column(Numeric, nullable=True)
    renovation_total_cost = Column(Numeric, nullable=True)
    renovation_rent_premium = Column(Numeric, nullable=True)
    renovation_roi_pct = Column(Float, nullable=True)
    renovation_duration_years = Column(Integer, nullable=True)
    renovation_stabilized_revenue = Column(Numeric, nullable=True)

    # Financials stored as JSON (simpler MVP)
    t12_financials_json = Column(Text)  # JSON string
    t3_financials_json = Column(Text)   # JSON string
    y1_financials_json = Column(Text)   # JSON string

    # Extracted NOI for sorting/filtering (denormalized for performance)
    t12_noi = Column(Float)
    t3_noi = Column(Float)
    y1_noi = Column(Float)

    # Additional Y1 financial line items (from detailed OM proformas)
    y1_loss_to_lease = Column(Numeric, nullable=True)
    y1_vacancy_rate_pct = Column(Float, nullable=True)
    y1_concessions = Column(Numeric, nullable=True)
    y1_credit_loss = Column(Numeric, nullable=True)
    y1_net_rental_income = Column(Numeric, nullable=True)
    y1_utility_reimbursements = Column(Numeric, nullable=True)
    y1_parking_storage_income = Column(Numeric, nullable=True)
    y1_other_income = Column(Numeric, nullable=True)
    y1_management_fee_pct = Column(Float, nullable=True)
    y1_real_estate_taxes = Column(Numeric, nullable=True)
    y1_insurance = Column(Numeric, nullable=True)
    y1_replacement_reserves = Column(Numeric, nullable=True)
    y1_net_cash_flow = Column(Numeric, nullable=True)
    y1_expense_ratio_pct = Column(Float, nullable=True)

    # Granular T12 financial line items
    t12_loss_to_lease = Column(Numeric, nullable=True)
    t12_vacancy_rate_pct = Column(Float, nullable=True)
    t12_concessions = Column(Numeric, nullable=True)
    t12_credit_loss = Column(Numeric, nullable=True)
    t12_net_rental_income = Column(Numeric, nullable=True)
    t12_utility_reimbursements = Column(Numeric, nullable=True)
    t12_parking_storage_income = Column(Numeric, nullable=True)
    t12_other_income = Column(Numeric, nullable=True)
    t12_management_fee_pct = Column(Float, nullable=True)
    t12_real_estate_taxes = Column(Numeric, nullable=True)
    t12_insurance = Column(Numeric, nullable=True)
    t12_replacement_reserves = Column(Numeric, nullable=True)
    t12_net_cash_flow = Column(Numeric, nullable=True)
    t12_expense_ratio_pct = Column(Float, nullable=True)

    # Granular T3 financial line items
    t3_loss_to_lease = Column(Numeric, nullable=True)
    t3_vacancy_rate_pct = Column(Float, nullable=True)
    t3_concessions = Column(Numeric, nullable=True)
    t3_credit_loss = Column(Numeric, nullable=True)
    t3_net_rental_income = Column(Numeric, nullable=True)
    t3_utility_reimbursements = Column(Numeric, nullable=True)
    t3_parking_storage_income = Column(Numeric, nullable=True)
    t3_other_income = Column(Numeric, nullable=True)
    t3_management_fee_pct = Column(Float, nullable=True)
    t3_real_estate_taxes = Column(Numeric, nullable=True)
    t3_insurance = Column(Numeric, nullable=True)
    t3_replacement_reserves = Column(Numeric, nullable=True)
    t3_net_cash_flow = Column(Numeric, nullable=True)
    t3_expense_ratio_pct = Column(Float, nullable=True)

    # Metadata
    raw_pdf_path = Column(Text)  # Relative path like "uploads/user123/file.pdf"
    analysis_date = Column(DateTime(timezone=True))
    last_viewed_date = Column(DateTime(timezone=True))
    analysis_count = Column(Integer, default=1)
    last_analyzed_at = Column(DateTime(timezone=True))
    analysis_model = Column(String(100))  # e.g. "claude-sonnet-4-5-20250929"
    analysis_status = Column(String(50))  # success, failed, needs_review
    search_text = Column(Text)  # Lowercase concatenation for search

    # Deal Score v2 — Market Intelligence (Layer 2)
    market_sentiment_score = Column(Integer, nullable=True)  # -10 to +10
    market_sentiment_rationale = Column(Text, nullable=True)
    market_sentiment_updated_at = Column(DateTime(timezone=True), nullable=True)

    # Screening results (auto-populated on save)
    screening_verdict = Column(String, nullable=True)  # PASS/FAIL/REVIEW
    screening_score = Column(Integer, nullable=True)
    screening_details_json = Column(Text, nullable=True)  # JSON of checks array

    # Pipeline management (Kanban board)
    pipeline_stage = Column(String, nullable=False, server_default='screening')  # screening, under_review, loi, under_contract, closed, passed
    pipeline_notes = Column(Text, nullable=True)
    pipeline_updated_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    unit_mix = relationship("PropertyUnitMix", backref="property", cascade="all, delete-orphan")
    rent_comps = relationship("PropertyRentComp", backref="property", cascade="all, delete-orphan")


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


class PropertyUnitMix(Base):
    """Unit mix rows extracted from OM/BOV documents"""
    __tablename__ = "property_unit_mix"

    id = Column(Integer, primary_key=True, autoincrement=True)
    property_id = Column(Integer, ForeignKey("properties.id", ondelete="CASCADE"), nullable=False)

    floorplan_name = Column(String, nullable=True)       # "A6", "B3B", "S1B"
    unit_type = Column(String, nullable=True)             # "1 BD/1 BA", "Studio", "2 BD/2 BA"
    bedroom_count = Column(Integer, nullable=True)        # 0, 1, 2, 3
    bathroom_count = Column(Integer, nullable=True)       # 1, 2
    num_units = Column(Integer, nullable=True)            # 41
    unit_sf = Column(Integer, nullable=True)              # 824
    in_place_rent = Column(Numeric, nullable=True)        # 1616.00
    proforma_rent = Column(Numeric, nullable=True)        # 1664.00
    proforma_rent_psf = Column(Float, nullable=True)      # 2.02
    renovation_premium = Column(Numeric, nullable=True)   # 150 (per unit type)

    created_at = Column(DateTime, default=func.now())


class PropertyRentComp(Base):
    """Rent comps extracted FROM the OM (distinct from Data Bank sales comps)"""
    __tablename__ = "property_rent_comps"

    id = Column(Integer, primary_key=True, autoincrement=True)
    property_id = Column(Integer, ForeignKey("properties.id", ondelete="CASCADE"), nullable=False)

    comp_name = Column(String, nullable=True, default="Unknown")  # "The Linc at Brookhaven"
    location = Column(String, nullable=True)              # "Brookhaven"
    num_units = Column(Integer, nullable=True)            # 300
    avg_unit_sf = Column(Integer, nullable=True)          # 939
    in_place_rent = Column(Numeric, nullable=True)        # 2130.00
    in_place_rent_psf = Column(Float, nullable=True)      # 2.27
    bedroom_type = Column(String, nullable=True)          # "All", "Studio", "1BR", "2BR", "3BR"
    is_new_construction = Column(Boolean, default=False)

    created_at = Column(DateTime, default=func.now())
