"""Equity waterfall (distribution) calculation module.

Computes a deal-level (European) promote waterfall: one combined LP+GP
equity contribution at year 0 is distributed back through the standard
tier sequence and the resulting LP/GP cash-flow vectors are scored for
returns. Self-contained within the v2 engine — its only dependency is the
shared :mod:`underwriting.v2._financial` primitive for IRR.

Tier order (applied cumulatively, deal-level):
    1. Return of Capital  — LP + GP capital repaid pro-rata.
    2. Preferred Return   — LP-only accruing preferred return.
    3. GP Catch-Up        — optional, closed-form, GP-only.
    4. Tier 1 split       — split_1 until LP IRR reaches hurdle_1.
    5. Tier 2 split       — split_2 on everything above hurdle_1.

The two promote tiers are gated on full return of LP capital: an IRR
hurdle is unreachable until 100% of LP capital is returned (LP IRR is
negative until contributions are recovered), so no promote can be paid
before then.
"""

from __future__ import annotations

from underwriting.v2._financial import irr
from underwriting.v2.schemas.waterfall import (
    WaterfallResult,
    WaterfallTerms,
    WaterfallTier,
)

_EPS = 1e-9


def _accrue_pref(base: float, balance: float, rate: float, compounds: bool) -> float:
    """One year of preferred-return accrual.

    Simple accrual earns only on ``base``; compounding accrual also earns
    on the unpaid pref ``balance``.
    """
    if compounds:
        return rate * (base + balance)
    return rate * base


def _gp_catchup_target(pref_dist: float, catch_up_pct: float) -> float:
    """Closed-form total GP catch-up given cumulative pref paid to LP.

    Sized so that of the profit distributed above return of capital
    (pref + catch-up), the GP receives ``catch_up_pct``:
    ``gp / (pref + gp) == catch_up_pct``.
    """
    return (pref_dist / (1.0 - catch_up_pct)) * catch_up_pct


def _distribute_to_hurdle(
    lp_cash_flows: list[float],
    year: int,
    cash: float,
    split_lp: float,
    split_gp: float,
    hurdle: float,
) -> tuple[float, float, float, bool]:
    """Distribute a promote tier up to an LP-IRR hurdle.

    Returns ``(lp_amount, gp_amount, cash_used, hurdle_reached)``. While the
    hurdle is below target the tier consumes cash at ``split_lp/split_gp``;
    bisection finds the LP amount that lands LP IRR exactly on the hurdle.
    """

    def lp_irr_with(extra: float) -> float:
        trial = list(lp_cash_flows)
        trial[year] += extra
        rate = irr(trial)
        return rate if rate is not None else float("-inf")

    if split_lp <= 0.0:
        # LP can never progress toward the hurdle; tier absorbs all cash to GP.
        return 0.0, cash, cash, False

    if lp_irr_with(0.0) >= hurdle:
        # Hurdle already satisfied — nothing falls into this tier.
        return 0.0, 0.0, 0.0, True

    max_extra = cash * split_lp
    if lp_irr_with(max_extra) <= hurdle:
        # Even the full tier allocation does not reach the hurdle: take it all.
        return cash * split_lp, cash * split_gp, cash, False

    lo, hi = 0.0, max_extra
    for _ in range(100):
        mid = (lo + hi) / 2.0
        if lp_irr_with(mid) < hurdle:
            lo = mid
        else:
            hi = mid
        if hi - lo < 1e-7:
            break
    extra = (lo + hi) / 2.0
    tier_total = extra / split_lp
    gp_amount = tier_total * split_gp
    return extra, gp_amount, tier_total, True


