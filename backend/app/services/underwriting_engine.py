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
    # Stub methods — implemented in Step 2 & Step 3
    # ------------------------------------------------------------------

    def _compute_dcf(
        self,
        proforma: ProformaResult,
        debt: DebtResult,
        scenario_key: str,
        purchase_price: float,
    ) -> DCFResult:
        """Placeholder — Step 2."""
        return DCFResult()

    def _compute_reversion(
        self,
        dcf: DCFResult,
        debt: DebtResult,
        scenario_key: str,
    ) -> ReversionResult:
        """Placeholder — Step 2."""
        return ReversionResult()

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
