"""
Tests for the Underwriting Engine V2.

Validation property: Champions Green (fictional Atlanta-area multifamily)
244 units, 231,800 SF, value-add play.

Also includes unit tests for IRR solver, debt sizing, pricing modes,
tax reassessment, and edge cases.
"""

import sys
import os
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

from app.schemas.underwriting import (
    UWInputs,
    UnitMixInput,
    OtherIncomeItem,
    PayrollItem,
    ScenarioInputs,
)
from app.services.underwriting_engine import UnderwritingEngine
from app.services.irr_solver import solve_irr


# ---------------------------------------------------------------------------
# Champions Green fixture
# ---------------------------------------------------------------------------

def build_champions_green_inputs() -> UWInputs:
    """
    Champions Green — 244 units, Atlanta suburb, value-add multifamily.

    Unit mix:
      1BR (120 units × $1,350/mo market, $1,200 inplace)
      2BR (100 units × $1,550/mo market, $1,400 inplace)
      3BR  (24 units × $1,750/mo market, $1,600 inplace)
    Avg SF: 950
    GSR = (120×1350 + 100×1550 + 24×1750) × 12 = $4,308,000
    """
    unit_mix = [
        UnitMixInput(floorplan="1BR/1BA", units=120, sf=750, market_rent=1350, inplace_rent=1200),
        UnitMixInput(floorplan="2BR/2BA", units=100, sf=1050, market_rent=1550, inplace_rent=1400),
        UnitMixInput(floorplan="3BR/2BA", units=24, sf=1250, market_rent=1750, inplace_rent=1600),
    ]

    payroll_items = [
        PayrollItem(position="Property Manager", salary=60000, bonus=5000, payroll_load_pct=0.30),
        PayrollItem(position="Leasing Agent", salary=38000, bonus=2000, payroll_load_pct=0.30),
        PayrollItem(position="Maintenance Tech", salary=45000, bonus=0, payroll_load_pct=0.30),
        PayrollItem(position="Groundskeeper", salary=32000, bonus=0, payroll_load_pct=0.30),
    ]

    return UWInputs(
        total_units=244,
        total_sf=244 * 950,  # 231,800
        unit_mix=unit_mix,
        rent_basis="market",
        retention_ratio=0.55,
        renewal_rent_bump=0.70,
        vacancy_pct=[0.05] * 8,
        concession_pct=[0.02, 0.01] + [0.0] * 6,
        bad_debt_pct=[0.01, 0.005] + [0.005] * 6,
        nru_count=2,
        nru_avg_rent=0,
        utility_reimb_per_unit=0,
        parking_income_per_unit=0,
        other_income_items=[],
        utilities_per_unit=900,
        repairs_per_unit=500,
        make_ready_per_unit=350,
        contract_services_per_unit=200,
        marketing_per_unit=100,
        payroll_items=payroll_items,
        ga_per_unit=175,
        property_tax_mode="reassessment",
        current_tax_amount=400_000,
        pct_of_purchase_assessed=1.0,
        assessment_ratio=0.40,
        millage_rate=4.0,
        reassessment_year=1,
        insurance_per_unit=450,
        mgmt_fee_pct=0.0275,
        reserves_per_unit=200,
        reserves_inflate=False,
        # Non-flat inflation curves
        rental_inflation=[0.03, 0.03, 0.025, 0.025, 0.02, 0.02, 0.02, 0.02],
        expense_inflation=[0.03, 0.03, 0.0275, 0.0275, 0.025, 0.025, 0.025, 0.025],
        re_tax_inflation=[0.02, 0.02, 0.02, 0.02, 0.02, 0.02, 0.02, 0.02],
        max_ltv=0.60,
        interest_rate=0.0525,
        loan_term_months=84,
        io_period_months=84,
        amort_years=30,
        dscr_minimum=1.25,
        sales_expense_pct=0.015,
        hold_period_years=7,
        premium=ScenarioInputs(
            pricing_mode="manual",
            purchase_price=35_000_000,
            terminal_cap_rate=0.055,
        ),
        market=ScenarioInputs(
            pricing_mode="direct_cap",
            target_cap_rate=0.065,
            terminal_cap_rate=0.0575,
        ),
    )