def compute_waterfall(
    equity_cash_flows: list[float], terms: WaterfallTerms
) -> WaterfallResult:
    """Run the equity waterfall over levered equity cash flows.

    Args:
        equity_cash_flows: Levered equity cash flows by year. ``[0]`` is the
            combined LP+GP contribution (negative); ``[1:]`` are
            distributions (non-negative).
        terms: Promote terms governing the split.

    Returns:
        A :class:`WaterfallResult` with LP/GP cash-flow vectors, returns,
        total promote, and a per-tier audit schedule.
    """
    if not equity_cash_flows or equity_cash_flows[0] >= 0:
        raise ValueError("equity_cash_flows[0] must be a negative contribution")
    if any(cf < 0 for cf in equity_cash_flows[1:]):
        raise ValueError("distribution years (index >= 1) must be non-negative")

    n = len(equity_cash_flows) - 1
    total_equity = -equity_cash_flows[0]
    lp_capital = total_equity * terms.lp_equity_pct
    gp_capital = total_equity * terms.gp_equity_pct

    lp_cash_flows = [0.0] * (n + 1)
    gp_cash_flows = [0.0] * (n + 1)
    lp_cash_flows[0] = -lp_capital
    gp_cash_flows[0] = -gp_capital

    lp_capital_returned = 0.0
    gp_capital_returned = 0.0
    pref_balance = 0.0
    pref_paid_cum = 0.0
    catchup_paid = 0.0
    gp_tier1_total = 0.0
    tier1_total = 0.0
    gp_tier2_total = 0.0
    tier2_total = 0.0
    tier_schedule: list[WaterfallTier] = []

    for t in range(1, n + 1):
        # Accrue one year of preferred return before distributing.
        if terms.pref_base == "remaining":
            base = max(0.0, lp_capital - lp_capital_returned)
        else:
            base = lp_capital
        pref_balance += _accrue_pref(
            base, pref_balance, terms.pref_rate, terms.pref_compounds
        )

        cash = equity_cash_flows[t]

        # Tier 1 — Return of Capital (LP + GP, pro-rata by outstanding capital).
        lp_outstanding = lp_capital - lp_capital_returned
        gp_outstanding = gp_capital - gp_capital_returned
        total_outstanding = lp_outstanding + gp_outstanding
        roc_pay = min(cash, total_outstanding)
        if roc_pay > 0 and total_outstanding > 0:
            lp_roc = roc_pay * (lp_outstanding / total_outstanding)
            gp_roc = roc_pay - lp_roc
            lp_cash_flows[t] += lp_roc
            gp_cash_flows[t] += gp_roc
            lp_capital_returned += lp_roc
            gp_capital_returned += gp_roc
            cash -= roc_pay
            tier_schedule.append(
                WaterfallTier(
                    year=t,
                    tier="return_of_capital",
                    cash_in=roc_pay,
                    lp_amount=lp_roc,
                    gp_amount=gp_roc,
                    cash_out=cash,
                    lp_capital_returned_to_date=lp_capital_returned,
                )
            )

        # Tier 2 — Preferred Return (LP only).
        pref_pay = min(cash, pref_balance)
        if pref_pay > 0:
            lp_cash_flows[t] += pref_pay
            pref_balance -= pref_pay
            pref_paid_cum += pref_pay
            cash -= pref_pay
            tier_schedule.append(
                WaterfallTier(
                    year=t,
                    tier="preferred_return",
                    cash_in=pref_pay,
                    lp_amount=pref_pay,
                    gp_amount=0.0,
                    cash_out=cash,
                    pref_balance_after=pref_balance,
                )
            )

        # Tier 3 — GP Catch-Up (GP only, closed form).
        if terms.catch_up_enabled and cash > 0 and pref_paid_cum > 0:
            target = _gp_catchup_target(pref_paid_cum, terms.catch_up_pct)
            catchup_pay = min(cash, max(0.0, target - catchup_paid))
            if catchup_pay > 0:
                gp_cash_flows[t] += catchup_pay
                catchup_paid += catchup_pay
                cash -= catchup_pay
                tier_schedule.append(
                    WaterfallTier(
                        year=t,
                        tier="gp_catch_up",
                        cash_in=catchup_pay,
                        lp_amount=0.0,
                        gp_amount=catchup_pay,
                        cash_out=cash,
                        catch_up_target=target,
                    )
                )

        # Tiers 4 & 5 — promote splits, only once LP capital is fully returned.
        if cash > _EPS and lp_capital_returned >= lp_capital - _EPS:
            lp1, gp1, used1, reached1 = _distribute_to_hurdle(
                lp_cash_flows, t, cash, terms.split_1_lp, terms.split_1_gp,
                terms.hurdle_1_irr,
            )
            if used1 > 0:
                lp_cash_flows[t] += lp1
                gp_cash_flows[t] += gp1
                cash -= used1
                gp_tier1_total += gp1
                tier1_total += used1
                tier_schedule.append(
                    WaterfallTier(
                        year=t,
                        tier="tier_1_split",
                        cash_in=used1,
                        lp_amount=lp1,
                        gp_amount=gp1,
                        cash_out=cash,
                        lp_irr_after=irr(lp_cash_flows),
                    )
                )

            if reached1 and cash > _EPS:
                lp2 = cash * terms.split_2_lp
                gp2 = cash * terms.split_2_gp
                lp_cash_flows[t] += lp2
                gp_cash_flows[t] += gp2
                gp_tier2_total += gp2
                tier2_total += cash
                tier_schedule.append(
                    WaterfallTier(
                        year=t,
                        tier="tier_2_split",
                        cash_in=cash,
                        lp_amount=lp2,
                        gp_amount=gp2,
                        cash_out=0.0,
                        lp_irr_after=irr(lp_cash_flows),
                    )
                )
                cash = 0.0

    lp_irr_val = irr(lp_cash_flows)
    gp_irr_val = irr(gp_cash_flows)
    lp_distributions = sum(lp_cash_flows[1:])
    lp_equity_multiple = lp_distributions / lp_capital if lp_capital > 0 else 0.0
    total_promote = (
        catchup_paid
        + (gp_tier1_total - tier1_total * terms.gp_equity_pct)
        + (gp_tier2_total - tier2_total * terms.gp_equity_pct)
    )

    return WaterfallResult(
        lp_cash_flows=lp_cash_flows,
        gp_cash_flows=gp_cash_flows,
        lp_irr=lp_irr_val if lp_irr_val is not None else float("-inf"),
        lp_equity_multiple=lp_equity_multiple,
        gp_irr=gp_irr_val if gp_irr_val is not None else float("-inf"),
        total_promote=total_promote,
        tier_schedule=tier_schedule,
    )
