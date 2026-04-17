"""Integrated underwriting orchestrator — wires the v2 modules into the
multifamily proforma / DCF.

This layer is additive. The base ``UnderwritingEngine`` and the three
module calculators (``calculate_renovation``, ``calculate_retail``,
``calculate_tax_abatement``) are NOT modified. Integration happens by:

  1. Running the base engine to get a "no-modules" scenario set.
  2. Running each enabled module.
  3. Layering module outputs on top of the engine result
     (renovation premium into each DCF year's GPR; tax-abatement
     savings + retail NCF into combined unlevered/levered cash flows;
     basis adjustments into LTC and going-in cap rate).

THE CIRCULAR DEPENDENCY — Pro_Forma_Price <-> Tax-Abatement FMV
---------------------------------------------------------------
Walker & Dunlop's Valuation tab computes Pro_Forma_Price from stabilized
NOI divided by the target cap rate, and that numerator includes Year-1
tax-abatement savings (and retail NCF). But the Tax-Abatement tab's FMV
input IS the Pro_Forma_Price — a genuine fixed point. W&D resolves it
via Excel's iterative calculation. We resolve it via an explicit
fixed-point loop.

Closed-form derivation for ``pricing_mode == "direct_cap"`` with
``property_tax_mode == "reassessment"``:

    base_price = (income − controllable − insurance − mgmt_fee)
                 / (target_cap + k)
    where k = pct_of_purchase_assessed × assessment_ratio × millage

    Integrated price (W&D Valuation!C61):
        price × target_cap = NOI_base + Y1_TA_savings(price) + Y1_retail_NCF
        NOI_base           = income − controllable − insurance − mgmt_fee − k × price
    →   price × (target_cap + k)
                           = (income − controllable − insurance − mgmt_fee)
                             + Y1_TA_savings(price) + Y1_retail_NCF
    →   price = base_price + [Y1_TA_savings(price) + Y1_retail_NCF]
                             / (target_cap + k)

``Y1_retail_NCF`` is price-independent (retail ignores the MF price).
``Y1_TA_savings`` depends on price via
``TaxAbatementInput.fair_market_value``, so we iterate:

    seed   price = base_price                                    (no modules)
    loop   ta    = calculate_tax_abatement(fmv = price)
           new   = base_price + (Y1_TA + Y1_retail) / (cap + k)
           stop  when |new − price| < $1,000 or after 10 passes.

Prose Gainesville converges in 2–3 passes. If convergence exceeds
``max_iterations``, the result is still returned with
``convergence.converged = False`` so callers can flag it.

For ``pricing_mode == "manual"`` the price is fixed; we run each module
once with the provided purchase price and report ``iterations = 1``.
For ``pricing_mode == "target_irr"`` we fall back to a single pass
against the engine's bisected price (the IRR solver already handles
non-module circularity); if a user enables tax-abatement + target_irr
and demands W&D parity, a follow-up is to add a joint solver.
"""

from __future__ import annotations

from app.schemas.underwriting import (
    DCFResult,
    DCFYearResult,
    ScenarioResult,
    UWInputs,
)
from app.services.underwriting_engine import UnderwritingEngine
from backend.underwriting.v2.renovation import calculate_renovation
from backend.underwriting.v2.retail import calculate_retail
from backend.underwriting.v2.schemas.integrated_result import (
    ConvergenceReport,
    IntegratedScenarioResult,
    IntegratedUnderwritingResult,
    ModuleResultsBundle,
)
from backend.underwriting.v2.schemas.renovation import (
    RenovationInput,
    RenovationResult,
)
from backend.underwriting.v2.schemas.retail import RetailInput, RetailResult
from backend.underwriting.v2.schemas.tax_abatement import (
    TaxAbatementInput,
    TaxAbatementResult,
)
from backend.underwriting.v2.tax_abatement import calculate_tax_abatement

CONVERGENCE_THRESHOLD_DEFAULT: float = 1_000.0  # dollars
MAX_ITERATIONS_DEFAULT: int = 10


