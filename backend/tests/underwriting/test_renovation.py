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
        assert q.incremental_revenue_gross_annual == 0.0
        assert q.incremental_revenue_actual_annual == 0.0
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


def test_rent_compounds_annually_via_gross_annual_row_86() -> None:
    """$150 base, 3% Y2 growth — Q1..Q4 rent = $150, Q5..Q8 rent = $154.50.

    Observed via the Row 86 SUMPRODUCT (gross_annual = ×12) since rent
    is not a direct output field. 200 units / 2-yr = 25/qtr scheduled
    in every quarter of Y1 and Y2.
    """
    result = calculate_renovation(
        _reference_input(
            duration_years=2,
            incremental_rent_growth_rates=[0.03] * 11,
        )
    )

    # Q1..Q4 (Y1): 25 units × $150 × 12 = $45,000/qtr annualized.
    for q in range(1, 5):
        assert result.quarterly_cash_flows[
            q - 1
        ].incremental_revenue_gross_annual == pytest.approx(25.0 * 150.0 * 12)

    # Q5..Q8 (Y2): 25 × ($150 × 1.03) × 12 = 25 × $154.50 × 12 = $46,350/qtr.
    for q in range(5, 9):
        assert result.quarterly_cash_flows[
            q - 1
        ].incremental_revenue_gross_annual == pytest.approx(25.0 * 154.50 * 12)


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
        gross monthly = 25*150 + 12.5*100 = 5000 $/month
        gross annual  = 5000 * 12         = $60,000
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
    assert q1.incremental_revenue_gross_annual == pytest.approx(60_000.0)
    # Row 88: actual = gross * factor (factor=1.0 at Q1).
    assert q1.incremental_revenue_actual_annual == pytest.approx(60_000.0)


def test_fiscal_year_tagging_with_nonunit_start_year() -> None:
    """start_year=2 — q=1→FY2, q=5→FY3, q=43→FY12. Mirrors Row 49."""
    result = calculate_renovation(_reference_input(start_year=2, duration_years=1))

    assert result.quarterly_cash_flows[0].fiscal_year == 2
    assert result.quarterly_cash_flows[0].quarter_in_year == 1
    assert result.quarterly_cash_flows[4].fiscal_year == 3
    assert result.quarterly_cash_flows[4].quarter_in_year == 1
    assert result.quarterly_cash_flows[-1].fiscal_year == 12
    assert result.quarterly_cash_flows[-1].quarter_in_year == 3


def test_enabled_path_actual_annual_zero_when_no_units() -> None:
    """Row 88 — actual_annual = 0 outside the renovation program window.

    Factor remains non-zero (the schedule is deterministic) but actual
    annual drops to zero when units_renovated == 0.
    """
    result = calculate_renovation(_reference_input())  # 200 units / 1-yr

    for q in range(5, QUARTERS + 1):
        cf = result.quarterly_cash_flows[q - 1]
        assert cf.units_renovated == 0.0
        assert cf.incremental_revenue_actual_annual == 0.0
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


def test_enabled_path_summary_scalars_populated() -> None:
    """Phase 4 contract: top-level F-column scalars match the rollups.

    Default ``_reference_input`` is 200 2BR @ $150/mo, 1-yr / Y1 start,
    $10k/unit, 3% growth. Hand-calc (annual dollars, ×12 applied):
      * total_units_renovated         = 200
      * total_renovation_cost         = 200 * $10_000        = $2_000_000
      * weighted_avg_rent_premium     = (200 * 150) / 200    = $150
      * implied_return_on_cost        = (150 * 12) / 10_000  = 0.18
      * avg_units_renovated_per_year  = 200 / 1              = 200
      * Y1 cumulative (first reno year identity):
          potential = 4 * 50 * 150 * 12             = $360_000
          actual    = 50 * 150 * 42/12 * 12         = $315_000
          cum[0]    = $315_000
      * Y2 cumulative (first post-reno year):
          cum[1] = (315_000 - (-45_000)) * 1.03     = $370_800
      * stabilized_revenue_increase   = rollups[start+dur-1]
                                      = rollups[1] = $370_800
      * annualized_return_on_investment = 370_800 / 2_000_000 = 0.1854
    """
    result = calculate_renovation(_reference_input())

    assert result.enabled is True
    assert result.total_units_renovated == pytest.approx(200.0, abs=0.01)
    assert result.total_renovation_cost == pytest.approx(2_000_000.0, abs=0.01)
    assert result.weighted_avg_rent_premium == pytest.approx(150.0, abs=0.01)
    assert result.implied_return_on_cost == pytest.approx(0.18, abs=1e-6)
    assert result.avg_units_renovated_per_year == pytest.approx(200.0, abs=0.01)
    assert result.stabilized_revenue_increase == pytest.approx(370_800.0, abs=0.01)
    assert result.annualized_return_on_investment == pytest.approx(0.1854, abs=1e-6)


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
    """Layer 3 — rollups are always proforma Y1..Y11 regardless of start.

    100 2BR / 1-yr / start=Y3 — annual_rollups[0] is proforma Y1 (a
    pre-renovation, all-zero rollup); the actual reno activity lives at
    position 2 (proforma Y3 = start_year).
    """
    result = calculate_renovation(
        _reference_input(
            start_year=3,
            unit_types=[_single_unit_type(units_to_renovate=100)],
        )
    )

    assert result.annual_rollups[0].fiscal_year == 1
    assert result.annual_rollups[0].renovations_completed == 0.0
    assert result.annual_rollups[1].fiscal_year == 2
    assert result.annual_rollups[1].renovations_completed == 0.0
    assert result.annual_rollups[2].fiscal_year == 3
    assert result.annual_rollups[2].renovations_completed == pytest.approx(100.0)
    # Last rollup is always proforma Y11.
    assert result.annual_rollups[-1].fiscal_year == 11


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
        expected = sum(q.incremental_revenue_gross_annual for q in bucket)
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


