"""Phased tax-abatement calculation module.

Ports the standalone tax-abatement cash-flow model from Walker & Dunlop's
institutional proforma (Prose_Gainesville_Proforma_1_30_26_RH.xlsm,
"Tax Abatement" tab) into the Talisman underwriting engine.

Architectural boundary:
    Tax abatement is SEPARATE from the Proforma/DCF. It does NOT reduce
    the base RE tax line. Instead it produces a standalone savings cash
    flow stream to be added back at the Unlevered/Levered Project CF
    level by the caller.

Scope:
    MVP supports the "phased" structure only — Year-1 abatement percent
    with a constant annual step-down (spread). PILOT and hybrid
    structures will follow as strategy variants.
"""

from __future__ import annotations

from backend.underwriting.v2.schemas.tax_abatement import (
    TaxAbatementInput,
    TaxAbatementResult,
)


def calculate_tax_abatement(inp: TaxAbatementInput) -> TaxAbatementResult:
    """Compute phased tax-abatement savings per the W&D 'Tax Abatement' tab.

    Mirrors rows C13–C21 across columns C:Q (15 years) of
    Prose_Gainesville_Proforma_1_30_26_RH.xlsm / "Tax Abatement". When
    ``inp.enabled`` is False, returns zero-filled arrays of length
    ``hold_period_years`` and ``npv_abatement == 0.0`` — the result is
    always fully constructed.

    Calculation steps (each aligned to a W&D row):
        1. Fair Market Value (constant): ``fmv = fair_market_value *
           sales_percent_pp * apt_percent``. W&D holds FMV flat across
           the hold.
        2. Assessed Value per year: ``av[i] = fmv * assessment_ratio``.
        3. Millage per year: ``millage[0] = millage_rate``;
           ``millage[i] = millage[i-1] * (1 + re_tax_inflation[i])``
           for i ≥ 1. Note: ``re_tax_inflation[0]`` is never consumed —
           Y1 millage is taken as-is, matching W&D.
        4. Taxes per year ('Tax Abatement'!C13): ``taxes[i] =
           av[i] * millage[i]``.
        5. Total Taxes, Row 15 ('Tax Abatement'!C15):
           ``total_taxes[i] = taxes[i] + (storm_street_lights_y1
           if i == 0 else 0.0)``.
        6. Abatement percent, Row 16 ('Tax Abatement'!C16):
           ``pct[0] = abatement_y1_percent``;
           ``pct[i] = max(pct[i-1] - abatement_spread, 0.0)``.
        7. Savings, Row 17 ('Tax Abatement'!C17):
           ``savings[i] = total_taxes[i] * pct[i]``.
        8. NPV, Row 19 ('Tax Abatement'!C19):
           ``npv = Σ savings[i] / (1 + discount_rate) ** (i + 1)``
           (end-of-period discounting — matches Excel ``NPV()``).
        9. Taxes after abatement, Row 21 ('Tax Abatement'!C21):
           ``taxes_after_abatement[i] = total_taxes[i] - savings[i]``.
           (Storm/street-lights surcharges are NOT abated, so subtract
           savings from Row 15 rather than Row 13.)

    Args:
        inp: Validated :class:`TaxAbatementInput`.

    Returns:
        A :class:`TaxAbatementResult` with 6 fields, all arrays of
        length ``inp.hold_period_years``.
    """
    n = inp.hold_period_years

    if not inp.enabled:
        zeros = [0.0] * n
        return TaxAbatementResult(
            enabled=False,
            annual_total_taxes=list(zeros),
            annual_abatement_percent=list(zeros),
            annual_abatement_savings=list(zeros),
            npv_abatement=0.0,
            taxes_after_abatement=list(zeros),
        )

    fmv = inp.fair_market_value * inp.sales_percent_pp * inp.apt_percent
    assessed_value = fmv * inp.assessment_ratio

    millage: list[float] = [0.0] * n
    millage[0] = inp.millage_rate
    for i in range(1, n):
        millage[i] = millage[i - 1] * (1.0 + inp.re_tax_inflation[i])

    total_taxes: list[float] = [0.0] * n
    for i in range(n):
        base = assessed_value * millage[i]
        total_taxes[i] = base + (inp.storm_street_lights_y1 if i == 0 else 0.0)

    pct: list[float] = [0.0] * n
    pct[0] = inp.abatement_y1_percent
    for i in range(1, n):
        pct[i] = max(pct[i - 1] - inp.abatement_spread, 0.0)

    savings: list[float] = [total_taxes[i] * pct[i] for i in range(n)]

    npv = _npv_end_of_period(inp.discount_rate, savings)

    taxes_after = [total_taxes[i] - savings[i] for i in range(n)]

    return TaxAbatementResult(
        enabled=True,
        annual_total_taxes=total_taxes,
        annual_abatement_percent=pct,
        annual_abatement_savings=savings,
        npv_abatement=npv,
        taxes_after_abatement=taxes_after,
    )


def _npv_end_of_period(rate: float, cashflows: list[float]) -> float:
    """End-of-period NPV (Excel ``NPV()`` semantics).

    The first cash flow is discounted by ``(1 + rate) ** 1``, the
    second by ``(1 + rate) ** 2``, and so on. This matches the W&D
    workbook's ``=NPV(rate, C17:Q17)`` formula on 'Tax Abatement'!C19.
    """
    return sum(cf / (1.0 + rate) ** (i + 1) for i, cf in enumerate(cashflows))
