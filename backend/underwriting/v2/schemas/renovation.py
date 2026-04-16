"""Pydantic schemas for the Renovation calculation module.

Mirrors the input/output shape of Walker & Dunlop's institutional proforma
"Renovation" tab (Prose_Gainesville_Proforma_1_30_26_RH.xlsm). Five
unit-type waterfalls (Studio / 1BR / 2BR / 3BR / 4BR) feed a 43-quarter
schedule that rolls up into 11 fiscal years. The annual cumulative
revenue-growth series and total CapEx are the integration points with
the multifamily Proforma / DCF — see ``renovation.py`` module docstring
for the integration contract.

All percentages are decimals (0.03 = 3%); all monetary values are floats.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationInfo, field_validator


class RenovationUnitType(BaseModel):
    """One unit-type slot in the renovation waterfall.

    Up to five slots are present in the W&D template (Renovation!C15:C19,
    Studio / 1BR / 2BR / 3BR / 4BR). Slots with ``units_to_renovate == 0``
    contribute zero to every quarter and are safe to include or omit.

    Attributes:
        unit_type: Bedroom count label.
        units_to_renovate: Total units of this type slated for renovation
            (Renovation!D15+).
        rent_premium_per_month: Post-renovation rent premium in $/unit/month
            (Renovation!F15+ — base premium, before annual compounding).
    """

    model_config = ConfigDict(frozen=True)

    unit_type: Literal["Studio", "1BR", "2BR", "3BR", "4BR"]
    units_to_renovate: int = Field(ge=0)
    rent_premium_per_month: float = Field(ge=0.0)


class RenovationInput(BaseModel):
    """Inputs for the Renovation calculation.

    Cell references below point to
    Prose_Gainesville_Proforma_1_30_26_RH.xlsm / "Renovation" tab.

    Attributes:
        enabled: Master toggle (Renovation!$F$4 — "Yes"/"No").
        start_year: 1-indexed fiscal year renovations begin (Renovation!F5).
        duration_years: Renovation program length in years
            (Renovation!F6). Total renovation quarters = ``duration_years
            * 4``.
        cost_per_unit: All-in renovation cost per unit, $ (Renovation!F7).
        unit_types: Per-bedroom-count waterfall slots; may be empty
            (-> zero result).
        incremental_rent_growth_rates: 11 annual rates pulled from
            Valuation!C18:M18, used by the Row 43 cumulative formula.
            Index 0 = year 1.
        downtime_months_per_unit: W&D bakes in 1 month of downtime per
            renovated unit via the Row 87 factor schedule
            (1.0, 11/12, 10/12, 9/12). Exposed for flexibility but only
            the default value (1) reproduces W&D output.
        finance_with_loan: Informational flag indicating CapEx will be
            loan-financed. The actual LTV->LTC conversion happens in the
            downstream integration step (NOT in this module).
    """

    model_config = ConfigDict(frozen=True)

    enabled: bool
    start_year: int = Field(ge=1, le=11)
    duration_years: int = Field(ge=1, le=11)
    cost_per_unit: float = Field(ge=0.0)
    unit_types: list[RenovationUnitType]
    incremental_rent_growth_rates: list[float]
    downtime_months_per_unit: int = Field(default=1, ge=0, le=3)
    finance_with_loan: bool = False

    @field_validator("incremental_rent_growth_rates")
    @classmethod
    def _validate_growth_rates_length(
        cls, v: list[float], info: ValidationInfo
    ) -> list[float]:
        """Enforce 11 entries to match W&D Row 42 / Valuation!C18:M18."""
        if len(v) != 11:
            raise ValueError(
                f"incremental_rent_growth_rates must have exactly 11 entries "
                f"(one per fiscal year), got {len(v)}"
            )
        return v


class RenovationQuarterlyCashFlow(BaseModel):
    """One quarter of the renovation waterfall (Renovation rows 81-91).

    Attributes:
        quarter: 1-indexed quarter, 1..43 (Renovation columns D:AU).
        fiscal_year: W&D Row 49 "Pro Forma Year (Current)" — equals
            ``start_year + (quarter - 1) // 4``.
        quarter_in_year: 1, 2, 3, or 4 — position within the fiscal year.
        units_renovated: Sum of scheduled renos across the 5 unit types
            for this quarter (Renovation!D81+).
        incremental_revenue_gross_monthly: SUMPRODUCT of scheduled units
            x rent premium across unit types — a MONTHLY $ figure
            (Renovation!D86+).
        incremental_revenue_factor: Downtime factor by quarter-in-year
            (1.0, 11/12, 10/12, 9/12) — Renovation!D87+.
        incremental_revenue_actual_monthly: ``gross_monthly * factor``
            when units_renovated > 0, else 0 (Renovation!D88+).
        renovation_capex: ``cost_per_unit * units_renovated``
            (Renovation!D91+).
    """

    quarter: int
    fiscal_year: int
    quarter_in_year: int
    units_renovated: float
    incremental_revenue_gross_monthly: float
    incremental_revenue_factor: float
    incremental_revenue_actual_monthly: float
    renovation_capex: float


class RenovationAnnualRollup(BaseModel):
    """One fiscal year of the annual rollup (Renovation rows 32-43).

    Attributes:
        fiscal_year: 1-indexed fiscal year (Renovation!C32:M32 = 1..11).
        renovations_completed: Units renovated this year
            (Renovation!C34:M34).
        annual_renovation_cost: Total CapEx this year
            (Renovation!C36:M36).
        potential_rent_premium_annual: Sum of monthly gross premiums
            across the year's 4 quarters (Renovation!C38:M38).
        downtime_deduction: ``current_year_revenue_growth -
            potential_rent_premium_annual`` (negative or zero) —
            Renovation!C39:M39.
        current_year_revenue_growth: Sum of monthly actual premiums
            across the year's 4 quarters (Renovation!C40:M40).
        incremental_rent_growth_rate: Per-year growth pulled from caller
            (Renovation!C42:M42 / Valuation!C18:M18).
        cumulative_revenue_growth: Row 43 — KEY OUTPUT that feeds
            Valuation!C106 in the integration step.
    """

    fiscal_year: int
    renovations_completed: float
    annual_renovation_cost: float
    potential_rent_premium_annual: float
    downtime_deduction: float
    current_year_revenue_growth: float
    incremental_rent_growth_rate: float
    cumulative_revenue_growth: float


class RenovationResult(BaseModel):
    """Top-level Renovation calculation result.

    Always fully constructed. When ``enabled`` is False, the rent roll
    is empty, or no units are slated for renovation, all scalars are 0.0
    and the time-series carry 43 zero quarterlies / 11 zero annuals.
    Callers can unconditionally consume the result without None checks.

    Attributes:
        enabled: Echoes the input toggle (False if no work to do).
        total_units_renovated: Sum of Row 34 across all 11 years
            (Renovation!F24).
        total_renovation_cost: Sum of Row 36 across all 11 years
            (Renovation!F26).
        weighted_avg_rent_premium: SF-weighted average premium in $/mo
            (Renovation!F8 / F20).
        implied_return_on_cost: ``(weighted_avg_rent_premium * 12) /
            cost_per_unit`` (Renovation!F9).
        avg_units_renovated_per_year: ``total_units_renovated /
            duration_years`` (Renovation!F10).
        stabilized_revenue_increase: Row 43 evaluated at ``start_year +
            duration_years - 1`` (Renovation!F28).
        annualized_return_on_investment: ``stabilized_revenue_increase /
            total_renovation_cost`` (Renovation!F29).
        quarterly_cash_flows: 43 quarterly entries (Renovation!D:AU).
        annual_rollups: 11 fiscal-year entries (Renovation!C:M).
    """

    enabled: bool
    total_units_renovated: float
    total_renovation_cost: float
    weighted_avg_rent_premium: float
    implied_return_on_cost: float
    avg_units_renovated_per_year: float
    stabilized_revenue_increase: float
    annualized_return_on_investment: float
    quarterly_cash_flows: list[RenovationQuarterlyCashFlow]
    annual_rollups: list[RenovationAnnualRollup]
