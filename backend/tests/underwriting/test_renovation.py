"""Tests for the Renovation calculation module.

Reference values are taken from Walker & Dunlop's Prose_Gainesville
proforma "Renovation" tab. Each assertion cites the W&D row/col it
corresponds to.
"""

from __future__ import annotations

from typing import Any

import pytest
from pydantic import ValidationError

from backend.underwriting.v2.renovation import (
    QUARTER_IN_YEAR_FACTORS,
    QUARTERS,
    ROLLUP_YEARS,
    _downtime_factor,
    calculate_renovation,
)
from backend.underwriting.v2.schemas.renovation import (
    RenovationInput,
    RenovationResult,
    RenovationUnitType,
)


def _single_unit_type(**overrides: Any) -> RenovationUnitType:
    """Build a single W&D-style unit-type slot with optional overrides."""
    defaults: dict[str, Any] = {
        "unit_type": "2BR",
        "units_to_renovate": 200,
        "rent_premium_per_month": 150.0,
    }
    defaults.update(overrides)
    return RenovationUnitType(**defaults)


def _reference_input(**overrides: Any) -> RenovationInput:
    """Build the canonical W&D-style reference case, with optional overrides.

    Defaults: 200 2BR units, 1-year duration starting Y1, $10k/unit,
    $150/mo premium, 3% annual rent growth.
    """
    defaults: dict[str, Any] = {
        "enabled": True,
        "start_year": 1,
        "duration_years": 1,
        "cost_per_unit": 10_000.0,
        "unit_types": [_single_unit_type()],
        "incremental_rent_growth_rates": [0.03] * 11,
        "downtime_months_per_unit": 1,
        "finance_with_loan": False,
    }
    defaults.update(overrides)
    return RenovationInput(**defaults)


# ---------------------------------------------------------------------------
# Phase 1: scaffolding — disabled / empty paths and schema validation
# ---------------------------------------------------------------------------


def test_disabled_returns_fully_constructed_zero_result() -> None:
    """enabled=False -> all scalars 0, 43 quarterlies, 11 annuals, no raise."""
    result = calculate_renovation(_reference_input(enabled=False))

    assert isinstance(result, RenovationResult)
    assert result.enabled is False
    assert result.total_units_renovated == 0.0
    assert result.total_renovation_cost == 0.0
    assert result.weighted_avg_rent_premium == 0.0
    assert result.implied_return_on_cost == 0.0
    assert result.avg_units_renovated_per_year == 0.0
    assert result.stabilized_revenue_increase == 0.0
    assert result.annualized_return_on_investment == 0.0
    assert len(result.quarterly_cash_flows) == QUARTERS
    assert len(result.annual_rollups) == ROLLUP_YEARS

    for q in result.quarterly_cash_flows:
        assert q.units_renovated == 0.0
        assert q.incremental_revenue_gross_monthly == 0.0
        assert q.incremental_revenue_actual_monthly == 0.0
        assert q.renovation_capex == 0.0

    for a in result.annual_rollups:
        assert a.renovations_completed == 0.0
        assert a.annual_renovation_cost == 0.0
        assert a.cumulative_revenue_growth == 0.0


def test_empty_unit_types_returns_zero_result() -> None:
    """unit_types=[] -> same shape as disabled."""
    result = calculate_renovation(_reference_input(unit_types=[]))

    assert result.enabled is False
    assert len(result.quarterly_cash_flows) == QUARTERS
    assert len(result.annual_rollups) == ROLLUP_YEARS


def test_zero_units_to_renovate_returns_zero_result() -> None:
    """Sum of units_to_renovate == 0 -> same shape as disabled."""
    result = calculate_renovation(
        _reference_input(unit_types=[_single_unit_type(units_to_renovate=0)])
    )

    assert result.enabled is False
    assert len(result.quarterly_cash_flows) == QUARTERS
    assert len(result.annual_rollups) == ROLLUP_YEARS