def _reassessment_k(deal: UWInputs) -> float:
    """Closed-form tax-circularity coefficient used by the engine.

    Mirrors ``UnderwritingEngine._solve_price_from_cap``:
        k = pct_of_purchase_assessed × assessment_ratio × (millage / 100)

    Returns ``0.0`` when the deal is NOT in reassessment mode.
    """
    if deal.property_tax_mode != "reassessment":
        return 0.0
    return (
        deal.pct_of_purchase_assessed
        * deal.assessment_ratio
        * (deal.millage_rate / 100.0)
    )


def _y1_retail_ncf(retail_result: RetailResult | None) -> float:
    """Year-1 net cash flow from retail, premium scenario."""
    if retail_result is None or not retail_result.premium.annual_cash_flows:
        return 0.0
    return retail_result.premium.annual_cash_flows[0].net_cash_flow


def _y1_tax_abatement_savings(ta_result: TaxAbatementResult | None) -> float:
    """Year-1 abatement savings."""
    if ta_result is None or not ta_result.annual_abatement_savings:
        return 0.0
    return ta_result.annual_abatement_savings[0]


def _solve_price_fixed_point(
    deal: UWInputs,
    base_price: float,
    tax_abatement: TaxAbatementInput | None,
    y1_retail: float,
    *,
    max_iterations: int,
    convergence_threshold: float,
) -> tuple[float, TaxAbatementResult | None, int, bool, float]:
    """Resolve the Pro_Forma_Price <-> TA-FMV fixed point.

    Price adjusts only in ``direct_cap`` mode (in ``manual`` / ``target_irr``
    modes the price is exogenous; we still run tax-abatement once with
    the seed FMV so the module result is available to downstream
    combined-CF assembly). Retail's Y1 NCF is folded in as a one-shot
    adjustment (retail does not depend on price). Tax-abatement requires
    iteration — the FMV is ``price``, and Y1 savings feed back into
    price via ``base_price + (Y1_TA + Y1_retail) / (cap + k)``.

    Returns ``(price, ta_result, iterations, converged, final_delta)``.
    """
    # Exogenous-price paths — no iteration, just echo the engine's price.
    if deal.premium.pricing_mode != "direct_cap":
        ta_result = (
            calculate_tax_abatement(tax_abatement)
            if tax_abatement is not None
            else None
        )
        return base_price, ta_result, 1, True, 0.0

    cap_plus_k = _target_cap(deal) + _reassessment_k(deal)
    if cap_plus_k <= 0:
        ta_result = (
            calculate_tax_abatement(tax_abatement)
            if tax_abatement is not None
            else None
        )
        return base_price, ta_result, 1, True, 0.0

    # No tax-abatement → one-shot retail adjustment, trivially converged.
    if tax_abatement is None:
        price = base_price + y1_retail / cap_plus_k
        return price, None, 1, True, 0.0

    # TA enabled + direct_cap — loop.
    price = base_price
    ta_result: TaxAbatementResult | None = None
    final_delta = 0.0
    converged = False
    iterations = 0
    for i in range(max_iterations):
        iterations = i + 1
        ta_iter_input = tax_abatement.model_copy(
            update={"fair_market_value": price}
        )
        ta_result = calculate_tax_abatement(ta_iter_input)
        y1_ta = _y1_tax_abatement_savings(ta_result)
        new_price = base_price + (y1_ta + y1_retail) / cap_plus_k
        final_delta = abs(new_price - price)
        price = new_price
        if final_delta < convergence_threshold:
            converged = True
            break

    return price, ta_result, iterations, converged, final_delta


def _target_cap(deal: UWInputs) -> float:
    """Premium scenario target cap rate (0 if not set)."""
    return deal.premium.target_cap_rate or 0.0


