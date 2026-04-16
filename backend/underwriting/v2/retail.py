"""Retail standalone DCF calculation module.

Ports the standalone retail valuation model from Walker & Dunlop's
institutional proforma (Prose_Gainesville_Proforma_1_30_26_RH.xlsm,
"Retail" tab) into the Talisman underwriting engine.

Architectural boundary:
    Retail is a fully STANDALONE DCF that produces its own valuation.
    It does NOT modify the multifamily Proforma. Its NCF and value
    get added at the Summary / consolidated DCF level only — that
    integration happens in a later step. This module computes the
    Retail block in isolation and returns a :class:`RetailResult`
    for the Summary layer to consume.

Scope:
    MVP runs the full 10–15 year DCF across both Premium (seller) and
    Market (buyer) scenarios. Both scenarios share identical cash flows;
    only discount rate and exit cap differ, producing two values that
    frame the bid-ask spread.

DEVIATIONS FROM W&D:
    1. **Rollover vacancy collapsed to structural vacancy.** W&D $C$32
       toggles a per-tenant rollover-vacancy calculation via a SUMIF over
       tenant expiration dates (see ``Retail!L38``). The MVP ignores the
       toggle and always applies structural vacancy
       (``-PRI × structural_vacancy_loss``). This is a safe, slightly
       conservative approximation: the structural rate is typically
       picked to encompass expected rollover downtime, and if anything
       overstates vacancy, which reduces value — the conservative
       direction for underwriting. v2 will wire up the SUMIF.
    2. **TI/LC applied uniformly every year.** W&D ``Retail!L42``
       applies TI and LC at tenant rollover dates (lease expirations).
       The MVP spreads both charges evenly across the hold, which
       front-loads expense in years where W&D would have none. This is
       conservative (value-reducing) and consistent across years,
       simplifying audit. v2 will switch to rollover-triggered TI/LC.
    3. **Unused lease fields on ``RetailTenant``.** ``lease_start_date``,
       ``lease_expiration_date``, ``lease_type``, and
       ``absorption_months`` are accepted via the API but not yet
       consumed by MVP logic (``rollover_vacancy=False`` always uses
       structural vacancy). These fields reserve API shape for v2
       per-tenant rollover logic.
"""

from __future__ import annotations

from backend.underwriting.v2._financial import excel_npv
from backend.underwriting.v2.schemas.retail import (
    RetailAnnualCashFlow,
    RetailInput,
    RetailResult,
    RetailScenarioAssumptions,
    RetailScenarioResult,
)


def calculate_retail(inp: RetailInput) -> RetailResult:
    """Compute the standalone Retail DCF per the W&D 'Retail' tab.

    Mirrors rows Retail!L37:V44 (annual cash flows) and Retail!L47:L53
    (valuation block) across both Premium and Market scenarios.

    Disabled / empty path:
        If ``inp.enabled`` is False or ``inp.tenants`` is empty, returns
        a fully constructed :class:`RetailResult` with ``enabled=False``,
        zero totals, and both scenarios carrying
        ``hold_period_years + 1`` zero-valued cash flows. Callers can
        unconditionally sum retail into the consolidated DCF without a
        None-check.

    Calculation (per year ``y`` in ``1..hold_period_years + 1``):
        1. PRI (Retail!L37):
           ``pri = total_sqft * wa_rent * (1 + rental_inflation)^(y-1)``
        2. Vacancy loss (Retail!L38):
           ``-pri * structural_vacancy_loss``
        3. Credit loss (Retail!L39):
           ``-pri * credit_loss``
        4. Expenses (Retail!L40):
           ``-expenses_per_sf * total_sqft * (1 + expense_inflation)^(y-1)``
        5. Expense reimbursements (Retail!L41):
           ``-expenses * tenant_expense_recovery``
        6. TI&LC (Retail!L42): sum of
           ``-ti_per_sf * total_sqft * (1 + expense_inflation)^(y-1)``
           and ``-lc_percent * pri``
        7. Capex reimbursements (Retail!L43):
           ``-ti_and_lc * tenant_capex_recovery``
        8. Net Cash Flow (Retail!L44): sum of steps 1–7.

    Valuation (per scenario, Retail!L47):
        * Reversion value = NCF[hold+1] / exit_cap
        * NPV inputs = NCF[1..hold-1] + [NCF[hold] + reversion]
        * retail_value = excel_npv(discount_rate, NPV inputs)
        * year_1_cap_rate = NCF[1] / retail_value (Retail!L48)
        * value_per_retail_sf = retail_value / total_sqft (Retail!L49)
        * maximum_debt_proceeds = mf_ltv_ratio × retail_value
          (Retail!L52)
        * implied_ltv = maximum_debt_proceeds / retail_value
          (Retail!L53)

    Args:
        inp: Validated :class:`RetailInput`.

    Returns:
        :class:`RetailResult` with both Premium and Market scenarios.
    """
    total_sqft = sum(t.square_feet for t in inp.tenants)

    if not inp.enabled or not inp.tenants or total_sqft == 0.0:
        return _zero_result(inp)

    wa_rent = (
        sum(t.square_feet * t.annual_rent_per_sf for t in inp.tenants)
        / total_sqft
    )  # Retail!$D$26 — SF-weighted average rent

    cash_flows = [
        _compute_annual_cashflow(year, inp, total_sqft, wa_rent)
        for year in range(1, inp.hold_period_years + 2)
    ]

    premium_result = _compute_scenario(
        "premium", inp, total_sqft, cash_flows, inp.premium
    )
    market_result = _compute_scenario(
        "market", inp, total_sqft, cash_flows, inp.market
    )

    return RetailResult(
        enabled=True,
        total_square_feet=total_sqft,
        weighted_average_rent_per_sf=wa_rent,
        premium=premium_result,
        market=market_result,
    )