def test_disabled_quarterly_metadata_correct() -> None:
    """Quarter, fiscal_year, quarter_in_year, factor must be filled even when zero."""
    result = calculate_renovation(_reference_input(enabled=False, start_year=2))

    # Quarter 1 -> fiscal year 2 (start_year), quarter_in_year 1, factor 1.0.
    q1 = result.quarterly_cash_flows[0]
    assert q1.quarter == 1
    assert q1.fiscal_year == 2
    assert q1.quarter_in_year == 1
    assert q1.incremental_revenue_factor == pytest.approx(1.0)

    # Quarter 5 -> fiscal year 3, quarter_in_year 1, factor 1.0 (resets).
    q5 = result.quarterly_cash_flows[4]
    assert q5.quarter == 5
    assert q5.fiscal_year == 3
    assert q5.quarter_in_year == 1
    assert q5.incremental_revenue_factor == pytest.approx(1.0)

    # Quarter 4 -> fiscal year 2, quarter_in_year 4, factor 9/12.
    q4 = result.quarterly_cash_flows[3]
    assert q4.quarter == 4
    assert q4.quarter_in_year == 4
    assert q4.incremental_revenue_factor == pytest.approx(9.0 / 12.0)

    # Quarter 43 -> fiscal year 12 (start_year + 10), quarter_in_year 3.
    q43 = result.quarterly_cash_flows[-1]
    assert q43.quarter == 43
    assert q43.fiscal_year == 12
    assert q43.quarter_in_year == 3


def test_disabled_annual_growth_rate_echoed() -> None:
    """Annual rollup must echo the input growth rates even on the zero path."""
    rates = [0.01, 0.02, 0.03, 0.04, 0.05, 0.06, 0.07, 0.08, 0.09, 0.10, 0.11]
    result = calculate_renovation(
        _reference_input(enabled=False, incremental_rent_growth_rates=rates)
    )

    for fy, expected in enumerate(rates, start=1):
        rollup = result.annual_rollups[fy - 1]
        assert rollup.fiscal_year == fy
        assert rollup.incremental_rent_growth_rate == pytest.approx(expected)


def test_quarter_in_year_factors_constant_matches_wd() -> None:
    """W&D Renovation!D87:G87 — Q1=1, Q2=11/12, Q3=10/12, Q4=9/12."""
    assert QUARTER_IN_YEAR_FACTORS == (1.0, 11.0 / 12.0, 10.0 / 12.0, 9.0 / 12.0)


# ---------------------------------------------------------------------------
# Schema validation
# ---------------------------------------------------------------------------


def test_growth_rates_must_have_eleven_entries() -> None:
    """W&D Row 42 / Valuation!C18:M18 has exactly 11 entries."""
    with pytest.raises(ValidationError, match="exactly 11 entries"):
        _reference_input(incremental_rent_growth_rates=[0.03] * 10)
    with pytest.raises(ValidationError, match="exactly 11 entries"):
        _reference_input(incremental_rent_growth_rates=[0.03] * 12)


def test_negative_units_rejected() -> None:
    with pytest.raises(ValidationError):
        RenovationUnitType(
            unit_type="2BR", units_to_renovate=-1, rent_premium_per_month=100.0
        )


def test_invalid_unit_type_rejected() -> None:
    with pytest.raises(ValidationError):
        RenovationUnitType(
            unit_type="Penthouse",  # type: ignore[arg-type]
            units_to_renovate=10,
            rent_premium_per_month=100.0,
        )


def test_start_year_bounds() -> None:
    with pytest.raises(ValidationError):
        _reference_input(start_year=0)
    with pytest.raises(ValidationError):
        _reference_input(start_year=12)


# ---------------------------------------------------------------------------
# Phase 2: quarterly engine — per-unit-type schedule (rows 55-77) and
# quarterly aggregation (rows 81/86/87/88/91)
# ---------------------------------------------------------------------------