def test_row43_post_reno_branch() -> None:
    """Row 43 — post-reno branch: Y2 = (Y1_cum − Y1_downtime) * (1 + rate).

    100 2BR @ $100/mo / 1-yr / start=Y1 / 3% growth. Annual dollars
    (Row 86 ×12):
      Y1 potential = 4 * (25 * $100) * 12 = $120_000.
      Y1 actual    = 25 * $100 * 42/12 * 12 = 25 * 100 * 42 = $105_000.
      Y1 downtime  = -$15_000  ->  Y1 cumulative = $105_000 (first reno
                                   year identity).
      Y2 cumulative = (105_000 - (-15_000)) * 1.03
                    = 120_000 * 1.03 = $123_600.
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

    assert y1.potential_rent_premium_annual == pytest.approx(120_000.0)
    assert y1.current_year_revenue_growth == pytest.approx(105_000.0)
    assert y1.downtime_deduction == pytest.approx(-15_000.0)
    assert y1.cumulative_revenue_growth == pytest.approx(105_000.0, abs=0.01)

    assert y2.renovations_completed == 0.0
    assert y2.cumulative_revenue_growth == pytest.approx(123_600.0, abs=0.01)


def test_row43_subsequent_reno_year_branch() -> None:
    """Row 43 — subsequent reno year: running sum + downtime, NO growth mult.

    200 2BR / 2-yr / start=Y1 / $100 base, 3% growth. Layer 1 schedules
    25 units/qtr in every Y1 and Y2 quarter and compounds rent at the
    Y2 rate (3%) for Q5..Q8.

    Annual dollars (Row 86 ×12):
      Y1 rent=$100, Y2 rent=$100 * 1.03 = $103.
      Y1 potential = 4 * 25 * 100 * 12 = $120_000.
      Y2 potential = 4 * 25 * 103 * 12 = $123_600.
      Y2 actual    = 25 * 103 * 42/12 * 12 = 25 * 103 * 42 = $108_150.
      Y2 downtime  = 108_150 - 123_600 = -$15_450.
      Y2 cumulative = running_sum(potential Y1..Y2) + Y2 downtime
                    = (120_000 + 123_600) + (-15_450) = $228_150.
      (No growth multiplier during active reno years — W&D Row 43
      formula is =SUM($C$38:D38) + D39, nothing else.)
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
    assert y2.potential_rent_premium_annual == pytest.approx(123_600.0)
    assert y2.downtime_deduction == pytest.approx(-15_450.0)
    assert y2.cumulative_revenue_growth == pytest.approx(228_150.0, abs=0.01)


