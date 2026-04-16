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
# Phase 2/3/4 (engine) — placeholder marker so CI shows pending work
# ---------------------------------------------------------------------------


def test_engine_not_yet_implemented_phase_1_only() -> None:
    """Phase 1 scaffolding raises NotImplementedError on the live path.

    This test will be removed in Phase 2 when the engine lands.
    """
    with pytest.raises(NotImplementedError, match="Phase 1 scaffolding"):
        calculate_renovation(_reference_input())
