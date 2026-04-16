"""Tests for the phased tax-abatement calculation module.

Reference values are taken from Walker & Dunlop's Prose_Gainesville
proforma "Tax Abatement" tab. Each assertion cites the W&D row/col it
corresponds to.
"""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from backend.underwriting.v2.schemas.tax_abatement import (
    TaxAbatementInput,
    TaxAbatementResult,
)
from backend.underwriting.v2.tax_abatement import (
    _npv_end_of_period,
    calculate_tax_abatement,
)


def _reference_input(**overrides: object) -> TaxAbatementInput:
    """Build the canonical W&D-style reference case, with optional overrides."""
    defaults: dict[str, object] = {
        "enabled": True,
        "hold_period_years": 15,
        "fair_market_value": 50_000_000.0,
        "sales_percent_pp": 1.0,
        "apt_percent": 1.0,
        "assessment_ratio": 0.40,
        "millage_rate": 0.025,
        "re_tax_inflation": [0.0275] * 15,
        "storm_street_lights_y1": 0.0,
        "abatement_y1_percent": 0.50,
        "abatement_spread": 0.05,
        "discount_rate": 0.065,
    }
    defaults.update(overrides)
    return TaxAbatementInput(**defaults)  # type: ignore[arg-type]


def test_reference_case_matches_wd() -> None:
    """Reference case must reproduce the W&D workbook values exactly.

    Row mapping:
      - Row 15 (annual_total_taxes) = AV × millage (+ storm in Y1)
      - Row 16 (annual_abatement_percent) = Y1% stepped down by spread
      - Row 17 (annual_abatement_savings) = Row 15 × Row 16
      - Row 19 (npv_abatement) = NPV(discount_rate, Row 17), EOY
      - Row 21 (taxes_after_abatement) = Row 15 − Row 17
    """
    result = calculate_tax_abatement(_reference_input())

    assert isinstance(result, TaxAbatementResult)
    assert result.enabled is True
    assert len(result.annual_total_taxes) == 15
    assert len(result.annual_abatement_percent) == 15
    assert len(result.annual_abatement_savings) == 15
    assert len(result.taxes_after_abatement) == 15

    # Row 15 — total taxes. FMV 50M × 40% assess × 2.5% millage = $500k Y1,
    # then millage compounds at 2.75%/yr.
    assert result.annual_total_taxes[0] == pytest.approx(500_000.00, abs=0.01)
    assert result.annual_total_taxes[1] == pytest.approx(513_750.00, abs=0.01)
    assert result.annual_total_taxes[2] == pytest.approx(527_878.125, abs=0.01)

    # Row 16 — abatement % step-down. Year 5 = i=4 = 0.30.
    expected_pct = [
        0.50, 0.45, 0.40, 0.35, 0.30, 0.25, 0.20, 0.15, 0.10, 0.05,
        0.0, 0.0, 0.0, 0.0, 0.0,
    ]
    assert result.annual_abatement_percent == pytest.approx(expected_pct, abs=1e-12)
    assert result.annual_abatement_percent[4] == pytest.approx(0.30, abs=1e-12)

    # Row 17 — savings.
    assert result.annual_abatement_savings[0] == pytest.approx(250_000.00, abs=0.01)
    # Years 11–15 are zero-pct so savings collapse to zero.
    for i in range(10, 15):
        assert result.annual_abatement_savings[i] == pytest.approx(0.0, abs=1e-9)

    # Row 21 — taxes after abatement = Row 15 − Row 17.
    for i in range(15):
        assert result.taxes_after_abatement[i] == pytest.approx(
            result.annual_total_taxes[i] - result.annual_abatement_savings[i],
            abs=1e-9,
        )
    # Y1 specifically: 500_000 − 250_000 = 250_000.
    assert result.taxes_after_abatement[0] == pytest.approx(250_000.00, abs=0.01)

    # Row 19 — NPV. Recompute independently from the module's own savings
    # stream using the documented end-of-period formula, then sanity-check
    # against the hand-computed constant.
    independent_npv = sum(
        cf / (1.065 ** (i + 1))
        for i, cf in enumerate(result.annual_abatement_savings)
    )
    assert result.npv_abatement == pytest.approx(independent_npv, abs=1e-6)
    # Hand-computed reference (Plan agent's worksheet): ≈ $1,163,825.
    assert result.npv_abatement == pytest.approx(1_163_825.0, rel=1e-3)


def test_disabled_returns_zeros() -> None:
    """enabled=False → fully constructed result with all-zero arrays."""
    result = calculate_tax_abatement(_reference_input(enabled=False))

    assert isinstance(result, TaxAbatementResult)
    assert result.enabled is False
    assert result.npv_abatement == 0.0
    assert len(result.annual_total_taxes) == 15
    assert len(result.annual_abatement_percent) == 15
    assert len(result.annual_abatement_savings) == 15
    assert len(result.taxes_after_abatement) == 15
    assert all(x == 0.0 for x in result.annual_total_taxes)
    assert all(x == 0.0 for x in result.annual_abatement_percent)
    assert all(x == 0.0 for x in result.annual_abatement_savings)
    assert all(x == 0.0 for x in result.taxes_after_abatement)