def test_row43_back_to_back_three_years_then_flat() -> None:
    """Row 43 — 3 yrs of active renos, then flat, branch transition.

    300 2BR / 3-yr / start=Y1 / $100 base, 3% growth.
    Layer 1 schedules 25 units/qtr in Q1..Q12 (Y1..Y3 each get 100 units),
    rent compounds annually: Y1=$100, Y2=$103, Y3=$106.09.

    Annual dollars (Row 86 ×12):
      * Y1..Y3 use reno-year branches (renovations_completed > 0) —
        Y1 = first reno (identity), Y2..Y3 = subsequent (running sum +
        this year's downtime, NO growth multiplier).
      * Y4..Y10 use the post-reno full-year branch.
      * Y4 = (Y3_cum − Y3_downtime) * (1 + rates[3]).
      * Y5+ each = prior_cum * (1 + rates[i])  (no downtime to strip).
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

    # Hand-compute Y1..Y3 in annual dollars (×12).
    y1_pot = 25.0 * 100.0 * 4.0 * 12.0
    y2_pot = 25.0 * 103.0 * 4.0 * 12.0
    y3_pot = 25.0 * 106.09 * 4.0 * 12.0
    factor_sum = 1.0 + 11.0 / 12.0 + 10.0 / 12.0 + 9.0 / 12.0
    y3_actual = 25.0 * 106.09 * factor_sum * 12.0
    y3_downtime = y3_actual - y3_pot

    # Y3 subsequent-reno-year formula: running potential sum + this
    # year's downtime (no growth multiplier).
    expected_y3 = y1_pot + y2_pot + y3_pot + y3_downtime
    assert rollups[2].cumulative_revenue_growth == pytest.approx(expected_y3, abs=0.01)

    # Y4 transitions to the post-reno branch:
    # Y4_cum = (Y3_cum − Y3_downtime) * (1 + rates[3])
    expected_y4 = (rollups[2].cumulative_revenue_growth - y3_downtime) * (1 + rates[3])
    assert rollups[3].cumulative_revenue_growth == pytest.approx(expected_y4, abs=0.01)

    # Y5..Y10 keep applying the full-year multiplier with downtime = 0,
    # so each year is just prior * (1 + rate).
    for i in range(4, ROLLUP_YEARS):
        expected_i = rollups[i - 1].cumulative_revenue_growth * (1 + rates[i])
        assert rollups[i].cumulative_revenue_growth == pytest.approx(
            expected_i, abs=0.01
        )


def test_row43_zero_growth_documents_downtime_strip() -> None:
    """Row 43 — zero-growth case: downtime stripping inflates Y2 then holds flat.

    100 2BR @ $100/mo / 1-yr / start=Y1 / 0% growth everywhere.
    Annual dollars (Row 86 ×12):

    The W&D post-reno formula intentionally strips the prior year's
    downtime drag and never re-adds it. With growth=0:
      * Y1_cum = $105_000 (first reno identity; = current_year).
      * Y2_cum = (105_000 − (−15_000)) * 1.0 = $120_000 — INCREASES
        vs. Y1 because the Y1 construction-disruption haircut is
        rolled back to represent units coming back online for full
        revenue.
      * Y3..Y11 carry $120_000 unchanged (no new renos, no new
        downtime to strip, multiplier of 1.0).

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
    assert rollups[0].cumulative_revenue_growth == pytest.approx(105_000.0, abs=0.01)

    # Y2 = Y1_cum − Y1_downtime (downtime stripped, no re-addition).
    expected_y2 = rollups[0].cumulative_revenue_growth - rollups[0].downtime_deduction
    assert rollups[1].cumulative_revenue_growth == pytest.approx(expected_y2, abs=0.01)
    assert rollups[1].cumulative_revenue_growth == pytest.approx(120_000.0, abs=0.01)

    # Y3..Y11 hold flat at the Y2 value (steady state).
    for i in range(2, ROLLUP_YEARS):
        assert rollups[i].cumulative_revenue_growth == pytest.approx(
            rollups[1].cumulative_revenue_growth, abs=0.01
        )


