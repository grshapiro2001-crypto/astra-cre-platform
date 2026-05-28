"""Tests for the equity waterfall calculation module.

Three sanity tests pin the load-bearing math: the GP catch-up closed form,
the "capital must be returned before any IRR hurdle is reachable" invariant,
and an end-to-end deal where the GP's promote lifts GP IRR above LP IRR.

The QA suite below adds (A) a fully hand-computed anchor deal with exact
expected values, (B) first-principles structural invariants that must hold for
ANY correct waterfall, and (C) an off-path/endpoint regression at the engine
layer. These tests validate `waterfall.py` only — they never modify it.
"""

from __future__ import annotations

import pytest

from app.schemas.underwriting import ScenarioInputs, UnitMixInput, UWInputs
from app.services.underwriting_engine import UnderwritingEngine
from underwriting.v2._financial import irr
from underwriting.v2.schemas.waterfall import WaterfallResult, WaterfallTerms
from underwriting.v2.waterfall import _gp_catchup_target, compute_waterfall


def test_catch_up_closed_form() -> None:
    """8% pref, 20% catch-up, $80 pref distributed -> $20 GP catch-up.

    (80 / (1 - 0.20)) * 0.20 = 100 * 0.20 = 20, and GP's share of the
    profit distributed so far is 20 / (80 + 20) = 20% = catch_up_pct.
    """
    gp_catchup = _gp_catchup_target(pref_dist=80.0, catch_up_pct=0.20)

    assert gp_catchup == pytest.approx(20.0, abs=1e-9)
    assert gp_catchup / (80.0 + gp_catchup) == pytest.approx(0.20, abs=1e-9)


def test_irr_requires_capital_return() -> None:
    """10%/yr for 5 years with no capital return has IRR < 0.

    Total nominal inflow (50) is less than the $100 invested, so NPV is
    negative at r=0 and only reaches zero at a negative discount rate.
    """
    rate = irr([-100.0, 10.0, 10.0, 10.0, 10.0, 10.0])

    assert rate is not None
    assert rate < 0.0


def test_full_waterfall_smoke() -> None:
    """A simple single-exit deal runs end-to-end with lp_irr < gp_irr."""
    terms = WaterfallTerms(
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
    equity_cash_flows = [-100.0, 0.0, 0.0, 0.0, 0.0, 180.0]

    result = compute_waterfall(equity_cash_flows, terms)

    assert isinstance(result, WaterfallResult)
    assert result.lp_irr < result.gp_irr
    assert result.lp_equity_multiple > 1.0
    assert result.total_promote > 0.0


# ---------------------------------------------------------------------------
# QA helpers
# ---------------------------------------------------------------------------

# Anchor deal: $1M LP in at year 0 (GP co-invest = 0), single $2M distribution
# at end of year 5. hurdle_1_irr is set above the realized LP IRR (~12.47%) so
# the entire residual falls in the single 80/20 tier (tier 2 never runs).
ANCHOR_TERMS = WaterfallTerms(
    lp_equity_pct=1.0,
    gp_equity_pct=0.0,
    pref_rate=0.08,
    pref_base="remaining",
    pref_compounds=True,
    catch_up_enabled=True,
    catch_up_pct=0.20,
    hurdle_1_irr=0.20,
    split_1_lp=0.80,
    split_1_gp=0.20,
    hurdle_2_irr=0.20,
    split_2_lp=0.70,
    split_2_gp=0.30,
)
ANCHOR_CFS = [-1_000_000.0, 0.0, 0.0, 0.0, 0.0, 2_000_000.0]


def _anchor_result() -> WaterfallResult:
    return compute_waterfall(ANCHOR_CFS, ANCHOR_TERMS)


def _tier_rows(result: WaterfallResult, name: str):
    return [row for row in result.tier_schedule if row.tier == name]


def _lp_total(result: WaterfallResult) -> float:
    return sum(result.lp_cash_flows[1:])


def _gp_total(result: WaterfallResult) -> float:
    return sum(result.gp_cash_flows[1:])


def _healthy_inputs() -> UWInputs:
    """A positive-cash-flow deal (full I/O) that yields real distributions.

    Mirrors the engine-level fixture used by the integration suite; replicated
    locally so this file has no cross-test import coupling.
    """
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
        io_period_months=84,
        amort_years=30,
        dscr_minimum=1.25,
        hold_period_years=7,
        premium=ScenarioInputs(pricing_mode="manual", purchase_price=35_000_000, terminal_cap_rate=0.055),
        market=ScenarioInputs(pricing_mode="direct_cap", target_cap_rate=0.065, terminal_cap_rate=0.0575),
    )


