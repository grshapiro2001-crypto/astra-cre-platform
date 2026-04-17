"""Tests for the integrated underwriting orchestrator.

Validates the additive integration layer that composes the multifamily
proforma / DCF with the three v2 modules (renovation, retail, tax
abatement).

Each module's own tests already enforce dollar-exact parity with W&D's
Prose Gainesville xlsm. These tests focus on the INTEGRATION contract:

  * no modules -> baseline engine output is unchanged
  * one module at a time -> the right line item moves by the right
    amount and everything else stays put
  * all three modules + direct_cap mode -> the Pro_Forma_Price <->
    tax-abatement-FMV fixed point converges in a handful of iterations
"""

from __future__ import annotations

from typing import Any

import pytest

from app.schemas.underwriting import ScenarioInputs, UnitMixInput, UWInputs
from app.services.underwriting_engine import UnderwritingEngine
from tests.underwriting.test_renovation import (
    _reference_input as _reno_reference,
)
from tests.underwriting.test_retail import (
    _reference_input as _retail_reference,
)
from tests.underwriting.test_tax_abatement import (
    _reference_input as _ta_reference,
)
from underwriting.v2.integration import run_integrated_underwriting


def _baseline_deal(**overrides: Any) -> UWInputs:
    """Minimal W&D-Prose-Gainesville-flavoured multifamily deal.

    200 2BR units @ $1,500/mo, $50M premium / $45M market purchase
    price (manual), current property-tax mode, 8-year hold. The
    absolute dollar levels are not the point here — the tests are
    concerned with INTEGRATION deltas, not engine correctness.
    """
    defaults: dict[str, Any] = {
        "total_units": 200,
        "total_sf": 160_000,
        "unit_mix": [
            UnitMixInput(
                floorplan="2BR",
                units=200,
                sf=800,
                market_rent=1_500.0,
                inplace_rent=1_500.0,
            ),
        ],
        "premium": ScenarioInputs(
            pricing_mode="manual", purchase_price=50_000_000
        ),
        "market": ScenarioInputs(
            pricing_mode="manual", purchase_price=45_000_000
        ),
        "property_tax_mode": "current",
        "current_tax_amount": 200_000.0,
        "insurance_per_unit": 500.0,
        "hold_period_years": 8,
    }
    defaults.update(overrides)
    return UWInputs(**defaults)


# ---------------------------------------------------------------------------
# Test 1: no modules -> baseline engine output unchanged
# ---------------------------------------------------------------------------


def test_no_modules_matches_baseline_proforma() -> None:
    """With all three modules disabled, the integrated result must mirror
    the engine's direct output — no drift, no module results."""
    deal = _baseline_deal()
    result = run_integrated_underwriting(deal)

    engine_out = UnderwritingEngine(deal).compute()

    assert result.proforma == engine_out.proforma

    for key, engine_scn in engine_out.scenarios.items():
        integrated_scn = result.scenarios[key].scenario
        assert integrated_scn == engine_scn

    # Combined CF with no modules collapses to the baseline NCF arrays.
    engine_premium = engine_out.scenarios["premium"]
    baseline_unlev = [y.ncf for y in engine_premium.dcf.years]
    baseline_lev = [y.ncf_after_debt for y in engine_premium.dcf.years]
    assert result.scenarios["premium"].combined_unlevered_cf == baseline_unlev
    assert result.scenarios["premium"].combined_levered_cf == baseline_lev

    assert result.module_results.renovation is None
    assert result.module_results.retail is None
    assert result.module_results.tax_abatement is None

    assert result.convergence.iterations == 1
    assert result.convergence.converged is True
    assert result.convergence.final_price_delta == 0.0


# ---------------------------------------------------------------------------
# Test 2: tax abatement only -> Y1 savings lift combined unlevered CF
# ---------------------------------------------------------------------------