def test_schedule_200_units_1yr_start_y1_renders_50_per_qtr_then_zero() -> None:
    """200 2BR / 1-yr / start=Y1 — units_renovated = [50,50,50,50,0,...,0].

    W&D Renovation!D81+ (Row 81 after Layer-2 sum).
    """
    result = calculate_renovation(_reference_input())

    for q in range(1, 5):
        assert result.quarterly_cash_flows[q - 1].units_renovated == pytest.approx(
            50.0
        )
    for q in range(5, QUARTERS + 1):
        assert result.quarterly_cash_flows[q - 1].units_renovated == 0.0


def test_schedule_tail_residual_sums_exactly_to_units_to_renovate() -> None:
    """Fractional target (10 units / 2-yr = 1.25/qtr) sums to exactly 10.

    Confirms no residual left unscheduled at the tail of the program.
    """
    result = calculate_renovation(
        _reference_input(
            duration_years=2,
            unit_types=[_single_unit_type(units_to_renovate=10)],
        )
    )

    total_within_program = sum(
        result.quarterly_cash_flows[q - 1].units_renovated for q in range(1, 9)
    )
    assert total_within_program == pytest.approx(10.0, abs=1e-9)

    for q in range(9, QUARTERS + 1):
        assert result.quarterly_cash_flows[q - 1].units_renovated == 0.0


def test_rent_compounds_annually_via_gross_monthly_row_86() -> None:
    """$150 base, 3% Y2 growth — Q1..Q4 rent = $150, Q5..Q8 rent = $154.50.

    Observed via the Row 86 SUMPRODUCT (gross_monthly) since rent is not a
    direct output field. 200 units / 2-yr = 25/qtr scheduled in every
    quarter of Y1 and Y2.
    """
    result = calculate_renovation(
        _reference_input(
            duration_years=2,
            incremental_rent_growth_rates=[0.03] * 11,
        )
    )

    # Q1..Q4 (Y1): 25 units × $150 = $3,750/month.
    for q in range(1, 5):
        assert result.quarterly_cash_flows[
            q - 1
        ].incremental_revenue_gross_monthly == pytest.approx(25.0 * 150.0)

    # Q5..Q8 (Y2): 25 units × ($150 × 1.03) = 25 × $154.50 = $3,862.50/month.
    for q in range(5, 9):
        assert result.quarterly_cash_flows[
            q - 1
        ].incremental_revenue_gross_monthly == pytest.approx(25.0 * 154.50)


def test_downtime_factor_pattern() -> None:
    """W&D Row 87 — Q1=1, Q2=11/12, Q3=10/12, Q4=9/12, resets at Q5."""
    assert _downtime_factor(1) == pytest.approx(1.0)
    assert _downtime_factor(2) == pytest.approx(11.0 / 12.0)
    assert _downtime_factor(3) == pytest.approx(10.0 / 12.0)
    assert _downtime_factor(4) == pytest.approx(0.75)
    assert _downtime_factor(5) == pytest.approx(1.0)
    assert _downtime_factor(8) == pytest.approx(0.75)
    assert _downtime_factor(9) == pytest.approx(1.0)


def test_multi_unit_type_row_86_sumproduct() -> None:
    """Two unit-type waterfalls aggregate via SUMPRODUCT on Row 86.

    100 2BR @ $150/mo + 50 1BR @ $100/mo, both 1-yr / start=Y1. Per qtr:
        units = 25 + 12.5 = 37.5
        gross = 25*150 + 12.5*100 = 3750 + 1250 = 5000 $/month
    """
    result = calculate_renovation(
        _reference_input(
            unit_types=[
                _single_unit_type(
                    unit_type="2BR",
                    units_to_renovate=100,
                    rent_premium_per_month=150.0,
                ),
                _single_unit_type(
                    unit_type="1BR",
                    units_to_renovate=50,
                    rent_premium_per_month=100.0,
                ),
            ],
        )
    )

    q1 = result.quarterly_cash_flows[0]
    assert q1.units_renovated == pytest.approx(37.5)
    assert q1.incremental_revenue_gross_monthly == pytest.approx(5000.0)
    # Row 88: actual = gross * factor (factor=1.0 at Q1).
    assert q1.incremental_revenue_actual_monthly == pytest.approx(5000.0)


