"""
Pydantic schemas for the Underwriting Engine V1.
All percentages stored as decimals (0.05 = 5%). All monetary values as float.
"""

from __future__ import annotations

from typing import Optional
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Input Detail Items
# ---------------------------------------------------------------------------

class UnitMixInput(BaseModel):
    floorplan: str = ""
    units: int = 0
    sf: int = 0
    market_rent: float = 0.0
    inplace_rent: float = 0.0


class OtherIncomeItem(BaseModel):
    line_item: str = ""
    description: str = ""
    amount_per_unit: float = 0.0  # Per-unit input ($/unit/yr or $/unit/mo)
    input_mode: str = "per_unit_year"  # "per_unit_year" | "per_unit_month"
    fee_amount: float = 0.0
    annual_income: float = 0.0  # Backward compat: used if amount_per_unit is 0


class PayrollItem(BaseModel):
    position: str = ""
    salary: float = 0.0
    bonus: float = 0.0
    payroll_load_pct: float = 0.30


class ContractServiceItem(BaseModel):
    service: str = ""
    occupancy: float = 1.0
    monthly_per_unit: float = 0.0
    monthly_total: float = 0.0
    annual_total: float = 0.0


class CustomLineItem(BaseModel):
    """User-defined revenue or expense line item."""
    id: str = ""
    label: str = ""
    base_value: float = 0.0       # Y1 annual amount
    growth_rate: float = 0.0      # annual growth rate (decimal, e.g. 0.03 = 3%)
    start_year: int = 1           # 1-based year when item begins
    category: str = "revenue"     # "revenue" | "expense"


# ---------------------------------------------------------------------------
# Scenario Inputs
# ---------------------------------------------------------------------------

class ScenarioInputs(BaseModel):
    pricing_mode: str = "manual"  # "manual" | "direct_cap" | "target_irr"
    purchase_price: Optional[float] = 0.0  # Required for manual mode
    terminal_cap_rate: float = 0.0525
    target_cap_rate: Optional[float] = None  # Required for direct_cap mode
    target_unlevered_irr: Optional[float] = None  # Required for target_irr mode


# ---------------------------------------------------------------------------
# Growth assumption arrays — 8 years
# ---------------------------------------------------------------------------

def _arr8(val: float) -> list[float]:
    return [val] * 8


# ---------------------------------------------------------------------------
# Complete Input Schema (spec Section 10)
# ---------------------------------------------------------------------------

