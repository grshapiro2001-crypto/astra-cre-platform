"""Tests for the Retail standalone DCF calculation module.

Reference values are taken from Walker & Dunlop's Prose_Gainesville
proforma "Retail" tab. Each assertion cites the W&D row/col it
corresponds to.
"""

from __future__ import annotations

from datetime import date
from typing import Any

import pytest
from pydantic import ValidationError

from underwriting.v2.retail import calculate_retail
from underwriting.v2.schemas.retail import (
    RetailInput,
    RetailResult,
    RetailScenarioAssumptions,
    RetailScenarioResult,
    RetailTenant,
)


def _single_tenant(**overrides: Any) -> RetailTenant:
    """Build a single W&D-style tenant with optional overrides."""
    defaults: dict[str, Any] = {
        "unit_number": 1,
        "tenant_name": "Acme Coffee",
        "square_feet": 10_000.0,
        "annual_rent_per_sf": 30.0,
    }
    defaults.update(overrides)
    return RetailTenant(**defaults)


def _reference_input(**overrides: Any) -> RetailInput:
    """Build the canonical W&D-style reference case, with optional overrides."""
    defaults: dict[str, Any] = {
        "enabled": True,
        "hold_period_years": 15,
        "rollover_vacancy": False,
        "vacant_leaseup_rollover_months": 6,
        "tenants": [_single_tenant()],
        "expenses_per_sf": 7.5,
        "tenant_expense_recovery": 1.0,
        "tenant_improvement_per_sf": 3.5,
        "leasing_commission_percent": 0.06,
        "tenant_capex_recovery": 0.0,
        "rental_inflation": 0.03,
        "structural_vacancy_loss": 0.05,
        "credit_loss": 0.05,
        "expense_inflation": 0.0275,
        "premium": RetailScenarioAssumptions(discount_rate=0.075, exit_cap=0.065),
        "market": RetailScenarioAssumptions(discount_rate=0.08, exit_cap=0.07),
        "mf_ltv_ratio": 0.65,
    }
    defaults.update(overrides)
    return RetailInput(**defaults)


def test_single_tenant_reference_case() -> None:
    """10k sf @ $30/sf, 15-yr hold — Y1 math verified by hand.

    Y1 hand calculation (100% expense recovery, 0% capex recovery):
        PRI       = 10,000 × $30              = $300,000
        Vacancy   = -300,000 × 5%             = -15,000
        Credit    = -300,000 × 5%             = -15,000
        Expenses  = -$7.5 × 10,000            = -75,000
        ExpReimb  = 75,000 × 100%             = +75,000
        TI        = -$3.5 × 10,000            = -35,000
        LC        = -6% × 300,000             = -18,000
        CapReimb  = 53,000 × 0%               = 0
        ----------------------------------------
        NCF       = 217,000
    """
    result = calculate_retail(_reference_input())

    assert isinstance(result, RetailResult)
    assert result.enabled is True
    assert result.total_square_feet == pytest.approx(10_000.0, abs=1e-9)
    assert result.weighted_average_rent_per_sf == pytest.approx(30.0, abs=1e-9)

    cf1 = result.premium.annual_cash_flows[0]
    # Retail!L37 — PRI
    assert cf1.potential_rental_income == pytest.approx(300_000.0, abs=1e-6)
    # Retail!L38 — Vacancy
    assert cf1.vacancy_loss == pytest.approx(-15_000.0, abs=1e-6)
    # Retail!L39 — Credit Loss
    assert cf1.credit_loss == pytest.approx(-15_000.0, abs=1e-6)
    # Retail!L40 — Expenses
    assert cf1.expenses == pytest.approx(-75_000.0, abs=1e-6)
    # Retail!L41 — Expense Reimbursements (100% recovery)
    assert cf1.expense_reimbursements == pytest.approx(75_000.0, abs=1e-6)
    # Retail!L42 — TI&LC = -35,000 + -18,000
    assert cf1.ti_and_lc == pytest.approx(-53_000.0, abs=1e-6)
    # Retail!L43 — Capex Reimbursements (0% recovery)
    assert cf1.capex_reimbursements == pytest.approx(0.0, abs=1e-9)
    # Retail!L44 — NCF
    assert cf1.net_cash_flow == pytest.approx(217_000.0, abs=1e-6)

    # Premium value sanity: within a wide "sane" range (> 5× < 30× Y1 NCF).
    assert result.premium.retail_value > 5 * cf1.net_cash_flow
    assert result.premium.retail_value < 30 * cf1.net_cash_flow
    # Scenario wiring echoed correctly.
    assert result.premium.scenario_name == "premium"
    assert result.premium.discount_rate == pytest.approx(0.075, abs=1e-12)
    assert result.premium.exit_cap == pytest.approx(0.065, abs=1e-12)
    assert result.market.scenario_name == "market"

    # Retail!L48 — Y1 cap rate = NCF / value.
    assert result.premium.year_1_cap_rate == pytest.approx(
        cf1.net_cash_flow / result.premium.retail_value, abs=1e-12
    )
    # Retail!L49 — $/sf.
    assert result.premium.value_per_retail_sf == pytest.approx(
        result.premium.retail_value / 10_000.0, abs=1e-9
    )
    # Retail!L52 — max debt = mf_ltv_ratio × value.
    assert result.premium.maximum_debt_proceeds == pytest.approx(
        0.65 * result.premium.retail_value, abs=1e-9
    )
    # Retail!L53 — implied LTV = mf_ltv_ratio by construction.
    assert result.premium.implied_ltv == pytest.approx(0.65, abs=1e-12)