def test_abatement_percent_floors_at_zero() -> None:
    """pct must clamp at 0 once step-down exhausts Y1%, never go negative."""
    result = calculate_tax_abatement(
        _reference_input(abatement_y1_percent=0.10, abatement_spread=0.05)
    )
    # Expected: 0.10, 0.05, 0.00, 0.00, ...
    assert result.annual_abatement_percent[0] == pytest.approx(0.10, abs=1e-12)
    assert result.annual_abatement_percent[1] == pytest.approx(0.05, abs=1e-12)
    assert result.annual_abatement_percent[2] == pytest.approx(0.00, abs=1e-12)
    for i in range(2, 15):
        assert result.annual_abatement_percent[i] == 0.0
    assert all(p >= 0.0 for p in result.annual_abatement_percent)


def test_spread_larger_than_y1_stays_zero_from_year_two() -> None:
    """If spread > Y1%, the percent drops straight to zero in year 2."""
    result = calculate_tax_abatement(
        _reference_input(abatement_y1_percent=0.05, abatement_spread=0.10)
    )
    assert result.annual_abatement_percent[0] == pytest.approx(0.05, abs=1e-12)
    for i in range(1, 15):
        assert result.annual_abatement_percent[i] == 0.0


def test_storm_street_lights_applied_only_in_year_one() -> None:
    """Storm/street-lights surcharge hits Y1 total_taxes only, never Y2+."""
    storm = 10_000.0
    result = calculate_tax_abatement(
        _reference_input(storm_street_lights_y1=storm)
    )
    # Y1 base tax is 500_000; total should be 510_000.
    assert result.annual_total_taxes[0] == pytest.approx(500_000.00 + storm, abs=0.01)
    # Y2 should be just the compounded tax, with no surcharge carry-over.
    assert result.annual_total_taxes[1] == pytest.approx(513_750.00, abs=0.01)


def test_fmv_constant_across_years() -> None:
    """FMV does NOT inflate — W&D holds it flat. Only millage compounds."""
    result = calculate_tax_abatement(_reference_input())
    av = 50_000_000.0 * 0.40  # 20,000,000 constant
    # Reconstruct implied millage from total_taxes (Y1 has no storm surcharge
    # in the reference case, so total_taxes[i] == av * millage[i]).
    implied_millage = [t / av for t in result.annual_total_taxes]
    # Year-6 millage should be 0.025 * 1.0275**5.
    assert implied_millage[5] == pytest.approx(0.025 * (1.0275 ** 5), rel=1e-12)
    # Implied AV is identical across every year (FMV flat).
    for i in range(15):
        implied_av = result.annual_total_taxes[i] / implied_millage[i]
        assert implied_av == pytest.approx(av, rel=1e-12)


def test_millage_compounds_correctly_with_full_abatement() -> None:
    """With y1_pct=1.0 and spread=0, savings equal total_taxes every year."""
    result = calculate_tax_abatement(
        _reference_input(
            abatement_y1_percent=1.0,
            abatement_spread=0.0,
        )
    )
    for i in range(15):
        assert result.annual_abatement_percent[i] == pytest.approx(1.0, abs=1e-12)
        assert result.annual_abatement_savings[i] == pytest.approx(
            result.annual_total_taxes[i], rel=1e-12
        )
        assert result.taxes_after_abatement[i] == pytest.approx(0.0, abs=1e-9)
    # Millage compounding check: Y3 = Y1 × 1.0275².
    assert result.annual_total_taxes[2] == pytest.approx(
        result.annual_total_taxes[0] * (1.0275 ** 2), rel=1e-12
    )


def test_re_tax_inflation_too_short_raises() -> None:
    """Shorter inflation series than hold_period_years → ValidationError."""
    with pytest.raises(ValidationError):
        TaxAbatementInput(
            enabled=True,
            hold_period_years=15,
            fair_market_value=50_000_000.0,
            sales_percent_pp=1.0,
            apt_percent=1.0,
            assessment_ratio=0.40,
            millage_rate=0.025,
            re_tax_inflation=[0.0275] * 5,
            storm_street_lights_y1=0.0,
            abatement_y1_percent=0.50,
            abatement_spread=0.05,
            discount_rate=0.065,
        )


def test_npv_end_of_period_helper_matches_excel_semantics() -> None:
    """Private NPV helper must match Excel NPV(): first CF at t=1."""
    # NPV(0.10, [100, 100]) = 100/1.1 + 100/1.21 = 173.5537...
    assert _npv_end_of_period(0.10, [100.0, 100.0]) == pytest.approx(
        100.0 / 1.1 + 100.0 / 1.21, abs=1e-9
    )
    # Empty stream → 0.0.
    assert _npv_end_of_period(0.10, []) == 0.0


def test_shorter_hold_period_returns_shorter_arrays() -> None:
    """Arrays must match hold_period_years, not the inflation series length."""
    result = calculate_tax_abatement(_reference_input(hold_period_years=5))
    assert len(result.annual_total_taxes) == 5
    assert len(result.annual_abatement_percent) == 5
    assert len(result.annual_abatement_savings) == 5
    assert len(result.taxes_after_abatement) == 5
    assert result.annual_abatement_percent == pytest.approx(
        [0.50, 0.45, 0.40, 0.35, 0.30], abs=1e-12
    )