# ---------------------------------------------------------------------------
# Revenue Tests
# ---------------------------------------------------------------------------

class TestRevenue:
    """Validate Y1 revenue waterfall for Champions Green."""

    def setup_method(self):
        self.inputs = build_champions_green_inputs()
        self.engine = UnderwritingEngine(self.inputs)
        self.rev = self.engine._compute_revenue()

    def test_gsr(self):
        """GSR = (120×1350 + 100×1550 + 24×1750) × 12 = $4,308,000."""
        assert abs(self.rev.gsr - 4_308_000) < 1.0

    def test_no_gain_loss_in_market_basis(self):
        """Market rent basis → gain/loss to lease = 0."""
        assert self.rev.gain_loss_to_lease == 0.0

    def test_gpr_equals_gsr_in_market_basis(self):
        assert abs(self.rev.gpr - self.rev.gsr) < 0.01

    def test_vacancy_pct_of_gpi(self):
        """Vacancy = 5% of GPI (V2: deductions off Total GPI)."""
        expected = self.rev.gpr * 0.05
        assert abs(self.rev.vacancy - expected) < 1.0

    def test_concessions_pct_of_gpi(self):
        """Y1 concessions = 2% of GPI."""
        expected = self.rev.gpr * 0.02
        assert abs(self.rev.concessions - expected) < 1.0

    def test_bad_debt_pct_of_gpi(self):
        """Y1 bad debt = 1% of GPI."""
        expected = self.rev.gpr * 0.01
        assert abs(self.rev.bad_debt - expected) < 1.0

    def test_nru_loss(self):
        """NRU loss = 2 × avg_market_rent × 12."""
        mix_units = sum(um.units for um in self.inputs.unit_mix)
        avg_rent = sum(um.market_rent * um.units for um in self.inputs.unit_mix) / mix_units
        expected = 2 * avg_rent * 12
        assert abs(self.rev.nru_loss - expected) < 1.0

    def test_nri_waterfall(self):
        """NRI = GPR − vacancy − concessions − NRU − bad debt."""
        expected = (
            self.rev.gpr - self.rev.vacancy - self.rev.concessions
            - self.rev.nru_loss - self.rev.bad_debt
        )
        assert abs(self.rev.nri - expected) < 0.01

    def test_total_income_equals_nri_when_no_other(self):
        """With no other income items, total_income = NRI."""
        assert abs(self.rev.total_income - self.rev.nri) < 0.01


class TestRevenueInplaceBasis:
    """Test gain/loss to lease with inplace rent basis."""

    def test_gain_loss_to_lease_negative(self):
        """Inplace < market → loss to lease (negative)."""
        inputs = build_champions_green_inputs()
        inputs.rent_basis = "inplace"
        engine = UnderwritingEngine(inputs)
        rev = engine._compute_revenue()
        assert rev.gain_loss_to_lease < 0


# ---------------------------------------------------------------------------
# Expense Tests
# ---------------------------------------------------------------------------