def test_row43_growth_rate_indexed_by_proforma_year() -> None:
    """Row 43 — growth-rate indexing aligns with rollup position (proforma year).

    100 2BR @ $100/mo / 1-yr / start=Y3 / non-uniform growth rates.
    annual_rollups[i] always represents proforma year i+1, so
    rollups[i].incremental_rent_growth_rate == rates[i]. Pre-reno
    years (Y1, Y2) carry zero cumulative; Y3 is the first reno year
    and uses rates[2]=0.10 as its growth rate; Y4 is the first
    post-reno year and applies rates[3]=0.20 to the stripped-downtime
    carryforward.
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

    # Growth-rate field always mirrors its proforma-year position.
    for i, expected_rate in enumerate(rates):
        assert rollups[i].fiscal_year == i + 1
        assert rollups[i].incremental_rent_growth_rate == pytest.approx(expected_rate)

    # Y1, Y2 pre-reno -> cum = 0.
    assert rollups[0].cumulative_revenue_growth == 0.0
    assert rollups[1].cumulative_revenue_growth == 0.0

    # Y3 first reno year: cum = potential + downtime = current_year.
    # potential = 4 * 25 * 100 * 12 = $120_000.
    # actual    = 25 * 100 * 42/12 * 12 = $105_000. downtime = -$15_000.
    assert rollups[2].cumulative_revenue_growth == pytest.approx(105_000.0, abs=0.01)

    # Y4 post-reno uses rates[3] = 0.20.
    expected_y4 = (
        rollups[2].cumulative_revenue_growth - rollups[2].downtime_deduction
    ) * (1 + 0.20)
    assert rollups[3].cumulative_revenue_growth == pytest.approx(expected_y4, abs=0.01)
    assert rollups[3].cumulative_revenue_growth == pytest.approx(144_000.0, abs=0.01)


# ---------------------------------------------------------------------------
# Phase 4: Summary scalars & end-to-end reference
# ---------------------------------------------------------------------------


def test_end_to_end_reference_scenario() -> None:
    """Hand-calculable regression anchor for the entire waterfall.

    Scenario: 100 x 2BR units, 1-year renovation starting Y1,
    $100/mo premium, $10k/unit, Y1 rent growth = 0% (so nothing
    compounds in the renovation year), Y2+ rent growth = 3%.

    Every intermediate value is hand-computed below (annual dollars,
    Row 86 ×12). If this test drifts, compare Talisman output against
    the W&D "Renovation" tab cell-by-cell before changing assertions.
    """
    result = calculate_renovation(
        _reference_input(
            start_year=1,
            duration_years=1,
            cost_per_unit=10_000.0,
            unit_types=[
                _single_unit_type(
                    unit_type="2BR",
                    units_to_renovate=100,
                    rent_premium_per_month=100.0,
                )
            ],
            incremental_rent_growth_rates=[0.0] + [0.03] * 10,
            downtime_months_per_unit=1,
            finance_with_loan=False,
        )
    )

    # --- Quarterly: Y1 (qtrs 1-4) ---
    # scheduled per qtr = 100 / (1 * 4) = 25 units.
    # gross annual (Row 86 ×12) = 25 * $100 * 12 = $30,000/qtr.
    # downtime factors (Row 87) = [1.0, 11/12, 10/12, 9/12].
    # actual annual (Row 88) = gross_annual * factor.
    # capex (Row 91) = 25 * $10,000 = $250,000.
    expected_actuals = [
        30_000.0,
        30_000.0 * 11 / 12,
        30_000.0 * 10 / 12,
        30_000.0 * 9 / 12,
    ]
    expected_factors = [1.0, 11 / 12, 10 / 12, 9 / 12]
    for q_idx in range(4):
        qcf = result.quarterly_cash_flows[q_idx]
        assert qcf.quarter == q_idx + 1
        assert qcf.fiscal_year == 1
        assert qcf.units_renovated == pytest.approx(25.0, abs=0.01)
        assert qcf.incremental_revenue_gross_annual == pytest.approx(30_000.0, abs=0.01)
        assert qcf.incremental_revenue_factor == pytest.approx(
            expected_factors[q_idx], abs=1e-6
        )
        assert qcf.incremental_revenue_actual_annual == pytest.approx(
            expected_actuals[q_idx], abs=0.01
        )
        assert qcf.renovation_capex == pytest.approx(250_000.0, abs=0.01)

    # --- Quarterly: qtrs 5-43 (post-completion, all zeros) ---
    for q_idx in range(4, QUARTERS):
        qcf = result.quarterly_cash_flows[q_idx]
        assert qcf.units_renovated == pytest.approx(0.0, abs=0.01)
        assert qcf.incremental_revenue_gross_annual == pytest.approx(0.0, abs=0.01)
        assert qcf.incremental_revenue_actual_annual == pytest.approx(0.0, abs=0.01)
        assert qcf.renovation_capex == pytest.approx(0.0, abs=0.01)

    # --- Annual: Y1 (first reno year) ---
    # Row 34 = 100 units, Row 36 = $1,000,000 capex.
    # Row 38 potential = 4 * $30,000 = $120,000 (annual dollars).
    # Row 40 actual = 30000 + 27500 + 25000 + 22500 = $105,000.
    # Row 39 downtime = actual - potential = -$15,000.
    # Row 43 first-reno identity = Row 40 = $105,000.
    y1 = result.annual_rollups[0]
    assert y1.fiscal_year == 1
    assert y1.renovations_completed == pytest.approx(100.0, abs=0.01)
    assert y1.annual_renovation_cost == pytest.approx(1_000_000.0, abs=0.01)
    assert y1.potential_rent_premium_annual == pytest.approx(120_000.0, abs=0.01)
    assert y1.current_year_revenue_growth == pytest.approx(105_000.0, abs=0.01)
    assert y1.downtime_deduction == pytest.approx(-15_000.0, abs=0.01)
    assert y1.cumulative_revenue_growth == pytest.approx(105_000.0, abs=0.01)

    # --- Annual: Y2 (post-reno branch) ---
    # cumulative = (prior_cum - prior_downtime) * (1 + growth_rate[1])
    #            = (105_000 - (-15_000)) * 1.03 = 120_000 * 1.03 = $123,600.
    y2 = result.annual_rollups[1]
    assert y2.renovations_completed == pytest.approx(0.0, abs=0.01)
    assert y2.annual_renovation_cost == pytest.approx(0.0, abs=0.01)
    assert y2.incremental_rent_growth_rate == pytest.approx(0.03, abs=1e-6)
    assert y2.cumulative_revenue_growth == pytest.approx(123_600.0, abs=0.01)

    # --- Annual: Y3 (post-reno branch, no prior downtime to strip) ---
    # cumulative = (123_600 - 0) * 1.03 = $127,308.
    y3 = result.annual_rollups[2]
    assert y3.renovations_completed == pytest.approx(0.0, abs=0.01)
    assert y3.cumulative_revenue_growth == pytest.approx(127_308.0, abs=0.01)

    # --- Summary scalars (Layer 5, W&D F-column) ---
    assert result.total_units_renovated == pytest.approx(100.0, abs=0.01)
    assert result.total_renovation_cost == pytest.approx(1_000_000.0, abs=0.01)
    # Weighted avg = (100 * 100) / 100 = $100/mo (single unit type).
    assert result.weighted_avg_rent_premium == pytest.approx(100.0, abs=0.01)
    # Implied RoC = (100 * 12) / 10_000 = 0.12 (12%).
    assert result.implied_return_on_cost == pytest.approx(0.12, abs=1e-6)
    # Avg units / yr = 100 / 1 = 100.
    assert result.avg_units_renovated_per_year == pytest.approx(100.0, abs=0.01)
    # Stabilized = rollups[start_year + duration_years - 1] = rollups[1]
    # = first post-reno year cumulative = $123,600.
    assert result.stabilized_revenue_increase == pytest.approx(123_600.0, abs=0.01)
    # Annualized RoI = 123_600 / 1_000_000 = 0.1236.
    assert result.annualized_return_on_investment == pytest.approx(0.1236, abs=1e-6)


def test_summary_stabilized_reads_first_post_reno_year() -> None:
    """Stabilized index must be ``start_year + duration_years - 1``.

    W&D F28 = OFFSET(C43, 0, (F5-1)+F6) = Row 43 at proforma year
    ``start_year + duration_years`` — the FIRST POST-RENOVATION year,
    when rent premiums are fully stabilized (not the final active-reno
    year). As a 0-indexed list position that is
    ``start_year + duration_years - 1``.

    With start_year=3, duration_years=2: stabilized reads rollups[4]
    (proforma Y5 = first post-reno year), not rollups[3] (Y4 = final
    reno year).
    """
    result = calculate_renovation(
        _reference_input(
            start_year=3,
            duration_years=2,
            unit_types=[
                _single_unit_type(units_to_renovate=100, rent_premium_per_month=100.0)
            ],
        )
    )

    assert result.annual_rollups[4].fiscal_year == 5
    assert result.annual_rollups[4].renovations_completed == 0.0
    assert result.stabilized_revenue_increase == pytest.approx(
        result.annual_rollups[4].cumulative_revenue_growth, abs=0.01
    )


def test_summary_scalars_zero_on_disabled_path() -> None:
    """Disabled path still zeros every F-column scalar."""
    result = calculate_renovation(_reference_input(enabled=False))

    assert result.enabled is False
    assert result.total_units_renovated == 0.0
    assert result.total_renovation_cost == 0.0
    assert result.weighted_avg_rent_premium == 0.0
    assert result.implied_return_on_cost == 0.0
    assert result.avg_units_renovated_per_year == 0.0
    assert result.stabilized_revenue_increase == 0.0
    assert result.annualized_return_on_investment == 0.0


def test_summary_weighted_avg_premium_multi_unit_type() -> None:
    """Weighted avg premium is units-weighted across unit types.

    Two unit types: 100 x $50 and 300 x $150. Weighted avg =
    (100*50 + 300*150) / 400 = (5_000 + 45_000) / 400 = $125/mo.
    """
    result = calculate_renovation(
        _reference_input(
            duration_years=2,
            unit_types=[
                _single_unit_type(
                    unit_type="1BR",
                    units_to_renovate=100,
                    rent_premium_per_month=50.0,
                ),
                _single_unit_type(
                    unit_type="2BR",
                    units_to_renovate=300,
                    rent_premium_per_month=150.0,
                ),
            ],
        )
    )

    assert result.weighted_avg_rent_premium == pytest.approx(125.0, abs=0.01)
    # Implied RoC = (125 * 12) / 10_000 = 0.15 sanity-check.
    assert result.implied_return_on_cost == pytest.approx(0.15, abs=1e-6)
    # Avg units/yr = 400 / 2 = 200.
    assert result.avg_units_renovated_per_year == pytest.approx(200.0, abs=0.01)


# ---------------------------------------------------------------------------
# W&D Prose Gainesville regression anchor
# ---------------------------------------------------------------------------


def test_renovation_matches_wd_prose_gainesville_scenario() -> None:
    """Regression test pinning Talisman output to W&D Prose Gainesville.

    Source: Prose_Gainesville_Proforma_1_30_26_RH.xlsm, "Renovation"
    tab, post LibreOffice recalc. Inputs:
      * start_year=2, duration=2, cost_per_unit=$8_000
      * Unit types: 150 x 1BR @ $125/mo, 90 x 2BR @ $175/mo
      * Growth rates: [0, 0.035, 0.0375, 0.0375, 0.03, 0.03, 0.03,
                       0.03, 0.03, 0.03, 0.03]

    Expected Row 43 cumulative revenue growth matches W&D to the cent
    across all 11 proforma years. This is the module's primary
    regression anchor — if this drifts, the DCF revenue ramp for the
    Prose Gainesville deal will drift, and the module needs to be
    re-validated against the source workbook before changing assertions.
    """
    result = calculate_renovation(
        RenovationInput(
            enabled=True,
            start_year=2,
            duration_years=2,
            cost_per_unit=8_000.0,
            unit_types=[
                RenovationUnitType(
                    unit_type="1BR",
                    units_to_renovate=150,
                    rent_premium_per_month=125.0,
                ),
                RenovationUnitType(
                    unit_type="2BR",
                    units_to_renovate=90,
                    rent_premium_per_month=175.0,
                ),
            ],
            incremental_rent_growth_rates=[
                0.0,
                0.035,
                0.0375,
                0.0375,
                0.03,
                0.03,
                0.03,
                0.03,
                0.03,
                0.03,
                0.03,
            ],
        )
    )

    # --- Summary scalars (W&D F-column) ---
    assert result.total_units_renovated == pytest.approx(240.0, abs=0.01)
    assert result.total_renovation_cost == pytest.approx(1_920_000.0, abs=0.50)
    assert result.weighted_avg_rent_premium == pytest.approx(143.75, abs=0.01)
    assert result.implied_return_on_cost == pytest.approx(0.215625, abs=1e-6)
    assert result.avg_units_renovated_per_year == pytest.approx(120.0, abs=0.01)
    assert result.stabilized_revenue_increase == pytest.approx(437_578.59, abs=0.50)
    assert result.annualized_return_on_investment == pytest.approx(0.22791, abs=1e-4)

    # --- Row 43 cumulative revenue growth by proforma year ---
    expected_cumulative = [
        0.00,  # Y1 — pre-renovation (renos start in Y2)
        181_125.00,  # Y2 — first reno year (identity: cum = actual)
        394_917.19,  # Y3 — subsequent reno year (running sum + downtime)
        437_578.59,  # Y4 — first post-reno year (stabilized)
        450_705.95,  # Y5 — post-reno × (1 + 0.03)
        464_227.13,  # Y6
        478_153.94,  # Y7
        492_498.56,  # Y8
        507_273.52,  # Y9
        522_491.72,  # Y10
        538_166.48,  # Y11
    ]
    for i, expected in enumerate(expected_cumulative):
        assert result.annual_rollups[i].fiscal_year == i + 1
        assert result.annual_rollups[i].cumulative_revenue_growth == pytest.approx(
            expected, abs=0.50
        ), f"Y{i + 1} cumulative drift"