def test_tax_abatement_only_lifts_unlevered_cf() -> None:
    """TA savings flow through combined CF; the base RE-tax proforma
    line is untouched (matches W&D Valuation!C165 placement)."""
    deal = _baseline_deal()
    ta_input = _ta_reference(
        hold_period_years=8,
        re_tax_inflation=[0.0275] * 8,
    )

    baseline = run_integrated_underwriting(deal)
    with_ta = run_integrated_underwriting(deal, tax_abatement=ta_input)

    ta_result = with_ta.module_results.tax_abatement
    assert ta_result is not None
    y1_savings = ta_result.annual_abatement_savings[0]
    assert y1_savings > 0

    base_y1_cf = baseline.scenarios["premium"].combined_unlevered_cf[0]
    integrated_y1_cf = with_ta.scenarios["premium"].combined_unlevered_cf[0]
    assert integrated_y1_cf == pytest.approx(base_y1_cf + y1_savings, abs=0.01)

    # Base proforma RE-tax line unchanged.
    base_tax = baseline.scenarios["premium"].scenario.dcf.years[0].property_taxes
    integrated_tax = with_ta.scenarios["premium"].scenario.dcf.years[
        0
    ].property_taxes
    assert integrated_tax == pytest.approx(base_tax, abs=0.01)


# ---------------------------------------------------------------------------
# Test 3: renovation only -> Y3 GPR lifts by the premium
# ---------------------------------------------------------------------------


def test_renovation_lifts_proforma_gpr() -> None:
    """Y3 GPR in the integrated DCF = baseline Y3 GPR + cumulative
    revenue growth at rollup position 2. Basis / NOI move consistently.
    """
    deal = _baseline_deal()
    reno_input = _reno_reference(
        start_year=1,
        duration_years=2,
        incremental_rent_growth_rates=[0.03] * 11,
    )

    baseline = run_integrated_underwriting(deal)
    with_reno = run_integrated_underwriting(deal, renovation=reno_input)

    reno_result = with_reno.module_results.renovation
    assert reno_result is not None

    base_y3_gpr = baseline.scenarios["premium"].scenario.dcf.years[2].gpr
    integrated_y3_gpr = with_reno.scenarios["premium"].scenario.dcf.years[2].gpr
    delta = integrated_y3_gpr - base_y3_gpr
    assert delta == pytest.approx(
        reno_result.annual_rollups[2].cumulative_revenue_growth, abs=0.01
    )

    # Renovation cost is NOT folded into the engine's basis today
    # (scenario.valuation_summary.purchase_price remains the base MF
    # price). The combined_value field is what surfaces basis + retail
    # at the integration layer, and renovation cost lands on the
    # adjusted going-in cap denominator.
    assert with_reno.scenarios["premium"].combined_value == pytest.approx(
        baseline.scenarios["premium"].pro_forma_price, abs=0.01
    )


# ---------------------------------------------------------------------------
# Test 4: retail only -> combined CF and combined value both lift
# ---------------------------------------------------------------------------


def test_retail_adds_to_combined_cf_and_value() -> None:
    """Retail's Y1 NCF lands in combined unlevered CF; retail_value
    lands in combined_value."""
    deal = _baseline_deal()
    retail_input = _retail_reference(hold_period_years=8)

    baseline = run_integrated_underwriting(deal)
    with_retail = run_integrated_underwriting(deal, retail=retail_input)

    retail_result = with_retail.module_results.retail
    assert retail_result is not None

    premium_price = baseline.scenarios["premium"].pro_forma_price
    assert with_retail.scenarios["premium"].combined_value == pytest.approx(
        premium_price + retail_result.premium.retail_value, abs=0.01
    )

    expected_y1_cf = (
        baseline.scenarios["premium"].combined_unlevered_cf[0]
        + retail_result.premium.annual_cash_flows[0].net_cash_flow
    )
    assert with_retail.scenarios["premium"].combined_unlevered_cf[
        0
    ] == pytest.approx(expected_y1_cf, abs=0.01)


# ---------------------------------------------------------------------------
# Test 5: all three modules + direct_cap -> fixed point converges
# ---------------------------------------------------------------------------


