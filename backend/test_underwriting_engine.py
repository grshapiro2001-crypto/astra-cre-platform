"""
Tests for the Underwriting Engine V1.
Validation targets from the Prose Gainesville reference model (Section 12 of spec).

Property: Prose Gainesville, 300 units, 285,408 SF, Gainesville GA
"""

import sys
import os
import pytest

# Ensure the backend app is importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

from app.schemas.underwriting import (
    UWInputs,
    UnitMixInput,
    OtherIncomeItem,
    PayrollItem,
    ScenarioInputs,
)
from app.services.underwriting_engine import UnderwritingEngine


# ---------------------------------------------------------------------------
# Prose Gainesville test fixture
# ---------------------------------------------------------------------------

def build_prose_inputs() -> UWInputs:
    """
    Build the complete UWInputs for Prose Gainesville.

    Property: 300 units, 285,408 SF
    Avg Market Rent: $1,493/month
    Avg In-Place Rent: $1,464/month

    We model the unit mix as a single weighted-average floorplan for simplicity.
    The GSR target is $5,375,803 which implies:
      GSR = rent * units * 12 => rent = 5,375,803 / (300 * 12) = $1,493.28/mo
    """
    # Derive market rent from GSR target
    target_gsr = 5_375_803
    market_rent = target_gsr / (300 * 12)  # ~$1,493.28

    unit_mix = [
        UnitMixInput(
            floorplan="Weighted Avg",
            units=300,
            sf=951,  # 285,408 / 300
            market_rent=market_rent,
            inplace_rent=1464.0,
        )
    ]

    # Other income: total $443,447
    other_income = [
        OtherIncomeItem(line_item="Other Income (All)", description="NSF, App, Pet, Admin, etc.", fee_amount=0, annual_income=443_447),
    ]

    # Payroll: We need to derive from total expenses target.
    # Total Expenses = $1,954,004 (target), Expense Ratio = 36.4%
    # We'll set line items to produce the right total.
    # From the proforma:
    #   Total Income = $5,353,348
    #   Management Fee = 5,353,348 * 0.0275 = $147,217
    #   Total Expenses = $1,954,004
    #   So controllable + tax + insurance + mgmt = $1,954,004

    # Working backwards from targets:
    # Net Rental Income = $4,909,900
    # GSR = $5,375,803
    # Loss to Lease = -$9,792 (this is in-place basis but we're using market basis)
    # GPR = GSR + LTL = 5,375,803 + (-9,792) = 5,366,011
    # But in market basis, LTL = 0, so GPR = GSR = 5,375,803
    # Vacancy = GPR * 0.05 = 268,790
    # Concessions = GPR * 0.02 = 107,516
    # Bad Debt = GPR * 0.01 = 53,758
    # NRU = 2 * 1493.28 * 12 = 35,839
    # NRI = 5,375,803 - 268,790 - 107,516 - 35,839 - 53,758 = 4,909,900

    # Target NRI = $4,909,900, Other Income = $443,447
    # So Total Income = 4,909,900 + 443,447 = 5,353,347

    # For expenses, we need specific breakdowns. We'll approximate:
    # Mgmt Fee = 5,353,347 * 0.0275 = $147,217
    # Remaining (controllable + tax + insurance) = 1,954,004 - 147,217 = $1,806,787
    # We'll distribute across categories using typical ratios

    # Use $/unit inputs to produce approximately right totals
    # Total non-mgmt expenses = $1,806,787 / 300 = $6,023/unit total

    payroll_items = [
        PayrollItem(position="Property Manager", salary=65000, bonus=5000, payroll_load_pct=0.30),
        PayrollItem(position="Assistant Manager", salary=45000, bonus=2000, payroll_load_pct=0.30),
        PayrollItem(position="Leasing Associate", salary=38000, bonus=3000, payroll_load_pct=0.30),
        PayrollItem(position="Maintenance Director", salary=55000, bonus=3000, payroll_load_pct=0.30),
        PayrollItem(position="Maintenance Tech I", salary=42000, bonus=0, payroll_load_pct=0.30),
        PayrollItem(position="Maintenance Tech II", salary=40000, bonus=0, payroll_load_pct=0.30),
        PayrollItem(position="Groundskeeper", salary=35000, bonus=0, payroll_load_pct=0.30),
    ]
    # Payroll total = sum of (salary + bonus) * 1.30
    # = (65000+5000 + 45000+2000 + 38000+3000 + 55000+3000 + 42000 + 40000 + 35000) * 1.30
    # = (70000 + 47000 + 41000 + 58000 + 42000 + 40000 + 35000) * 1.30
    # = 333,000 * 1.30 = 432,900

    # We need total expenses = $1,954,004
    # Mgmt fee = ~$147,217
    # Payroll = $432,900
    # Remaining controllable + non-controllable = 1,954,004 - 147,217 - 432,900 = $1,373,887
    # That's $1,373,887 / 300 = $4,580/unit across other categories

    # Set expense categories:
    # Property tax (reassessed): will be set by reassessment logic
    # For premium: 63,880,219 * 0.90 * millage = property tax
    # For market: 60,185,002 * 0.90 * millage = property tax

    # We need to set a current tax that, combined with other expenses, hits our target.
    # Let's work with approximate values:

    return UWInputs(
        total_units=300,
        total_sf=285_408,
        unit_mix=unit_mix,
        premium=ScenarioInputs(purchase_price=63_880_219, terminal_cap_rate=0.0525),
        market=ScenarioInputs(purchase_price=60_185_002, terminal_cap_rate=0.0550),
        rent_basis="market",
        retention_ratio=0.55,
        renewal_rent_bump=0.70,
        vacancy_pct=[0.05] * 8,
        concession_pct=[0.02, 0.01, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
        bad_debt_pct=[0.01, 0.005, 0.005, 0.005, 0.005, 0.005, 0.005, 0.005],
        nru_count=2,
        nru_avg_rent=0,  # Will use avg market rent
        utility_reimb_per_unit=0,
        parking_income_per_unit=0,
        other_income_items=other_income,
        # Expense assumptions ($/unit/year)
        utilities_per_unit=825,
        repairs_per_unit=425,
        make_ready_per_unit=200,
        contract_services_per_unit=350,
        marketing_per_unit=150,
        payroll_items=payroll_items,
        ga_per_unit=275,
        property_tax_mode="current",
        current_tax_amount=460_000,
        assessment_ratio=0.90,
        millage_rate=0.01,
        reassessment_year=1,
        insurance_per_unit=425,
        mgmt_fee_pct=0.0275,
        reserves_per_unit=200,
        reserves_inflate=False,
        rental_inflation=[0.02] * 8,
        expense_inflation=[0.0275] * 8,
        re_tax_inflation=[0.0275] * 8,
        max_ltv=0.60,
        interest_rate=0.0525,
        loan_term_months=84,
        io_period_months=84,
        amort_years=30,
        dscr_minimum=1.25,
        sales_expense_pct=0.015,
        hold_period_years=7,
        la_enabled=False,
    )


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestUnderwritingEngine:
    """Test the underwriting engine against Prose Gainesville validation targets."""

    def setup_method(self):
        self.inputs = build_prose_inputs()
        self.engine = UnderwritingEngine(self.inputs)
        self.outputs = self.engine.compute()

    def test_gsr(self):
        """GSR should be ~$5,375,803."""
        gsr = self.outputs.proforma.revenue.gsr
        assert abs(gsr - 5_375_803) / 5_375_803 < 0.01, f"GSR={gsr:.0f}, expected ~5,375,803"

    def test_nri(self):
        """NRI should be ~$4,909,900."""
        nri = self.outputs.proforma.revenue.nri
        assert abs(nri - 4_909_900) / 4_909_900 < 0.02, f"NRI={nri:.0f}, expected ~4,909,900"

    def test_total_income(self):
        """Total Income should be ~$5,353,348."""
        ti = self.outputs.proforma.revenue.total_income
        assert abs(ti - 5_353_348) / 5_353_348 < 0.02, f"Total Income={ti:.0f}, expected ~5,353,348"

    def test_noi(self):
        """NOI should be ~$3,399,344."""
        noi = self.outputs.proforma.noi
        # Allow wider tolerance since expense $/unit values are approximated
        assert abs(noi - 3_399_344) / 3_399_344 < 0.05, f"NOI={noi:.0f}, expected ~3,399,344"

    def test_expense_ratio(self):
        """Expense ratio should be ~36.4%."""
        ratio = self.outputs.proforma.expense_ratio
        assert abs(ratio - 0.364) < 0.03, f"Expense Ratio={ratio:.3f}, expected ~0.364"

    def test_premium_scenario_exists(self):
        """Premium scenario should be computed."""
        assert "premium" in self.outputs.scenarios

    def test_market_scenario_exists(self):
        """Market scenario should be computed."""
        assert "market" in self.outputs.scenarios

    def test_premium_cap_rate(self):
        """Premium Y1 Cap Rate should be ~5.23%."""
        cap = self.outputs.scenarios["premium"].valuation_summary.cap_rates.y1_cap_rate
        assert cap is not None
        assert abs(cap - 0.0523) < 0.005, f"Premium Y1 Cap={cap:.4f}, expected ~0.0523"

    def test_market_cap_rate(self):
        """Market Y1 Cap Rate should be ~5.55%."""
        cap = self.outputs.scenarios["market"].valuation_summary.cap_rates.y1_cap_rate
        assert cap is not None
        assert abs(cap - 0.0555) < 0.005, f"Market Y1 Cap={cap:.4f}, expected ~0.0555"

    def test_premium_ltv(self):
        """Premium LTV should be 60%."""
        ltv = self.outputs.scenarios["premium"].debt.actual_ltv
        assert abs(ltv - 0.60) < 0.01, f"Premium LTV={ltv:.3f}, expected 0.60"

    def test_premium_levered_irr(self):
        """Premium Levered IRR should be ~13.03%."""
        irr = self.outputs.scenarios["premium"].returns.levered_irr
        assert irr is not None
        # Allow wider tolerance due to expense approximations
        assert abs(irr - 0.1303) < 0.03, f"Premium Lev IRR={irr:.4f}, expected ~0.1303"

    def test_market_levered_irr(self):
        """Market Levered IRR should be ~14.10%."""
        irr = self.outputs.scenarios["market"].returns.levered_irr
        assert irr is not None
        assert abs(irr - 0.1410) < 0.03, f"Market Lev IRR={irr:.4f}, expected ~0.1410"

    def test_premium_unlevered_irr(self):
        """Premium Unlevered IRR should be ~8.75%."""
        irr = self.outputs.scenarios["premium"].returns.unlevered_irr
        assert irr is not None
        assert abs(irr - 0.0875) < 0.02, f"Premium Unlev IRR={irr:.4f}, expected ~0.0875"

    def test_premium_y1_coc(self):
        """Premium Y1 Cash-on-Cash should be ~5.19%."""
        coc = self.outputs.scenarios["premium"].returns.y1_cash_on_cash
        assert coc is not None
        assert abs(coc - 0.0519) < 0.02, f"Premium Y1 CoC={coc:.4f}, expected ~0.0519"

    def test_premium_avg_coc(self):
        """Premium Avg Cash-on-Cash should be ~6.93%."""
        coc = self.outputs.scenarios["premium"].returns.avg_cash_on_cash
        assert coc is not None
        assert abs(coc - 0.0693) < 0.02, f"Premium Avg CoC={coc:.4f}, expected ~0.0693"

    def test_premium_price_per_unit(self):
        """Premium $/Unit should be ~$212,934."""
        ppu = self.outputs.scenarios["premium"].valuation_summary.price_per_unit
        assert abs(ppu - 212_934) / 212_934 < 0.01, f"Premium $/Unit={ppu:.0f}, expected ~212,934"

    def test_premium_price_per_sf(self):
        """Premium $/SF should be ~$223.89."""
        ppsf = self.outputs.scenarios["premium"].valuation_summary.price_per_sf
        assert abs(ppsf - 223.89) / 223.89 < 0.01, f"Premium $/SF={ppsf:.2f}, expected ~223.89"

    def test_dcf_has_correct_years(self):
        """DCF should have 7 years (hold period)."""
        dcf = self.outputs.scenarios["premium"].dcf
        assert len(dcf.years) == 7

    def test_dcf_revenue_grows(self):
        """Revenue should grow year-over-year with 2% rental inflation."""
        dcf = self.outputs.scenarios["premium"].dcf
        for i in range(1, len(dcf.years)):
            assert dcf.years[i].total_income > dcf.years[i - 1].total_income

    def test_terminal_value_premium(self):
        """Premium terminal value should be ~$82M."""
        tv = self.outputs.scenarios["premium"].returns.reversion.gross_selling_price
        assert tv > 70_000_000, f"Terminal value too low: {tv:.0f}"
        assert tv < 100_000_000, f"Terminal value too high: {tv:.0f}"

    def test_operating_statement_has_lines(self):
        """Operating statement should have revenue, expense, and summary lines."""
        os = self.outputs.operating_statement
        assert len(os.revenue_lines) > 0
        assert len(os.expense_lines) > 0
        assert len(os.summary_lines) > 0

    def test_debt_full_io(self):
        """With full I/O (84 months = 7 year hold), all debt service should be interest-only."""
        debt = self.outputs.scenarios["premium"].debt
        expected_ds = debt.loan_amount * 0.0525
        for yr_ds in debt.annual_debt_service:
            assert abs(yr_ds - expected_ds) / expected_ds < 0.001, \
                f"DS={yr_ds:.0f}, expected ~{expected_ds:.0f} (full I/O)"

    def test_principal_outstanding_full_io(self):
        """With full I/O, principal should remain constant."""
        debt = self.outputs.scenarios["premium"].debt
        for po in debt.principal_outstanding:
            assert abs(po - debt.loan_amount) < 1.0, \
                f"Principal={po:.0f}, expected {debt.loan_amount:.0f} (full I/O)"


class TestIRRSolver:
    """Test the IRR solver directly."""

    def test_simple_irr(self):
        """Simple cash flow series with known IRR."""
        # -100, +110 → IRR = 10%
        cfs = [-100, 110]
        irr = UnderwritingEngine._solve_irr(cfs)
        assert irr is not None
        assert abs(irr - 0.10) < 0.001

    def test_multi_period_irr(self):
        """Multi-period cash flow."""
        # -1000, 300, 300, 300, 300 → IRR ≈ 7.71%
        cfs = [-1000, 300, 300, 300, 300]
        irr = UnderwritingEngine._solve_irr(cfs)
        assert irr is not None
        assert abs(irr - 0.0771) < 0.005

    def test_all_negative_returns_none(self):
        """All negative cash flows should return None."""
        cfs = [-100, -50, -25]
        irr = UnderwritingEngine._solve_irr(cfs)
        assert irr is None

    def test_empty_returns_none(self):
        """Empty cash flows should return None."""
        irr = UnderwritingEngine._solve_irr([])
        assert irr is None


class TestDebtSizing:
    """Test DSCR-constrained loan sizing."""

    def test_ltv_binds_when_dscr_not_constraining(self):
        """When DSCR doesn't bind, LTV determines loan amount."""
        inputs = build_prose_inputs()
        # With NOI ~$3.4M, DSCR 1.25x, full I/O at 5.25%:
        # Max DS = 3,400,000 / 1.25 = 2,720,000
        # Max Loan (I/O) = 2,720,000 / 0.0525 = 51,809,524
        # LTV Loan = 63,880,219 * 0.60 = 38,328,131
        # LTV < DSCR → LTV binds
        engine = UnderwritingEngine(inputs)
        outputs = engine.compute()
        debt = outputs.scenarios["premium"].debt
        assert not debt.is_dscr_constrained

    def test_dscr_binds_with_high_ltv(self):
        """When LTV is very high, DSCR should bind."""
        inputs = build_prose_inputs()
        inputs.max_ltv = 0.95  # Very high LTV
        engine = UnderwritingEngine(inputs)
        outputs = engine.compute()
        debt = outputs.scenarios["premium"].debt
        assert debt.is_dscr_constrained


class TestEdgeCases:
    """Test edge cases and boundary conditions."""

    def test_zero_purchase_price_skips_scenario(self):
        """Scenario with zero purchase price should not be computed."""
        inputs = build_prose_inputs()
        inputs.premium.purchase_price = 0
        engine = UnderwritingEngine(inputs)
        outputs = engine.compute()
        assert "premium" not in outputs.scenarios
        assert "market" in outputs.scenarios

    def test_zero_units(self):
        """Engine should handle zero units gracefully."""
        inputs = UWInputs(total_units=0, total_sf=0)
        engine = UnderwritingEngine(inputs)
        outputs = engine.compute()
        assert outputs.proforma.noi == 0

    def test_inplace_rent_basis(self):
        """In-place rent basis should produce gain/loss to lease."""
        inputs = build_prose_inputs()
        inputs.rent_basis = "inplace"
        engine = UnderwritingEngine(inputs)
        outputs = engine.compute()
        # In-place < market, so LTL should be negative (loss)
        assert outputs.proforma.revenue.gain_loss_to_lease != 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