def _inject_renovation_into_year(
    year: DCFYearResult,
    year_idx: int,
    renovation_result: RenovationResult,
    equity: float,
) -> DCFYearResult:
    """Return a new ``DCFYearResult`` with the year's renovation premium
    layered into GPR, re-deriving every GPR-dependent line.

    Placement mirrors W&D's Valuation!C106 ("Plus: Renovated Unit
    Premiums", above the vacancy line) — vacancy / concessions /
    bad_debt are therefore applied to the lifted GPR. To respect any
    per-scenario overrides the engine may have applied, rates are
    back-derived from the existing year (``vacancy / gpr`` etc.) rather
    than recomputed from ``UWInputs``.

    Unchanged lines: ``nru_loss``, ``other_income``,
    ``controllable_expenses``, ``property_taxes``, ``insurance``,
    ``reserves``, ``debt_service``, ``custom_revenue``,
    ``custom_expenses``, ``computed_values``.

    Growth-rate metrics (``revenue_growth_rate``, ``noi_growth_rate``)
    are left unchanged on a per-year basis; if the caller needs
    integrated CAGRs they should derive them from the returned DCF.
    """
    if (
        year_idx >= len(renovation_result.annual_rollups)
        or year.gpr <= 0
    ):
        return year

    premium = renovation_result.annual_rollups[year_idx].cumulative_revenue_growth
    if premium == 0.0:
        return year

    vacancy_rate = year.vacancy / year.gpr
    concession_rate = year.concessions / year.gpr
    bad_debt_rate = year.bad_debt / year.gpr
    mgmt_rate = (
        year.management_fee / year.total_income if year.total_income > 0 else 0.0
    )

    new_gpr = year.gpr + premium
    new_vacancy = new_gpr * vacancy_rate
    new_concessions = new_gpr * concession_rate
    new_bad_debt = new_gpr * bad_debt_rate
    new_nri = (
        new_gpr - new_vacancy - new_concessions - year.nru_loss - new_bad_debt
    )
    new_total_income = new_nri + year.other_income
    new_mgmt_fee = new_total_income * mgmt_rate
    new_total_expenses = (
        year.controllable_expenses
        + year.property_taxes
        + year.insurance
        + new_mgmt_fee
    )
    new_noi = new_total_income - new_total_expenses
    new_ncf = new_noi - year.reserves
    new_ncf_after_debt = new_ncf - year.debt_service
    new_coc = new_ncf_after_debt / equity if equity > 0 else None
    new_dscr = new_noi / year.debt_service if year.debt_service > 0 else None
    new_eff_rent = (
        year.effective_rent * (new_total_income / year.total_income)
        if year.total_income > 0
        else year.effective_rent
    )

    return year.model_copy(
        update={
            "gpr": new_gpr,
            "vacancy": new_vacancy,
            "concessions": new_concessions,
            "bad_debt": new_bad_debt,
            "nri": new_nri,
            "total_income": new_total_income,
            "management_fee": new_mgmt_fee,
            "total_expenses": new_total_expenses,
            "noi": new_noi,
            "ncf": new_ncf,
            "ncf_after_debt": new_ncf_after_debt,
            "cash_on_cash": new_coc,
            "dscr": new_dscr,
            "effective_rent": new_eff_rent,
        }
    )


def _apply_renovation_to_scenario(
    scenario: ScenarioResult,
    renovation_result: RenovationResult | None,
) -> ScenarioResult:
    """Layer renovation premium into every DCF year of ``scenario``.

    Returns a new ``ScenarioResult`` with the DCF replaced. ``proforma``,
    ``debt``, ``returns``, and ``valuation_summary`` are UNCHANGED here —
    basis adjustments (LTC, purchase-price bump, IRR re-solve) are
    layered by downstream helpers in later commits so this function
    stays focused on the GPR / NOI / NCF re-derivation.
    """
    if (
        renovation_result is None
        or not renovation_result.enabled
        or not scenario.dcf.years
    ):
        return scenario

    equity = scenario.debt.equity
    new_years = [
        _inject_renovation_into_year(
            year=y,
            year_idx=i,
            renovation_result=renovation_result,
            equity=equity,
        )
        for i, y in enumerate(scenario.dcf.years)
    ]
    new_dcf = DCFResult(
        years=new_years,
        revenue_cagr=scenario.dcf.revenue_cagr,
        noi_cagr=scenario.dcf.noi_cagr,
    )
    return scenario.model_copy(update={"dcf": new_dcf})


