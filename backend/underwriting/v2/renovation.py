"""Renovation waterfall calculation module.

Ports the Renovation tab from Walker & Dunlop's institutional proforma
(Prose_Gainesville_Proforma_1_30_26_RH.xlsm, "Renovation" tab) into the
Talisman underwriting engine.

INTEGRATION CONTRACT:
    Unlike the standalone Tax Abatement and Retail modules, Renovation
    feeds directly into the multifamily Proforma / DCF. This module
    performs the CALCULATION ONLY — a separate integration step (not in
    this module) wires outputs into proforma.py / valuation.py:

        * RenovationAnnualRollup.cumulative_revenue_growth (Row 43),
          one value per rollup position 0..10
              -> Valuation!C106:M106 ("Plus: Renovated Unit Premiums",
                 added to GPR ABOVE vacancy).
              ALREADY ANNUALIZED — each value is produced by summing
              Row 40 (four monthly quarterly actuals) and compounding
              via the Row 43 branches, so it represents the
              stabilized year's incremental annual revenue. The
              caller MUST NOT apply a further x12 conversion.
        * RenovationResult.total_renovation_cost (Row F26)
              -> Valuation!C95 ("Renovation Dollars", added to
                 purchase basis).
        * RenovationInput.finance_with_loan
              -> Triggers Valuation!C99 LTV -> LTC mode switch in the
                 integration step (NOT handled here).
        * Going-in cap rate adjustment (Proforma!G53 / Proforma!J53)
          is applied during integration, NOT here.

    The F-column summary scalars on RenovationResult
    (total_units_renovated, weighted_avg_rent_premium,
    implied_return_on_cost, avg_units_renovated_per_year,
    stabilized_revenue_increase, annualized_return_on_investment) are
    for UI display / analyst quick-look only; they do NOT feed the DCF
    directly.

ROW 43 IMPLEMENTATION NOTES:
    Row 43 ("Cumulative Revenue Growth") is the single most important
    output of this module — it is what flows into the DCF as incremental
    GPR each year. The W&D formula switches behavior based on whether
    any units are renovated in the current year. Two semantics matter:

      * "rollup index ``i``" — the 0..10 position in ``annual_rollups``.
        This is what indexes ``incremental_rent_growth_rates`` regardless
        of ``start_year``: ``annual_rollups[0]`` always pairs with
        ``growth_rates[0]``, even if its W&D ``fiscal_year`` is 3.
      * "W&D fiscal_year" — the integer stamped on each rollup
        (``start_year + i``). Used for cross-referencing the proforma
        but NOT for indexing growth rates.

    Year 1 (rollup index 0):
        cumulative[0] = potential_rent_premium_annual[0]
                        + downtime_deduction[0]
    By the downtime identity (``downtime = actual − potential``) this
    simplifies to ``current_year_revenue_growth[0]``. The implementation
    enforces this as a runtime guard — a mismatch raises ``ValueError``
    and indicates Layer 3 / Layer 4 have drifted out of sync.

    Year 2+ (rollup index ``i`` >= 1), NO renos this year
    (``renovations_completed[i] == 0``):
        cumulative[i] = (cumulative[i-1] − downtime_deduction[i-1])
                        * (1 + growth_rate[i])
    Plain English: the prior year's cumulative carried a (negative)
    downtime drag from that year's reno work. Subtracting the drag
    recovers the prior year's underlying "potential" running total,
    which then grows by the FULL annual rate since no new renos
    disturb this year.

    Year 2+ (rollup index ``i`` >= 1), WITH renos this year
    (``renovations_completed[i] > 0``):
        cumulative[i] = (sum(potential[0..i]) + downtime_deduction[i])
                        * (1 + growth_rate[i] / 2)
    Plain English: aggregate the running potential premium through this
    year, add this year's (negative) downtime drag, and apply a
    HALF-YEAR growth convention because the renos land throughout the
    year rather than all at year-start.

    The two branches must be implemented exactly as above; collapsing
    them into a single formula will misstate the DCF rent ramp.

    Zero-growth subtlety: with ``growth_rate == 0`` and a single year of
    renos in Y1, ``cumulative[1] = cumulative[0] − downtime_deduction[0]``
    (downtime gets stripped, full-year multiplier of 1.0, no re-addition).
    Because ``downtime_deduction[0]`` is negative, ``cumulative[1]``
    INCREASES vs. ``cumulative[0]`` by the magnitude of Y1 downtime, then
    holds flat thereafter (Y2+ have no new downtime to strip, multiplier
    of 1.0). This is intentional W&D behavior — it represents the units
    coming back online for full revenue contribution after the Y1
    construction-disruption haircut — not a defect.

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

import math

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


def _build_annual_rollups(
    quarterly: list[RenovationQuarterlyCashFlow],
    growth_rates: list[float],
) -> list[RenovationAnnualRollup]:
    """Group 43 quarterly cash flows into 11 annual rollups (rows 32-42).

    Implements Layer 3 of the W&D waterfall (Renovation rows 34/36/38/39/
    40/42). Each rollup aggregates the four quarters whose
    ``fiscal_year`` equals ``base + i`` where ``base`` is the smallest
    ``fiscal_year`` across ``quarterly`` (i.e., ``inp.start_year``) and
    ``i`` is the 0-indexed rollup position.

    Note: the growth-rate index is the rollup POSITION (0..10), not the
    W&D ``fiscal_year`` integer — so a non-1 ``start_year`` does not
    shift growth-rate indexing. ``annual_rollups[0]`` always pairs with
    ``growth_rates[0]``.

    The ``cumulative_revenue_growth`` field is left at 0.0 here and
    populated by :func:`_compute_cumulative_revenue_growth` (Layer 4).

    Args:
        quarterly: 43 :class:`RenovationQuarterlyCashFlow` entries from
            :func:`_aggregate_quarterly` (Layer 2 output).
        growth_rates: 11 annual incremental rent-growth rates, indexed
            by rollup position.

    Returns:
        11 :class:`RenovationAnnualRollup` entries, indexed 0..10.
    """
    base_fy = quarterly[0].fiscal_year
    rollups: list[RenovationAnnualRollup] = []

    for i in range(ROLLUP_YEARS):
        target_fy = base_fy + i
        bucket = [q for q in quarterly if q.fiscal_year == target_fy]

        # Renovation!Row 34 — units renovated this year.
        renovations_completed = sum(q.units_renovated for q in bucket)
        # Renovation!Row 36 — total CapEx this year.
        annual_renovation_cost = sum(q.renovation_capex for q in bucket)
        # Renovation!Row 38 — sum of monthly gross premiums (MONTHLY $).
        potential_rent_premium_annual = sum(
            q.incremental_revenue_gross_monthly for q in bucket
        )
        # Renovation!Row 40 — sum of monthly actual premiums (MONTHLY $).
        current_year_revenue_growth = sum(
            q.incremental_revenue_actual_monthly for q in bucket
        )
        # Renovation!Row 39 — actual minus potential (≤ 0); negative
        # because the downtime factor is ≤ 1.
        downtime_deduction = current_year_revenue_growth - potential_rent_premium_annual

        rollups.append(
            RenovationAnnualRollup(
                fiscal_year=target_fy,
                renovations_completed=renovations_completed,
                annual_renovation_cost=annual_renovation_cost,
                potential_rent_premium_annual=potential_rent_premium_annual,
                downtime_deduction=downtime_deduction,
                current_year_revenue_growth=current_year_revenue_growth,
                # Renovation!Row 42 — pulled from Valuation!C18:M18.
                incremental_rent_growth_rate=growth_rates[i],
                cumulative_revenue_growth=0.0,
            )
        )

    return rollups


def _compute_cumulative_revenue_growth(
    rollups: list[RenovationAnnualRollup],
) -> list[float]:
    """Compute Row 43 cumulative revenue growth across 11 rollups.

    Implements Layer 4 — the single most important output of the module.
    The W&D formula has two branches keyed on whether any units are
    renovated in the current year:

      Year 1 (rollup index 0):
          cum[0] = potential_rent_premium_annual[0] + downtime_deduction[0]
        which by the downtime identity (downtime = actual − potential)
        equals current_year_revenue_growth[0]. This identity is enforced
        as a runtime guard — a mismatch raises ``ValueError``.

      Year 2+, NO renos this year (renovations_completed[i] == 0):
          cum[i] = (cum[i-1] − downtime_deduction[i-1])
                   * (1 + growth_rate[i])
        Plain English: the prior year's cumulative carried a (negative)
        downtime drag. Subtracting the drag recovers the prior year's
        "potential" running total, which then grows by the FULL annual
        rate since no new renos disturb this year.

      Year 2+, WITH renos this year (renovations_completed[i] > 0):
          cum[i] = (sum(potential[0..i]) + downtime_deduction[i])
                   * (1 + growth_rate[i] / 2)
        Plain English: aggregate the running potential premium through
        this year, add this year's (negative) downtime drag, and apply
        a HALF-YEAR growth convention because the renos land throughout
        the year rather than all at year-start.

    Growth-rate indexing uses the rollup POSITION (0..10), pulled from
    ``rollups[i].incremental_rent_growth_rate`` (which Layer 3 already
    stamped from ``growth_rates[i]`` regardless of ``start_year``).

    Args:
        rollups: 11 :class:`RenovationAnnualRollup` entries from
            :func:`_build_annual_rollups`.

    Returns:
        11 cumulative-revenue-growth floats, indexed 0..10.

    Raises:
        ValueError: if the Y1 identity is violated, indicating a drift
            between Layer 3 and Layer 4.
    """
    cumulative: list[float] = []
    running_potential = 0.0

    for i, rollup in enumerate(rollups):
        running_potential += rollup.potential_rent_premium_annual

        if i == 0:
            # Renovation!C43 — =SUM($C$38:C38) + C39. By the downtime
            # identity this equals current_year_revenue_growth[0].
            cum_i = rollup.potential_rent_premium_annual + rollup.downtime_deduction
            if not math.isclose(
                cum_i,
                rollup.current_year_revenue_growth,
                rel_tol=1e-9,
                abs_tol=1e-6,
            ):
                raise ValueError(
                    "Row 43 Y1 identity violated: cumulative_revenue_growth[0]"
                    f" ({cum_i}) != current_year_revenue_growth[0]"
                    f" ({rollup.current_year_revenue_growth}). Layer 3 and"
                    " Layer 4 have drifted out of sync."
                )
        elif rollup.renovations_completed == 0:
            # Renovation!Row 43, no-renos branch — strip prior downtime
            # drag and apply FULL annual growth.
            prior = rollups[i - 1]
            cum_i = (cumulative[i - 1] - prior.downtime_deduction) * (
                1.0 + rollup.incremental_rent_growth_rate
            )
        else:
            # Renovation!Row 43, active-renos branch — running potential
            # plus this year's downtime, with HALF-YEAR growth convention.
            cum_i = (running_potential + rollup.downtime_deduction) * (
                1.0 + rollup.incremental_rent_growth_rate / 2.0
            )

        cumulative.append(cum_i)

    return cumulative


def _compute_summary_scalars(
    inp: RenovationInput,
    annual: list[RenovationAnnualRollup],
) -> dict[str, float]:
    """Compute the W&D F-column summary scalars (Layer 5).

    Only reached for the enabled / non-empty path — the disabled path
    in :func:`_zero_result` assigns zeros directly.

    W&D references:
        F24 total_units_renovated        = SUM(Row 34)
        F26 total_renovation_cost        = SUM(Row 36)
        F20 weighted_avg_rent_premium    = SUMPRODUCT(E15:E19, F15:F19)
                                           / SUM(E15:E19). Because
                                           ``E = D / (duration * 4)``,
                                           the ``duration * 4`` constant
                                           cancels in numerator and
                                           denominator, so weighting by
                                           ``units_to_renovate`` gives
                                           the identical result.
        F9  implied_return_on_cost       = (weighted_avg_rent_premium
                                            * 12) / cost_per_unit
        F10 avg_units_renovated_per_year = total_units_renovated
                                           / duration_years
        F28 stabilized_revenue_increase  = OFFSET(C43, 0, (F5-1)+F6)
                                           i.e., Row 43 read at the
                                           completion fiscal year
                                           (``start_year + duration_years
                                           - 1``). Converted to a
                                           0-indexed position within
                                           ``annual_rollups`` this is
                                           ``duration_years - 1``, clamped
                                           to ``[0, ROLLUP_YEARS - 1]``.
        F29 annualized_return_on_investment = F28 / F26
    """
    total_units_renovated = sum(r.renovations_completed for r in annual)
    total_renovation_cost = sum(r.annual_renovation_cost for r in annual)

    total_units_input = sum(ut.units_to_renovate for ut in inp.unit_types)
    weighted_numerator = sum(
        ut.units_to_renovate * ut.rent_premium_per_month for ut in inp.unit_types
    )
    weighted_avg_rent_premium = (
        weighted_numerator / total_units_input if total_units_input else 0.0
    )

    implied_return_on_cost = (
        (weighted_avg_rent_premium * 12) / inp.cost_per_unit
        if inp.cost_per_unit
        else 0.0
    )
    avg_units_renovated_per_year = (
        total_units_renovated / inp.duration_years if inp.duration_years else 0.0
    )

    # Completion fiscal year is ``start_year + duration_years - 1`` (1-indexed).
    # ``annual_rollups[i].fiscal_year == start_year + i`` (see
    # ``_build_annual_rollups``), so the 0-indexed position within the
    # rollup list is ``duration_years - 1``, independent of ``start_year``.
    idx = max(0, min(ROLLUP_YEARS - 1, inp.duration_years - 1))
    stabilized_revenue_increase = annual[idx].cumulative_revenue_growth

    annualized_return_on_investment = (
        stabilized_revenue_increase / total_renovation_cost
        if total_renovation_cost
        else 0.0
    )

    return {
        "total_units_renovated": total_units_renovated,
        "total_renovation_cost": total_renovation_cost,
        "weighted_avg_rent_premium": weighted_avg_rent_premium,
        "implied_return_on_cost": implied_return_on_cost,
        "avg_units_renovated_per_year": avg_units_renovated_per_year,
        "stabilized_revenue_increase": stabilized_revenue_increase,
        "annualized_return_on_investment": annualized_return_on_investment,
    }


def calculate_renovation(inp: RenovationInput) -> RenovationResult:
    """Compute the Renovation waterfall per the W&D 'Renovation' tab.

    See module docstring for the full INTEGRATION CONTRACT and ROW 43
    IMPLEMENTATION NOTES. The function returns a fully constructed
    :class:`RenovationResult` even when disabled or when no units are
    slated for renovation.

    Layers 1-4 populate the 43-quarter cash-flow series (W&D rows 55-77
    per unit type aggregated into rows 81/86/87/88/91) and the 11
    fiscal-year rollups (rows 34/36/38/39/40/42/43). Layer 5
    (:func:`_compute_summary_scalars`) derives the seven F-column
    summary scalars from those rollups and the input. The
    disabled / empty path (:func:`_zero_result`) returns zeros for all
    scalars, so callers can consume the result unconditionally.

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

    # Layer 3 (rows 34/36/38/39/40/42) — bucket quarters into 11 rollups.
    annual = _build_annual_rollups(quarterly, inp.incremental_rent_growth_rates)
    # Layer 4 (Row 43) — cumulative revenue growth, the DCF integration
    # point. Stamp the result back onto each frozen rollup.
    cumulative = _compute_cumulative_revenue_growth(annual)
    annual = [
        a.model_copy(update={"cumulative_revenue_growth": c})
        for a, c in zip(annual, cumulative, strict=True)
    ]

    # Layer 5 (F-column) — derive the seven summary scalars from the
    # annual rollups and the input. Spread into the result kwargs.
    summary = _compute_summary_scalars(inp, annual)

    return RenovationResult(
        enabled=True,
        **summary,
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