def test_fiscal_year_tagging_with_nonunit_start_year() -> None:
    """start_year=2 — q=1→FY2, q=5→FY3, q=43→FY12. Mirrors Row 49."""
    result = calculate_renovation(_reference_input(start_year=2, duration_years=1))

    assert result.quarterly_cash_flows[0].fiscal_year == 2
    assert result.quarterly_cash_flows[0].quarter_in_year == 1
    assert result.quarterly_cash_flows[4].fiscal_year == 3
    assert result.quarterly_cash_flows[4].quarter_in_year == 1
    assert result.quarterly_cash_flows[-1].fiscal_year == 12
    assert result.quarterly_cash_flows[-1].quarter_in_year == 3


def test_enabled_path_actual_monthly_zero_when_no_units() -> None:
    """Row 88 — actual_monthly = 0 outside the renovation program window.

    Factor remains non-zero (the schedule is deterministic) but actual
    monthly drops to zero when units_renovated == 0.
    """
    result = calculate_renovation(_reference_input())  # 200 units / 1-yr

    for q in range(5, QUARTERS + 1):
        cf = result.quarterly_cash_flows[q - 1]
        assert cf.units_renovated == 0.0
        assert cf.incremental_revenue_actual_monthly == 0.0
        # Factor is still populated per Row 87 schedule.
        assert cf.incremental_revenue_factor == pytest.approx(
            QUARTER_IN_YEAR_FACTORS[(q - 1) % 4]
        )


def test_enabled_path_capex_row_91() -> None:
    """Row 91 — capex = cost_per_unit * units_renovated, per quarter.

    200 2BR / 1-yr / $10k per unit → Q1 capex = 50 × $10,000 = $500,000;
    Q5+ capex = 0.
    """
    result = calculate_renovation(_reference_input())

    for q in range(1, 5):
        assert result.quarterly_cash_flows[q - 1].renovation_capex == pytest.approx(
            500_000.0
        )
    for q in range(5, QUARTERS + 1):
        assert result.quarterly_cash_flows[q - 1].renovation_capex == 0.0


def test_enabled_path_annual_rollups_stay_zeroed_in_phase_2() -> None:
    """Phase 2 contract: annual rollups populated only with metadata.

    fiscal_year and incremental_rent_growth_rate are echoed; every other
    field is 0.0 until Phase 3 lands the Layer-3 rollup.
    """
    rates = [0.01, 0.02, 0.03, 0.04, 0.05, 0.06, 0.07, 0.08, 0.09, 0.10, 0.11]
    result = calculate_renovation(
        _reference_input(incremental_rent_growth_rates=rates)
    )

    assert result.enabled is True
    for fy, expected_rate in enumerate(rates, start=1):
        rollup = result.annual_rollups[fy - 1]
        assert rollup.fiscal_year == fy
        assert rollup.incremental_rent_growth_rate == pytest.approx(expected_rate)
        assert rollup.renovations_completed == 0.0
        assert rollup.annual_renovation_cost == 0.0
        assert rollup.potential_rent_premium_annual == 0.0
        assert rollup.downtime_deduction == 0.0
        assert rollup.current_year_revenue_growth == 0.0
        assert rollup.cumulative_revenue_growth == 0.0


def test_enabled_path_summary_scalars_stay_zeroed_in_phase_2() -> None:
    """Phase 2 contract: top-level scalars still 0.0 even on enabled path.

    Phase 4 will populate them from the annual rollups.
    """
    result = calculate_renovation(_reference_input())

    assert result.enabled is True
    assert result.total_units_renovated == 0.0
    assert result.total_renovation_cost == 0.0
    assert result.weighted_avg_rent_premium == 0.0
    assert result.implied_return_on_cost == 0.0
    assert result.avg_units_renovated_per_year == 0.0
    assert result.stabilized_revenue_increase == 0.0
    assert result.annualized_return_on_investment == 0.0
