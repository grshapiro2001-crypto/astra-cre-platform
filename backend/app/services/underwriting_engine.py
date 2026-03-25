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
    # Stub methods — implemented in Step 3
    # ------------------------------------------------------------------

    def _compute_debt(
        self,
        proforma: ProformaResult,
        scenario_key: str,
        purchase_price: float,
    ) -> DebtResult:
        """Placeholder — Step 3."""
        return DebtResult()

    def compute(self) -> UWOutputs:
        """Placeholder — Step 3."""
        return UWOutputs()