# ---------------------------------------------------------------------------
# A. Hand-computed anchor deal (exact expected values)
# ---------------------------------------------------------------------------

def test_anchor_deal_exact_values() -> None:
    """$1M LP in, $2M out at year 5; 8% compounding pref, 100% catch-up to 20%.

    Every tier is hand-computed; asserts hold within $500 / 5bps.
    """
    result = _anchor_result()

    # Tier 1 — return of capital to LP.
    roc = _tier_rows(result, "return_of_capital")
    assert len(roc) == 1
    assert roc[0].lp_amount == pytest.approx(1_000_000.0, abs=500)
    assert roc[0].gp_amount == pytest.approx(0.0, abs=500)
    assert roc[0].lp_capital_returned_to_date == pytest.approx(1_000_000.0, abs=500)

    # Tier 2 — accrued pref to LP: 1,000,000 * (1.08^5 - 1) = 469,328.
    pref_rows = _tier_rows(result, "preferred_return")
    pref_total = sum(r.lp_amount for r in pref_rows)
    assert pref_total == pytest.approx(469_328.0, abs=500)

    # Tier 3 — GP catch-up: (469,328 / 0.80) * 0.20 = 117,332.
    catchup = _tier_rows(result, "gp_catch_up")
    assert len(catchup) == 1
    assert catchup[0].gp_amount == pytest.approx(117_332.0, abs=500)
    assert catchup[0].catch_up_target == pytest.approx(117_332.0, abs=500)
    assert catchup[0].catch_up_target == pytest.approx(
        _gp_catchup_target(pref_total, 0.20), abs=1e-6
    )

    # Tier 4 — residual 413,340 split 80/20 -> LP 330,672 / GP 82,668.
    tier1 = _tier_rows(result, "tier_1_split")
    assert len(tier1) == 1
    assert tier1[0].lp_amount == pytest.approx(330_672.0, abs=500)
    assert tier1[0].gp_amount == pytest.approx(82_668.0, abs=500)
    assert not _tier_rows(result, "tier_2_split")

    # Totals, multiple, IRR.
    assert _lp_total(result) == pytest.approx(1_800_000.0, abs=500)
    assert _gp_total(result) == pytest.approx(200_000.0, abs=500)
    assert result.total_promote == pytest.approx(200_000.0, abs=500)
    assert result.lp_equity_multiple == pytest.approx(1.80, abs=1e-3)
    assert result.lp_irr == pytest.approx(0.1247, abs=5e-4)

    # KEY INVARIANT: full 100% catch-up to 20% -> GP total == 20% of total profit.
    total_profit = 2_000_000.0 - 1_000_000.0
    assert _gp_total(result) == pytest.approx(0.20 * total_profit, abs=500)


# ---------------------------------------------------------------------------
# B. Structural invariants (must hold for ANY terms)
# ---------------------------------------------------------------------------

