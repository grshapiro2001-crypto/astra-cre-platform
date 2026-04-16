"""Pydantic schemas for the Tax Abatement calculation module.

Mirrors the input/output shape of Walker & Dunlop's institutional proforma
"Tax Abatement" tab (Prose_Gainesville_Proforma_1_30_26_RH.xlsm). All
percentages are stored as decimals (0.05 = 5%); all monetary values are
floats.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field, ValidationInfo, field_validator


class TaxAbatementInput(BaseModel):
    """Inputs for a phased tax-abatement calculation.

    Cell references below point to
    Prose_Gainesville_Proforma_1_30_26_RH.xlsm / "Tax Abatement" tab.

    Attributes:
        enabled: Master toggle ('Tax Abatement'!B3).
        hold_period_years: DCF hold length in years (W&D caps at 15).
        fair_market_value: Proforma sale price used as FMV basis.
        sales_percent_pp: Sale-price percent-of-purchase-price factor (T9).
        apt_percent: Apartment allocation percent (T10); defaults to 1.0.
        assessment_ratio: Named range 'Assess_Ratio' (e.g. 0.40 = 40%).
        millage_rate: Year-1 millage, named range 'Millage' (e.g. 0.025).
        re_tax_inflation: Per-year real-estate tax inflation decimals,
            mirroring Valuation!D25:Q25. Must contain at least
            ``hold_period_years`` entries.
        storm_street_lights_y1: Storm / street-lights surcharge applied
            to Year 1 only; zero thereafter.
        abatement_y1_percent: Initial abatement percent (e.g. 0.50).
        abatement_spread: Annual step-down spread (T11, e.g. 0.05).
        discount_rate: NPV discount rate (Scenario_Assump_Static!H19).
    """

    model_config = ConfigDict(frozen=True)

    enabled: bool
    hold_period_years: int = Field(gt=0, le=30)
    fair_market_value: float = Field(ge=0.0)
    sales_percent_pp: float = Field(ge=0.0, le=1.0)
    apt_percent: float = Field(default=1.0, ge=0.0, le=1.0)
    assessment_ratio: float = Field(ge=0.0, le=1.0)
    millage_rate: float = Field(ge=0.0)
    re_tax_inflation: list[float]
    storm_street_lights_y1: float = Field(default=0.0, ge=0.0)
    abatement_y1_percent: float = Field(ge=0.0, le=1.0)
    abatement_spread: float = Field(ge=0.0, le=1.0)
    discount_rate: float = Field(ge=0.0)

    @field_validator("re_tax_inflation")
    @classmethod
    def _validate_inflation_length(
        cls, v: list[float], info: ValidationInfo
    ) -> list[float]:
        hold = info.data.get("hold_period_years")
        if hold is not None and len(v) < hold:
            raise ValueError(
                f"re_tax_inflation must have at least hold_period_years "
                f"({hold}) entries, got {len(v)}"
            )
        return v


class TaxAbatementResult(BaseModel):
    """Output of a phased tax-abatement calculation.

    Each list has length ``hold_period_years``. When ``enabled`` is False,
    all list entries are 0.0 and ``npv_abatement`` is 0.0 — the result
    object is still fully constructed so downstream callers can blindly
    add savings to cash flows without a None-check.

    Attributes:
        enabled: Echoes the input toggle.
        annual_total_taxes: Row 15 ('Tax Abatement'!C15:Q15).
        annual_abatement_percent: Row 16 after step-down.
        annual_abatement_savings: Row 17 (savings $ per year).
        npv_abatement: Row 19 — NPV(discount_rate, savings).
        taxes_after_abatement: Row 21 (= Row 15 − Row 17).
    """

    enabled: bool
    annual_total_taxes: list[float]
    annual_abatement_percent: list[float]
    annual_abatement_savings: list[float]
    npv_abatement: float
    taxes_after_abatement: list[float]