def test_circular_dependency_converges() -> None:
    """With all three modules enabled on a direct_cap deal, the
    Pro_Forma_Price <-> TA-FMV fixed point must converge within a
    handful of iterations (spec requires <= 5)."""
    deal = _baseline_deal(
        premium=ScenarioInputs(pricing_mode="direct_cap", target_cap_rate=0.055),
        market=ScenarioInputs(pricing_mode="direct_cap", target_cap_rate=0.06),
        property_tax_mode="reassessment",
        current_tax_amount=0.0,
        pct_of_purchase_assessed=1.0,
        assessment_ratio=0.40,
        millage_rate=2.5,
    )
    ta = _ta_reference(hold_period_years=8, re_tax_inflation=[0.0275] * 8)
    retail = _retail_reference(hold_period_years=8)
    reno = _reno_reference(
        start_year=2,
        duration_years=2,
        incremental_rent_growth_rates=[0.03] * 11,
    )

    result = run_integrated_underwriting(
        deal, renovation=reno, retail=retail, tax_abatement=ta
    )

    assert result.convergence.converged is True
    assert result.convergence.iterations <= 5
    assert result.convergence.final_price_delta < 1_000.0


# ---------------------------------------------------------------------------
# Test 6: Prose-Gainesville-style smoke test
# ---------------------------------------------------------------------------


def test_prose_gainesville_full_integration() -> None:
    """Smoke test that all three modules flow end-to-end on a
    Prose-Gainesville-flavoured deal.

    Note: a dollar-exact regression against W&D's live xlsm
    ($67,074,332) requires replicating the full Prose Gainesville
    UWInputs (unit mix, T12 expenses, per-year arrays, growth, debt
    terms) as a JSON fixture — out of scope for this integration test,
    which uses the module reference inputs atop a minimal deal shell.
    Dollar-exact parity is enforced by the per-module tests already.

    Here we assert: all three modules return results, the fixed point
    converges, the combined CF moves in the expected direction, and
    the Pro_Forma_Price lands in a sane range.
    """
    deal = _baseline_deal(
        premium=ScenarioInputs(pricing_mode="direct_cap", target_cap_rate=0.055),
        market=ScenarioInputs(pricing_mode="direct_cap", target_cap_rate=0.06),
        property_tax_mode="reassessment",
        current_tax_amount=0.0,
        pct_of_purchase_assessed=1.0,
        assessment_ratio=0.40,
        millage_rate=2.5,
    )
    ta = _ta_reference(
        hold_period_years=8,
        re_tax_inflation=[0.0275] * 8,
        abatement_y1_percent=0.50,
        abatement_spread=0.05,
    )
    retail = _retail_reference(hold_period_years=8)
    reno = _reno_reference(
        start_year=2,
        duration_years=2,
        incremental_rent_growth_rates=[0.03] * 11,
    )

    result = run_integrated_underwriting(
        deal, renovation=reno, retail=retail, tax_abatement=ta
    )

    assert result.module_results.renovation is not None
    assert result.module_results.retail is not None
    assert result.module_results.tax_abatement is not None
    assert result.convergence.converged is True

    baseline = run_integrated_underwriting(deal)
    base_y1_cf = baseline.scenarios["premium"].combined_unlevered_cf[0]
    integrated_y1_cf = result.scenarios["premium"].combined_unlevered_cf[0]
    y1_ta = result.module_results.tax_abatement.annual_abatement_savings[0]
    y1_retail = result.module_results.retail.premium.annual_cash_flows[
        0
    ].net_cash_flow
    # Combined Y1 CF lifts by (Y1_TA + Y1_retail) PLUS any renovation
    # NCF delta in Y1 (= 0 for a start_year=2 reno).
    assert integrated_y1_cf - base_y1_cf == pytest.approx(
        y1_ta + y1_retail, abs=1.0
    )

    price = result.scenarios["premium"].pro_forma_price
    assert 10_000_000 < price < 250_000_000, f"price out of range: {price}"
