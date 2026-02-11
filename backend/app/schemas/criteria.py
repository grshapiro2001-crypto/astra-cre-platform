"""
Pydantic schemas for investment criteria and screening results
"""
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class InvestmentCriteriaBase(BaseModel):
    """Base schema for investment criteria fields"""
    criteria_name: Optional[str] = "Default Criteria"

    # Property Filters
    min_units: Optional[int] = None
    max_units: Optional[int] = None
    property_types: Optional[str] = None
    target_markets: Optional[str] = None
    min_year_built: Optional[int] = None

    # Financial Thresholds
    min_cap_rate: Optional[float] = None
    max_cap_rate: Optional[float] = None
    min_economic_occupancy: Optional[float] = None
    max_opex_ratio: Optional[float] = None
    min_noi: Optional[float] = None
    max_price_per_unit: Optional[float] = None

    # Deal Score
    min_deal_score: Optional[int] = None


class InvestmentCriteriaUpdate(InvestmentCriteriaBase):
    """Schema for updating criteria (all fields optional)"""
    pass


class InvestmentCriteriaResponse(InvestmentCriteriaBase):
    """Schema for criteria response"""
    id: int
    user_id: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ScreeningCheck(BaseModel):
    """Single criterion check result"""
    criterion: str
    value: Optional[float] = None
    result: str  # "PASS", "FAIL", "SKIP"


class ScreeningResult(BaseModel):
    """Full screening result for a property"""
    property_id: int
    property_name: str
    verdict: str  # "PASS", "FAIL", "REVIEW"
    score: int  # percentage of criteria met
    checks: List[ScreeningCheck]
    summary: str


class ScreeningSummaryItem(BaseModel):
    """Screening result for summary endpoint"""
    property_id: int
    property_name: str
    verdict: str
    score: int
    summary: str