class TestExpenses:
    """Validate expense calculation for Champions Green."""

    def setup_method(self):
        self.inputs = build_champions_green_inputs()
        self.engine = UnderwritingEngine(self.inputs)
        self.rev = self.engine._compute_revenue()
        self.exp = self.engine._compute_expenses(self.rev, purchase_price=35_000_000)

    def test_controllable_per_unit_lines(self):
        """Each controllable line = $/unit × total_units."""
        u = 244
        assert abs(self.exp.utilities - 900 * u) < 0.01
        assert abs(self.exp.repairs_maintenance - 500 * u) < 0.01
        assert abs(self.exp.make_ready - 350 * u) < 0.01
        assert abs(self.exp.contract_services - 200 * u) < 0.01
        assert abs(self.exp.marketing - 100 * u) < 0.01
        assert abs(self.exp.general_admin - 175 * u) < 0.01

    def test_payroll(self):
        """Payroll = Σ (salary + bonus) × (1 + load)."""
        expected = (65000 + 40000 + 45000 + 32000) * 1.30
        assert abs(self.exp.payroll - expected) < 1.0

    def test_reassessment_tax(self):
        """Tax = 35M × 1.0 × 0.40 × (4.0 / 100) = $560,000."""
        expected = 35_000_000 * 1.0 * 0.40 * (4.0 / 100)
        assert abs(self.exp.property_taxes - expected) < 1.0

    def test_insurance(self):
        assert abs(self.exp.insurance - 450 * 244) < 0.01

    def test_mgmt_fee(self):
        """Mgmt fee = 2.75% × total income."""
        expected = self.rev.total_income * 0.0275
        assert abs(self.exp.management_fee - expected) < 1.0

    def test_total_sums(self):
        ctrl = (
            self.exp.utilities + self.exp.repairs_maintenance + self.exp.make_ready
            + self.exp.contract_services + self.exp.marketing + self.exp.payroll
            + self.exp.general_admin
        )
        assert abs(self.exp.controllable_total - ctrl) < 0.01
        nc = self.exp.property_taxes + self.exp.insurance + self.exp.management_fee
        assert abs(self.exp.non_controllable_total - nc) < 0.01
        assert abs(self.exp.total_expenses - (ctrl + nc)) < 0.01


# ---------------------------------------------------------------------------
# Proforma Tests
# ---------------------------------------------------------------------------

class TestProforma:

    def setup_method(self):
        inputs = build_champions_green_inputs()
        self.engine = UnderwritingEngine(inputs)
        self.rev = self.engine._compute_revenue()
        self.exp = self.engine._compute_expenses(self.rev, purchase_price=35_000_000)
        self.pf = self.engine._compute_proforma(self.rev, self.exp)

    def test_noi(self):
        expected = self.rev.total_income - self.exp.total_expenses
        assert abs(self.pf.noi - expected) < 0.01

    def test_reserves(self):
        assert abs(self.pf.reserves - 200 * 244) < 0.01

    def test_ncf(self):
        assert abs(self.pf.ncf - (self.pf.noi - self.pf.reserves)) < 0.01


# ---------------------------------------------------------------------------
# DCF Tests (non-flat inflation)
# ---------------------------------------------------------------------------

class TestDCF:

    def setup_method(self):
        self.inputs = build_champions_green_inputs()
        self.engine = UnderwritingEngine(self.inputs)
        self.outputs = self.engine.compute()
        self.dcf = self.outputs.scenarios["premium"].dcf

    def test_correct_year_count(self):
        assert len(self.dcf.years) == 7

    def test_y1_matches_proforma(self):
        """DCF Y1 total income should match proforma."""
        y1 = self.dcf.years[0]
        pf = self.outputs.scenarios["premium"].proforma
        assert abs(y1.total_income - pf.revenue.total_income) < 1.0

    def test_non_flat_rental_growth(self):
        """GPR growth tracks rental_inflation array year-by-year.

        inflation = [0.03, 0.03, 0.025, 0.025, 0.02, 0.02, 0.02, 0.02]
        Y1→Y2 grows by inflation[0]=3%, Y4→Y5 grows by inflation[3]=2.5%.
        """
        y1 = self.dcf.years[0].gpr
        y2 = self.dcf.years[1].gpr
        assert abs(y2 / y1 - 1.03) < 0.001  # inflation[0] = 0.03

        y4 = self.dcf.years[3].gpr
        y5 = self.dcf.years[4].gpr
        assert abs(y5 / y4 - 1.025) < 0.001  # inflation[3] = 0.025

    def test_mgmt_fee_recalculated(self):
        """Mgmt fee should track each year's income, not grow at expense inflation."""
        for yr in self.dcf.years:
            expected = yr.total_income * 0.0275
            assert abs(yr.management_fee - expected) < 1.0

    def test_revenue_grows_monotonically(self):
        for i in range(1, len(self.dcf.years)):
            assert self.dcf.years[i].total_income > self.dcf.years[i - 1].total_income

    def test_cagr_populated(self):
        assert self.dcf.revenue_cagr is not None
        assert self.dcf.noi_cagr is not None
        assert 0.01 < self.dcf.revenue_cagr < 0.10
        assert 0.01 < self.dcf.noi_cagr < 0.10