def test_vacant_tenant_uses_market_rent_for_pri() -> None:
    """Vacant slot still contributes market rent to PRI via weighted avg."""
    tenants = [
        _single_tenant(
            unit_number=1,
            tenant_name="Vacant",
            square_feet=10_000.0,
            annual_rent_per_sf=30.0,
        ),
    ]
    result = calculate_retail(_reference_input(tenants=tenants))

    assert result.weighted_average_rent_per_sf == pytest.approx(30.0, abs=1e-9)
    # PRI = total_sqft × wa_rent — unchanged vs. the occupied reference.
    assert result.premium.annual_cash_flows[0].potential_rental_income == pytest.approx(
        300_000.0, abs=1e-6
    )


def test_weighted_average_rent_two_tenants() -> None:
    """Two tenants, different sizes: SF-weighted rent, not a simple mean."""
    tenants = [
        _single_tenant(unit_number=1, square_feet=5_000.0, annual_rent_per_sf=40.0),
        _single_tenant(unit_number=2, square_feet=15_000.0, annual_rent_per_sf=25.0),
    ]
    result = calculate_retail(_reference_input(tenants=tenants))

    # (5000 × 40 + 15000 × 25) / 20000 = 575000 / 20000 = 28.75.
    assert result.weighted_average_rent_per_sf == pytest.approx(28.75, abs=1e-9)
    assert result.total_square_feet == pytest.approx(20_000.0, abs=1e-9)
    # Y1 PRI = 20,000 × 28.75 = 575,000 — equals SUMPRODUCT of rent × sf.
    assert result.premium.annual_cash_flows[0].potential_rental_income == pytest.approx(
        575_000.0, abs=1e-6
    )


def test_disabled_returns_zero_result() -> None:
    """enabled=False → zero-filled result; both scenarios present, no raise."""
    result = calculate_retail(_reference_input(enabled=False))

    _assert_zero_result(result)


def test_empty_tenants_returns_zero_result() -> None:
    """Empty rent roll is treated identically to disabled."""
    result = calculate_retail(_reference_input(tenants=[]))

    _assert_zero_result(result)


