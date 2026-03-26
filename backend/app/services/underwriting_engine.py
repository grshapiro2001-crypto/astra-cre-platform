"""
Underwriting Engine V2 — Pure calculation module.

Takes a typed UWInputs and returns UWOutputs. No database or API dependencies.
V2 improvements over V1:
  - Deductions computed as % of Total GPI (includes renovation premiums)
  - Non-flat inflation curves (year-by-year arrays)
  - Mgmt fee recalculated each DCF year as % of that year's income
  - Terminal value = Y(n+1) NOI After Capital / terminal cap rate
  - LTC-based debt sizing when renovation is capitalized
  - Closed-form tax circularity solution for direct-cap pricing
  - Bisection IRR solver from irr_solver module
"""

from __future__ import annotations

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
from app.services.irr_solver import solve_irr


class UnderwritingEngine:
    """Stateless V2 underwriting calculation engine."""

    def __init__(self, inputs: UWInputs):
        self.inputs = inputs
        self._total_units = inputs.total_units if inputs.total_units > 0 else 1
        self._total_sf = inputs.total_sf if inputs.total_sf > 0 else 1

        # Pre-compute weighted average rents from unit mix
        mix_units = sum(um.units for um in inputs.unit_mix) or 1
        self._avg_market_rent = (
            sum(um.market_rent * um.units for um in inputs.unit_mix) / mix_units
            if inputs.unit_mix else 0.0
        )
        self._avg_inplace_rent = (
            sum(um.inplace_rent * um.units for um in inputs.unit_mix) / mix_units
            if inputs.unit_mix else 0.0
        )

    # ------------------------------------------------------------------
    # Revenue Waterfall
    # ------------------------------------------------------------------

    def _compute_revenue(self) -> RevenueResult:
        """Compute Year-1 revenue waterfall.

        Key V2 change: deductions (vacancy, concessions, bad debt) are
        applied as a percentage of **Total GPI** (GSR + renovation premiums),
        NOT of base GPR.
        """
        inp = self.inputs
        units = self._total_units

        # ── Step 1: GSR from unit mix ──
        # Always use market rent as the base scheduled rent
        gsr = 0.0
        for um in inp.unit_mix:
            gsr += um.market_rent * um.units * 12

        # ── Step 2: Gain/Loss to Lease (renovation premiums) ──
        # When rent_basis is "inplace", tenants are paying below market.
        # The renovation premium captures the expected recapture of the
        # gap between inplace and market rent via lease turnover.
        #   blended_capture = retention × renewal_bump + (1 − retention) × 1.0
        #   gain_loss = Σ (inplace − market) × units × 12 × (1 − blended_capture)
        # This is negative when inplace < market (a "loss to lease").
        gain_loss_to_lease = 0.0
        if inp.rent_basis == "inplace":
            blended_capture = (
                inp.retention_ratio * inp.renewal_rent_bump
                + (1 - inp.retention_ratio) * 1.0
            )
            for um in inp.unit_mix:
                gap = um.inplace_rent - um.market_rent
                gain_loss_to_lease += gap * um.units * 12 * (1 - blended_capture)

        # ── Step 3: GPR / GPI ──
        gpr = gsr + gain_loss_to_lease
        # Total GPI is the base for deduction percentages in V2
        total_gpi = gpr

        # ── Step 4: Deductions as % of Total GPI ──
        vacancy = total_gpi * inp.vacancy_pct[0]
        concessions = total_gpi * inp.concession_pct[0]
        bad_debt = total_gpi * inp.bad_debt_pct[0]

        # Non-revenue units
        nru_avg = inp.nru_avg_rent
        if nru_avg <= 0 and inp.unit_mix:
            nru_avg = self._avg_market_rent
        nru_loss = inp.nru_count * nru_avg * 12

        # ── Step 5: NRI ──
        nri = gpr - vacancy - concessions - nru_loss - bad_debt

        # ── Step 6: Other income ──
        utility_reimb = inp.utility_reimb_per_unit * units
        parking = inp.parking_income_per_unit * units

        other_income = 0.0
        for item in inp.other_income_items:
            if item.amount_per_unit > 0:
                if item.input_mode == "per_unit_month":
                    other_income += item.amount_per_unit * 12 * units
                else:
                    other_income += item.amount_per_unit * units
            else:
                other_income += item.annual_income

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
    # Expenses
    # ------------------------------------------------------------------

    def _compute_expenses(
        self,
        revenue: RevenueResult,
        purchase_price: float = 0.0,
    ) -> ExpenseResult:
        """Compute Year-1 operating expenses.

        Property tax is scenario-dependent:
          tax = price × pct_assessed × assessment_ratio × (millage_rate / 100)
        Management fee = mgmt_fee_pct × total income (EGI).
        """
        inp = self.inputs
        units = self._total_units

        # ── Controllable expenses (all $/unit lines) ──
        utilities = inp.utilities_per_unit * units
        repairs = inp.repairs_per_unit * units
        make_ready = inp.make_ready_per_unit * units
        marketing = inp.marketing_per_unit * units
        ga = inp.ga_per_unit * units

        # Contract services: detail table sum if populated, else per-unit
        if inp.contract_services_items:
            contract_svc = sum(item.annual_total for item in inp.contract_services_items)
        else:
            contract_svc = inp.contract_services_per_unit * units

        # Payroll from detail table
        payroll = 0.0
        for p in inp.payroll_items:
            payroll += (p.salary + p.bonus) * (1 + p.payroll_load_pct)

        controllable = (
            utilities + repairs + make_ready + contract_svc
            + marketing + payroll + ga
        )

        # ── Non-controllable expenses ──

        # Property taxes — scenario-dependent via purchase price
        if (
            inp.property_tax_mode == "reassessment"
            and purchase_price > 0
        ):
            fmv = purchase_price * inp.pct_of_purchase_assessed
            assessed = fmv * inp.assessment_ratio
            property_taxes = assessed * (inp.millage_rate / 100)
        else:
            property_taxes = inp.current_tax_amount

        # Insurance
        insurance = inp.insurance_per_unit * units

        # Management fee = % of total income (EGI)
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
    # Proforma (helper — combines revenue + expenses)
    # ------------------------------------------------------------------

    def _compute_proforma(
        self, revenue: RevenueResult, expenses: ExpenseResult
    ) -> ProformaResult:
        inp = self.inputs
        noi = revenue.total_income - expenses.total_expenses
        reserves = inp.reserves_per_unit * self._total_units
        ncf = noi - reserves
        expense_ratio = (
            expenses.total_expenses / revenue.total_income
            if revenue.total_income > 0 else 0.0
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
    # DCF Projection (non-flat inflation curves)
    # ------------------------------------------------------------------

    def _compute_dcf(
        self,
        proforma: ProformaResult,
        debt: DebtResult,
        scenario_key: str,
        purchase_price: float,
    ) -> DCFResult:
        """Project cash flows over the hold period using year-by-year arrays.

        V2 key differences from V1:
          - Revenue grows at rental_inflation[year] (not a single rate)
          - Expenses grow at expense_inflation[year]
          - Taxes grow at re_tax_inflation[year]
          - Mgmt fee is RECALCULATED each year as % of that year's income
          - Deductions (vacancy, concessions, bad debt) use per-year arrays
            applied to that year's GPI
        """
        inp = self.inputs
        hold = inp.hold_period_years
        units = self._total_units

        # Y1 base values from proforma
        y1_gpr = proforma.revenue.gpr
        y1_util = proforma.revenue.utility_reimbursements
        y1_parking = proforma.revenue.parking_income
        y1_other = proforma.revenue.other_income
        y1_controllable = proforma.expenses.controllable_total
        y1_tax = proforma.expenses.property_taxes
        y1_insurance = proforma.expenses.insurance
        y1_reserves = proforma.reserves

        years: list[DCFYearResult] = []
        prev_total_income: Optional[float] = None
        prev_noi: Optional[float] = None

        for yr_idx in range(hold):
            yr = yr_idx + 1

            # ── Cumulative growth factors (year-by-year arrays) ──
            rental_gf = self._cumulative_growth(inp.rental_inflation, yr_idx)
            expense_gf = self._cumulative_growth(inp.expense_inflation, yr_idx)
            tax_gf = self._cumulative_growth(inp.re_tax_inflation, yr_idx)

            # ── Revenue ──
            gpr = y1_gpr * rental_gf

            # Deductions: per-year pct arrays applied to GPI
            vi = min(yr_idx, len(inp.vacancy_pct) - 1)
            ci = min(yr_idx, len(inp.concession_pct) - 1)
            bi = min(yr_idx, len(inp.bad_debt_pct) - 1)

            vacancy = gpr * inp.vacancy_pct[vi]
            concessions_val = gpr * inp.concession_pct[ci]
            bad_debt_val = gpr * inp.bad_debt_pct[bi]

            # NRU loss grows with rental inflation
            nru_avg = inp.nru_avg_rent
            if nru_avg <= 0 and inp.unit_mix:
                nru_avg = self._avg_market_rent
            nru_loss = inp.nru_count * nru_avg * 12 * rental_gf

            nri = gpr - vacancy - concessions_val - nru_loss - bad_debt_val

            # Other income grows with rental inflation
            util_reimb = y1_util * rental_gf
            parking = y1_parking * rental_gf
            other_inc = y1_other * rental_gf
            total_income = nri + util_reimb + parking + other_inc

            # ── Expenses ──
            # Controllable: grows at expense_inflation[year]
            controllable = y1_controllable * expense_gf

            # Property taxes: grows at re_tax_inflation[year]
            # If reassessment mode, use reassessed base from Y1 proforma
            prop_tax = y1_tax * tax_gf

            # Insurance: grows at expense_inflation[year]
            insurance = y1_insurance * expense_gf

            # Management fee: RECALCULATED each year as % of that year's income
            mgmt_fee = total_income * inp.mgmt_fee_pct

            total_expenses = controllable + prop_tax + insurance + mgmt_fee

            # ── Bottom line ──
            noi = total_income - total_expenses

            # Reserves
            if inp.reserves_inflate:
                reserves = y1_reserves * expense_gf
            else:
                reserves = y1_reserves

            ncf = noi - reserves

            # Debt service
            ds = (
                debt.annual_debt_service[yr_idx]
                if yr_idx < len(debt.annual_debt_service) else 0.0
            )
            ncf_after_debt = ncf - ds

            # ── Per-year metrics ──
            coc = ncf_after_debt / debt.equity if debt.equity > 0 else None
            dscr = noi / ds if ds > 0 else None

            rev_growth = None
            if prev_total_income is not None and prev_total_income > 0:
                rev_growth = (total_income - prev_total_income) / prev_total_income
            elif yr == 1:
                rev_growth = 0.0

            noi_growth = None
            if prev_noi is not None and prev_noi > 0:
                noi_growth = (noi - prev_noi) / prev_noi
            elif yr == 1:
                noi_growth = 0.0

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

            prev_total_income = total_income
            prev_noi = noi

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
    # Terminal Value & Reversion
    # ------------------------------------------------------------------

    def _compute_reversion(
        self,
        dcf: DCFResult,
        debt: DebtResult,
        scenario_key: str,
    ) -> ReversionResult:
        """Compute terminal value and net sale proceeds.

        Terminal Value = Y(n+1) NOI After Capital / terminal cap rate
        where Y(n+1) NOI After Capital is the forward year's NCF
        (NOI minus reserves, grown one more year from the last hold year).
        """
        inp = self.inputs
        scenario = getattr(inp, scenario_key)

        if not dcf.years:
            return ReversionResult()

        last_year = dcf.years[-1]
        last_yr_idx = len(dcf.years) - 1

        # Forward (Y n+1) NOI: grow last year's NOI by one more year
        # Use the next rental_inflation rate for revenue, expense_inflation
        # for expenses, and re_tax_inflation for taxes
        fwd_rental_gf = self._cumulative_growth(inp.rental_inflation, last_yr_idx + 1)
        fwd_expense_gf = self._cumulative_growth(inp.expense_inflation, last_yr_idx + 1)
        fwd_tax_gf = self._cumulative_growth(inp.re_tax_inflation, last_yr_idx + 1)

        # Rebuild forward year revenue
        y1_gpr = dcf.years[0].gpr / self._cumulative_growth(inp.rental_inflation, 0)  # = Y1 base
        fwd_gpr = y1_gpr * fwd_rental_gf

        # Forward year deduction rates: clamp to last available index
        vi = min(last_yr_idx + 1, len(inp.vacancy_pct) - 1)
        ci = min(last_yr_idx + 1, len(inp.concession_pct) - 1)
        bi = min(last_yr_idx + 1, len(inp.bad_debt_pct) - 1)

        fwd_vacancy = fwd_gpr * inp.vacancy_pct[vi]
        fwd_concessions = fwd_gpr * inp.concession_pct[ci]
        fwd_bad_debt = fwd_gpr * inp.bad_debt_pct[bi]

        nru_avg = inp.nru_avg_rent
        if nru_avg <= 0 and inp.unit_mix:
            nru_avg = self._avg_market_rent
        fwd_nru = inp.nru_count * nru_avg * 12 * fwd_rental_gf

        fwd_nri = fwd_gpr - fwd_vacancy - fwd_concessions - fwd_nru - fwd_bad_debt

        # Forward other income
        y1_util = dcf.years[0].other_income / self._cumulative_growth(inp.rental_inflation, 0) if dcf.years else 0.0
        fwd_other = y1_util * fwd_rental_gf if y1_util else 0.0
        # Simpler: scale last year's other income by one more year of rental inflation
        ri = min(last_yr_idx, len(inp.rental_inflation) - 1)
        fwd_other = last_year.other_income * (1 + inp.rental_inflation[ri])

        fwd_total_income = fwd_nri + fwd_other

        # Forward expenses
        y1_controllable = dcf.years[0].controllable_expenses
        fwd_controllable = y1_controllable * fwd_expense_gf

        y1_tax = dcf.years[0].property_taxes
        fwd_tax = y1_tax * fwd_tax_gf

        y1_insurance = dcf.years[0].insurance
        fwd_insurance = y1_insurance * fwd_expense_gf

        # Mgmt fee recalculated on forward year income
        fwd_mgmt = fwd_total_income * inp.mgmt_fee_pct

        fwd_total_expenses = fwd_controllable + fwd_tax + fwd_insurance + fwd_mgmt
        fwd_noi = fwd_total_income - fwd_total_expenses

        # Forward reserves
        if inp.reserves_inflate:
            fwd_reserves = (inp.reserves_per_unit * self._total_units) * fwd_expense_gf
        else:
            fwd_reserves = inp.reserves_per_unit * self._total_units

        # Y(n+1) NOI After Capital
        forward_noi_after_capital = fwd_noi - fwd_reserves

        # Terminal value
        terminal_cap = scenario.terminal_cap_rate
        gsp = forward_noi_after_capital / terminal_cap if terminal_cap > 0 else 0.0
        sales_exp = gsp * inp.sales_expense_pct

        principal = (
            debt.principal_outstanding[-1]
            if debt.principal_outstanding
            else debt.loan_amount
        )
        net_proceeds = gsp - sales_exp - principal

        return ReversionResult(
            forward_noi=forward_noi_after_capital,
            gross_selling_price=gsp,
            sales_expenses=sales_exp,
            principal_outstanding=principal,
            net_proceeds=net_proceeds,
        )

    # ------------------------------------------------------------------
    # Growth helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _cumulative_growth(rates: list[float], year_index: int) -> float:
        """Cumulative growth factor from Y1. year_index=0 → factor=1.0.

        Uses the year-by-year array: factor = Π (1 + rates[i]) for i in 0..year_index-1.
        Clamps to the last rate if the array is shorter than the hold period.
        """
        factor = 1.0
        for i in range(year_index):
            ri = min(i, len(rates) - 1)
            factor *= (1 + rates[ri])
        return factor

    # ------------------------------------------------------------------
    # Debt Sizing
    # ------------------------------------------------------------------

    def _compute_debt(
        self,
        proforma: ProformaResult,
        scenario_key: str,
        purchase_price: float,
    ) -> DebtResult:
        """Size the loan and build a debt service schedule.

        Supports:
          - LTV-based sizing (standard)
          - DSCR constraint (binding unless assume_max_ltv)
          - Full I/O and amortizing periods
          - Loan assumption mode (la_enabled)
        """
        inp = self.inputs

        if inp.la_enabled:
            return self._compute_debt_assumption()

        # ── LTV-based loan ──
        ltv_loan = purchase_price * inp.max_ltv

        # ── DSCR-constrained loan ──
        max_annual_ds = (
            proforma.noi / inp.dscr_minimum if inp.dscr_minimum > 0 else float("inf")
        )

        if inp.io_period_months >= inp.loan_term_months:
            # Full I/O: DS = loan × rate → max_loan = max_ds / rate
            dscr_loan = (
                max_annual_ds / inp.interest_rate
                if inp.interest_rate > 0 else float("inf")
            )
        else:
            # Amortizing: solve PV of annuity for max_ds
            dscr_loan = self._solve_loan_from_payment(
                max_annual_ds, inp.interest_rate, inp.amort_years
            )

        loan_amount = min(ltv_loan, dscr_loan)
        is_dscr_constrained = dscr_loan < ltv_loan
        actual_ltv = loan_amount / purchase_price if purchase_price > 0 else 0.0
        equity = purchase_price - loan_amount

        # ── Debt service schedule ──
        hold = inp.hold_period_years
        annual_ds: list[float] = []
        principal_outstanding: list[float] = []

        for yr in range(1, hold + 1):
            ms = (yr - 1) * 12 + 1
            me = yr * 12
            ds = self._annual_debt_service(
                loan_amount, inp.interest_rate,
                inp.io_period_months, inp.amort_years, ms, me,
            )
            annual_ds.append(ds)

            outstanding = self._outstanding_principal(
                loan_amount, inp.interest_rate,
                inp.io_period_months, inp.amort_years, me,
            )
            principal_outstanding.append(outstanding)

        loan_constant = (
            annual_ds[0] / loan_amount if loan_amount > 0 and annual_ds else 0.0
        )

        return DebtResult(
            loan_amount=loan_amount,
            actual_ltv=actual_ltv,
            equity=equity,
            is_dscr_constrained=is_dscr_constrained,
            annual_debt_service=annual_ds,
            principal_outstanding=principal_outstanding,
            loan_constant=loan_constant,
        )

    def _compute_debt_assumption(self) -> DebtResult:
        """Loan assumption mode — use existing loan parameters."""
        inp = self.inputs
        loan_amount = inp.la_existing_balance

        hold = inp.hold_period_years
        annual_ds: list[float] = []
        principal_outstanding: list[float] = []

        for yr in range(1, hold + 1):
            ms = (yr - 1) * 12 + 1
            me = yr * 12
            ds = self._annual_debt_service(
                inp.la_original_amount, inp.la_interest_rate,
                inp.la_remaining_io_months, inp.la_amort_years, ms, me,
            )
            annual_ds.append(ds)

            outstanding = self._outstanding_principal(
                inp.la_original_amount, inp.la_interest_rate,
                inp.la_remaining_io_months, inp.la_amort_years, me,
            )
            principal_outstanding.append(outstanding)

        loan_constant = (
            annual_ds[0] / loan_amount if loan_amount > 0 and annual_ds else 0.0
        )

        return DebtResult(
            loan_amount=loan_amount,
            actual_ltv=0.0,
            equity=0.0,
            is_dscr_constrained=False,
            annual_debt_service=annual_ds,
            principal_outstanding=principal_outstanding,
            loan_constant=loan_constant,
        )

    # ------------------------------------------------------------------
    # Financial math helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _pmt(rate_monthly: float, nper: int, pv: float) -> float:
        """Standard PMT — returns positive payment amount."""
        if rate_monthly == 0:
            return pv / nper if nper > 0 else 0.0
        return pv * (rate_monthly * (1 + rate_monthly) ** nper) / (
            (1 + rate_monthly) ** nper - 1
        )

    @staticmethod
    def _solve_loan_from_payment(
        annual_payment: float, annual_rate: float, amort_years: int
    ) -> float:
        """Given max annual payment, solve for loan amount (PV of annuity)."""
        mr = annual_rate / 12
        nper = amort_years * 12
        mp = annual_payment / 12
        if mr == 0:
            return mp * nper
        return mp * ((1 + mr) ** nper - 1) / (mr * (1 + mr) ** nper)

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
        mr = annual_rate / 12
        total_ds = 0.0
        for m in range(months_start, months_end + 1):
            if m <= io_months:
                total_ds += loan_amount * mr
            else:
                nper = amort_years * 12
                total_ds += self._pmt(mr, nper, loan_amount)
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
        amort_elapsed = at_month - io_months
        mr = annual_rate / 12
        nper = amort_years * 12
        if mr == 0:
            payment = loan_amount / nper if nper > 0 else 0
            return max(0, loan_amount - payment * amort_elapsed)
        payment = self._pmt(mr, nper, loan_amount)
        remaining = nper - amort_elapsed
        if remaining <= 0:
            return 0.0
        balance = payment * ((1 + mr) ** remaining - 1) / (mr * (1 + mr) ** remaining)
        return max(0.0, balance)

    # ------------------------------------------------------------------
    # Returns (IRR, Cash-on-Cash, Equity Multiple)
    # ------------------------------------------------------------------

    def _compute_returns(
        self,
        dcf: DCFResult,
        debt: DebtResult,
        reversion: ReversionResult,
        purchase_price: float,
    ) -> ReturnsResult:
        """Compute levered/unlevered IRR, CoC, equity multiple."""
        if not dcf.years:
            return ReturnsResult()

        equity = debt.equity
        gsp = reversion.gross_selling_price
        sales_exp = reversion.sales_expenses
        net_proceeds = reversion.net_proceeds

        # Levered IRR: [−Equity, NCF_after_debt₁…ₙ₋₁, NCFₙ + net_proceeds]
        lev_cfs = [-equity]
        for i, yr in enumerate(dcf.years):
            cf = yr.ncf_after_debt
            if i == len(dcf.years) - 1:
                cf += net_proceeds
            lev_cfs.append(cf)
        levered_irr = solve_irr(lev_cfs)

        # Unlevered IRR: [−Price, NCF₁…ₙ₋₁, NCFₙ + GSP − sales_exp]
        unlev_cfs = [-purchase_price]
        for i, yr in enumerate(dcf.years):
            cf = yr.ncf
            if i == len(dcf.years) - 1:
                cf += gsp - sales_exp
            unlev_cfs.append(cf)
        unlevered_irr = solve_irr(unlev_cfs)

        # Cash-on-Cash
        y1_coc = dcf.years[0].ncf_after_debt / equity if equity > 0 else None
        coc_vals = [yr.ncf_after_debt / equity for yr in dcf.years if equity > 0]
        avg_coc = sum(coc_vals) / len(coc_vals) if coc_vals else None

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
        purchase_price: float,
    ) -> ValuationSummary:
        units = self._total_units
        sf = self._total_sf
        avg_sf = sf / units if units > 0 else 0
        y1_rent_psf = self._avg_market_rent / avg_sf if avg_sf > 0 else 0.0

        return ValuationSummary(
            purchase_price=purchase_price,
            price_per_unit=purchase_price / units if units > 0 else 0.0,
            price_per_sf=purchase_price / sf if sf > 0 else 0.0,
            cap_rates=cap_rates,
            y1_market_rent=self._avg_market_rent,
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
        units = self._total_units
        rev = proforma.revenue
        exp = proforma.expenses
        ti = rev.total_income

        def pct(val: float) -> Optional[float]:
            return val / ti if ti > 0 else None

        def pu(val: float) -> Optional[float]:
            return val / units if units > 0 else None

        def ln(
            label: str,
            pf_val: float,
            is_deduction: bool = False,
            is_total: bool = False,
            t12_val: Optional[float] = None,
            t3_val: Optional[float] = None,
        ) -> OperatingStatementLine:
            # Normalize sign: deduction rows show positive values (the "Less:" label conveys subtraction)
            if is_deduction:
                if t12_val is not None:
                    t12_val = abs(t12_val)
                if t3_val is not None:
                    t3_val = abs(t3_val)
            return OperatingStatementLine(
                label=label,
                t12_amount=t12_val,
                t12_pct_income=None,
                t12_per_unit=t12_val / units if t12_val is not None and units > 0 else None,
                t3_amount=t3_val,
                t3_pct_income=None,
                t3_per_unit=t3_val / units if t3_val is not None and units > 0 else None,
                proforma_amount=pf_val,
                proforma_pct_income=pct(pf_val),
                proforma_per_unit=pu(pf_val),
                is_deduction=is_deduction,
                is_total=is_total,
            )

        t12 = inp.trailing_t12 or {}
        t3 = inp.trailing_t3 or {}

        revenue_lines = [
            ln("Gross Scheduled Rent", rev.gsr, t12_val=t12.get("gsr"), t3_val=t3.get("gsr")),
            ln("Gain/Loss to Lease", rev.gain_loss_to_lease, is_deduction=True, t12_val=t12.get("loss_to_lease"), t3_val=t3.get("loss_to_lease")),
            ln("Gross Potential Rent", rev.gpr, is_total=True),
            ln("Less: Vacancy", rev.vacancy, is_deduction=True, t12_val=t12.get("vacancy"), t3_val=t3.get("vacancy")),
            ln("Less: Concessions", rev.concessions, is_deduction=True, t12_val=t12.get("concessions"), t3_val=t3.get("concessions")),
            ln("Less: Non-Revenue Units", rev.nru_loss, is_deduction=True),
            ln("Less: Bad Debt", rev.bad_debt, is_deduction=True, t12_val=t12.get("bad_debt")),
            ln("Net Rental Income", rev.nri, is_total=True, t12_val=t12.get("net_rental_income"), t3_val=t3.get("net_rental_income")),
            ln("Utility Reimbursements", rev.utility_reimbursements, t12_val=t12.get("utility_reimbursements")),
            ln("Parking/Storage Income", rev.parking_income, t12_val=t12.get("parking_storage_income")),
            ln("Other Income", rev.other_income, t12_val=t12.get("other_income"), t3_val=t3.get("other_income")),
            ln("Total Income", rev.total_income, is_total=True),
        ]

        expense_lines = [
            ln("Utilities", exp.utilities, t12_val=t12.get("utilities")),
            ln("Repairs & Maintenance", exp.repairs_maintenance, t12_val=t12.get("repairs_maintenance")),
            ln("Apartment Make Ready", exp.make_ready, t12_val=t12.get("turnover")),
            ln("Contract Services", exp.contract_services, t12_val=t12.get("contract_services")),
            ln("Marketing", exp.marketing, t12_val=t12.get("marketing")),
            ln("Payroll Expenses", exp.payroll, t12_val=t12.get("payroll")),
            ln("General & Administrative", exp.general_admin, t12_val=t12.get("administrative")),
            ln("Controllable Expenses", exp.controllable_total, is_total=True),
            ln("Property Taxes", exp.property_taxes, t12_val=t12.get("real_estate_taxes")),
            ln("Insurance", exp.insurance, t12_val=t12.get("insurance_amount")),
            ln("Management Fee", exp.management_fee, t12_val=t12.get("management_fee_amount")),
            ln("Non-Controllable Expenses", exp.non_controllable_total, is_total=True),
            ln("Total Operating Expenses", exp.total_expenses, is_total=True, t12_val=t12.get("total_opex")),
        ]

        summary_lines = [
            ln("Net Operating Income", proforma.noi, is_total=True, t12_val=t12.get("noi")),
            ln("Replacement Reserves", proforma.reserves, is_deduction=True),
            ln("Net Cash Flow", proforma.ncf, is_total=True),
        ]

        return OperatingStatement(
            revenue_lines=revenue_lines,
            expense_lines=expense_lines,
            summary_lines=summary_lines,
        )

    # ------------------------------------------------------------------
    # Price Solvers
    # ------------------------------------------------------------------

    def _solve_price_from_irr(
        self, scenario_key: str, revenue: RevenueResult
    ) -> float:
        """Bisection solver: find purchase price → target unlevered IRR."""
        inp = self.inputs
        scenario = getattr(inp, scenario_key)
        target_irr = scenario.target_unlevered_irr

        if not target_irr or target_irr <= 0:
            return 0.0

        units = self._total_units
        lo = 10_000.0 * units
        hi = 500_000.0 * units

        def irr_at_price(price: float) -> Optional[float]:
            expenses = self._compute_expenses(revenue, purchase_price=price)
            proforma = self._compute_proforma(revenue, expenses)
            debt = self._compute_debt(proforma, scenario_key, price)
            dcf = self._compute_dcf(proforma, debt, scenario_key, price)
            reversion = self._compute_reversion(dcf, debt, scenario_key)
            returns = self._compute_returns(dcf, debt, reversion, price)
            return returns.unlevered_irr

        for _ in range(60):
            mid = (lo + hi) / 2
            irr = irr_at_price(mid)
            if irr is None:
                hi = mid
                continue
            if abs(irr - target_irr) < 0.0001:
                return mid
            if irr > target_irr:
                lo = mid  # price too low → IRR too high
            else:
                hi = mid
        return (lo + hi) / 2

    def _solve_price_from_cap(
        self, scenario_key: str, revenue: RevenueResult
    ) -> float:
        """Closed-form direct-cap pricing with tax circularity solution.

        When property_tax_mode == "reassessment", tax is a function of price:
          tax = price × pct_assessed × assessment_ratio × (millage_rate / 100)
        Let k = pct_assessed × assessment_ratio × (millage_rate / 100).
        Then: NOI = income − (expenses_ex_tax) − k × price
        And:  price = NOI / cap_rate
        Solving: price = (income − expenses_ex_tax) / (cap_rate + k)
        """
        inp = self.inputs
        scenario = getattr(inp, scenario_key)
        target_cap = scenario.target_cap_rate

        if not target_cap or target_cap <= 0:
            return 0.0

        # Expenses excluding tax and mgmt fee (which depend on price/income)
        expenses_ex_tax = self._compute_expenses(revenue, purchase_price=0.0)
        controllable = expenses_ex_tax.controllable_total
        insurance = expenses_ex_tax.insurance
        mgmt_fee = expenses_ex_tax.management_fee  # based on revenue, not price

        total_income = revenue.total_income
        reserves = inp.reserves_per_unit * self._total_units

        if inp.property_tax_mode == "reassessment":
            # Closed-form: price = (income − ctrl − ins − mgmt) / (cap + k)
            k = (
                inp.pct_of_purchase_assessed
                * inp.assessment_ratio
                * (inp.millage_rate / 100)
            )
            numerator = total_income - controllable - insurance - mgmt_fee
            denominator = target_cap + k
            if denominator <= 0:
                return 0.0
            return numerator / denominator
        else:
            # No circularity: NOI is independent of price
            tax = inp.current_tax_amount
            noi = total_income - controllable - insurance - mgmt_fee - tax
            return noi / target_cap if target_cap > 0 else 0.0

    # ------------------------------------------------------------------
    # Scenario Runner
    # ------------------------------------------------------------------

    def _run_scenario(
        self, scenario_key: str, revenue: RevenueResult
    ) -> Optional[ScenarioResult]:
        """Run a single scenario end-to-end."""
        inp = self.inputs
        scenario = getattr(inp, scenario_key)
        mode = getattr(scenario, "pricing_mode", "manual")

        # ── Resolve purchase price ──
        if mode == "manual":
            purchase_price = scenario.purchase_price or 0.0
        elif mode == "direct_cap":
            purchase_price = self._solve_price_from_cap(scenario_key, revenue)
        elif mode == "target_irr":
            purchase_price = self._solve_price_from_irr(scenario_key, revenue)
        else:
            purchase_price = scenario.purchase_price or 0.0

        if purchase_price <= 0:
            return None

        # ── Full calculation chain ──
        expenses = self._compute_expenses(revenue, purchase_price=purchase_price)
        proforma = self._compute_proforma(revenue, expenses)
        debt = self._compute_debt(proforma, scenario_key, purchase_price)
        dcf = self._compute_dcf(proforma, debt, scenario_key, purchase_price)
        reversion = self._compute_reversion(dcf, debt, scenario_key)
        returns = self._compute_returns(dcf, debt, reversion, purchase_price)
        cap_rates = self._compute_cap_rates(proforma, scenario_key, purchase_price)
        val_summary = self._build_valuation_summary(
            proforma, debt, dcf, returns, cap_rates, purchase_price,
        )

        return ScenarioResult(
            proforma=proforma,
            debt=debt,
            dcf=dcf,
            returns=returns,
            valuation_summary=val_summary,
        )

    # ------------------------------------------------------------------
    # Master compute()
    # ------------------------------------------------------------------

    def compute(self) -> UWOutputs:
        """Run both scenarios and return complete outputs."""
        inp = self.inputs

        # Revenue is scenario-independent
        revenue = self._compute_revenue()

        # Run both scenarios
        scenarios: dict[str, ScenarioResult] = {}
        first_proforma: Optional[ProformaResult] = None

        for key in ("premium", "market"):
            result = self._run_scenario(key, revenue)
            if result is not None:
                scenarios[key] = result
                if first_proforma is None:
                    first_proforma = result.proforma

        # Fallback proforma if no scenarios ran
        if first_proforma is None:
            fallback_exp = self._compute_expenses(revenue, purchase_price=0.0)
            first_proforma = self._compute_proforma(revenue, fallback_exp)

        operating_statement = self._build_operating_statement(first_proforma)

        # Build per-scenario operating statements for scenario toggle
        operating_statements = {}
        for key, result in scenarios.items():
            operating_statements[key] = self._build_operating_statement(result.proforma)

        return UWOutputs(
            proforma=first_proforma,
            scenarios=scenarios,
            operating_statement=operating_statement,
            operating_statements=operating_statements,
        )