def _retail_scenario(
    retail_result: RetailResult | None, scenario_key: str
) -> RetailResult | None:
    """Return the matching retail scenario result, if available.

    ``RetailResult`` carries both ``premium`` and ``market`` scenarios
    side-by-side; we pick whichever matches the MF scenario key.
    """
    if retail_result is None:
        return retail_result
    return retail_result  # scoping handled by caller via ``.premium`` / ``.market``


def _retail_annual_ncf(
    retail_result: RetailResult | None,
    scenario_key: str,
    year_idx: int,
) -> float:
    """Year-``year_idx`` retail NCF for the given MF scenario key."""
    if retail_result is None:
        return 0.0
    rs = (
        retail_result.premium
        if scenario_key == "premium"
        else retail_result.market
    )
    if year_idx >= len(rs.annual_cash_flows):
        return 0.0
    return rs.annual_cash_flows[year_idx].net_cash_flow


def _retail_scenario_value(
    retail_result: RetailResult | None, scenario_key: str
) -> float:
    """Retail value for the given MF scenario key."""
    if retail_result is None:
        return 0.0
    return (
        retail_result.premium.retail_value
        if scenario_key == "premium"
        else retail_result.market.retail_value
    )


def _ta_savings_at(
    ta_result: TaxAbatementResult | None, year_idx: int
) -> float:
    """Tax-abatement savings for a given year, or 0."""
    if ta_result is None or year_idx >= len(ta_result.annual_abatement_savings):
        return 0.0
    return ta_result.annual_abatement_savings[year_idx]


def _combined_cash_flows(
    scenario: ScenarioResult,
    retail_result: RetailResult | None,
    ta_result: TaxAbatementResult | None,
    scenario_key: str,
) -> tuple[list[float], list[float]]:
    """Assemble combined unlevered / levered cash flows for one scenario.

    Mirrors W&D Valuation!C167/C169 (retail NCF added to Annual Unlevered
    Project CF) and Valuation!C165 (tax-abatement savings added), plus
    Valuation!C178 for the levered variant. Tax-abatement and retail
    debt-service lines are NOT subtracted today — neither module output
    exposes them (see open-question notes in the module docstring). If
    those are required for full W&D parity the caller should either
    supply debt parameters via a follow-up extension or accept cash-flow-
    only treatment.
    """
    years = scenario.dcf.years
    combined_unlev: list[float] = []
    combined_lev: list[float] = []
    for i, year in enumerate(years):
        ta = _ta_savings_at(ta_result, i)
        retail_ncf = _retail_annual_ncf(retail_result, scenario_key, i)
        combined_unlev.append(year.ncf + ta + retail_ncf)
        combined_lev.append(year.ncf_after_debt + ta + retail_ncf)
    return combined_unlev, combined_lev


def _going_in_cap_rates(
    scenario: ScenarioResult,
    pro_forma_price: float,
    renovation_result: RenovationResult | None,
    retail_result: RetailResult | None,
    ta_result: TaxAbatementResult | None,
    scenario_key: str,
) -> tuple[float, float]:
    """Standard and module-adjusted going-in cap rates.

    Standard mirrors the engine: ``Y1_NOI_base / Pro_Forma_Price_base``
    (the engine's ``cap_rates.y1_cap_rate``; baseline NOI is used
    because ``valuation_summary`` is copied through unchanged by the
    renovation-injection helper).

    Adjusted mirrors W&D Proforma!K46/L46:

        adjusted_numerator   = Y1_NOI_base
                             + renovation.stabilized_revenue_increase
                             + Y1_TA_savings
                             + Y1_retail_NCF
        adjusted_denominator = Pro_Forma_Price
                             + renovation.total_renovation_cost
                             + tax_abatement.npv_abatement
                             + retail.<scn>.retail_value
    """
    y1_cap = scenario.valuation_summary.cap_rates.y1_cap_rate or 0.0
    y1_noi_base = scenario.proforma.noi

    reno_premium = (
        renovation_result.stabilized_revenue_increase
        if renovation_result is not None and renovation_result.enabled
        else 0.0
    )
    reno_cost = (
        renovation_result.total_renovation_cost
        if renovation_result is not None and renovation_result.enabled
        else 0.0
    )
    ta_npv = ta_result.npv_abatement if ta_result is not None else 0.0
    y1_ta = _ta_savings_at(ta_result, 0)
    y1_retail = _retail_annual_ncf(retail_result, scenario_key, 0)
    retail_value = _retail_scenario_value(retail_result, scenario_key)

    numerator = y1_noi_base + reno_premium + y1_ta + y1_retail
    denominator = pro_forma_price + reno_cost + ta_npv + retail_value
    adjusted = numerator / denominator if denominator > 0 else y1_cap
    return y1_cap, adjusted


