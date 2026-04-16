"""Pydantic schemas for the Retail DCF calculation module.

Mirrors the input/output shape of Walker & Dunlop's institutional proforma
"Retail" tab (Prose_Gainesville_Proforma_1_30_26_RH.xlsm). All percentages
are stored as decimals (0.05 = 5%); all monetary values are floats.

Two scenarios — ``premium`` (seller) and ``market`` (buyer) — are computed
side by side with different discount rates and exit caps so valuators can
show the bid-ask spread.
"""

from __future__ import annotations

from datetime import date

from pydantic import BaseModel, ConfigDict, Field


class RetailTenant(BaseModel):
    """One retail suite (tenant slot) on the rent roll.

    Up to six slots are present in the W&D template (Retail!C12:C17); this
    schema accepts arbitrary ``N``. A ``tenant_name`` of ``None`` or
    ``"Vacant"`` signals vacancy — the slot's ``annual_rent_per_sf``
    should still carry the assumed market rent so it flows into the
    weighted-average rent calculation.

    Attributes:
        unit_number: Suite identifier (Retail!B12+).
        tenant_name: Displayed tenant name; ``None`` / ``"Vacant"`` =
            vacant slot.
        square_feet: Leaseable SF (Retail!D12+).
        annual_rent_per_sf: Contract or market rent, $/sf/year
            (Retail!E12+).
        lease_start_date: Contract commencement.
        lease_expiration_date: Contract expiration.
        lease_type: "NNN", "Gross", "Modified Gross", etc.
        absorption_months: Vacant-unit lease-up delay in months
            (Retail!$C$33 default 6).

    Note:
        ``lease_start_date``, ``lease_expiration_date``, ``lease_type``,
        and ``absorption_months`` are accepted by the API but **not**
        consumed by MVP logic (``rollover_vacancy=False`` always uses
        structural vacancy). They reserve API shape for v2 per-tenant
        rollover logic.
    """

    model_config = ConfigDict(frozen=True)

    unit_number: int
    tenant_name: str | None = None
    square_feet: float = Field(ge=0.0)
    annual_rent_per_sf: float = Field(ge=0.0)
    lease_start_date: date | None = None
    lease_expiration_date: date | None = None
    lease_type: str | None = None
    absorption_months: int = Field(default=0, ge=0)


class RetailScenarioAssumptions(BaseModel):
    """Per-scenario valuation assumptions.

    W&D runs two scenarios on the Retail tab — Premium (seller-side, lower
    discount/cap) and Market (buyer-side, higher discount/cap).

    Attributes:
        discount_rate: Per-year NPV discount rate (decimal, e.g. 0.075).
        exit_cap: Terminal cap rate applied to year ``hold+1`` NCF
            (decimal, e.g. 0.065).
    """

    model_config = ConfigDict(frozen=True)

    discount_rate: float = Field(gt=0.0, le=1.0)
    exit_cap: float = Field(gt=0.0, le=1.0)


class RetailInput(BaseModel):
    """Inputs for the Retail standalone DCF.

    Cell references below point to
    Prose_Gainesville_Proforma_1_30_26_RH.xlsm / "Retail" tab.

    Attributes:
        enabled: Master toggle (Retail!$C$30).
        hold_period_years: DCF hold length in years (W&D: 10–15).
        rollover_vacancy: $C$32 Yes/No. MVP ignores and uses structural
            vacancy only; reserved for v2.
        vacant_leaseup_rollover_months: $C$33 — vacant lease-up months.
            Accepted but not consumed by MVP.
        tenants: Rent roll; may be empty (→ zero result).
        expenses_per_sf: Operating expenses per SF, year 1 (Retail!$C$36).
        tenant_expense_recovery: Fraction of expenses recovered from
            tenants (Retail!$C$37; 1.00 = 100%).
        tenant_improvement_per_sf: TI allowance per SF (Retail!$C$40).
        leasing_commission_percent: LC as % of PRI (Retail!$C$41).
        tenant_capex_recovery: Fraction of TI&LC recovered from tenants
            (Retail!$C$42).
        rental_inflation: Per-year rent growth decimal.
        structural_vacancy_loss: Structural vacancy rate decimal.
        credit_loss: Credit-loss rate decimal.
        expense_inflation: Per-year expense growth decimal.
        premium: Seller-scenario discount/exit cap.
        market: Buyer-scenario discount/exit cap.
        mf_ltv_ratio: MF Loan_Amount / Pro_Forma_Price; applied to
            retail value to size implied retail debt proceeds
            (Retail!$C$52).
    """

    model_config = ConfigDict(frozen=True)

    enabled: bool
    hold_period_years: int = Field(gt=0, le=30)
    rollover_vacancy: bool = False
    vacant_leaseup_rollover_months: int = Field(default=6, ge=0)
    tenants: list[RetailTenant]
    expenses_per_sf: float = Field(ge=0.0)
    tenant_expense_recovery: float = Field(ge=0.0, le=1.0)
    tenant_improvement_per_sf: float = Field(ge=0.0)
    leasing_commission_percent: float = Field(ge=0.0, le=1.0)
    tenant_capex_recovery: float = Field(ge=0.0, le=1.0)
    rental_inflation: float = Field(default=0.03, ge=-1.0, le=1.0)
    structural_vacancy_loss: float = Field(default=0.05, ge=0.0, le=1.0)
    credit_loss: float = Field(default=0.05, ge=0.0, le=1.0)
    expense_inflation: float = Field(default=0.0275, ge=-1.0, le=1.0)
    premium: RetailScenarioAssumptions
    market: RetailScenarioAssumptions
    mf_ltv_ratio: float = Field(ge=0.0, le=1.5)


