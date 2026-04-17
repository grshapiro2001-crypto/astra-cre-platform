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
          one value per proforma year Y1..Y11 (rollup position 0..10)
              -> Valuation!C106:M106 ("Plus: Renovated Unit Premiums",
                 added to GPR ABOVE vacancy).
              ALREADY ANNUALIZED — each quarterly in Layer 2 is
              multiplied by 12 (mirroring W&D Row 86's trailing
              ``*12``), so summing four quarterlies yields the year's
              total annual dollars. The caller MUST NOT apply a
              further ×12 conversion.
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
    output of this module — it flows into the DCF as incremental GPR
    each year. The W&D formula has FOUR cases keyed on the state of
    renovations. Two semantics matter:

      * "rollup index ``i``" — the 0..10 position in ``annual_rollups``
        == proforma year − 1. Rollups are ALWAYS numbered Y1..Y11, not
        offset by ``start_year``. When ``start_year > 1``, the
        pre-renovation positions (``0 .. start_year - 2``) are all-zero
        rollups.
      * ``incremental_rent_growth_rate[i]`` — indexed by rollup position,
        i.e. ``growth_rates[proforma_year - 1]``. This matches W&D
        Row 42 / Valuation!C18:M18 directly.

    Case 1 — Pre-renovation year
    (``renovations_completed[i] == 0`` and no prior renos):
        cumulative[i] = 0.0
    No units have been touched yet; there is no rent premium to accrue.

    Case 2 — First renovation year (Y1 identity):
        cumulative[i] = potential_rent_premium_annual[i]
                        + downtime_deduction[i]
    By the downtime identity (``downtime = actual − potential``) this
    simplifies to ``current_year_revenue_growth[i]``. The implementation
    enforces this as a runtime guard — a mismatch raises ``ValueError``
    and indicates Layer 3 / Layer 4 have drifted out of sync.

    Case 3 — Subsequent renovation year
    (``renovations_completed[i] > 0`` after the first reno year):
        cumulative[i] = running_sum(potential[first_reno..i])
                        + downtime_deduction[i]
    NO growth multiplier. W&D Row 43 formula during active-reno years is
    ``=SUM($C$38:D38) + D39`` with no ``*(1+rate)`` or ``*(1+rate/2)``
    factor. Growth is already baked into each year's potential via the
    Layer 1 rent compounding (Row 57 / 62 / … apply the current fiscal
    year's rate once per year).

    Case 4 — Post-renovation year
    (``renovations_completed[i] == 0`` after the final reno year):
        cumulative[i] = (cumulative[i-1] − downtime_deduction[i-1])
                        * (1 + growth_rate[i])
    The prior year's cumulative carried a (negative) downtime drag from
    the final reno year. Subtracting that drag recovers the fully
    stabilized running potential, which then grows by the FULL annual
    rate each year thereafter.

    Validation: these four cases match Walker & Dunlop's Prose
    Gainesville proforma (Renovation!Row 43, post LibreOffice recalc)
    to the cent across all 11 years. An earlier version of this module
    applied a HALF-YEAR growth multiplier (``*(1 + rate/2)``) during
    active-reno years — that was wrong and has been removed.

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

from underwriting.v2.schemas.renovation import (
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
      * Row 86: incremental_revenue_gross_annual — SUMPRODUCT of
        (scheduled, rent) across unit types, times 12 to annualize.
        The ×12 mirrors W&D Renovation!Row 86 formula
        ``=SUM(D56*D57, D61*D62, …) * 12`` — the last operation in the
        sheet is annualization, NOT leaving the sum in monthly dollars.
      * Row 87: incremental_revenue_factor — ``_downtime_factor(q)``.
      * Row 88: incremental_revenue_actual_annual — gross_annual × factor
        when units_renovated > 0, else 0 (still ANNUAL dollars).
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
        # Row 86: SUMPRODUCT(units, rent) × 12 — annualized quarterly pace.
        gross_annual = sum(sched[idx][0] * sched[idx][1] for sched in schedules) * 12.0
        factor = _downtime_factor(q)
        # Row 88: gross_annual × factor, still ANNUAL dollars.
        actual_annual = gross_annual * factor if units > 0 else 0.0
        capex = inp.cost_per_unit * units

        quarterly.append(
            RenovationQuarterlyCashFlow(
                quarter=q,
                fiscal_year=_rollup_year(q, inp.start_year),
                quarter_in_year=_quarter_in_year(q),
                units_renovated=units,
                incremental_revenue_gross_annual=gross_annual,
                incremental_revenue_factor=factor,
                incremental_revenue_actual_annual=actual_annual,
                renovation_capex=capex,
            )
        )

    return quarterly


def _build_annual_rollups(
    quarterly: list[RenovationQuarterlyCashFlow],
    growth_rates: list[float],
) -> list[RenovationAnnualRollup]:
    """Group 43 quarterly cash flows into 11 proforma-year rollups.

    Implements Layer 3 of the W&D waterfall (Renovation rows 34/36/38/39/
    40/42). The rollup array ALWAYS covers proforma years 1..11 (W&D
    Row 32 — ``annual_rollups[i].fiscal_year == i + 1``). When
    ``start_year > 1``, the pre-renovation years (positions
    ``0 .. start_year - 2``) contain all zeros because no quarterlies
    are tagged with those fiscal years.

    The growth-rate index is the rollup position (0..10) == proforma
    year − 1, matching W&D Row 42 / Valuation!C18:M18.

    The ``cumulative_revenue_growth`` field is left at 0.0 here and
    populated by :func:`_compute_cumulative_revenue_growth` (Layer 4).

    Args:
        quarterly: 43 :class:`RenovationQuarterlyCashFlow` entries from
            :func:`_aggregate_quarterly` (Layer 2 output). Each entry's
            ``fiscal_year`` is the W&D Row 49 "Pro Forma Year (Current)"
            stamp.
        growth_rates: 11 annual incremental rent-growth rates, indexed
            by proforma-year position.

    Returns:
        11 :class:`RenovationAnnualRollup` entries, one per proforma
        year Y1..Y11.
    """
    rollups: list[RenovationAnnualRollup] = []

    for proforma_year in range(1, ROLLUP_YEARS + 1):
        bucket = [q for q in quarterly if q.fiscal_year == proforma_year]

        # Renovation!Row 34 — units renovated this year.
        renovations_completed = sum(q.units_renovated for q in bucket)
        # Renovation!Row 36 — total CapEx this year.
        annual_renovation_cost = sum(q.renovation_capex for q in bucket)
        # Renovation!Row 38 — sum of 4 annualized quarterly gross premiums.
        potential_rent_premium_annual = sum(
            q.incremental_revenue_gross_annual for q in bucket
        )
        # Renovation!Row 40 — sum of 4 annualized quarterly actual premiums.
        current_year_revenue_growth = sum(
            q.incremental_revenue_actual_annual for q in bucket
        )
        # Renovation!Row 39 — actual minus potential (≤ 0); negative
        # because the downtime factor is ≤ 1.
        downtime_deduction = current_year_revenue_growth - potential_rent_premium_annual

        rollups.append(
            RenovationAnnualRollup(
                fiscal_year=proforma_year,
                renovations_completed=renovations_completed,
                annual_renovation_cost=annual_renovation_cost,
                potential_rent_premium_annual=potential_rent_premium_annual,
                downtime_deduction=downtime_deduction,
                current_year_revenue_growth=current_year_revenue_growth,
                # Renovation!Row 42 — pulled from Valuation!C18:M18.
                incremental_rent_growth_rate=growth_rates[proforma_year - 1],
                cumulative_revenue_growth=0.0,
            )
        )

    return rollups


def _compute_cumulative_revenue_growth(
    rollups: list[RenovationAnnualRollup],
) -> list[float]:
    """Compute Row 43 cumulative revenue growth across 11 proforma years.

    Implements Layer 4 — the single most important output of the module.
    Validated against Walker & Dunlop's Prose Gainesville proforma
    (Renovation!Row 43, post LibreOffice recalc) to the cent across all
    11 years. The W&D formula has four cases keyed on renovation state:

      Pre-renovation year (no renos yet, none previously):
          cum[i] = 0.0
        Proforma years before ``start_year`` carry zero cumulative — no
        units have been touched yet, so there is no rent premium.

      First renovation year (Y1 identity):
          cum[i] = potential_rent_premium_annual[i] + downtime_deduction[i]
        By the downtime identity (downtime = actual − potential) this
        equals current_year_revenue_growth[i]. This identity is enforced
        as a runtime guard — a mismatch raises ``ValueError``.

      Subsequent renovation year (renos still in progress):
          cum[i] = running_sum(potential[first_reno..i])
                   + downtime_deduction[i]
        Plain English: aggregate the running potential premium across
        every reno year so far, add THIS year's (negative) downtime
        drag. Crucially: NO growth multiplier — W&D Row 43 formula is
        ``=SUM($C$38:D38) + D39`` during active reno years, with no
        ``*(1+rate)`` or ``*(1+rate/2)`` factor. Growth is already
        baked into each year's ``potential`` via the Layer 1 rent
        compounding.

      Post-renovation year (renos are done):
          cum[i] = (cum[i-1] − downtime_deduction[i-1])
                   * (1 + growth_rate[i])
        Plain English: the prior year's cumulative carried a (negative)
        downtime drag from the final reno year. Subtracting that drag
        recovers the fully-stabilized running potential, which then
        grows by the FULL annual rate each year thereafter.

    Growth-rate indexing uses the rollup POSITION (0..10) via
    ``rollups[i].incremental_rent_growth_rate`` (Layer 3 stamps each
    rollup with ``growth_rates[proforma_year - 1]``).

    Args:
        rollups: 11 :class:`RenovationAnnualRollup` entries from
            :func:`_build_annual_rollups`.

    Returns:
        11 cumulative-revenue-growth floats, indexed 0..10 (one per
        proforma year Y1..Y11).

    Raises:
        ValueError: if the first-reno-year identity is violated,
            indicating a drift between Layer 3 and Layer 4.
    """
    cumulative: list[float] = []
    running_potential_sum = 0.0
    first_reno_seen = False

    for i, rollup in enumerate(rollups):
        if rollup.renovations_completed > 0:
            running_potential_sum += rollup.potential_rent_premium_annual
            if not first_reno_seen:
                # First reno year. W&D =SUM($C$38:C38) + C39 collapses
                # to potential + downtime, which equals current_year
                # by the downtime identity.
                cum_i = rollup.potential_rent_premium_annual + rollup.downtime_deduction
                if not math.isclose(
                    cum_i,
                    rollup.current_year_revenue_growth,
                    rel_tol=1e-9,
                    abs_tol=1e-6,
                ):
                    raise ValueError(
                        "Row 43 first-reno-year identity violated:"
                        f" cumulative_revenue_growth ({cum_i}) !="
                        f" current_year_revenue_growth"
                        f" ({rollup.current_year_revenue_growth})."
                        " Layer 3 and Layer 4 have drifted out of sync."
                    )
                first_reno_seen = True
            else:
                # Subsequent reno year. W&D =SUM($C$38:D38) + D39 — the
                # running sum of potentials from the first reno year
                # through THIS year, plus this year's downtime drag.
                # NO growth multiplier.
                cum_i = running_potential_sum + rollup.downtime_deduction
        else:
            if not first_reno_seen:
                # Pre-renovation year — no renos yet, no accumulation.
                cum_i = 0.0
            else:
                # Post-renovation year. W&D =(Cprior43 − Cprior39)
                # × (1 + Dfy42) — strip the prior year's downtime drag,
                # then grow by the full annual rate.
                prior = rollups[i - 1]
                cum_i = (cumulative[i - 1] - prior.downtime_deduction) * (
                    1.0 + rollup.incremental_rent_growth_rate
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
        F28 stabilized_revenue_increase  = OFFSET(C43, 0, (F5-1)+F6).
                                           With F5=start_year and
                                           F6=duration_years this reads
                                           Row 43 at proforma year
                                           ``start_year + duration_years``
                                           — the FIRST POST-RENOVATION
                                           year, when rent premiums are
                                           fully stabilized (not the
                                           final year of active renos).
                                           0-indexed list position:
                                           ``start_year + duration_years
                                           − 1``, clamped to
                                           ``[0, ROLLUP_YEARS - 1]``.
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

    # F28 reads Row 43 at the FIRST post-renovation proforma year, which
    # is ``start_year + duration_years`` (1-indexed). Since rollups are
    # indexed by proforma year (``annual_rollups[i].fiscal_year == i + 1``),
    # the 0-indexed list position is ``start_year + duration_years - 1``,
    # clamped to the 11-year horizon.
    idx = max(0, min(ROLLUP_YEARS - 1, inp.start_year + inp.duration_years - 1))
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
            incremental_revenue_gross_annual=0.0,
            incremental_revenue_factor=_downtime_factor(q),
            incremental_revenue_actual_annual=0.0,
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
