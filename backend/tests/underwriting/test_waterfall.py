"""Tests for the equity waterfall calculation module.

Three sanity tests pin the load-bearing math: the GP catch-up closed form,
the "capital must be returned before any IRR hurdle is reachable" invariant,
and an end-to-end deal where the GP's promote lifts GP IRR above LP IRR.
"""

from __future__ import annotations

import pytest

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