def _assert_zero_result(result: RetailResult) -> None:
    assert result.enabled is False
    assert result.total_square_feet == 0.0
    assert result.weighted_average_rent_per_sf == 0.0
    for scenario in (result.premium, result.market):
        assert isinstance(scenario, RetailScenarioResult)
        assert scenario.retail_value == 0.0
        assert scenario.year_1_cap_rate == 0.0
        assert scenario.value_per_retail_sf == 0.0
        assert scenario.maximum_debt_proceeds == 0.0
        assert scenario.implied_ltv == 0.0
        # hold_period_years + 1 zero-valued cash flows.
        assert len(scenario.annual_cash_flows) == 16
        for cf in scenario.annual_cash_flows:
            assert cf.net_cash_flow == 0.0
            assert cf.potential_rental_income == 0.0
            assert cf.expenses == 0.0


def test_market_scenario_values_below_premium() -> None:
    """Higher discount AND higher exit cap in Market → strictly lower value."""
    result = calculate_retail(_reference_input())

    assert result.market.retail_value < result.premium.retail_value
    # Scenario inputs echoed correctly for downstream display.
    assert result.market.discount_rate == pytest.approx(0.08, abs=1e-12)
    assert result.market.exit_cap == pytest.approx(0.07, abs=1e-12)


def test_annual_cashflow_count_matches_hold_plus_one() -> None:
    """10-yr hold → exactly 11 cash-flow rows (Y1..Y10 operating + Y11 reversion)."""
    result = calculate_retail(_reference_input(hold_period_years=10))

    assert len(result.premium.annual_cash_flows) == 11
    assert len(result.market.annual_cash_flows) == 11
    # Years are 1-indexed, 1..11 contiguously.
    assert [cf.year for cf in result.premium.annual_cash_flows] == list(range(1, 12))


def test_stabilized_flat_ncf_reversion_sanity() -> None:
    """Flat NCF with disc == exit cap → retail_value == NCF / cap exactly.

    Closed-form identity: valuing a flat-NCF perpetuity via N years of
    operating cash flows plus terminal at cap rate ``r`` (= discount
    rate) collapses to ``NCF / r``. See module docstring for derivation.
    """
    inp = _reference_input(
        rental_inflation=0.0,
        expense_inflation=0.0,
        transaction_cost_percent=0.0,
        premium=RetailScenarioAssumptions(discount_rate=0.07, exit_cap=0.07),
        market=RetailScenarioAssumptions(discount_rate=0.07, exit_cap=0.07),
    )
    result = calculate_retail(inp)

    ncf = result.premium.annual_cash_flows[0].net_cash_flow
    expected_value = ncf / 0.07
    # Spec says within 5%; closed-form identity delivers ~1e-9.
    assert result.premium.retail_value == pytest.approx(expected_value, rel=0.05)
    assert result.premium.retail_value == pytest.approx(expected_value, rel=1e-9)


def test_lease_fields_accepted_but_unused() -> None:
    """Providing lease_* fields on RetailTenant must not change outputs.

    MVP ignores lease_start_date, lease_expiration_date, lease_type, and
    absorption_months (see module DEVIATIONS). This test pins that
    behavior: two inputs identical except for those fields produce
    identical retail values.
    """
    tenant_without = _single_tenant()
    tenant_with = _single_tenant(
        lease_start_date=date(2025, 1, 1),
        lease_expiration_date=date(2030, 12, 31),
        lease_type="NNN",
        absorption_months=6,
    )

    result_without = calculate_retail(_reference_input(tenants=[tenant_without]))
    result_with = calculate_retail(_reference_input(tenants=[tenant_with]))

    assert result_with.premium.retail_value == pytest.approx(
        result_without.premium.retail_value, abs=1e-9
    )
    assert result_with.market.retail_value == pytest.approx(
        result_without.market.retail_value, abs=1e-9
    )


