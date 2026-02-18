"""
Deal Folder and BOV-specific models for Phase 3A
"""
from sqlalchemy import Column, Integer, String, Text, Numeric, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base


class DealFolder(Base):
    """Deal Folder model - organizes documents by deal/property"""
    __tablename__ = "deal_folders"

    # Core identifiers
    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)  # Fixed: User.id is UUID string
    folder_name = Column(String(255), nullable=False)

    # Property summary fields (for display optimization)
    property_type = Column(String(100), nullable=True)
    property_address = Column(Text, nullable=True)
    submarket = Column(String(255), nullable=True)
    total_units = Column(Integer, nullable=True)
    total_sf = Column(Integer, nullable=True)

    # Metadata
    created_date = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    last_updated = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    document_count = Column(Integer, default=0, nullable=False)
    status = Column(String(50), default='active', nullable=True)  # 'active', 'archived'
    notes = Column(Text, nullable=True)


class BOVPricingTier(Base):
    """BOV Pricing Tier model - each tier is a complete isolated package of metrics"""
    __tablename__ = "bov_pricing_tiers"

    # Core identifiers
    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    property_id = Column(Integer, ForeignKey("properties.id", ondelete='CASCADE'), nullable=False)
    pricing_tier_id = Column(String(50), nullable=False)  # "tier_1", "tier_2", "tier_3", etc.
    tier_label = Column(String(255), nullable=True)  # "Premium Pricing", "Market Assumptions", etc.
    tier_type = Column(String(50), nullable=True)  # "market_assumption", "asking_price", or NULL

    # Pricing fields
    pricing = Column(Integer, nullable=True)  # Valuation for this tier
    price_per_unit = Column(Integer, nullable=True)
    price_per_sf = Column(Numeric(20, 6), nullable=True)

    # Loan assumptions
    leverage = Column(Numeric(20, 6), nullable=True)  # LTV %
    loan_amount = Column(Integer, nullable=True)
    interest_rate = Column(Numeric(20, 6), nullable=True)  # 5.25
    io_period_months = Column(Integer, nullable=True)
    amortization_years = Column(Integer, nullable=True)

    # Return metrics
    unlevered_irr = Column(Numeric(20, 6), nullable=True)
    levered_irr = Column(Numeric(20, 6), nullable=True)
    equity_multiple = Column(Numeric(20, 6), nullable=True)
    avg_cash_on_cash = Column(Numeric(20, 6), nullable=True)

    # Terminal assumptions
    terminal_cap_rate = Column(Numeric(20, 6), nullable=True)
    hold_period_years = Column(Integer, nullable=True)


class BOVCapRate(Base):
    """BOV Cap Rate model - cap rates linked to pricing tiers"""
    __tablename__ = "bov_cap_rates"

    # Core identifiers
    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    pricing_tier_id = Column(Integer, ForeignKey("bov_pricing_tiers.id", ondelete='CASCADE'), nullable=False)
    cap_rate_type = Column(String(50), nullable=False)  # "trailing", "proforma", "stabilized", etc.
    cap_rate_value = Column(Numeric(20, 6), nullable=True)  # 4.75
    noi_basis = Column(Integer, nullable=True)  # NOI value used for calculation
    qualifier = Column(String(100), nullable=True)  # "as-is", "stabilized", etc.