def _ltv_or_ltc(
    scenario: ScenarioResult,
    pro_forma_price: float,
    renovation_input: RenovationInput | None,
    renovation_result: RenovationResult | None,
) -> tuple[float, bool]:
    """LTC when renovation is loan-financed; otherwise LTV.

    When renovation is enabled AND ``finance_with_loan=True``, the loan
    is conceptually increased by ``total_renovation_cost * actual_ltv``
    and the effective basis is ``price + total_renovation_cost``. The
    returned ratio is ``new_loan / effective_basis`` — mathematically
    equal to ``scenario.debt.actual_ltv`` in the standard case (same
    ratio applied to both numerator and denominator), so the exposed
    value is informational today. Re-sizing the loan and re-running the
    DCF with the larger debt service is a separate follow-up.
    """
    base_ltv = scenario.debt.actual_ltv
    is_ltc = (
        renovation_input is not None
        and renovation_result is not None
        and renovation_result.enabled
        and renovation_input.finance_with_loan
    )
    if not is_ltc:
        return base_ltv, False

    reno_cost = renovation_result.total_renovation_cost if renovation_result else 0.0
    loan = scenario.debt.loan_amount + reno_cost * base_ltv
    effective_basis = pro_forma_price + reno_cost
    ltc = loan / effective_basis if effective_basis > 0 else 0.0
    return ltc, True


def _build_integrated_scenario(
    scenario: ScenarioResult,
    pro_forma_price: float,
    scenario_key: str,
    renovation_input: RenovationInput | None,
    renovation_result: RenovationResult | None,
    retail_result: RetailResult | None,
    ta_result: TaxAbatementResult | None,
) -> IntegratedScenarioResult:
    """Compose one scenario's integrated result.

    ``scenario`` is expected to already carry renovation GPR injection
    when renovation is enabled (applied by
    :func:`_apply_renovation_to_scenario` before this helper is called).
    """
    combined_unlev, combined_lev = _combined_cash_flows(
        scenario=scenario,
        retail_result=retail_result,
        ta_result=ta_result,
        scenario_key=scenario_key,
    )
    going_in, going_in_adj = _going_in_cap_rates(
        scenario=scenario,
        pro_forma_price=pro_forma_price,
        renovation_result=renovation_result,
        retail_result=retail_result,
        ta_result=ta_result,
        scenario_key=scenario_key,
    )
    ltv_or_ltc, is_ltc = _ltv_or_ltc(
        scenario=scenario,
        pro_forma_price=pro_forma_price,
        renovation_input=renovation_input,
        renovation_result=renovation_result,
    )
    combined_value = pro_forma_price + _retail_scenario_value(
        retail_result, scenario_key
    )

    return IntegratedScenarioResult(
        scenario=scenario,
        pro_forma_price=pro_forma_price,
        combined_unlevered_cf=combined_unlev,
        combined_levered_cf=combined_lev,
        going_in_cap_rate=going_in,
        going_in_cap_rate_adjusted=going_in_adj,
        combined_value=combined_value,
        ltv_or_ltc=ltv_or_ltc,
        is_ltc=is_ltc,
    )