def test_validation_rejects_bad_inputs() -> None:
    """Schema bounds reject nonsense values."""
    # Negative square footage.
    with pytest.raises(ValidationError):
        RetailTenant(unit_number=1, square_feet=-1.0, annual_rent_per_sf=30.0)

    # Non-positive discount rate.
    with pytest.raises(ValidationError):
        RetailScenarioAssumptions(discount_rate=0.0, exit_cap=0.07)

    # Non-positive exit cap.
    with pytest.raises(ValidationError):
        RetailScenarioAssumptions(discount_rate=0.08, exit_cap=0.0)

    # Hold period out of range.
    with pytest.raises(ValidationError):
        _reference_input(hold_period_years=0)

    # Recovery > 100%.
    with pytest.raises(ValidationError):
        _reference_input(tenant_expense_recovery=1.5)


def test_pri_grows_with_rental_inflation() -> None:
    """Year-N PRI must equal Y1 PRI × (1 + rental_inflation)^(N-1)."""
    result = calculate_retail(_reference_input())

    cfs = result.premium.annual_cash_flows
    base = cfs[0].potential_rental_income
    # Year 5 (index 4): base × 1.03^4.
    assert cfs[4].potential_rental_income == pytest.approx(
        base * (1.03 ** 4), rel=1e-12
    )
    # Year 15 (index 14): base × 1.03^14.
    assert cfs[14].potential_rental_income == pytest.approx(
        base * (1.03 ** 14), rel=1e-12
    )


def test_retail_matches_wd_prose_gainesville_scenario() -> None:
    """Regression test pinning Talisman output to Walker & Dunlop's
    Prose Gainesville Retail tab output, activated with:
      2 tenants (Blue Bottle Coffee 1500sf @ $32, Polished Nail Bar 1200sf @ $28),
      7-year hold, premium disc/exit 7.5%/6.5%, market 8.0%/7.0%,
      $7.50/sf expenses at 100% recovery, $3.50/sf TI, 6% LC, 0% capex recovery,
      3% rent inflation, 2.75% expense inflation, 5% structural vac, 5% credit loss,
      mf_ltv_ratio = 38328131.16 / 63880218.60 = 0.60001...,
      transaction_cost_percent = 0.015.
    Expected values extracted from the source xlsm after LibreOffice recalc.
    """
    tenants = [
        RetailTenant(
            unit_number=1,
            tenant_name="Blue Bottle Coffee",
            square_feet=1500.0,
            annual_rent_per_sf=32.0,
        ),
        RetailTenant(
            unit_number=2,
            tenant_name="Polished Nail Bar",
            square_feet=1200.0,
            annual_rent_per_sf=28.0,
        ),
    ]
    inp = _reference_input(
        hold_period_years=7,
        tenants=tenants,
        premium=RetailScenarioAssumptions(discount_rate=0.075, exit_cap=0.065),
        market=RetailScenarioAssumptions(discount_rate=0.08, exit_cap=0.07),
        mf_ltv_ratio=38328131.16 / 63880218.60,
        transaction_cost_percent=0.015,
    )
    res = calculate_retail(inp)

    assert res.total_square_feet == pytest.approx(2700.0, abs=0.0001)
    assert res.weighted_average_rent_per_sf == pytest.approx(30.2222, abs=0.0001)
    assert res.premium.retail_value == pytest.approx(1_005_716.97, abs=0.50)
    assert res.premium.year_1_cap_rate == pytest.approx(0.05876, abs=0.0001)
    assert res.market.retail_value == pytest.approx(932_439.23, abs=0.50)
    assert res.market.year_1_cap_rate == pytest.approx(0.06338, abs=0.0001)
    assert res.premium.annual_cash_flows[0].net_cash_flow == pytest.approx(
        59_094.00, abs=0.50
    )
    assert res.premium.annual_cash_flows[1].net_cash_flow == pytest.approx(
        60_890.45, abs=0.50
    )
    assert res.premium.annual_cash_flows[7].net_cash_flow == pytest.approx(
        72_874.20, abs=0.50
    )