# ---------------------------------------------------------------------------
# Reversion / Terminal Value Tests
# ---------------------------------------------------------------------------

class TestReversion:

    def setup_method(self):
        inputs = build_champions_green_inputs()
        self.engine = UnderwritingEngine(inputs)
        self.outputs = self.engine.compute()
        self.reversion = self.outputs.scenarios["premium"].returns.reversion

    def test_terminal_value_positive(self):
        assert self.reversion.gross_selling_price > 0

    def test_forward_noi_is_noi_after_capital(self):
        """Forward NOI should be NOI minus reserves (NOI After Capital)."""
        assert self.reversion.forward_noi > 0

    def test_terminal_value_formula(self):
        """GSP = forward_noi / terminal_cap_rate."""
        expected = self.reversion.forward_noi / 0.055
        assert abs(self.reversion.gross_selling_price - expected) < 1.0

    def test_sales_expenses(self):
        expected = self.reversion.gross_selling_price * 0.015
        assert abs(self.reversion.sales_expenses - expected) < 1.0

    def test_net_proceeds(self):
        expected = (
            self.reversion.gross_selling_price
            - self.reversion.sales_expenses
            - self.reversion.principal_outstanding
        )
        assert abs(self.reversion.net_proceeds - expected) < 1.0


# ---------------------------------------------------------------------------
# Debt Tests
# ---------------------------------------------------------------------------

class TestDebt:

    def setup_method(self):
        inputs = build_champions_green_inputs()
        self.engine = UnderwritingEngine(inputs)
        self.outputs = self.engine.compute()
        self.debt = self.outputs.scenarios["premium"].debt

    def test_ltv_loan(self):
        assert abs(self.debt.loan_amount - 35_000_000 * 0.60) < 1.0

    def test_equity(self):
        assert abs(self.debt.equity - 35_000_000 * 0.40) < 1.0

    def test_full_io_debt_service(self):
        """Full I/O (84 months = 7yr hold): DS = loan × rate each year."""
        expected_ds = self.debt.loan_amount * 0.0525
        for ds in self.debt.annual_debt_service:
            assert abs(ds - expected_ds) / expected_ds < 0.001

    def test_full_io_principal_constant(self):
        for po in self.debt.principal_outstanding:
            assert abs(po - self.debt.loan_amount) < 1.0

    def test_dscr_not_constrained(self):
        """With standard LTV, DSCR should not bind."""
        assert not self.debt.is_dscr_constrained

    def test_dscr_binds_high_ltv(self):
        """Very high LTV with high rate should trigger DSCR constraint."""
        inputs = build_champions_green_inputs()
        inputs.max_ltv = 0.95
        inputs.interest_rate = 0.09  # High rate makes DSCR bind
        engine = UnderwritingEngine(inputs)
        outputs = engine.compute()
        assert outputs.scenarios["premium"].debt.is_dscr_constrained


# ---------------------------------------------------------------------------
# Returns / IRR Tests
# ---------------------------------------------------------------------------

