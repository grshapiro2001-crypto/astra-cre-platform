"""Integration tests: LP/GP waterfall outputs wired into UnderwritingEngine.

These exercise the endpoint wiring at the engine layer (the routes are thin
pass-throughs to ``UnderwritingEngine.compute()``), covering:
  - the brokerage path (no terms) staying behaviorally unchanged,
  - terms present populating per-scenario LP/GP outputs,
  - the guard that returns ``None`` instead of 500-ing when the levered cash
    flows are incompatible with the waterfall (e.g. a negative distribution
    year), and
  - JSON-serializability of the full output (guards the ``-inf`` IRR sentinel).
"""

from __future__ import annotations

import json

from app.schemas.underwriting import (
    ScenarioInputs,
    UnitMixInput,
    UWInputs,
)
from app.services.underwriting_engine import UnderwritingEngine
from underwriting.v2.schemas.waterfall import WaterfallTerms


PROMOTE_TERMS = WaterfallTerms(
    lp_equity_pct=0.90,
    gp_equity_pct=0.10,
    pref_rate=0.08,
    pref_base="original",
    pref_compounds=False,
    catch_up_enabled=True,
    catch_up_pct=0.20,
    hurdle_1_irr=0.12,
    split_1_lp=0.80,
    split_1_gp=0.20,
    hurdle_2_irr=0.18,
    split_2_lp=0.70,
    split_2_gp=0.30,
)


def _healthy_inputs() -> UWInputs:
    """A positive-cash-flow deal (full I/O) that yields real distributions."""
    return UWInputs(
        total_units=244,
        total_sf=244 * 950,
        unit_mix=[
            UnitMixInput(floorplan="1BR/1BA", units=120, sf=750, market_rent=1350, inplace_rent=1200),
            UnitMixInput(floorplan="2BR/2BA", units=100, sf=1050, market_rent=1550, inplace_rent=1400),
            UnitMixInput(floorplan="3BR/2BA", units=24, sf=1250, market_rent=1750, inplace_rent=1600),
        ],
        rent_basis="market",
        utilities_per_unit=900,
        repairs_per_unit=500,
        make_ready_per_unit=350,
        contract_services_per_unit=200,
        marketing_per_unit=100,
        ga_per_unit=175,
        property_tax_mode="current",
        current_tax_amount=400_000,
        insurance_per_unit=450,
        mgmt_fee_pct=0.0275,
        reserves_per_unit=200,
        max_ltv=0.60,
        interest_rate=0.0525,
        loan_term_months=84,
        io_period_months=84,  # full I/O over the hold
        amort_years=30,
        dscr_minimum=1.25,
        hold_period_years=7,
        premium=ScenarioInputs(pricing_mode="manual", purchase_price=35_000_000, terminal_cap_rate=0.055),
        market=ScenarioInputs(pricing_mode="direct_cap", target_cap_rate=0.065, terminal_cap_rate=0.0575),
    )


def _high_leverage_inputs() -> UWInputs:
    """Same deal, but LTV-bound high-rate amortizing debt drives debt service
    above NOI, producing negative ``ncf_after_debt`` (distribution) years."""
    inp = _healthy_inputs()
    inp.max_ltv = 0.80
    inp.dscr_minimum = 0.5  # keep DSCR from shrinking the loan → LTV binds
    inp.interest_rate = 0.12
    inp.io_period_months = 0  # fully amortizing from year 1
    return inp


def test_no_terms_leaves_waterfall_none_and_unchanged():
    base = _healthy_inputs()
    base.waterfall_terms = None
    out = UnderwritingEngine(base).compute()

    assert out.scenarios  # scenarios actually ran
    for scenario in out.scenarios.values():
        assert scenario.waterfall is None
        # Brokerage numbers still computed.
        assert scenario.valuation_summary.levered_irr is not None

    # Adding terms must not perturb any existing (non-waterfall) field.
    with_terms = _healthy_inputs()
    with_terms.waterfall_terms = PROMOTE_TERMS
    out_wf = UnderwritingEngine(with_terms).compute()

    assert out.scenarios.keys() == out_wf.scenarios.keys()
    for key in out.scenarios:
        before = out.scenarios[key].model_dump(exclude={"waterfall"})
        after = out_wf.scenarios[key].model_dump(exclude={"waterfall"})
        assert before == after


def test_terms_present_populate_lp_gp_outputs():
    inp = _healthy_inputs()
    inp.waterfall_terms = PROMOTE_TERMS
    out = UnderwritingEngine(inp).compute()

    populated = [s.waterfall for s in out.scenarios.values() if s.waterfall is not None]
    assert populated, "expected at least one scenario to produce a waterfall"

    for wf in populated:
        assert wf.lp_equity_multiple > 1.0
        assert wf.total_promote > 0.0
        assert wf.tier_schedule
        # Promote lifts the GP above the LP.
        assert wf.lp_irr <= wf.gp_irr


def test_negative_distribution_year_guarded_to_none():
    inp = _high_leverage_inputs()
    inp.waterfall_terms = PROMOTE_TERMS
    # Must not raise even though distribution years go negative.
    out = UnderwritingEngine(inp).compute()

    assert out.scenarios
    for scenario in out.scenarios.values():
        assert scenario.waterfall is None
        # Returns still computed for the brokerage view.
        assert scenario.valuation_summary is not None


def test_output_is_json_serializable_with_terms():
    inp = _healthy_inputs()
    inp.waterfall_terms = PROMOTE_TERMS
    out = UnderwritingEngine(inp).compute()
    # allow_nan=False mirrors Starlette's JSONResponse; -inf/nan would raise.
    json.dumps(out.model_dump(), allow_nan=False)
