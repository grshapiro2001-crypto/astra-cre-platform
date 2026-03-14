"""
Underwriting Engine V1 — Pure calculation module.

Takes a typed UWInputs and returns UWOutputs. No database or API dependencies.
All formulas from the Talisman IO UW Engine V1 spec, Sections 3–7.
Calculation order follows Section 13 dependency graph.
"""

from __future__ import annotations

import math
from typing import Optional

from app.schemas.underwriting import (
    UWInputs,
    UWOutputs,
    RevenueResult,
    ExpenseResult,
    ProformaResult,
    DebtResult,
    DCFYearResult,
    DCFResult,
    ReversionResult,
    ReturnsResult,
    CapRates,
    ValuationSummary,
    ScenarioResult,
    OperatingStatement,
    OperatingStatementLine,
)


class UnderwritingEngine:
    """Stateless underwriting calculation engine."""

    def __init__(self, inputs: UWInputs):
        self.inputs = inputs

    def compute(self) -> UWOutputs:
        """Master computation — runs the full calculation chain.

        Revenue is scenario-independent. Property tax (and therefore expenses,
        proforma, and all downstream metrics) is scenario-dependent when
        property_tax_mode == 'reassessment' because tax depends on purchase price.
        """
        inp = self.inputs

        # Step 1-6: Revenue — always scenario-independent
        revenue = self._compute_revenue()

        # Steps 7-22: per scenario (tax may depend on purchase price)
        scenarios: dict[str, ScenarioResult] = {}
        first_proforma: ProformaResult | None = None

        for scenario_key in ("premium", "market"):
            scenario_inputs = getattr(inp, scenario_key)

            # Resolve purchase price based on pricing mode
            purchase_price = self._resolve_purchase_price(scenario_key, revenue)
            if purchase_price <= 0:
                continue

            # Compute scenario-specific tax
            scenario_tax = self._compute_scenario_tax(purchase_price)

            # Compute expenses with scenario-specific tax
            expenses = self._compute_expenses(revenue, property_tax=scenario_tax)
            proforma = self._compute_proforma(revenue, expenses)

            if first_proforma is None:
                first_proforma = proforma

            debt = self._compute_debt(proforma, scenario_key, purchase_price)
            dcf = self._compute_dcf(proforma, debt, scenario_key, purchase_price)
            returns = self._compute_returns(dcf, debt, scenario_key, purchase_price)

            cap_rates = self._compute_cap_rates(proforma, scenario_key, purchase_price)
            val_summary = self._build_valuation_summary(
                proforma, debt, dcf, returns, cap_rates, scenario_key, purchase_price
            )

            scenarios[scenario_key] = ScenarioResult(
                proforma=proforma,
                debt=debt,
                dcf=dcf,
                returns=returns,
                valuation_summary=val_summary,
            )

        # Top-level proforma: use first scenario's proforma, or compute a
        # fallback using current_tax_amount if no scenarios ran
        if first_proforma is None:
            fallback_expenses = self._compute_expenses(revenue, property_tax=inp.current_tax_amount)
            first_proforma = self._compute_proforma(revenue, fallback_expenses)

        operating_statement = self._build_operating_statement(first_proforma)

        return UWOutputs(
            proforma=first_proforma,
            scenarios=scenarios,
            operating_statement=operating_statement,
        )

    # ------------------------------------------------------------------
    # Purchase Price Resolution (pricing modes)
    # ------------------------------------------------------------------

    def _resolve_purchase_price(self, scenario_key: str, revenue: RevenueResult) -> float:
        """Resolve purchase price based on pricing mode."""
        inp = self.inputs
        scenario = getattr(inp, scenario_key)
        mode = getattr(scenario, "pricing_mode", "manual")

        if mode == "manual":
            return scenario.purchase_price or 0.0

        elif mode == "direct_cap":
            target_cap = scenario.target_cap_rate
            if not target_cap or target_cap <= 0:
                return 0.0

            # Start with current_tax_amount to compute initial NOI
            tax = inp.current_tax_amount
            expenses = self._compute_expenses(revenue, property_tax=tax)
            noi = revenue.total_income - expenses.total_expenses
            price = noi / target_cap

            # If reassessment mode, iterate to convergence (tax depends on price)
            if inp.property_tax_mode == "reassessment":
                for _ in range(20):
                    tax = self._compute_scenario_tax(price)
                    expenses = self._compute_expenses(revenue, property_tax=tax)
                    noi = revenue.total_income - expenses.total_expenses
                    new_price = noi / target_cap
                    if abs(new_price - price) < 1.0:
                        break
                    price = new_price

            return price

        elif mode == "target_irr":
            return self._solve_price_from_irr(scenario_key, revenue)

        return scenario.purchase_price or 0.0

    def _solve_price_from_irr(self, scenario_key: str, revenue: RevenueResult) -> float:
        """Bisection solver: find purchase price that produces the target unlevered IRR."""
        inp = self.inputs
        scenario = getattr(inp, scenario_key)
        target_irr = scenario.target_unlevered_irr

        if not target_irr or target_irr <= 0:
            return 0.0

        units = inp.total_units if inp.total_units > 0 else 1
        lo = 10_000.0 * units
        hi = 500_000.0 * units

        def compute_irr_at_price(price: float) -> Optional[float]:
            tax = self._compute_scenario_tax(price)
            expenses = self._compute_expenses(revenue, property_tax=tax)
            proforma = self._compute_proforma(revenue, expenses)
            debt = self._compute_debt(proforma, scenario_key, price)
            dcf = self._compute_dcf(proforma, debt, scenario_key, price)
            returns = self._compute_returns(dcf, debt, scenario_key, price)
            return returns.unlevered_irr

        # Bisection: higher price -> lower IRR (monotonically decreasing)
        for _ in range(60):
            mid = (lo + hi) / 2
            irr = compute_irr_at_price(mid)
            if irr is None:
                hi = mid
                continue
            if abs(irr - target_irr) < 0.0001:
                return mid
            if irr > target_irr:
                # Price too low → IRR too high → increase price
                lo = mid
            else:
                # Price too high → IRR too low → decrease price
                hi = mid

        return (lo + hi) / 2

    # ------------------------------------------------------------------
    # Scenario Tax Calculation
    # ------------------------------------------------------------------

    def _compute_scenario_tax(self, purchase_price: float) -> float:
        """Compute property tax for a given purchase price."""
        inp = self.inputs
        if inp.property_tax_mode == "reassessment" and purchase_price > 0:
            fmv = purchase_price * inp.pct_of_purchase_assessed
            assessed = fmv * inp.assessment_ratio
            return assessed * (inp.millage_rate / 100)
        return inp.current_tax_amount

    # ------------------------------------------------------------------
    # Step 1–6: Revenue Waterfall
    # ------------------------------------------------------------------

    def _compute_revenue(self) -> RevenueResult:
        inp = self.inputs

        # Step 1: GSR from unit mix
        gsr = 0.0
        for um in inp.unit_mix:
            rent = um.market_rent if inp.rent_basis == "market" else um.inplace_rent
            gsr += rent * um.units * 12

        # Step 2: Gain/Loss to Lease
        gain_loss_to_lease = 0.0
        if inp.rent_basis == "inplace":
            blended_capture = (
                inp.retention_ratio * inp.renewal_rent_bump
                + (1 - inp.retention_ratio) * 1.0
            )
            for um in inp.unit_mix:
                gap = um.inplace_rent - um.market_rent  # negative if inplace < market
                gain_loss_to_lease += gap * um.units * 12 * (1 - blended_capture)

        # Step 3: GPR
        gpr = gsr + gain_loss_to_lease

        # Step 4: Deductions (Y1 = index 0)
        vacancy = gpr * inp.vacancy_pct[0]
        concessions = gpr * inp.concession_pct[0]
        bad_debt = gpr * inp.bad_debt_pct[0]

        # NRU loss
        nru_avg = inp.nru_avg_rent
        if nru_avg <= 0 and inp.unit_mix:
            total_units_in_mix = sum(um.units for um in inp.unit_mix)
            if total_units_in_mix > 0:
                nru_avg = sum(
                    um.market_rent * um.units for um in inp.unit_mix
                ) / total_units_in_mix
        nru_loss = inp.nru_count * nru_avg * 12

        # Step 5: NRI
        nri = gpr - vacancy - concessions - nru_loss - bad_debt

        # Step 6: Other income
        utility_reimb = inp.utility_reimb_per_unit * inp.total_units
        parking = inp.parking_income_per_unit * inp.total_units
        units = inp.total_units
        other_income = 0.0
        for item in inp.other_income_items:
            if item.amount_per_unit > 0:
                if item.input_mode == "per_unit_month":
                    other_income += item.amount_per_unit * 12 * units
                else:
                    other_income += item.amount_per_unit * units
            else:
                other_income += item.annual_income  # backward compat

        total_income = nri + utility_reimb + parking + other_income
        monthly_collections = total_income / 12 if total_income else 0.0

        return RevenueResult(
            gsr=gsr,
            gain_loss_to_lease=gain_loss_to_lease,
            gpr=gpr,
            vacancy=vacancy,
            concessions=concessions,
            nru_loss=nru_loss,
            bad_debt=bad_debt,
            nri=nri,
            utility_reimbursements=utility_reimb,
            parking_income=parking,
            other_income=other_income,
            total_income=total_income,
            monthly_collections=monthly_collections,
        )

    # ------------------------------------------------------------------
    # Step 7–10: Expenses
    # ------------------------------------------------------------------

    def _compute_expenses(self, revenue: RevenueResult, property_tax: Optional[float] = None) -> ExpenseResult:
        inp = self.inputs
        units = inp.total_units

        # Controllable expenses
        utilities = inp.utilities_per_unit * units
        repairs = inp.repairs_per_unit * units
        make_ready = inp.make_ready_per_unit * units
        marketing = inp.marketing_per_unit * units
        ga = inp.ga_per_unit * units

        # Contract services: use detail table sum if populated, else per-unit
        if inp.contract_services_items:
            contract_svc = sum(item.annual_total for item in inp.contract_services_items)
        else:
            contract_svc = inp.contract_services_per_unit * units

        # Payroll from detail table
        payroll = 0.0
        for p in inp.payroll_items:
            payroll += (p.salary + p.bonus) * (1 + p.payroll_load_pct)

        controllable = utilities + repairs + make_ready + contract_svc + marketing + payroll + ga

        # Non-controllable
        # Property taxes — use override if provided (scenario-dependent)
        property_taxes = property_tax if property_tax is not None else inp.current_tax_amount
        insurance = inp.insurance_per_unit * units

        # Management fee = % of Total Income (EGI)
        mgmt_fee = revenue.total_income * inp.mgmt_fee_pct

        non_controllable = property_taxes + insurance + mgmt_fee
        total_expenses = controllable + non_controllable

        return ExpenseResult(
            utilities=utilities,
            repairs_maintenance=repairs,
            make_ready=make_ready,
            contract_services=contract_svc,
            marketing=marketing,
            payroll=payroll,
            general_admin=ga,
            controllable_total=controllable,
            property_taxes=property_taxes,
            insurance=insurance,
            management_fee=mgmt_fee,
            non_controllable_total=non_controllable,
            total_expenses=total_expenses,
        )

    # ------------------------------------------------------------------
    # Step 11–13: Proforma
    # ------------------------------------------------------------------

    def _compute_proforma(
        self, revenue: RevenueResult, expenses: ExpenseResult
    ) -> ProformaResult:
        inp = self.inputs
        noi = revenue.total_income - expenses.total_expenses
        reserves = inp.reserves_per_unit * inp.total_units
        ncf = noi - reserves
        expense_ratio = (
            expenses.total_expenses / revenue.total_income
            if revenue.total_income > 0
            else 0.0
        )

        return ProformaResult(
            revenue=revenue,
            expenses=expenses,
            noi=noi,
            reserves=reserves,
            ncf=ncf,
            expense_ratio=expense_ratio,
        )

    # ------------------------------------------------------------------
    # Step 14–15: Debt
    # ------------------------------------------------------------------

    def _compute_debt(self, proforma: ProformaResult, scenario_key: str, purchase_price: float) -> DebtResult:
        inp = self.inputs

        if inp.la_enabled:
            return self._compute_debt_assumption(proforma)

        # LTV-based loan
        ltv_loan = purchase_price * inp.max_ltv

        # DSCR-constrained loan
        max_annual_ds = proforma.noi / inp.dscr_minimum if inp.dscr_minimum > 0 else float("inf")

        if inp.io_period_months >= inp.loan_term_months:
            # Full I/O — DSCR constraint: max_loan = max_ds / interest_rate
            dscr_loan = max_annual_ds / inp.interest_rate if inp.interest_rate > 0 else float("inf")
        else:
            # Amortizing — solve for loan amount where PMT = max_ds
            dscr_loan = self._solve_loan_from_payment(
                max_annual_ds, inp.interest_rate, inp.amort_years
            )

        loan_amount = min(ltv_loan, dscr_loan)
        is_dscr_constrained = dscr_loan < ltv_loan
        actual_ltv = loan_amount / purchase_price if purchase_price > 0 else 0.0
        equity = purchase_price - loan_amount

        # Annual debt service schedule
        hold = inp.hold_period_years
        annual_ds = []
        principal_outstanding = []

        for yr in range(1, hold + 1):
            months_start = (yr - 1) * 12 + 1
            months_end = yr * 12
            ds = self._annual_debt_service(
                loan_amount, inp.interest_rate, inp.io_period_months,
                inp.amort_years, months_start, months_end
            )
            annual_ds.append(ds)

            outstanding = self._outstanding_principal(
                loan_amount, inp.interest_rate, inp.io_period_months,
                inp.amort_years, months_end
            )
            principal_outstanding.append(outstanding)

        loan_constant = annual_ds[0] / loan_amount if loan_amount > 0 and annual_ds else 0.0

        return DebtResult(
            loan_amount=loan_amount,
            actual_ltv=actual_ltv,
            equity=equity,
            is_dscr_constrained=is_dscr_constrained,
            annual_debt_service=annual_ds,
            principal_outstanding=principal_outstanding,
            loan_constant=loan_constant,
        )

    def _compute_debt_assumption(self, proforma: ProformaResult) -> DebtResult:
        """Loan assumption mode."""
        inp = self.inputs
        loan_amount = inp.la_existing_balance
        equity = 0.0  # Computed per-scenario in DCF/returns

        hold = inp.hold_period_years
        annual_ds = []
        principal_outstanding = []

        for yr in range(1, hold + 1):
            months_start = (yr - 1) * 12 + 1
            months_end = yr * 12
            ds = self._annual_debt_service(
                inp.la_original_amount, inp.la_interest_rate,
                inp.la_remaining_io_months, inp.la_amort_years,
                months_start, months_end
            )
            annual_ds.append(ds)

            outstanding = self._outstanding_principal(
                inp.la_original_amount, inp.la_interest_rate,
                inp.la_remaining_io_months, inp.la_amort_years,
                months_end
            )
            principal_outstanding.append(outstanding)

        loan_constant = annual_ds[0] / loan_amount if loan_amount > 0 and annual_ds else 0.0

        return DebtResult(
            loan_amount=loan_amount,
            actual_ltv=0.0,
            equity=equity,
            is_dscr_constrained=False,
            annual_debt_service=annual_ds,
            principal_outstanding=principal_outstanding,
            loan_constant=loan_constant,
        )

    # ------------------------------------------------------------------
    # Step 16–17: DCF Projection (8 years)
    # ------------------------------------------------------------------

    def _compute_dcf(
        self, proforma: ProformaResult, debt: DebtResult, scenario_key: str, purchase_price: float
    ) -> DCFResult:
        inp = self.inputs
        hold = inp.hold_period_years
        units = inp.total_units

        # Y1 base values
        y1_gpr = proforma.revenue.gpr
        y1_util = proforma.revenue.utility_reimbursements
        y1_parking = proforma.revenue.parking_income
        y1_other = proforma.revenue.other_income
        y1_controllable = proforma.expenses.controllable_total
        y1_tax = proforma.expenses.property_taxes
        y1_insurance = proforma.expenses.insurance
        y1_reserves = proforma.reserves
        y1_total_income = proforma.revenue.total_income
        y1_noi = proforma.noi

        # Tax reassessment for this scenario (using millage_rate / 1000)
        if inp.property_tax_mode == "reassessment" and purchase_price > 0:
            fmv = purchase_price * inp.pct_of_purchase_assessed
            reassessed_tax = fmv * inp.assessment_ratio * (inp.millage_rate / 100)
        else:
            reassessed_tax = inp.current_tax_amount

        years: list[DCFYearResult] = []

        for yr_idx in range(hold):
            yr = yr_idx + 1
            vi = min(yr_idx, len(inp.vacancy_pct) - 1)
            ci = min(yr_idx, len(inp.concession_pct) - 1)
            bi = min(yr_idx, len(inp.bad_debt_pct) - 1)

            # Cumulative growth factors from Y1
            rental_growth = self._cumulative_growth(inp.rental_inflation, yr_idx)
            expense_growth = self._cumulative_growth(inp.expense_inflation, yr_idx)

            # Revenue
            gpr = y1_gpr * rental_growth
            vac_pct = inp.vacancy_pct[vi]
            con_pct = inp.concession_pct[ci]
            bd_pct = inp.bad_debt_pct[bi]

            vacancy = gpr * vac_pct
            concessions_val = gpr * con_pct
            bad_debt_val = gpr * bd_pct

            # NRU grows with rental inflation
            nru_avg = inp.nru_avg_rent
            if nru_avg <= 0 and inp.unit_mix:
                total_units_mix = sum(um.units for um in inp.unit_mix)
                if total_units_mix > 0:
                    nru_avg = sum(um.market_rent * um.units for um in inp.unit_mix) / total_units_mix
            nru_loss = inp.nru_count * nru_avg * 12 * rental_growth

            nri = gpr - vacancy - concessions_val - nru_loss - bad_debt_val
            util_reimb = y1_util * rental_growth
            parking = y1_parking * rental_growth
            other_inc = y1_other * rental_growth
            total_income = nri + util_reimb + parking + other_inc

            # Expenses
            controllable = y1_controllable * expense_growth

            # Property tax: use reassessed base, then grow from reassessment year
            if yr_idx == 0:
                if inp.property_tax_mode == "reassessment" and inp.reassessment_year <= 1:
                    prop_tax = reassessed_tax
                else:
                    prop_tax = y1_tax
            else:
                if inp.property_tax_mode == "reassessment" and yr <= inp.reassessment_year:
                    # Before reassessment, grow current tax
                    prop_tax = y1_tax * self._cumulative_growth(inp.re_tax_inflation, yr_idx)
                elif inp.property_tax_mode == "reassessment":
                    # After reassessment, grow from reassessed base
                    prop_tax = reassessed_tax * self._cumulative_growth_from(
                        inp.re_tax_inflation, inp.reassessment_year - 1, yr_idx
                    )
                else:
                    prop_tax = y1_tax * self._cumulative_growth(inp.re_tax_inflation, yr_idx)

            insurance = y1_insurance * expense_growth

            # Management fee = % of that year's total income
            mgmt_fee = total_income * inp.mgmt_fee_pct

            total_expenses = controllable + prop_tax + insurance + mgmt_fee
            noi = total_income - total_expenses

            # Reserves
            if inp.reserves_inflate:
                reserves = y1_reserves * expense_growth
            else:
                reserves = y1_reserves

            ncf = noi - reserves

            # Debt service
            ds = debt.annual_debt_service[yr_idx] if yr_idx < len(debt.annual_debt_service) else 0.0
            ncf_after_debt = ncf - ds

            # Metrics
            coc = ncf_after_debt / debt.equity if debt.equity > 0 else None
            dscr = noi / ds if ds > 0 else None
            rev_growth = (total_income - y1_total_income) / y1_total_income if y1_total_income > 0 and yr > 1 else (0.0 if yr == 1 else None)
            noi_growth = (noi - y1_noi) / y1_noi if y1_noi > 0 and yr > 1 else (0.0 if yr == 1 else None)
            eff_rent = total_income / (units * 12) if units > 0 else 0.0

            years.append(DCFYearResult(
                year=yr,
                gpr=gpr,
                vacancy=vacancy,
                concessions=concessions_val,
                bad_debt=bad_debt_val,
                nru_loss=nru_loss,
                nri=nri,
                other_income=util_reimb + parking + other_inc,
                total_income=total_income,
                controllable_expenses=controllable,
                property_taxes=prop_tax,
                insurance=insurance,
                management_fee=mgmt_fee,
                total_expenses=total_expenses,
                noi=noi,
                reserves=reserves,
                ncf=ncf,
                debt_service=ds,
                ncf_after_debt=ncf_after_debt,
                cash_on_cash=coc,
                dscr=dscr,
                revenue_growth_rate=rev_growth,
                noi_growth_rate=noi_growth,
                effective_rent=eff_rent,
            ))

        # CAGRs
        rev_cagr = None
        noi_cagr = None
        if len(years) >= 2:
            y1_rev = years[0].total_income
            yn_rev = years[-1].total_income
            y1_n = years[0].noi
            yn_n = years[-1].noi
            n = len(years) - 1
            if y1_rev > 0 and yn_rev > 0:
                rev_cagr = (yn_rev / y1_rev) ** (1 / n) - 1
            if y1_n > 0 and yn_n > 0:
                noi_cagr = (yn_n / y1_n) ** (1 / n) - 1

        return DCFResult(years=years, revenue_cagr=rev_cagr, noi_cagr=noi_cagr)

    # ------------------------------------------------------------------
    # Step 18–21: Returns
    # ------------------------------------------------------------------

    def _compute_returns(
        self, dcf: DCFResult, debt: DebtResult, scenario_key: str, purchase_price: float
    ) -> ReturnsResult:
        inp = self.inputs
        scenario = getattr(inp, scenario_key)

        if not dcf.years:
            return ReturnsResult()

        # Reversion (terminal year)
        exit_year = dcf.years[-1]
        last_ri = min(len(dcf.years) - 1, len(inp.rental_inflation) - 1)
        forward_noi = exit_year.noi * (1 + inp.rental_inflation[last_ri])

        terminal_cap = scenario.terminal_cap_rate
        gsp = forward_noi / terminal_cap if terminal_cap > 0 else 0.0
        sales_exp = gsp * inp.sales_expense_pct
        principal = (
            debt.principal_outstanding[-1]
            if debt.principal_outstanding
            else debt.loan_amount
        )
        net_proceeds = gsp - sales_exp - principal

        reversion = ReversionResult(
            forward_noi=forward_noi,
            gross_selling_price=gsp,
            sales_expenses=sales_exp,
            principal_outstanding=principal,
            net_proceeds=net_proceeds,
        )

        # Leveraged IRR: [-Equity, NCF1, NCF2, ..., NCFn + Net Proceeds]
        equity = debt.equity
        lev_cfs = [-equity]
        for i, yr in enumerate(dcf.years):
            cf = yr.ncf_after_debt
            if i == len(dcf.years) - 1:
                cf += net_proceeds
            lev_cfs.append(cf)

        levered_irr = self._solve_irr(lev_cfs)

        # Unleveraged IRR: [-Purchase Price, NOIAC1, ..., NOIACn + GSP - Sales Exp]
        unlev_cfs = [-purchase_price]
        for i, yr in enumerate(dcf.years):
            cf = yr.ncf  # NOI After Capital = NCF = NOI - Reserves
            if i == len(dcf.years) - 1:
                cf += gsp - sales_exp
            unlev_cfs.append(cf)

        unlevered_irr = self._solve_irr(unlev_cfs)

        # Cash-on-Cash
        y1_coc = dcf.years[0].ncf_after_debt / equity if equity > 0 else None
        coc_values = [yr.ncf_after_debt / equity for yr in dcf.years if equity > 0]
        avg_coc = sum(coc_values) / len(coc_values) if coc_values else None

        # Equity Multiple
        total_ncf = sum(yr.ncf_after_debt for yr in dcf.years)
        eq_multiple = (total_ncf + net_proceeds) / equity if equity > 0 else None

        return ReturnsResult(
            levered_irr=levered_irr,
            unlevered_irr=unlevered_irr,
            y1_cash_on_cash=y1_coc,
            avg_cash_on_cash=avg_coc,
            equity_multiple=eq_multiple,
            reversion=reversion,
        )

    # ------------------------------------------------------------------
    # Cap Rates
    # ------------------------------------------------------------------

    def _compute_cap_rates(
        self, proforma: ProformaResult, scenario_key: str, purchase_price: float
    ) -> CapRates:
        scenario = getattr(self.inputs, scenario_key)
        y1_cap = proforma.noi / purchase_price if purchase_price > 0 else None

        return CapRates(
            y1_cap_rate=y1_cap,
            terminal_cap_rate=scenario.terminal_cap_rate,
        )

    # ------------------------------------------------------------------
    # Valuation Summary
    # ------------------------------------------------------------------

    def _build_valuation_summary(
        self,
        proforma: ProformaResult,
        debt: DebtResult,
        dcf: DCFResult,
        returns: ReturnsResult,
        cap_rates: CapRates,
        scenario_key: str,
        purchase_price: float,
    ) -> ValuationSummary:
        inp = self.inputs
        units = inp.total_units
        sf = inp.total_sf

        # Avg market rent from unit mix
        total_mix_units = sum(um.units for um in inp.unit_mix)
        y1_market_rent = 0.0
        if total_mix_units > 0:
            y1_market_rent = sum(um.market_rent * um.units for um in inp.unit_mix) / total_mix_units
        avg_sf = sf / units if units > 0 else 0
        y1_rent_psf = y1_market_rent / avg_sf if avg_sf > 0 else 0.0

        return ValuationSummary(
            purchase_price=purchase_price,
            price_per_unit=purchase_price / units if units > 0 else 0.0,
            price_per_sf=purchase_price / sf if sf > 0 else 0.0,
            cap_rates=cap_rates,
            y1_market_rent=y1_market_rent,
            y1_market_rent_psf=y1_rent_psf,
            ltv=debt.actual_ltv,
            levered_irr=returns.levered_irr,
            unlevered_irr=returns.unlevered_irr,
            y1_cash_on_cash=returns.y1_cash_on_cash,
            avg_cash_on_cash=returns.avg_cash_on_cash,
            equity_multiple=returns.equity_multiple,
            terminal_value=returns.reversion.gross_selling_price,
            terminal_value_per_unit=(
                returns.reversion.gross_selling_price / units if units > 0 else 0.0
            ),
            revenue_cagr=dcf.revenue_cagr,
            noi_cagr=dcf.noi_cagr,
        )

    # ------------------------------------------------------------------
    # Operating Statement builder
    # ------------------------------------------------------------------

    def _build_operating_statement(self, proforma: ProformaResult) -> OperatingStatement:
        inp = self.inputs
        units = inp.total_units
        rev = proforma.revenue
        exp = proforma.expenses
        ti = rev.total_income

        def pct(val: float) -> Optional[float]:
            return val / ti if ti > 0 else None

        def pu(val: float) -> Optional[float]:
            return val / units if units > 0 else None

        def line(
            label: str,
            proforma_val: float,
            is_deduction: bool = False,
            is_total: bool = False,
            t12_val: Optional[float] = None,
            t3_val: Optional[float] = None,
        ) -> OperatingStatementLine:
            return OperatingStatementLine(
                label=label,
                t12_amount=t12_val,
                t12_pct_income=None,
                t12_per_unit=t12_val / units if t12_val is not None and units > 0 else None,
                t3_amount=t3_val,
                t3_pct_income=None,
                t3_per_unit=t3_val / units if t3_val is not None and units > 0 else None,
                proforma_amount=proforma_val,
                proforma_pct_income=pct(proforma_val),
                proforma_per_unit=pu(proforma_val),
                is_deduction=is_deduction,
                is_total=is_total,
            )

        # Build T12/T3 lookups from trailing data
        t12 = inp.trailing_t12 or {}
        t3 = inp.trailing_t3 or {}

        revenue_lines = [
            line("Gross Scheduled Rent", rev.gsr, t12_val=t12.get("gsr"), t3_val=t3.get("gsr")),
            line("Gain/Loss to Lease", rev.gain_loss_to_lease, is_deduction=True, t12_val=t12.get("loss_to_lease"), t3_val=t3.get("loss_to_lease")),
            line("Gross Potential Rent", rev.gpr, is_total=True),
            line("Less: Vacancy", rev.vacancy, is_deduction=True, t12_val=t12.get("vacancy"), t3_val=t3.get("vacancy")),
            line("Less: Concessions", rev.concessions, is_deduction=True, t12_val=t12.get("concessions"), t3_val=t3.get("concessions")),
            line("Less: Non-Revenue Units", rev.nru_loss, is_deduction=True),
            line("Less: Bad Debt", rev.bad_debt, is_deduction=True, t12_val=t12.get("bad_debt")),
            line("Net Rental Income", rev.nri, is_total=True, t12_val=t12.get("net_rental_income"), t3_val=t3.get("net_rental_income")),
            line("Utility Reimbursements", rev.utility_reimbursements, t12_val=t12.get("utility_reimbursements")),
            line("Parking/Storage Income", rev.parking_income, t12_val=t12.get("parking_storage_income")),
            line("Other Income", rev.other_income, t12_val=t12.get("other_income"), t3_val=t3.get("other_income")),
            line("Total Income", rev.total_income, is_total=True),
        ]

        expense_lines = [
            line("Utilities", exp.utilities),
            line("Repairs & Maintenance", exp.repairs_maintenance),
            line("Apartment Make Ready", exp.make_ready),
            line("Contract Services", exp.contract_services),
            line("Marketing", exp.marketing),
            line("Payroll Expenses", exp.payroll),
            line("General & Administrative", exp.general_admin),
            line("Controllable Expenses", exp.controllable_total, is_total=True),
            line("Property Taxes", exp.property_taxes, t12_val=t12.get("real_estate_taxes")),
            line("Insurance", exp.insurance, t12_val=t12.get("insurance_amount")),
            line("Management Fee", exp.management_fee),
            line("Non-Controllable Expenses", exp.non_controllable_total, is_total=True),
            line("Total Operating Expenses", exp.total_expenses, is_total=True, t12_val=t12.get("total_opex")),
        ]

        summary_lines = [
            line("Net Operating Income", proforma.noi, is_total=True, t12_val=t12.get("noi")),
            line("Replacement Reserves", proforma.reserves, is_deduction=True),
            line("Net Cash Flow", proforma.ncf, is_total=True),
        ]

        return OperatingStatement(
            revenue_lines=revenue_lines,
            expense_lines=expense_lines,
            summary_lines=summary_lines,
        )

    # ------------------------------------------------------------------
    # Financial Math Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _pmt(rate_monthly: float, nper: int, pv: float) -> float:
        """Standard PMT formula — returns positive payment amount."""
        if rate_monthly == 0:
            return pv / nper if nper > 0 else 0.0
        return pv * (rate_monthly * (1 + rate_monthly) ** nper) / ((1 + rate_monthly) ** nper - 1)

    @staticmethod
    def _solve_loan_from_payment(annual_payment: float, annual_rate: float, amort_years: int) -> float:
        """Given max annual payment, solve for loan amount (PV of annuity)."""
        monthly_rate = annual_rate / 12
        nper = amort_years * 12
        monthly_payment = annual_payment / 12
        if monthly_rate == 0:
            return monthly_payment * nper
        return monthly_payment * ((1 + monthly_rate) ** nper - 1) / (monthly_rate * (1 + monthly_rate) ** nper)

    def _annual_debt_service(
        self,
        loan_amount: float,
        annual_rate: float,
        io_months: int,
        amort_years: int,
        months_start: int,
        months_end: int,
    ) -> float:
        """Compute debt service for a range of months (1-indexed)."""
        monthly_rate = annual_rate / 12
        total_ds = 0.0

        for m in range(months_start, months_end + 1):
            if m <= io_months:
                # Interest-only
                total_ds += loan_amount * monthly_rate
            else:
                # Amortizing
                nper = amort_years * 12
                total_ds += self._pmt(monthly_rate, nper, loan_amount)

        return total_ds

    def _outstanding_principal(
        self,
        loan_amount: float,
        annual_rate: float,
        io_months: int,
        amort_years: int,
        at_month: int,
    ) -> float:
        """Compute outstanding principal at a given month."""
        if at_month <= io_months:
            return loan_amount

        # Months into amortization
        amort_months_elapsed = at_month - io_months
        monthly_rate = annual_rate / 12
        nper = amort_years * 12

        if monthly_rate == 0:
            payment = loan_amount / nper if nper > 0 else 0
            return max(0, loan_amount - payment * amort_months_elapsed)

        payment = self._pmt(monthly_rate, nper, loan_amount)
        # Remaining balance = PV of remaining payments
        remaining = nper - amort_months_elapsed
        if remaining <= 0:
            return 0.0
        balance = payment * ((1 + monthly_rate) ** remaining - 1) / (monthly_rate * (1 + monthly_rate) ** remaining)
        return max(0.0, balance)

    @staticmethod
    def _cumulative_growth(rates: list[float], year_index: int) -> float:
        """Compute cumulative growth factor from Y1. year_index=0 means Y1 (factor=1.0)."""
        factor = 1.0
        for i in range(year_index):
            ri = min(i, len(rates) - 1)
            factor *= (1 + rates[ri])
        return factor

    @staticmethod
    def _cumulative_growth_from(rates: list[float], from_idx: int, to_idx: int) -> float:
        """Compute cumulative growth factor between two year indices."""
        factor = 1.0
        for i in range(from_idx, to_idx):
            ri = min(i, len(rates) - 1)
            factor *= (1 + rates[ri])
        return factor

    @staticmethod
    def _solve_irr(cash_flows: list[float], max_iter: int = 100, tol: float = 1e-6) -> Optional[float]:
        """
        Solve IRR using Newton's method.
        Returns None if solver fails to converge.
        """
        if not cash_flows or len(cash_flows) < 2:
            return None

        # Initial guess
        r = 0.10

        for _ in range(max_iter):
            npv = 0.0
            dnpv = 0.0
            for t, cf in enumerate(cash_flows):
                denom = (1 + r) ** t
                if denom == 0:
                    return None
                npv += cf / denom
                if t > 0:
                    dnpv -= t * cf / ((1 + r) ** (t + 1))

            if abs(dnpv) < 1e-14:
                # Derivative too small, try bisection fallback
                return UnderwritingEngine._solve_irr_bisection(cash_flows)

            r_new = r - npv / dnpv

            if abs(r_new - r) < tol:
                return r_new

            r = r_new

            # Guard against divergence
            if abs(r) > 10:
                return UnderwritingEngine._solve_irr_bisection(cash_flows)

        # Newton didn't converge, try bisection
        return UnderwritingEngine._solve_irr_bisection(cash_flows)

    @staticmethod
    def _solve_irr_bisection(
        cash_flows: list[float], lo: float = -0.5, hi: float = 5.0, max_iter: int = 200, tol: float = 1e-6
    ) -> Optional[float]:
        """Bisection fallback for IRR."""
        def npv_at(r: float) -> float:
            return sum(cf / (1 + r) ** t for t, cf in enumerate(cash_flows))

        npv_lo = npv_at(lo)
        npv_hi = npv_at(hi)

        if npv_lo * npv_hi > 0:
            return None  # No sign change — IRR not in range

        for _ in range(max_iter):
            mid = (lo + hi) / 2
            npv_mid = npv_at(mid)

            if abs(npv_mid) < tol or (hi - lo) / 2 < tol:
                return mid

            if npv_mid * npv_lo < 0:
                hi = mid
            else:
                lo = mid
                npv_lo = npv_mid

        return (lo + hi) / 2
