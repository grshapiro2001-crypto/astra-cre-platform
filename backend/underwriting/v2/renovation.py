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
    RenovationUnitType,
)

QUARTERS = 43
ROLLUP_YEARS = 11
QUARTER_IN_YEAR_FACTORS: tuple[float, float, float, float] = (
    1.0,
    11.0 / 12.0,
    10.0 / 12.0,
    9.0 / 12.0,
)


def _rollup_year(quarter: int, start_year: int) -> int:
    """Fiscal year for a 1-indexed quarter — Renovation!D49+."""
    return start_year + (quarter - 1) // 4


def _quarter_in_year(quarter: int) -> int:
    """Position within fiscal year (1..4)."""
    return ((quarter - 1) % 4) + 1


def _downtime_factor(quarter: int) -> float:
    """Revenue-factor schedule by position in year — Renovation!D87+."""
    return QUARTER_IN_YEAR_FACTORS[(quarter - 1) % 4]


def _build_unit_type_schedule(
    ut: RenovationUnitType,
    duration_years: int,
    start_year: int,
    growth_rates: list[float],
) -> list[tuple[float, float]]:
    """Per-quarter ``(units_scheduled, rent_per_month)`` for one unit type.

    Implements the Layer 1 per-unit-type waterfall (Renovation rows 55-77):
    units deplete against a fixed per-quarter target, and the rent premium
    compounds annually by the current fiscal year's growth rate after the
    first four quarters of the program.

    Args:
        ut: One :class:`RenovationUnitType` slot.
        duration_years: Renovation program length in years.
        start_year: 1-indexed fiscal year renovations begin.
        growth_rates: 11 annual incremental rent-growth rates.

    Returns:
        43 ``(units_scheduled, rent_per_month)`` tuples indexed 0..42 for
        quarters 1..43.
    """
    target = ut.units_to_renovate / (duration_years * 4)
    duration_qtrs = duration_years * 4
    schedule: list[tuple[float, float]] = []
    remaining = float(ut.units_to_renovate)

    for q in range(1, QUARTERS + 1):
        if q > duration_qtrs:
            scheduled = 0.0
        else:
            # Renovation!N+1: equivalent to IF(remaining<target, MIN(remaining,
            # target), target) since target >= 0 — the nested IF collapses.
            scheduled = min(remaining, target)
        remaining -= scheduled

        if q <= 4:
            rent = ut.rent_premium_per_month
        else:
            prior_rent = schedule[q - 5][1]
            # Clamp the growth-rate index to the 11-year horizon: tail
            # quarters past FY11 (possible when start_year > 1) reuse the
            # terminal year's rate. Aggregation zeroes out rent beyond
            # duration_qtrs via units_renovated == 0, so this only
            # affects bookkeeping on rows that contribute 0 to Row 86.
            fy_idx = min(_rollup_year(q, start_year) - 1, len(growth_rates) - 1)
            rate = growth_rates[fy_idx]
            rent = prior_rent * (1.0 + rate)

        schedule.append((scheduled, rent))

    return schedule


def _aggregate_quarterly(
    schedules: list[list[tuple[float, float]]],
    inp: RenovationInput,
) -> list[RenovationQuarterlyCashFlow]:
    """Combine per-unit-type schedules into 43 quarterly cash flows.

    Implements Layer 2 of the W&D waterfall (Renovation rows 81/86/87/88/91):

      * Row 81: units_renovated — sum of scheduled units across unit types.
      * Row 86: incremental_revenue_gross_monthly — SUMPRODUCT of
        (scheduled, rent) across unit types, in MONTHLY dollars.
      * Row 87: incremental_revenue_factor — ``_downtime_factor(q)``.
      * Row 88: incremental_revenue_actual_monthly — gross × factor when
        units_renovated > 0, else 0.
      * Row 91: renovation_capex — ``cost_per_unit × units_renovated``.

    Args:
        schedules: One per-quarter tuple list per unit type (from
            :func:`_build_unit_type_schedule`).
        inp: The full :class:`RenovationInput` (for ``start_year`` and
            ``cost_per_unit``).

    Returns:
        43 :class:`RenovationQuarterlyCashFlow` entries for quarters 1..43.
    """
    quarterly: list[RenovationQuarterlyCashFlow] = []

    for q in range(1, QUARTERS + 1):
        idx = q - 1
        units = sum(sched[idx][0] for sched in schedules)
        gross_monthly = sum(sched[idx][0] * sched[idx][1] for sched in schedules)
        factor = _downtime_factor(q)
        actual_monthly = gross_monthly * factor if units > 0 else 0.0
        capex = inp.cost_per_unit * units

        quarterly.append(
            RenovationQuarterlyCashFlow(
                quarter=q,
                fiscal_year=_rollup_year(q, inp.start_year),
                quarter_in_year=_quarter_in_year(q),
                units_renovated=units,
                incremental_revenue_gross_monthly=gross_monthly,
                incremental_revenue_factor=factor,
                incremental_revenue_actual_monthly=actual_monthly,
                renovation_capex=capex,
            )
        )

    return quarterly


def calculate_renovation(inp: RenovationInput) -> RenovationResult:
    """Compute the Renovation waterfall per the W&D 'Renovation' tab.

    See module docstring for the full INTEGRATION CONTRACT and ROW 43
    IMPLEMENTATION NOTES. The function returns a fully constructed
    :class:`RenovationResult` even when disabled or when no units are
    slated for renovation.

    Phase 2 populates the 43-quarter cash-flow series (W&D rows 55-77 per
    unit type aggregated into rows 81/86/87/88/91). Annual rollups (rows
    34/36/38/39/40/42/43) and top-level summary scalars remain zero-valued
    placeholders — they are populated in Phases 3 and 4.

    Args:
        inp: Validated :class:`RenovationInput`.

    Returns:
        :class:`RenovationResult` with summary scalars, 43 quarterly
        cash flows, and 11 annual rollups.
    """
    total_units = sum(ut.units_to_renovate for ut in inp.unit_types)

    if not inp.enabled or not inp.unit_types or total_units == 0:
        return _zero_result(inp)

    schedules = [
        _build_unit_type_schedule(
            ut,
            inp.duration_years,
            inp.start_year,
            inp.incremental_rent_growth_rates,
        )
        for ut in inp.unit_types
    ]
    quarterly = _aggregate_quarterly(schedules, inp)

    # Phase 2: annual rollups carry fiscal_year + echo the growth rate only;
    # renovations_completed, CapEx, potential/actual premium sums, downtime
    # deduction, and the Row 43 cumulative are populated in Phase 3.
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

    # Phase 2: summary scalars remain zero; Phase 4 populates them from the
    # annual rollups and the stabilized-year Row 43 value.
    return RenovationResult(
        enabled=True,
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


def _zero_result(inp: RenovationInput) -> RenovationResult:
    """Fully-constructed zero result for the disabled / empty path."""
    quarterly = [
        RenovationQuarterlyCashFlow(
            quarter=q,
            fiscal_year=_rollup_year(q, inp.start_year),
            quarter_in_year=_quarter_in_year(q),
            units_renovated=0.0,
            incremental_revenue_gross_monthly=0.0,
            incremental_revenue_factor=_downtime_factor(q),
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
