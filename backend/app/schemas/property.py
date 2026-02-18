"""
Property schemas for request/response handling
"""
from pydantic import BaseModel, validator
from typing import Optional, List
from datetime import datetime


# ==================== FINANCIAL PERIOD SCHEMAS ====================

class FinancialPeriodData(BaseModel):
    """Financial data for a single period (T12, T3, Y1, etc.)"""
    period_label: str = "Unknown"  # Default to avoid validation errors if frontend omits it
    gsr: Optional[float] = None
    vacancy: Optional[float] = None
    concessions: Optional[float] = None
    bad_debt: Optional[float] = None
    non_revenue_units: Optional[float] = None
    total_opex: Optional[float] = None
    noi: Optional[float] = None
    opex_ratio: Optional[float] = None
    # Granular financial line items
    loss_to_lease: Optional[float] = None
    vacancy_rate_pct: Optional[float] = None
    credit_loss: Optional[float] = None
    net_rental_income: Optional[float] = None
    utility_reimbursements: Optional[float] = None
    parking_storage_income: Optional[float] = None
    other_income: Optional[float] = None
    management_fee_pct: Optional[float] = None
    real_estate_taxes: Optional[float] = None
    insurance_amount: Optional[float] = None
    replacement_reserves: Optional[float] = None
    net_cash_flow: Optional[float] = None
    expense_ratio_pct: Optional[float] = None


# ==================== BOV SCHEMAS ====================

class BOVCapRateData(BaseModel):
    """Cap rate data for a BOV pricing tier"""
    cap_rate_type: str = "Unknown"  # Default to avoid validation errors from extraction data
    cap_rate_value: Optional[float] = None
    noi_basis: Optional[int] = None
    qualifier: Optional[str] = None


class BOVLoanAssumptions(BaseModel):
    """Loan assumptions for a BOV pricing tier"""
    leverage: Optional[float] = None
    loan_amount: Optional[int] = None
    interest_rate: Optional[float] = None
    io_period_months: Optional[int] = None
    amortization_years: Optional[int] = None


class BOVReturnMetrics(BaseModel):
    """Return metrics for a BOV pricing tier"""
    unlevered_irr: Optional[float] = None
    levered_irr: Optional[float] = None
    equity_multiple: Optional[float] = None
    avg_cash_on_cash: Optional[float] = None


class BOVTerminalAssumptions(BaseModel):
    """Terminal assumptions for a BOV pricing tier"""
    terminal_cap_rate: Optional[float] = None
    hold_period_years: Optional[int] = None


class BOVPricingTierData(BaseModel):
    """Complete BOV pricing tier data"""
    pricing_tier_id: str = "tier_0"  # Default to avoid validation errors from extraction data
    tier_label: Optional[str] = None
    tier_type: Optional[str] = None
    pricing: Optional[int] = None
    price_per_unit: Optional[int] = None
    price_per_sf: Optional[float] = None
    cap_rates: List[BOVCapRateData] = []
    loan_assumptions: Optional[BOVLoanAssumptions] = None
    return_metrics: Optional[BOVReturnMetrics] = None
    terminal_assumptions: Optional[BOVTerminalAssumptions] = None


# ==================== UNIT MIX & RENT COMP SCHEMAS ====================

class UnitMixItem(BaseModel):
    """Unit mix row from extracted OM data"""
    id: Optional[int] = None
    floorplan_name: Optional[str] = None
    unit_type: Optional[str] = None
    bedroom_count: Optional[int] = None
    bathroom_count: Optional[int] = None
    num_units: Optional[int] = None
    unit_sf: Optional[int] = None
    in_place_rent: Optional[float] = None
    proforma_rent: Optional[float] = None
    proforma_rent_psf: Optional[float] = None
    renovation_premium: Optional[float] = None

    class Config:
        from_attributes = True


class RentCompItem(BaseModel):
    """Rent comp extracted from OM"""
    id: Optional[int] = None
    comp_name: Optional[str] = "Unknown"  # Default to avoid Pydantic validation failures if extraction omits name
    location: Optional[str] = None
    num_units: Optional[int] = None
    avg_unit_sf: Optional[int] = None
    in_place_rent: Optional[float] = None
    in_place_rent_psf: Optional[float] = None
    bedroom_type: Optional[str] = None
    is_new_construction: bool = False

    class Config:
        from_attributes = True


# ==================== SAVE PROPERTY REQUEST ====================