class TestReturns:

    def setup_method(self):
        inputs = build_champions_green_inputs()
        self.engine = UnderwritingEngine(inputs)
        self.outputs = self.engine.compute()
        self.returns = self.outputs.scenarios["premium"].returns

    def test_levered_irr_exists(self):
        assert self.returns.levered_irr is not None
        assert self.returns.levered_irr > 0

    def test_unlevered_irr_exists(self):
        assert self.returns.unlevered_irr is not None
        assert self.returns.unlevered_irr > 0

    def test_leverage_amplifies_irr(self):
        """Positive leverage: levered IRR > unlevered IRR."""
        assert self.returns.levered_irr > self.returns.unlevered_irr

    def test_equity_multiple_gt_1(self):
        assert self.returns.equity_multiple is not None
        assert self.returns.equity_multiple > 1.0

    def test_y1_coc(self):
        assert self.returns.y1_cash_on_cash is not None
        assert 0.05 < self.returns.y1_cash_on_cash < 0.30


# ---------------------------------------------------------------------------
# IRR Solver Tests
# ---------------------------------------------------------------------------

class TestIRRSolver:

    def test_simple_irr(self):
        irr = solve_irr([-100, 110])
        assert irr is not None
        assert abs(irr - 0.10) < 0.001

    def test_multi_period(self):
        irr = solve_irr([-1000, 300, 300, 300, 300])
        assert irr is not None
        assert abs(irr - 0.0771) < 0.005

    def test_all_negative_returns_none(self):
        assert solve_irr([-100, -50, -25]) is None

    def test_empty_returns_none(self):
        assert solve_irr([]) is None

    def test_single_cf_returns_none(self):
        assert solve_irr([-100]) is None


# ---------------------------------------------------------------------------
# Pricing Mode Tests
# ---------------------------------------------------------------------------

class TestDirectCapPricing:

    def test_closed_form_cap_rate(self):
        """Direct cap mode should produce Y1 cap ≈ target."""
        inputs = build_champions_green_inputs()
        self.outputs = UnderwritingEngine(inputs).compute()
        market = self.outputs.scenarios["market"]
        cap = market.valuation_summary.cap_rates.y1_cap_rate
        assert cap is not None
        assert abs(cap - 0.065) < 0.001, f"Cap={cap:.4%}, expected 6.50%"

    def test_current_tax_mode_direct_cap(self):
        """Direct cap with current tax mode (no circularity)."""
        inputs = build_champions_green_inputs()
        inputs.property_tax_mode = "current"
        inputs.current_tax_amount = 400_000
        inputs.market.target_cap_rate = 0.07
        outputs = UnderwritingEngine(inputs).compute()
        cap = outputs.scenarios["market"].valuation_summary.cap_rates.y1_cap_rate
        assert cap is not None
        assert abs(cap - 0.07) < 0.001


class TestTargetIRRPricing:

    def test_target_irr_solved(self):
        """Target IRR mode should converge within tolerance."""
        inputs = build_champions_green_inputs()
        inputs.premium.pricing_mode = "target_irr"
        inputs.premium.target_unlevered_irr = 0.12
        inputs.premium.purchase_price = 0
        outputs = UnderwritingEngine(inputs).compute()
        assert "premium" in outputs.scenarios
        irr = outputs.scenarios["premium"].returns.unlevered_irr
        assert irr is not None
        assert abs(irr - 0.12) < 0.005


class TestManualPricing:

    def test_manual_preserves_price(self):
        inputs = build_champions_green_inputs()
        outputs = UnderwritingEngine(inputs).compute()
        assert abs(
            outputs.scenarios["premium"].valuation_summary.purchase_price - 35_000_000
        ) < 1.0


# ---------------------------------------------------------------------------
# Tax Reassessment Tests
# ---------------------------------------------------------------------------