_B_TERMS = WaterfallTerms(
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

# A couple of representative deals (fixed for determinism): a single-exit deal
# and a multi-distribution deal.
_B_DEALS = [
    [-100.0, 0.0, 0.0, 0.0, 0.0, 220.0],
    [-100.0, 5.0, 5.0, 5.0, 120.0],
]


@pytest.mark.parametrize("cfs", _B_DEALS)
def test_conservation(cfs) -> None:
    """No money created or destroyed: LP + GP == equity, per period and total."""
    result = compute_waterfall(cfs, _B_TERMS)

    for t, equity_cf in enumerate(cfs):
        assert result.lp_cash_flows[t] + result.gp_cash_flows[t] == pytest.approx(
            equity_cf, abs=1e-6
        )

    assert sum(result.lp_cash_flows) + sum(result.gp_cash_flows) == pytest.approx(
        sum(cfs), abs=1e-6
    )


def test_lp_irr_negative_until_capital_returned() -> None:
    """LP IRR stays < 0 until 100% of LP capital is returned (integrated)."""
    result = compute_waterfall([-100.0, 10.0, 10.0, 10.0, 10.0, 10.0], _B_TERMS)

    assert _lp_total(result) < 90.0  # less than LP's contributed capital
    assert result.lp_irr < 0.0


def test_gp_zero_until_pref_satisfied() -> None:
    """In any period, GP receives $0 until the LP pref for that period clears.

    Uses a GP co-invest = 0 deal so GP has no return-of-capital, isolating the
    pref-precedence rule from capital repayment.
    """
    terms = ANCHOR_TERMS.model_copy(update={"hurdle_1_irr": 0.12, "hurdle_2_irr": 0.18})
    result = compute_waterfall([-100.0, 4.0, 4.0, 4.0, 4.0, 130.0], terms)

    for row in result.tier_schedule:
        if row.tier == "preferred_return" and (row.pref_balance_after or 0.0) > 1e-6:
            # Pref not fully satisfied this period -> GP must get nothing.
            assert result.gp_cash_flows[row.year] == pytest.approx(0.0, abs=1e-9)


def test_catch_up_closed_form_integrated() -> None:
    """GP catch-up == (pref_dist / (1 - catch_up_pct)) * catch_up_pct end-to-end."""
    result = _anchor_result()
    pref_total = sum(r.lp_amount for r in _tier_rows(result, "preferred_return"))
    catchup = _tier_rows(result, "gp_catch_up")[0]

    expected = (pref_total / (1.0 - 0.20)) * 0.20
    assert catchup.gp_amount == pytest.approx(expected, abs=1e-6)
    assert catchup.catch_up_target == pytest.approx(expected, abs=1e-6)


def test_promote_monotonicity() -> None:
    """Raising the promote never decreases GP total nor increases LP total."""
    cfs = [-100.0, 0.0, 0.0, 0.0, 0.0, 220.0]
    low = compute_waterfall(
        cfs, _B_TERMS.model_copy(update={"catch_up_pct": 0.20, "split_1_lp": 0.80, "split_1_gp": 0.20}),
    )
    high = compute_waterfall(
        cfs, _B_TERMS.model_copy(update={"catch_up_pct": 0.30, "split_1_lp": 0.70, "split_1_gp": 0.30}),
    )

    assert _gp_total(high) >= _gp_total(low) - 1e-6
    assert _lp_total(high) <= _lp_total(low) + 1e-6


def test_catch_up_toggle_changes_split() -> None:
    """Disabling catch-up gives GP less and LP proportionally more."""
    cfs = [-100.0, 0.0, 0.0, 0.0, 0.0, 220.0]
    on = compute_waterfall(cfs, _B_TERMS.model_copy(update={"catch_up_enabled": True}))
    off = compute_waterfall(cfs, _B_TERMS.model_copy(update={"catch_up_enabled": False}))

    assert _gp_total(off) < _gp_total(on)
    assert _lp_total(off) > _lp_total(on)


# ---------------------------------------------------------------------------
# C. Endpoint regression (off-path guarantee)
# ---------------------------------------------------------------------------

# Engine-level terms with GP co-invest so the GP IRR is finite and the engine
# populates a waterfall (it sanitizes the -inf IRR sentinel of a 0%-GP deal to
# None). Used only for the off-path regression below.
_ENGINE_TERMS = WaterfallTerms(
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


def test_no_terms_off_path_unchanged() -> None:
    """No terms -> waterfall is None and every pre-existing field is unchanged."""
    base = _healthy_inputs()
    base.waterfall_terms = None
    baseline = UnderwritingEngine(base).compute()

    assert baseline.scenarios
    for scenario in baseline.scenarios.values():
        assert scenario.waterfall is None

    with_terms = _healthy_inputs()
    with_terms.waterfall_terms = _ENGINE_TERMS
    out = UnderwritingEngine(with_terms).compute()

    assert baseline.scenarios.keys() == out.scenarios.keys()
    for key in baseline.scenarios:
        before = baseline.scenarios[key].model_dump(exclude={"waterfall"})
        after = out.scenarios[key].model_dump(exclude={"waterfall"})
        assert before == after

    assert any(s.waterfall is not None for s in out.scenarios.values())


def test_never_clears_returns_valid_result() -> None:
    """A deal that never returns LP capital yields a valid result, not a 500."""
    terms = ANCHOR_TERMS.model_copy(update={"hurdle_1_irr": 0.12, "hurdle_2_irr": 0.18})
    result = compute_waterfall([-100.0, 10.0, 10.0, 10.0, 10.0, 10.0], terms)

    assert isinstance(result, WaterfallResult)
    assert result.lp_irr < 0.0
    assert _gp_total(result) == pytest.approx(0.0, abs=1e-9)
    assert result.total_promote == pytest.approx(0.0, abs=1e-9)