def run_integrated_underwriting(
    deal: UWInputs,
    renovation: RenovationInput | None = None,
    retail: RetailInput | None = None,
    tax_abatement: TaxAbatementInput | None = None,
    *,
    max_iterations: int = MAX_ITERATIONS_DEFAULT,
    convergence_threshold: float = CONVERGENCE_THRESHOLD_DEFAULT,
) -> IntegratedUnderwritingResult:
    """Compute an integrated underwriting result.

    Runs the multifamily engine, runs each enabled module, resolves the
    Pro_Forma_Price <-> TA-FMV fixed point, and returns a composed
    result. See module docstring for the full integration contract.

    Args:
        deal: Multifamily inputs (unchanged — integration never
            mutates this).
        renovation: Optional renovation module input.
        retail: Optional retail module input.
        tax_abatement: Optional tax-abatement module input. The
            ``fair_market_value`` field is used as the initial seed and
            is overwritten on each iteration; the caller's input object
            is never mutated (pydantic ``model_copy``).
        max_iterations: Fixed-point iteration cap (default 10).
        convergence_threshold: Price delta in dollars below which the
            fixed point is declared converged (default $1,000).

    Returns:
        :class:`IntegratedUnderwritingResult` with baseline proforma,
        per-scenario integrated results, operating statements, module
        results (``None`` slots for disabled modules), and a
        convergence report.
    """
    engine = UnderwritingEngine(deal)
    base_uw = engine.compute()

    renovation_result: RenovationResult | None = (
        calculate_renovation(renovation) if renovation is not None else None
    )
    retail_result: RetailResult | None = (
        calculate_retail(retail) if retail is not None else None
    )
    y1_retail = _y1_retail_ncf(retail_result)

    premium_scenario = base_uw.scenarios.get("premium")
    if premium_scenario is None:
        # No scenarios ran (e.g., both pricing modes failed to resolve a
        # price). Return the bare engine result with an empty scenarios
        # map — the caller sees the raw proforma for diagnostics.
        return IntegratedUnderwritingResult(
            proforma=base_uw.proforma,
            scenarios={},
            operating_statements=base_uw.operating_statements,
            module_results=ModuleResultsBundle(
                renovation=renovation_result,
                retail=retail_result,
                tax_abatement=None,
            ),
            convergence=ConvergenceReport(
                iterations=0, converged=True, final_price_delta=0.0
            ),
        )

    base_price = premium_scenario.valuation_summary.purchase_price
    price, ta_result, iterations, converged, final_delta = _solve_price_fixed_point(
        deal=deal,
        base_price=base_price,
        tax_abatement=tax_abatement,
        y1_retail=y1_retail,
        max_iterations=max_iterations,
        convergence_threshold=convergence_threshold,
    )

    # Per-scenario integrated results. Renovation GPR injection happens
    # first (it modifies the DCF), then combined-CF assembly / going-in
    # cap adjustment / LTC selection run on the renovation-adjusted
    # scenario.
    integrated_scenarios: dict[str, IntegratedScenarioResult] = {}
    for scn_key, scn in base_uw.scenarios.items():
        scn_price = (
            price
            if scn_key == "premium"
            else scn.valuation_summary.purchase_price
        )
        integrated_scn = _apply_renovation_to_scenario(scn, renovation_result)
        integrated_scenarios[scn_key] = _build_integrated_scenario(
            scenario=integrated_scn,
            pro_forma_price=scn_price,
            scenario_key=scn_key,
            renovation_input=renovation,
            renovation_result=renovation_result,
            retail_result=retail_result,
            ta_result=ta_result,
        )

    return IntegratedUnderwritingResult(
        proforma=base_uw.proforma,
        scenarios=integrated_scenarios,
        operating_statements=base_uw.operating_statements,
        module_results=ModuleResultsBundle(
            renovation=renovation_result,
            retail=retail_result,
            tax_abatement=ta_result,
        ),
        convergence=ConvergenceReport(
            iterations=iterations,
            converged=converged,
            final_price_delta=final_delta,
        ),
    )