def _compute_annual_cashflow(
    year: int,
    inp: RetailInput,
    total_sqft: float,
    wa_rent: float,
) -> RetailAnnualCashFlow:
    """Build one DCF year per Retail!L37:L44.

    Cash flows are scenario-independent — only discount rate and exit
    cap vary between Premium and Market — so we compute this once per
    year and reuse across both scenarios.
    """
    rent_escalator = (1.0 + inp.rental_inflation) ** (year - 1)
    expense_escalator = (1.0 + inp.expense_inflation) ** (year - 1)

    pri = total_sqft * wa_rent * rent_escalator  # Retail!L37 — PRI

    # Retail!L38 — Vacancy Loss. MVP: structural only.
    # TODO(v2): when inp.rollover_vacancy is True, replace with W&D
    # SUMIF over tenant lease_expiration_date to capture per-tenant
    # rollover-vacancy months × vacant_leaseup_rollover_months.
    vacancy_loss = -pri * inp.structural_vacancy_loss

    credit_loss = -pri * inp.credit_loss  # Retail!L39 — Credit Loss

    expenses = (
        -inp.expenses_per_sf * total_sqft * expense_escalator
    )  # Retail!L40 — Operating Expenses

    # Retail!L41 — Expense Reimbursements. Negative × negative = positive.
    expense_reimbursements = -expenses * inp.tenant_expense_recovery

    # Retail!L42 — TI & LC. MVP applies uniformly every year (see module
    # docstring DEVIATIONS). W&D triggers at rollover.
    ti_portion = (
        -(inp.tenant_improvement_per_sf * total_sqft) * expense_escalator
    )
    lc_portion = -(inp.leasing_commission_percent * pri)
    ti_and_lc = ti_portion + lc_portion

    # Retail!L43 — Capex Reimbursements. Negative × negative = positive.
    capex_reimbursements = -ti_and_lc * inp.tenant_capex_recovery

    # Retail!L44 — Net Cash Flow (sum of rows 37–43).
    net_cash_flow = (
        pri
        + vacancy_loss
        + credit_loss
        + expenses
        + expense_reimbursements
        + ti_and_lc
        + capex_reimbursements
    )

    return RetailAnnualCashFlow(
        year=year,
        potential_rental_income=pri,
        vacancy_loss=vacancy_loss,
        credit_loss=credit_loss,
        expenses=expenses,
        expense_reimbursements=expense_reimbursements,
        ti_and_lc=ti_and_lc,
        capex_reimbursements=capex_reimbursements,
        net_cash_flow=net_cash_flow,
    )


def _compute_scenario(
    scenario_name: str,
    inp: RetailInput,
    total_sqft: float,
    cash_flows: list[RetailAnnualCashFlow],
    assumptions: RetailScenarioAssumptions,
) -> RetailScenarioResult:
    """Compute one scenario's valuation block (Retail!L47:L53)."""
    hold = inp.hold_period_years
    ncfs = [cf.net_cash_flow for cf in cash_flows]

    # Retail!L47 — Reversion from year hold+1 NCF / exit cap.
    reversion_value = ncfs[hold] / assumptions.exit_cap

    # NPV inputs: years 1..hold, with reversion added to the final hold year.
    npv_inputs = list(ncfs[:hold])
    npv_inputs[-1] += reversion_value

    retail_value = excel_npv(assumptions.discount_rate, npv_inputs)

    year_1_cap_rate = ncfs[0] / retail_value  # Retail!L48
    value_per_retail_sf = retail_value / total_sqft  # Retail!L49
    maximum_debt_proceeds = inp.mf_ltv_ratio * retail_value  # Retail!L52
    implied_ltv = maximum_debt_proceeds / retail_value  # Retail!L53

    return RetailScenarioResult(
        scenario_name=scenario_name,
        discount_rate=assumptions.discount_rate,
        exit_cap=assumptions.exit_cap,
        annual_cash_flows=cash_flows,
        retail_value=retail_value,
        year_1_cap_rate=year_1_cap_rate,
        value_per_retail_sf=value_per_retail_sf,
        maximum_debt_proceeds=maximum_debt_proceeds,
        implied_ltv=implied_ltv,
    )


def _zero_result(inp: RetailInput) -> RetailResult:
    """Fully-constructed zero result for the disabled / empty path."""
    n = inp.hold_period_years + 1
    zero_cash_flows = [
        RetailAnnualCashFlow(
            year=y,
            potential_rental_income=0.0,
            vacancy_loss=0.0,
            credit_loss=0.0,
            expenses=0.0,
            expense_reimbursements=0.0,
            ti_and_lc=0.0,
            capex_reimbursements=0.0,
            net_cash_flow=0.0,
        )
        for y in range(1, n + 1)
    ]

    def _zero_scenario(
        name: str, assumptions: RetailScenarioAssumptions
    ) -> RetailScenarioResult:
        return RetailScenarioResult(
            scenario_name=name,
            discount_rate=assumptions.discount_rate,
            exit_cap=assumptions.exit_cap,
            annual_cash_flows=list(zero_cash_flows),
            retail_value=0.0,
            year_1_cap_rate=0.0,
            value_per_retail_sf=0.0,
            maximum_debt_proceeds=0.0,
            implied_ltv=0.0,
        )

    return RetailResult(
        enabled=False,
        total_square_feet=0.0,
        weighted_average_rent_per_sf=0.0,
        premium=_zero_scenario("premium", inp.premium),
        market=_zero_scenario("market", inp.market),
    )