class UWInputs(BaseModel):
    # Property
    total_units: int = 0
    total_sf: int = 0
    unit_mix: list[UnitMixInput] = Field(default_factory=list)

    # Trailing financials (for display — T12/T3 columns)
    trailing_t12: Optional[dict] = None
    trailing_t3: Optional[dict] = None

    # Scenarios
    premium: ScenarioInputs = Field(default_factory=ScenarioInputs)
    market: ScenarioInputs = Field(default_factory=ScenarioInputs)

    # Revenue Assumptions (Section 10.3)
    rent_basis: str = "market"  # "market" | "inplace"
    retention_ratio: float = 0.55
    renewal_rent_bump: float = 0.70
    vacancy_pct: list[float] = Field(default_factory=lambda: _arr8(0.05))
    concession_pct: list[float] = Field(default_factory=lambda: [0.02, 0.01] + [0.0] * 6)
    bad_debt_pct: list[float] = Field(default_factory=lambda: [0.01, 0.005] + [0.005] * 6)
    nru_count: int = 2
    nru_avg_rent: float = 0.0  # If 0, engine uses avg market rent
    utility_reimb_per_unit: float = 0.0
    parking_income_per_unit: float = 0.0
    other_income_items: list[OtherIncomeItem] = Field(default_factory=list)

    # Expense Assumptions (Section 10.4)
    utilities_per_unit: float = 0.0
    repairs_per_unit: float = 0.0
    make_ready_per_unit: float = 0.0
    contract_services_per_unit: float = 0.0
    marketing_per_unit: float = 0.0
    payroll_items: list[PayrollItem] = Field(default_factory=list)
    ga_per_unit: float = 0.0
    property_tax_mode: str = "reassessment"  # "current" | "reassessment"
    current_tax_amount: float = 0.0
    pct_of_purchase_assessed: float = 1.0  # % of purchase price used as FMV
    assessment_ratio: float = 0.40  # GA standard: 40%
    millage_rate: float = 4.0  # Entered as percentage (4.0 = 4.0%). Engine divides by 100.
    reassessment_year: int = 1
    insurance_per_unit: float = 0.0
    mgmt_fee_pct: float = 0.0275
    reserves_per_unit: float = 200.0
    reserves_inflate: bool = False

    # Contract services detail (optional)
    contract_services_items: list[ContractServiceItem] = Field(default_factory=list)

    # Growth Assumptions (Section 10.5) — 8-year arrays
    rental_inflation: list[float] = Field(default_factory=lambda: _arr8(0.02))
    expense_inflation: list[float] = Field(default_factory=lambda: _arr8(0.0275))
    re_tax_inflation: list[float] = Field(default_factory=lambda: _arr8(0.0275))

    # Debt Assumptions — New Acquisition (Section 10.6)
    max_ltv: float = 0.60
    interest_rate: float = 0.0525
    loan_term_months: int = 84
    io_period_months: int = 84
    amort_years: int = 30
    dscr_minimum: float = 1.25
    sales_expense_pct: float = 0.015
    hold_period_years: int = 8

    # Debt Assumptions — Loan Assumption (Section 10.7)
    la_enabled: bool = False
    la_existing_balance: float = 0.0
    la_original_amount: float = 0.0
    la_interest_rate: float = 0.0
    la_origination_date: Optional[str] = None
    la_remaining_term_months: int = 0
    la_remaining_io_months: int = 0
    la_amort_years: int = 30

    # Cell overrides — per-scenario, keyed by "line_key:year_index"
    # Example: {"premium": {"gpr:2": 4500000.0}, "market": {}}
    overrides: dict[str, dict[str, float]] = Field(default_factory=dict)

    # Custom line items (user-defined revenue/expense rows)
    custom_revenue_items: list[CustomLineItem] = Field(default_factory=list)
    custom_expense_items: list[CustomLineItem] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Output Sub-Results
# ---------------------------------------------------------------------------

class RevenueResult(BaseModel):
    gsr: float = 0.0
    gain_loss_to_lease: float = 0.0
    gpr: float = 0.0
    vacancy: float = 0.0
    concessions: float = 0.0
    nru_loss: float = 0.0
    bad_debt: float = 0.0
    nri: float = 0.0
    utility_reimbursements: float = 0.0
    parking_income: float = 0.0
    other_income: float = 0.0
    total_income: float = 0.0
    monthly_collections: float = 0.0


class ExpenseResult(BaseModel):
    utilities: float = 0.0
    repairs_maintenance: float = 0.0
    make_ready: float = 0.0
    contract_services: float = 0.0
    marketing: float = 0.0
    payroll: float = 0.0
    general_admin: float = 0.0
    controllable_total: float = 0.0
    property_taxes: float = 0.0
    insurance: float = 0.0
    management_fee: float = 0.0
    non_controllable_total: float = 0.0
    total_expenses: float = 0.0


class ProformaResult(BaseModel):
    revenue: RevenueResult = Field(default_factory=RevenueResult)
    expenses: ExpenseResult = Field(default_factory=ExpenseResult)
    noi: float = 0.0
    reserves: float = 0.0
    ncf: float = 0.0
    expense_ratio: float = 0.0


class DebtResult(BaseModel):
    loan_amount: float = 0.0
    actual_ltv: float = 0.0
    equity: float = 0.0
    is_dscr_constrained: bool = False
    annual_debt_service: list[float] = Field(default_factory=list)
    principal_outstanding: list[float] = Field(default_factory=list)
    loan_constant: float = 0.0


class DCFYearResult(BaseModel):
    year: int = 0
    # Revenue
    gpr: float = 0.0
    vacancy: float = 0.0
    concessions: float = 0.0
    bad_debt: float = 0.0
    nru_loss: float = 0.0
    nri: float = 0.0
    other_income: float = 0.0
    total_income: float = 0.0
    # Expenses
    controllable_expenses: float = 0.0
    property_taxes: float = 0.0
    insurance: float = 0.0
    management_fee: float = 0.0
    total_expenses: float = 0.0
    # Bottom line
    noi: float = 0.0
    reserves: float = 0.0
    ncf: float = 0.0
    # Debt (per scenario)
    debt_service: float = 0.0
    ncf_after_debt: float = 0.0
    # Metrics
    cash_on_cash: Optional[float] = None
    dscr: Optional[float] = None
    revenue_growth_rate: Optional[float] = None
    noi_growth_rate: Optional[float] = None
    effective_rent: float = 0.0
    # Custom line item totals
    custom_revenue: float = 0.0
    custom_expenses: float = 0.0
    # Pre-override computed values for overridden cells (sparse — only populated for overridden keys)
    computed_values: Optional[dict[str, float]] = None


