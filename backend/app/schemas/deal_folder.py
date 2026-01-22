"""
Pydantic schemas for Deal Folders and BOV-specific data
"""
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel


# ==================== DEAL FOLDER SCHEMAS ====================

class DealFolderBase(BaseModel):
    """Base schema for deal folder"""
    folder_name: str
    property_type: Optional[str] = None
    property_address: Optional[str] = None
    submarket: Optional[str] = None
    total_units: Optional[int] = None
    total_sf: Optional[int] = None
    status: Optional[str] = 'active'
    notes: Optional[str] = None


class DealFolderCreate(DealFolderBase):
    """Schema for creating a deal folder"""
    pass


class DealFolderUpdate(BaseModel):
    """Schema for updating a deal folder (all fields optional)"""
    folder_name: Optional[str] = None
    property_type: Optional[str] = None
    property_address: Optional[str] = None
    submarket: Optional[str] = None
    total_units: Optional[int] = None
    total_sf: Optional[int] = None
    status: Optional[str] = None
    notes: Optional[str] = None


class DealFolderResponse(DealFolderBase):
    """Schema for deal folder response"""
    id: int
    user_id: str  # Fixed: User.id is UUID string
    created_date: datetime
    last_updated: datetime
    document_count: int

    class Config:
        from_attributes = True


class DealFolderWithDocuments(DealFolderResponse):
    """Schema for deal folder with associated documents (lazy-loaded)"""
    # Documents will be fetched separately to avoid circular imports
    pass


# ==================== BOV PRICING TIER SCHEMAS ====================

class BOVPricingTierBase(BaseModel):
    """Base schema for BOV pricing tier"""
    pricing_tier_id: str  # "tier_1", "tier_2", etc.
    tier_label: Optional[str] = None
    tier_type: Optional[str] = None

    # Pricing fields
    pricing: Optional[int] = None
    price_per_unit: Optional[int] = None
    price_per_sf: Optional[float] = None

    # Loan assumptions
    leverage: Optional[float] = None
    loan_amount: Optional[int] = None
    interest_rate: Optional[float] = None
    io_period_months: Optional[int] = None
    amortization_years: Optional[int] = None

    # Return metrics
    unlevered_irr: Optional[float] = None
    levered_irr: Optional[float] = None
    equity_multiple: Optional[float] = None
    avg_cash_on_cash: Optional[float] = None

    # Terminal assumptions
    terminal_cap_rate: Optional[float] = None
    hold_period_years: Optional[int] = None


class BOVPricingTierCreate(BOVPricingTierBase):
    """Schema for creating a BOV pricing tier"""
    property_id: int


class BOVPricingTierResponse(BOVPricingTierBase):
    """Schema for BOV pricing tier response"""
    id: int
    property_id: int

    class Config:
        from_attributes = True


# ==================== BOV CAP RATE SCHEMAS ====================

class BOVCapRateBase(BaseModel):
    """Base schema for BOV cap rate"""
    cap_rate_type: str  # "trailing", "proforma", "stabilized", etc.
    cap_rate_value: Optional[float] = None
    noi_basis: Optional[int] = None
    qualifier: Optional[str] = None


class BOVCapRateCreate(BOVCapRateBase):
    """Schema for creating a BOV cap rate"""
    pricing_tier_id: int


class BOVCapRateResponse(BOVCapRateBase):
    """Schema for BOV cap rate response"""
    id: int
    pricing_tier_id: int

    class Config:
        from_attributes = True


class BOVPricingTierWithCapRates(BOVPricingTierResponse):
    """Schema for BOV pricing tier with cap rates"""
    cap_rates: List[BOVCapRateResponse] = []
