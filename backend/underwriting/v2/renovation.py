"""Renovation waterfall calculation module.

Ports the Renovation tab from Walker & Dunlop's institutional proforma
(Prose_Gainesville_Proforma_1_30_26_RH.xlsm, "Renovation" tab) into the
Talisman underwriting engine.

INTEGRATION CONTRACT:
    Unlike the standalone Tax Abatement and Retail modules, Renovation
    feeds directly into the multifamily Proforma / DCF. This module
    performs the CALCULATION ONLY — a separate integration step (not in
    this module) wires outputs into proforma.py / valuation.py:

        * RenovationAnnualRollup.cumulative_revenue_growth (Row 43)
              -> Valuation!C106 (added to GPR ABOVE vacancy)
        * RenovationResult.total_renovation_cost (Row F26)
              -> Valuation!C95 (added to purchase basis)
        * RenovationInput.finance_with_loan
              -> Triggers LTV -> LTC conversion in the integration step
                (NOT handled here).

ROW 43 IMPLEMENTATION NOTES:
    Row 43 ("Cumulative Revenue Growth") is the single most important
    output of this module — it is what flows into the DCF as incremental
    GPR each year. The W&D formula switches behavior based on whether
    any units are renovated in the current year:

      * Year 1 (column C):
            cumulative[1] = potential_rent_premium_annual[1] +
                            downtime_deduction[1]
        which by identity (downtime = actual - potential) equals
        current_year_revenue_growth[1]. We assert this identity at runtime.

      * Year 2+, NO renos this year:
            cumulative[fy] = (cumulative[fy-1] - downtime_deduction[fy-1])
                             * (1 + growth_rate[fy])
        Rationale: the prior year's cumulative carried a downtime drag
        (downtime_deduction is negative). Subtracting that drag recovers
        the prior year's "potential" running total, which then grows by
        the full annual rate since no new renos disturb the year.

      * Year 2+, WITH renos this year:
            cumulative[fy] = (sum(potential[1..fy]) + downtime_deduction[fy])
                             * (1 + growth_rate[fy] / 2)
        Rationale: aggregate the running potential premium through this
        year, add this year's (negative) downtime drag, and apply a
        HALF-YEAR growth convention because renovations land throughout
        the year rather than at year-start.

    The two branches must be implemented exactly as above; collapsing
    them into a single formula will misstate the DCF rent ramp.

DEVIATIONS FROM W&D:
    1. **Schedule tail behavior.** W&D Row N+1 uses a nested IF
       (`IF(prior_unrenovated - prior_scheduled < 0, MIN(current, target),
       target)`) that schedules ``target_per_qtr`` every quarter and only
       caps at ``current_unrenovated`` once the prior remaining count
       drops below target. This module schedules ``min(remaining,
       target_per_qtr)`` each quarter, which is functionally equivalent
       for the integer-divisible case (W&D's intended use). For
       fractional targets that don't divide cleanly into the duration,
       both implementations leave a small residual unscheduled — this is
       inherent to the W&D model, not a deviation.
    2. **Quarter-in-year downtime factor.** W&D hardcodes
       D87=1, E87=11/12, F87=10/12, G87=9/12 and uses an IF for the
       remainder. We compute the same series directly via
       ``[1.0, 11/12, 10/12, 9/12][quarter_in_year - 1]`` for every
       quarter, identical numerically.
    3. **Downtime-months input.** W&D's downtime is implicit in the
       hardcoded factor schedule. We expose ``downtime_months_per_unit``
       on the input for forward compatibility, but only the default
       value (1 month) reproduces W&D output.
"""

from __future__ import annotations

from backend.underwriting.v2.schemas.renovation import (
    RenovationAnnualRollup,
    RenovationInput,
    RenovationQuarterlyCashFlow,
    RenovationResult,
)

QUARTERS = 43
ROLLUP_YEARS = 11
QUARTER_IN_YEAR_FACTORS: tuple[float, float, float, float] = (
    1.0,
    11.0 / 12.0,
    10.0 / 12.0,
    9.0 / 12.0,
)


def calculate_renovation(inp: RenovationInput) -> RenovationResult:
    """Compute the Renovation waterfall per the W&D 'Renovation' tab.

    See module docstring for the full INTEGRATION CONTRACT and ROW 43
    IMPLEMENTATION NOTES. The function returns a fully constructed
    :class:`RenovationResult` even when disabled or when no units are
    slated for renovation.

    Args:
        inp: Validated :class:`RenovationInput`.

    Returns:
        :class:`RenovationResult` with summary scalars, 43 quarterly
        cash flows, and 11 annual rollups.
    """
    total_units = sum(ut.units_to_renovate for ut in inp.unit_types)

    if not inp.enabled or not inp.unit_types or total_units == 0:
        return _zero_result(inp)

    # Phase 2/3/4 will replace this with the real engine.
    # For Phase 1 scaffolding, we treat any "enabled with units" call
    # as not-yet-implemented to avoid silently returning wrong numbers.
    raise NotImplementedError(
        "Renovation engine not yet implemented (Phase 1 scaffolding only)."
    )


def _zero_result(inp: RenovationInput) -> RenovationResult:
    """Fully-constructed zero result for the disabled / empty path."""
    quarterly = [
        RenovationQuarterlyCashFlow(
            quarter=q,
            fiscal_year=inp.start_year + (q - 1) // 4,
            quarter_in_year=((q - 1) % 4) + 1,
            units_renovated=0.0,
            incremental_revenue_gross_monthly=0.0,
            incremental_revenue_factor=QUARTER_IN_YEAR_FACTORS[((q - 1) % 4)],
            incremental_revenue_actual_monthly=0.0,
            renovation_capex=0.0,
        )
        for q in range(1, QUARTERS + 1)
    ]

    annual = [
        RenovationAnnualRollup(
            fiscal_year=fy,
            renovations_completed=0.0,
            annual_renovation_cost=0.0,
            potential_rent_premium_annual=0.0,
            downtime_deduction=0.0,
            current_year_revenue_growth=0.0,
            incremental_rent_growth_rate=inp.incremental_rent_growth_rates[fy - 1],
            cumulative_revenue_growth=0.0,
        )
        for fy in range(1, ROLLUP_YEARS + 1)
    ]

    return RenovationResult(
        enabled=False,
        total_units_renovated=0.0,
        total_renovation_cost=0.0,
        weighted_avg_rent_premium=0.0,
        implied_return_on_cost=0.0,
        avg_units_renovated_per_year=0.0,
        stabilized_revenue_increase=0.0,
        annualized_return_on_investment=0.0,
        quarterly_cash_flows=quarterly,
        annual_rollups=annual,
    )