class PropertyCreate(BaseModel):
    """Request model for saving a property to the library"""
    # Required
    deal_name: str
    uploaded_filename: str
    document_type: str
    deal_folder_id: int  # Phase 3A - REQUIRED folder association
    document_subtype: Optional[str] = None  # Phase 3A - "OM", "BOV", "Rent Roll", etc.

    # Property info
    property_address: Optional[str] = None
    property_type: Optional[str] = None
    submarket: Optional[str] = None
    metro: Optional[str] = None
    year_built: Optional[int] = None
    total_units: Optional[int] = None
    total_residential_sf: Optional[int] = None
    average_market_rent: Optional[float] = None
    average_inplace_rent: Optional[float] = None

    # Renovation assumptions
    renovation_cost_per_unit: Optional[float] = None
    renovation_total_cost: Optional[float] = None
    renovation_rent_premium: Optional[float] = None
    renovation_roi_pct: Optional[float] = None
    renovation_duration_years: Optional[int] = None
    renovation_stabilized_revenue: Optional[float] = None

    # Financial periods (as structured data)
    t12_financials: Optional[FinancialPeriodData] = None
    t3_financials: Optional[FinancialPeriodData] = None
    y1_financials: Optional[FinancialPeriodData] = None

    # BOV pricing tiers (Phase 3A - only for BOV documents)
    bov_pricing_tiers: Optional[List[BOVPricingTierData]] = None

    # Unit mix and rent comps
    unit_mix: Optional[List[UnitMixItem]] = None
    rent_comps: Optional[List[RentCompItem]] = None

    # Metadata
    raw_pdf_path: str
    analysis_model: str


# ==================== PROPERTY RESPONSES ====================

class PropertyListItem(BaseModel):
    """Summary for property list view (library page)"""
    id: int
    deal_name: str
    property_type: Optional[str]
    property_address: Optional[str]
    submarket: Optional[str]
    upload_date: datetime
    t3_noi: Optional[float]
    y1_noi: Optional[float]
    t12_noi: Optional[float]
    document_type: Optional[str]
    total_units: Optional[int] = None
    deal_folder_id: Optional[int] = None  # Phase 3A
    document_subtype: Optional[str] = None  # Phase 3A
    screening_verdict: Optional[str] = None
    screening_score: Optional[int] = None
    user_guidance_price: Optional[float] = None
    pipeline_stage: str = "screening"  # Pipeline Kanban board
    pipeline_notes: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

    class Config:
        from_attributes = True


class PropertyDetail(BaseModel):
    """Full property detail for detail page"""
    # Core identifiers
    id: int
    deal_name: str
    uploaded_filename: Optional[str]
    upload_date: datetime
    document_type: Optional[str]
    deal_folder_id: Optional[int] = None  # Phase 3A
    document_subtype: Optional[str] = None  # Phase 3A

    # Property info
    property_address: Optional[str]
    property_type: Optional[str]
    submarket: Optional[str]
    metro: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    year_built: Optional[int]
    total_units: Optional[int]
    total_residential_sf: Optional[int]
    average_market_rent: Optional[float]
    average_inplace_rent: Optional[float]

    # Renovation assumptions
    renovation_cost_per_unit: Optional[float] = None
    renovation_total_cost: Optional[float] = None
    renovation_rent_premium: Optional[float] = None
    renovation_roi_pct: Optional[float] = None
    renovation_duration_years: Optional[int] = None
    renovation_stabilized_revenue: Optional[float] = None

    # Financials (parsed from JSON)
    t12_financials: Optional[FinancialPeriodData] = None
    t3_financials: Optional[FinancialPeriodData] = None
    y1_financials: Optional[FinancialPeriodData] = None

    # BOV pricing tiers (Phase 3A - only for BOV documents)
    bov_pricing_tiers: Optional[List[BOVPricingTierData]] = None

    # Unit mix and rent comps
    unit_mix: List[UnitMixItem] = []
    rent_comps: List[RentCompItem] = []

    # Metadata
    analysis_date: Optional[datetime]
    last_viewed_date: Optional[datetime]
    analysis_count: Optional[int]
    last_analyzed_at: Optional[datetime]
    analysis_model: Optional[str]
    analysis_status: Optional[str]

    # Screening
    screening_verdict: Optional[str] = None
    screening_score: Optional[int] = None
    screening_details_json: Optional[str] = None

    # User-entered pricing guidance
    user_guidance_price: Optional[float] = None

    # Pipeline management
    pipeline_stage: str = "screening"
    pipeline_notes: Optional[str] = None
    pipeline_updated_at: Optional[datetime] = None

    # Documents (Phase 1: Excel Integration)
    documents: List["PropertyDocumentResponse"] = []

    # Rent roll summary (Phase 1: Excel Integration)
    rr_total_units: Optional[int] = None
    rr_occupied_units: Optional[int] = None
    rr_vacancy_count: Optional[int] = None
    rr_physical_occupancy_pct: Optional[float] = None
    rr_avg_market_rent: Optional[float] = None
    rr_avg_in_place_rent: Optional[float] = None
    rr_avg_sqft: Optional[float] = None
    rr_loss_to_lease_pct: Optional[float] = None
    rr_as_of_date: Optional[datetime] = None

    class Config:
        from_attributes = True