class RetailAnnualCashFlow(BaseModel):
    """One DCF year of retail cash flow (Retail!L37:V44).

    Sign convention: revenues positive, expenses/losses negative. The
    ``net_cash_flow`` field is the sum of the seven components above it,
    matching Retail!L44.

    Attributes:
        year: 1-indexed DCF year.
        potential_rental_income: Retail!L37.
        vacancy_loss: Retail!L38 (negative).
        credit_loss: Retail!L39 (negative).
        expenses: Retail!L40 (negative).
        expense_reimbursements: Retail!L41 (positive, offsets expenses).
        ti_and_lc: Retail!L42 (negative).
        capex_reimbursements: Retail!L43 (positive, offsets TI&LC).
        net_cash_flow: Retail!L44 — sum of rows 37–43.
    """

    year: int
    potential_rental_income: float
    vacancy_loss: float
    credit_loss: float
    expenses: float
    expense_reimbursements: float
    ti_and_lc: float
    capex_reimbursements: float
    net_cash_flow: float


class RetailScenarioResult(BaseModel):
    """Output for a single scenario (Premium or Market).

    Attributes:
        scenario_name: ``"premium"`` or ``"market"``.
        discount_rate: Echoed from input for downstream display.
        exit_cap: Echoed from input for downstream display.
        annual_cash_flows: ``hold_period_years + 1`` entries. The last
            entry (year hold+1) is used only to compute the reversion.
        retail_value: NPV of operating NCFs plus terminal reversion
            (Retail!L47).
        year_1_cap_rate: Y1 NCF / retail_value (Retail!L48).
        value_per_retail_sf: retail_value / total_sqft (Retail!L49).
        maximum_debt_proceeds: mf_ltv_ratio × retail_value
            (Retail!L52).
        implied_ltv: maximum_debt_proceeds / retail_value
            (Retail!L53). Equal to ``mf_ltv_ratio`` by construction;
            exposed for validation.
    """

    scenario_name: str
    discount_rate: float
    exit_cap: float
    annual_cash_flows: list[RetailAnnualCashFlow]
    retail_value: float
    year_1_cap_rate: float
    value_per_retail_sf: float
    maximum_debt_proceeds: float
    implied_ltv: float


class RetailResult(BaseModel):
    """Top-level Retail calculation result.

    Always fully constructed. When ``enabled`` is False or the rent roll
    is empty, both scenarios carry zero-filled cash flows and zero
    scalars so callers can unconditionally sum retail value into the
    consolidated DCF.

    Attributes:
        enabled: Echoes the input toggle (and False if tenants empty).
        total_square_feet: Sum of ``RetailTenant.square_feet``.
        weighted_average_rent_per_sf: SF-weighted rent (Retail!$D$26).
        premium: Premium-scenario result.
        market: Market-scenario result.
    """

    enabled: bool
    total_square_feet: float
    weighted_average_rent_per_sf: float
    premium: RetailScenarioResult
    market: RetailScenarioResult
