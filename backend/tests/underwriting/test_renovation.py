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
        assert result.quarterly_cash_flows[q - 1].units_renovated == pytest.approx(50.0)
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


def test_enabled_path_annual_rollup_metadata_echoed() -> None:
    """Annual rollup metadata: fiscal_year + incremental_rent_growth_rate.

    Both fields must be set on every rollup regardless of whether the
    underlying year carries any reno activity. Other fields are populated
    by Phase 3 and validated in the Phase 3 test block below.
    """
    rates = [0.01, 0.02, 0.03, 0.04, 0.05, 0.06, 0.07, 0.08, 0.09, 0.10, 0.11]
    result = calculate_renovation(_reference_input(incremental_rent_growth_rates=rates))

    assert result.enabled is True
    for fy, expected_rate in enumerate(rates, start=1):
        rollup = result.annual_rollups[fy - 1]
        assert rollup.fiscal_year == fy
        assert rollup.incremental_rent_growth_rate == pytest.approx(expected_rate)


def test_enabled_path_summary_scalars_stay_zeroed_in_phase_2() -> None:
    """Phase 2/3 contract: top-level scalars still 0.0 even on enabled path.

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


# ---------------------------------------------------------------------------
# Phase 3: annual rollup (Layer 3, rows 34/36/38/39/40/42) and
# Row 43 cumulative revenue growth (Layer 4)
# ---------------------------------------------------------------------------


def test_annual_rollup_grouping_basic() -> None:
    """Layer 3 — 200 2BR / 1-yr / start=Y1 rolls up entirely into Y1.

    W&D Renovation rows 34 (units) and 36 (CapEx). 11 entries total;
    Y1 carries everything, Y2..Y11 are zero.
    """
    result = calculate_renovation(_reference_input())

    assert len(result.annual_rollups) == ROLLUP_YEARS

    y1 = result.annual_rollups[0]
    assert y1.renovations_completed == pytest.approx(200.0)
    assert y1.annual_renovation_cost == pytest.approx(200.0 * 10_000.0)

    for i in range(1, ROLLUP_YEARS):
        rollup = result.annual_rollups[i]
        assert rollup.renovations_completed == 0.0
        assert rollup.annual_renovation_cost == 0.0


def test_annual_rollup_start_year_offset() -> None:
    """Layer 3 — start_year=3 stamps annual_rollups[0].fiscal_year == 3.

    100 2BR / 1-yr / start=Y3 — quarter 1 lands in W&D fiscal_year 3
    so the first rollup carries that fiscal_year and all 100 units.
    """
    result = calculate_renovation(
        _reference_input(
            start_year=3,
            unit_types=[_single_unit_type(units_to_renovate=100)],
        )
    )

    assert result.annual_rollups[0].fiscal_year == 3
    assert result.annual_rollups[0].renovations_completed == pytest.approx(100.0)
    # Final rollup picks up the start_year offset too — last fiscal_year
    # is start_year + 10 = 13.
    assert result.annual_rollups[-1].fiscal_year == 13


def test_layer3_potential_equals_quarterly_sum() -> None:
    """Layer 3 invariant — Row 38 == Σ Row 86 across the year's quarters.

    Pins down the bucketing logic: every rollup's
    ``potential_rent_premium_annual`` must equal the sum of
    ``incremental_revenue_gross_monthly`` across the quarterlies tagged
    with that fiscal_year. Y1..Y10 each have 4 quarters; the terminal
    rollup has only 3 (W&D's 43-quarter horizon = 10 full years + Q41-43).
    """
    result = calculate_renovation(_reference_input(duration_years=2))

    for i, rollup in enumerate(result.annual_rollups):
        bucket = [
            q
            for q in result.quarterly_cash_flows
            if q.fiscal_year == rollup.fiscal_year
        ]
        assert len(bucket) == (4 if i < ROLLUP_YEARS - 1 else 3)
        expected = sum(q.incremental_revenue_gross_monthly for q in bucket)
        assert rollup.potential_rent_premium_annual == pytest.approx(expected)


def test_row43_y1_identity() -> None:
    """Row 43 — Y1 identity: cumulative[0] == current_year_revenue_growth[0].

    The W&D Y1 formula =SUM($C$38:C38)+C39 simplifies to
    current_year_revenue_growth via the downtime identity (downtime =
    actual − potential). Validates the runtime guard does not fire on a
    well-formed input.
    """
    result = calculate_renovation(_reference_input())

    y1 = result.annual_rollups[0]
    assert y1.cumulative_revenue_growth == pytest.approx(y1.current_year_revenue_growth)


def test_row43_no_renos_branch() -> None:
    """Row 43 — no-renos branch: Y2 = (Y1_cum − Y1_downtime) * (1 + rate).

    100 2BR @ $100/mo / 1-yr / start=Y1 / 3% growth.
    Y1 potential = 25 * $100 * 4 = $10,000/mo.
    Y1 actual    = 25 * $100 * (1 + 11/12 + 10/12 + 9/12)
                = 25 * $100 * 42/12 = $8,750/mo.
    Y1 downtime  = -$1,250 -> Y1 cumulative = $8,750.
    Y2 cumulative = (8750 - (-1250)) * 1.03 = 10000 * 1.03 = $10,300/mo.
    """
    result = calculate_renovation(
        _reference_input(
            unit_types=[
                _single_unit_type(units_to_renovate=100, rent_premium_per_month=100.0)
            ],
        )
    )

    y1 = result.annual_rollups[0]
    y2 = result.annual_rollups[1]

    assert y1.potential_rent_premium_annual == pytest.approx(10_000.0)
    assert y1.current_year_revenue_growth == pytest.approx(8_750.0)
    assert y1.downtime_deduction == pytest.approx(-1_250.0)
    assert y1.cumulative_revenue_growth == pytest.approx(8_750.0, abs=0.01)

    assert y2.renovations_completed == 0.0
    assert y2.cumulative_revenue_growth == pytest.approx(10_300.0, abs=0.01)


def test_row43_half_year_branch() -> None:
    """Row 43 — active-renos branch: half-year growth convention in Y2.

    200 2BR / 2-yr / start=Y1 / $100 base, 3% growth.
    Layer 1 schedules 25 units/qtr in every Y1 and Y2 quarter and
    compounds rent at the Y2 rate (3%) for Q5..Q8.

    Y1 rent     = $100, Y2 rent = $100 * 1.03 = $103.
    Y1 potential = 25 * 100 * 4 = $10,000/mo.
    Y2 potential = 25 * 103 * 4 = $10,300/mo.
    Y2 actual    = 25 * 103 * 42/12 = $9,012.50/mo.
    Y2 downtime  = 9012.50 - 10300 = -$1,287.50.
    Y2 cumulative = (10000 + 10300 + (-1287.50)) * (1 + 0.03/2)
                  = 19012.50 * 1.015 = $19,297.6875.
    """
    result = calculate_renovation(
        _reference_input(
            duration_years=2,
            unit_types=[
                _single_unit_type(units_to_renovate=200, rent_premium_per_month=100.0)
            ],
        )
    )

    y2 = result.annual_rollups[1]

    assert y2.renovations_completed == pytest.approx(100.0)
    assert y2.potential_rent_premium_annual == pytest.approx(10_300.0)
    assert y2.downtime_deduction == pytest.approx(-1_287.50)
    assert y2.cumulative_revenue_growth == pytest.approx(19_297.6875, abs=0.01)


def test_row43_back_to_back_three_years_then_flat() -> None:
    """Row 43 — 3 yrs of active renos, then 5 flat yrs, branch transition.

    300 2BR / 3-yr / start=Y1 / $100 base, 3% growth.
    Layer 1 schedules 25 units/qtr in Q1..Q12 (Y1..Y3 each get 100 units),
    rent compounds annually: Y1=$100, Y2=$103, Y3=$106.09.
    Verifies:
      * Y1..Y3 use the half-year branch (renovations_completed > 0).
      * Y4..Y8 use the full-year no-renos branch.
      * Y4 = (Y3_cum − Y3_downtime) * (1 + growth_rates[3]).
      * Y5+ multiply Y4 by the cumulative growth product (no new
        downtime to strip thereafter).
    """
    result = calculate_renovation(
        _reference_input(
            duration_years=3,
            unit_types=[
                _single_unit_type(units_to_renovate=300, rent_premium_per_month=100.0)
            ],
        )
    )

    rates = [0.03] * 11
    rollups = result.annual_rollups

    # Y1..Y3 carry renos; Y4+ do not.
    for i in range(3):
        assert rollups[i].renovations_completed == pytest.approx(100.0)
    for i in range(3, ROLLUP_YEARS):
        assert rollups[i].renovations_completed == 0.0

    # Hand-compute the half-year branch for Y1..Y3.
    y1_pot = 25.0 * 100.0 * 4.0
    y2_pot = 25.0 * 103.0 * 4.0
    y3_pot = 25.0 * 106.09 * 4.0
    factor_sum = 1.0 + 11.0 / 12.0 + 10.0 / 12.0 + 9.0 / 12.0
    y3_actual = 25.0 * 106.09 * factor_sum
    y3_downtime = y3_actual - y3_pot

    expected_y3 = (y1_pot + y2_pot + y3_pot + y3_downtime) * (1 + rates[2] / 2.0)
    assert rollups[2].cumulative_revenue_growth == pytest.approx(expected_y3, abs=0.01)

    # Y4 transitions to the no-renos branch:
    # Y4_cum = (Y3_cum − Y3_downtime) * (1 + rates[3])
    expected_y4 = (rollups[2].cumulative_revenue_growth - y3_downtime) * (1 + rates[3])
    assert rollups[3].cumulative_revenue_growth == pytest.approx(expected_y4, abs=0.01)

    # Y5..Y8 keep applying the full-year multiplier with downtime = 0,
    # so each year is just prior * (1 + rate).
    for i in range(4, 8):
        expected_i = rollups[i - 1].cumulative_revenue_growth * (1 + rates[i])
        assert rollups[i].cumulative_revenue_growth == pytest.approx(
            expected_i, abs=0.01
        )


def test_row43_zero_growth_documents_downtime_strip() -> None:
    """Row 43 — zero-growth case: downtime stripping inflates Y2 then holds flat.

    100 2BR @ $100/mo / 1-yr / start=Y1 / 0% growth everywhere.

    The W&D no-renos formula intentionally strips the prior year's
    downtime drag and never re-adds it. With growth=0:
      * Y1_cum = $8,750 (Y1 identity, current_year_revenue_growth).
      * Y2_cum = (8750 − (−1250)) * 1.0 = $10,000 — INCREASES vs. Y1
        because the Y1 construction-disruption haircut is rolled back
        to represent units coming back online for full revenue.
      * Y3..Y11 carry $10,000 unchanged (no new renos, no new downtime
        to strip, multiplier of 1.0).

    This is intentional W&D behavior, not a defect in the formula.
    """
    result = calculate_renovation(
        _reference_input(
            unit_types=[
                _single_unit_type(units_to_renovate=100, rent_premium_per_month=100.0)
            ],
            incremental_rent_growth_rates=[0.0] * 11,
        )
    )

    rollups = result.annual_rollups

    # Y1 identity holds.
    assert rollups[0].cumulative_revenue_growth == pytest.approx(
        rollups[0].current_year_revenue_growth, abs=0.01
    )
    assert rollups[0].cumulative_revenue_growth == pytest.approx(8_750.0, abs=0.01)

    # Y2 = Y1_cum − Y1_downtime (downtime stripped, no re-addition).
    expected_y2 = rollups[0].cumulative_revenue_growth - rollups[0].downtime_deduction
    assert rollups[1].cumulative_revenue_growth == pytest.approx(expected_y2, abs=0.01)
    assert rollups[1].cumulative_revenue_growth == pytest.approx(10_000.0, abs=0.01)

    # Y3..Y11 hold flat at the Y2 value (steady state).
    for i in range(2, ROLLUP_YEARS):
        assert rollups[i].cumulative_revenue_growth == pytest.approx(
            rollups[1].cumulative_revenue_growth, abs=0.01
        )


def test_row43_growth_rate_indexing_uses_rollup_position() -> None:
    """Row 43 — start_year offset does NOT shift growth-rate indexing.

    100 2BR @ $100/mo / 1-yr / start=Y3 / non-uniform growth rates.
    annual_rollups[0] (W&D fiscal_year=3) must pair with
    growth_rates[0], not growth_rates[2]. So the Y2 (no-renos)
    multiplier uses growth_rates[1] = 0.05, not growth_rates[3].
    """
    rates = [0.01, 0.05, 0.10, 0.20, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]
    result = calculate_renovation(
        _reference_input(
            start_year=3,
            unit_types=[
                _single_unit_type(units_to_renovate=100, rent_premium_per_month=100.0)
            ],
            incremental_rent_growth_rates=rates,
        )
    )

    rollups = result.annual_rollups

    assert rollups[0].fiscal_year == 3
    assert rollups[0].incremental_rent_growth_rate == pytest.approx(0.01)
    assert rollups[1].incremental_rent_growth_rate == pytest.approx(0.05)

    # Y2 no-renos branch uses rates[1] = 0.05, not rates[3] = 0.20.
    expected_y2 = (
        rollups[0].cumulative_revenue_growth - rollups[0].downtime_deduction
    ) * (1 + 0.05)
    assert rollups[1].cumulative_revenue_growth == pytest.approx(expected_y2, abs=0.01)