# ==================== FILTER/SEARCH PARAMETERS ====================

class PropertyFilters(BaseModel):
    """Query parameters for filtering/searching properties"""
    search: Optional[str] = None
    property_type: Optional[str] = None
    upload_date_start: Optional[datetime] = None
    upload_date_end: Optional[datetime] = None
    noi_min: Optional[float] = None
    noi_max: Optional[float] = None
    sort_by: str = "upload_date"
    sort_direction: str = "desc"


class PropertyListResponse(BaseModel):
    """Response for property list endpoint"""
    properties: List[PropertyListItem]
    total: int


# ==================== COMPARISON SCHEMAS (Phase 3B) ====================

class ComparisonPricing(BaseModel):
    price: Optional[int] = None
    price_per_unit: Optional[int] = None
    price_per_sf: Optional[float] = None


class ComparisonCapRates(BaseModel):
    going_in: Optional[float] = None
    stabilized: Optional[float] = None


class ComparisonBOVReturns(BaseModel):
    tier_name: Optional[str] = None
    levered_irr: Optional[float] = None
    unlevered_irr: Optional[float] = None
    equity_multiple: Optional[float] = None


class ComparisonFinancials(BaseModel):
    t12_noi: Optional[int] = None
    y1_noi: Optional[int] = None
    noi_growth_pct: Optional[float] = None


class ComparisonOperations(BaseModel):
    opex_ratio: Optional[float] = None
    opex_per_unit: Optional[int] = None


class PropertyComparisonItem(BaseModel):
    id: int
    property_name: str
    document_type: str
    property_type: Optional[str] = None
    property_address: Optional[str] = None
    submarket: Optional[str] = None
    total_units: Optional[int] = None
    total_sf: Optional[int] = None
    year_built: Optional[int] = None

    pricing: ComparisonPricing
    cap_rates: ComparisonCapRates
    bov_returns: Optional[ComparisonBOVReturns] = None
    financials: ComparisonFinancials
    operations: ComparisonOperations


class BestValues(BaseModel):
    best_price_per_unit: Optional[int] = None
    best_price_per_sf: Optional[int] = None
    best_going_in_cap: Optional[int] = None
    best_stabilized_cap: Optional[int] = None
    best_levered_irr: Optional[int] = None
    best_unlevered_irr: Optional[int] = None
    best_equity_multiple: Optional[int] = None
    best_noi_growth: Optional[int] = None
    lowest_opex_ratio: Optional[int] = None
    lowest_opex_per_unit: Optional[int] = None


class ComparisonRequest(BaseModel):
    property_ids: List[int]

    @validator('property_ids')
    def validate_property_ids(cls, v):
        if len(v) < 2:
            raise ValueError('Must select at least 2 properties')
        if len(v) > 5:
            raise ValueError('Cannot compare more than 5 properties')
        return v


class ComparisonResponse(BaseModel):
    properties: List[PropertyComparisonItem]
    best_values: BestValues


# ==================== DOCUMENT SCHEMAS (Phase 1: Excel Integration) ====================

class PropertyDocumentResponse(BaseModel):
    """Response for a single property document"""
    id: int
    filename: str
    file_type: str
    document_category: str
    document_date: Optional[datetime] = None
    uploaded_at: datetime
    extraction_status: str
    extraction_summary: Optional[str] = None

    class Config:
        from_attributes = True


class RentRollSummaryResponse(BaseModel):
    """Summary data from a rent roll extraction"""
    total_units: Optional[int] = None
    occupied_units: Optional[int] = None
    vacant_units: Optional[int] = None
    physical_occupancy_pct: Optional[float] = None
    avg_market_rent: Optional[float] = None
    avg_in_place_rent: Optional[float] = None
    avg_sqft: Optional[float] = None
    loss_to_lease_pct: Optional[float] = None


class T12SummaryResponse(BaseModel):
    """Summary data from a T-12 extraction"""
    fiscal_year: Optional[int] = None
    gross_potential_rent: Optional[float] = None
    loss_to_lease: Optional[float] = None
    concessions: Optional[float] = None
    vacancy_loss: Optional[float] = None
    bad_debt: Optional[float] = None
    net_rental_income: Optional[float] = None
    other_income: Optional[float] = None
    total_revenue: Optional[float] = None
    total_operating_expenses: Optional[float] = None
    net_operating_income: Optional[float] = None
    expense_ratio_pct: Optional[float] = None
    noi_margin_pct: Optional[float] = None

# Rebuild models with forward references
PropertyDetail.model_rebuild()