class TestTaxReassessment:

    def test_formula(self):
        """$35M × 1.0 × 0.40 × (4.0/100) = $560,000."""
        inputs = build_champions_green_inputs()
        engine = UnderwritingEngine(inputs)
        rev = engine._compute_revenue()
        exp = engine._compute_expenses(rev, purchase_price=35_000_000)
        assert abs(exp.property_taxes - 560_000) < 1.0

    def test_scenario_dependent(self):
        """Different prices → different taxes."""
        inputs = build_champions_green_inputs()
        engine = UnderwritingEngine(inputs)
        rev = engine._compute_revenue()
        exp1 = engine._compute_expenses(rev, purchase_price=35_000_000)
        exp2 = engine._compute_expenses(rev, purchase_price=40_000_000)
        assert exp1.property_taxes < exp2.property_taxes

    def test_current_mode_ignores_price(self):
        inputs = build_champions_green_inputs()
        inputs.property_tax_mode = "current"
        inputs.current_tax_amount = 400_000
        engine = UnderwritingEngine(inputs)
        rev = engine._compute_revenue()
        exp = engine._compute_expenses(rev, purchase_price=99_000_000)
        assert abs(exp.property_taxes - 400_000) < 1.0

    def test_tax_grows_at_re_tax_inflation(self):
        """DCF taxes should grow at re_tax_inflation, not expense_inflation."""
        inputs = build_champions_green_inputs()
        outputs = UnderwritingEngine(inputs).compute()
        dcf = outputs.scenarios["premium"].dcf
        y1_tax = dcf.years[0].property_taxes
        y2_tax = dcf.years[1].property_taxes
        # re_tax_inflation[0] = 0.02
        assert abs(y2_tax / y1_tax - 1.02) < 0.001


# ---------------------------------------------------------------------------
# Scenario Runner Tests
# ---------------------------------------------------------------------------

class TestScenarioRunner:

    def test_both_scenarios_run(self):
        inputs = build_champions_green_inputs()
        outputs = UnderwritingEngine(inputs).compute()
        assert "premium" in outputs.scenarios
        assert "market" in outputs.scenarios

    def test_zero_price_skips(self):
        inputs = build_champions_green_inputs()
        inputs.premium.purchase_price = 0
        outputs = UnderwritingEngine(inputs).compute()
        assert "premium" not in outputs.scenarios
        assert "market" in outputs.scenarios

    def test_operating_statement(self):
        inputs = build_champions_green_inputs()
        outputs = UnderwritingEngine(inputs).compute()
        os_ = outputs.operating_statement
        assert len(os_.revenue_lines) == 12
        assert len(os_.expense_lines) == 13
        assert len(os_.summary_lines) == 3

    def test_valuation_summary(self):
        inputs = build_champions_green_inputs()
        outputs = UnderwritingEngine(inputs).compute()
        vs = outputs.scenarios["premium"].valuation_summary
        assert vs.purchase_price == 35_000_000
        assert abs(vs.price_per_unit - 35_000_000 / 244) < 1.0
        assert vs.levered_irr is not None
        assert vs.unlevered_irr is not None


# ---------------------------------------------------------------------------
# Edge Cases
# ---------------------------------------------------------------------------

class TestEdgeCases:

    def test_zero_units(self):
        inputs = UWInputs(total_units=0, total_sf=0)
        outputs = UnderwritingEngine(inputs).compute()
        assert outputs.proforma.noi == 0

    def test_no_unit_mix(self):
        inputs = UWInputs(
            total_units=100,
            total_sf=100_000,
            premium=ScenarioInputs(purchase_price=10_000_000),
        )
        outputs = UnderwritingEngine(inputs).compute()
        assert outputs.proforma.revenue.gsr == 0

    def test_single_unit(self):
        inputs = UWInputs(
            total_units=1,
            total_sf=1000,
            unit_mix=[UnitMixInput(floorplan="Studio", units=1, sf=1000, market_rent=2000)],
            premium=ScenarioInputs(purchase_price=300_000, terminal_cap_rate=0.06),
            hold_period_years=5,
            vacancy_pct=[0.05] * 8,
            concession_pct=[0.0] * 8,
            bad_debt_pct=[0.0] * 8,
            nru_count=0,
            max_ltv=0.60,
            interest_rate=0.05,
            io_period_months=60,
            loan_term_months=60,
        )
        outputs = UnderwritingEngine(inputs).compute()
        assert "premium" in outputs.scenarios
        assert outputs.scenarios["premium"].returns.unlevered_irr is not None


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