class DCFResult(BaseModel):
    years: list[DCFYearResult] = Field(default_factory=list)
    revenue_cagr: Optional[float] = None
    noi_cagr: Optional[float] = None


class ReversionResult(BaseModel):
    forward_noi: float = 0.0
    gross_selling_price: float = 0.0
    sales_expenses: float = 0.0
    principal_outstanding: float = 0.0
    net_proceeds: float = 0.0


class ReturnsResult(BaseModel):
    levered_irr: Optional[float] = None
    unlevered_irr: Optional[float] = None
    y1_cash_on_cash: Optional[float] = None
    avg_cash_on_cash: Optional[float] = None
    equity_multiple: Optional[float] = None
    reversion: ReversionResult = Field(default_factory=ReversionResult)


class CapRates(BaseModel):
    y1_cap_rate: Optional[float] = None
    inplace_cap_tax_adjusted: Optional[float] = None
    terminal_cap_rate: Optional[float] = None


class ValuationSummary(BaseModel):
    purchase_price: float = 0.0
    price_per_unit: float = 0.0
    price_per_sf: float = 0.0
    cap_rates: CapRates = Field(default_factory=CapRates)
    y1_market_rent: float = 0.0
    y1_market_rent_psf: float = 0.0
    ltv: float = 0.0
    levered_irr: Optional[float] = None
    unlevered_irr: Optional[float] = None
    y1_cash_on_cash: Optional[float] = None
    avg_cash_on_cash: Optional[float] = None
    equity_multiple: Optional[float] = None
    terminal_value: float = 0.0
    terminal_value_per_unit: float = 0.0
    revenue_cagr: Optional[float] = None
    noi_cagr: Optional[float] = None


class ScenarioResult(BaseModel):
    proforma: ProformaResult = Field(default_factory=ProformaResult)
    debt: DebtResult = Field(default_factory=DebtResult)
    dcf: DCFResult = Field(default_factory=DCFResult)
    returns: ReturnsResult = Field(default_factory=ReturnsResult)
    valuation_summary: ValuationSummary = Field(default_factory=ValuationSummary)


# ---------------------------------------------------------------------------
# Operating Statement (3-column: T12, T3, Proforma)
# ---------------------------------------------------------------------------

class OperatingStatementLine(BaseModel):
    label: str = ""
    t12_amount: Optional[float] = None
    t12_pct_income: Optional[float] = None
    t12_per_unit: Optional[float] = None
    t3_amount: Optional[float] = None
    t3_pct_income: Optional[float] = None
    t3_per_unit: Optional[float] = None
    proforma_amount: Optional[float] = None
    proforma_pct_income: Optional[float] = None
    proforma_per_unit: Optional[float] = None
    is_deduction: bool = False
    is_total: bool = False


class OperatingStatement(BaseModel):
    revenue_lines: list[OperatingStatementLine] = Field(default_factory=list)
    expense_lines: list[OperatingStatementLine] = Field(default_factory=list)
    summary_lines: list[OperatingStatementLine] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Complete Output Schema
# ---------------------------------------------------------------------------

class UWOutputs(BaseModel):
    proforma: ProformaResult = Field(default_factory=ProformaResult)
    scenarios: dict[str, ScenarioResult] = Field(default_factory=dict)
    operating_statement: OperatingStatement = Field(default_factory=OperatingStatement)
    operating_statements: dict[str, OperatingStatement] = Field(default_factory=dict)


# ---------------------------------------------------------------------------
# API Request/Response Models
# ---------------------------------------------------------------------------

class ComputeRequest(BaseModel):
    inputs: UWInputs = Field(default_factory=UWInputs)


class SaveRequest(BaseModel):
    property_id: int
    inputs: UWInputs


class SaveResponse(BaseModel):
    model_id: int
    saved_at: str


class LoadResponse(BaseModel):
    model_id: int
    inputs: UWInputs
    outputs: UWOutputs
