/**
 * TypeScript types for the Underwriting Engine V1.
 * Mirrors backend Pydantic schemas in app/schemas/underwriting.py
 * All percentages as decimals (0.05 = 5%). All monetary values as number.
 */

// ---------------------------------------------------------------------------
// Input Detail Items
// ---------------------------------------------------------------------------

export interface UnitMixInput {
  floorplan: string;
  units: number;
  sf: number;
  market_rent: number;
  inplace_rent: number;
}

export interface OtherIncomeItem {
  line_item: string;
  description: string;
  amount_per_unit: number;
  input_mode: 'per_unit_year' | 'per_unit_month';
  fee_amount: number;
  annual_income: number;
}

export interface PayrollItem {
  position: string;
  salary: number;
  bonus: number;
  payroll_load_pct: number;
}

export interface ContractServiceItem {
  service: string;
  occupancy: number;
  monthly_per_unit: number;
  monthly_total: number;
  annual_total: number;
}

// ---------------------------------------------------------------------------
// Scenario Inputs
// ---------------------------------------------------------------------------

export interface ScenarioInputs {
  pricing_mode: 'manual' | 'direct_cap' | 'target_irr';
  purchase_price: number;
  terminal_cap_rate: number;
  target_cap_rate?: number | null;
  target_unlevered_irr?: number | null;
}

// ---------------------------------------------------------------------------
// Complete Input Schema
// ---------------------------------------------------------------------------

export interface UWInputs {
  total_units: number;
  total_sf: number;
  unit_mix: UnitMixInput[];
  trailing_t12?: Record<string, unknown> | null;
  trailing_t3?: Record<string, unknown> | null;
  premium: ScenarioInputs;
  market: ScenarioInputs;
  // Revenue
  rent_basis: 'market' | 'inplace';
  retention_ratio: number;
  renewal_rent_bump: number;
  vacancy_pct: number[];
  concession_pct: number[];
  bad_debt_pct: number[];
  nru_count: number;
  nru_avg_rent: number;
  utility_reimb_per_unit: number;
  parking_income_per_unit: number;
  other_income_items: OtherIncomeItem[];
  // Expenses
  utilities_per_unit: number;
  repairs_per_unit: number;
  make_ready_per_unit: number;
  contract_services_per_unit: number;
  marketing_per_unit: number;
  payroll_items: PayrollItem[];
  ga_per_unit: number;
  property_tax_mode: 'current' | 'reassessment';
  current_tax_amount: number;
  pct_of_purchase_assessed: number;
  assessment_ratio: number;
  millage_rate: number; // In mills (40.0 = 40 mills = $0.040 per dollar assessed)
  reassessment_year: number;
  insurance_per_unit: number;
  mgmt_fee_pct: number;
  reserves_per_unit: number;
  reserves_inflate: boolean;
  contract_services_items: ContractServiceItem[];
  // Growth
  rental_inflation: number[];
  expense_inflation: number[];
  re_tax_inflation: number[];
  // Debt — New Acquisition
  max_ltv: number;
  interest_rate: number;
  loan_term_months: number;
  io_period_months: number;
  amort_years: number;
  dscr_minimum: number;
  sales_expense_pct: number;
  hold_period_years: number;
  // Debt — Loan Assumption
  la_enabled: boolean;
  la_existing_balance: number;
  la_original_amount: number;
  la_interest_rate: number;
  la_origination_date: string | null;
  la_remaining_term_months: number;
  la_remaining_io_months: number;
  la_amort_years: number;
}

// ---------------------------------------------------------------------------
// Output Types
// ---------------------------------------------------------------------------

export interface RevenueResult {
  gsr: number;
  gain_loss_to_lease: number;
  gpr: number;
  vacancy: number;
  concessions: number;
  nru_loss: number;
  bad_debt: number;
  nri: number;
  utility_reimbursements: number;
  parking_income: number;
  other_income: number;
  total_income: number;
  monthly_collections: number;
}

export interface ExpenseResult {
  utilities: number;
  repairs_maintenance: number;
  make_ready: number;
  contract_services: number;
  marketing: number;
  payroll: number;
  general_admin: number;
  controllable_total: number;
  property_taxes: number;
  insurance: number;
  management_fee: number;
  non_controllable_total: number;
  total_expenses: number;
}

export interface ProformaResult {
  revenue: RevenueResult;
  expenses: ExpenseResult;
  noi: number;
  reserves: number;
  ncf: number;
  expense_ratio: number;
}

export interface DebtResult {
  loan_amount: number;
  actual_ltv: number;
  equity: number;
  is_dscr_constrained: boolean;
  annual_debt_service: number[];
  principal_outstanding: number[];
  loan_constant: number;
}

export interface DCFYearResult {
  year: number;
  gpr: number;
  vacancy: number;
  concessions: number;
  bad_debt: number;
  nru_loss: number;
  nri: number;
  other_income: number;
  total_income: number;
  controllable_expenses: number;
  property_taxes: number;
  insurance: number;
  management_fee: number;
  total_expenses: number;
  noi: number;
  reserves: number;
  ncf: number;
  debt_service: number;
  ncf_after_debt: number;
  cash_on_cash: number | null;
  dscr: number | null;
  revenue_growth_rate: number | null;
  noi_growth_rate: number | null;
  effective_rent: number;
}

export interface DCFResult {
  years: DCFYearResult[];
  revenue_cagr: number | null;
  noi_cagr: number | null;
}

export interface ReversionResult {
  forward_noi: number;
  gross_selling_price: number;
  sales_expenses: number;
  principal_outstanding: number;
  net_proceeds: number;
}

export interface ReturnsResult {
  levered_irr: number | null;
  unlevered_irr: number | null;
  y1_cash_on_cash: number | null;
  avg_cash_on_cash: number | null;
  equity_multiple: number | null;
  reversion: ReversionResult;
}

export interface CapRates {
  y1_cap_rate: number | null;
  inplace_cap_tax_adjusted: number | null;
  terminal_cap_rate: number | null;
}

export interface ValuationSummary {
  purchase_price: number;
  price_per_unit: number;
  price_per_sf: number;
  cap_rates: CapRates;
  y1_market_rent: number;
  y1_market_rent_psf: number;
  ltv: number;
  levered_irr: number | null;
  unlevered_irr: number | null;
  y1_cash_on_cash: number | null;
  avg_cash_on_cash: number | null;
  equity_multiple: number | null;
  terminal_value: number;
  terminal_value_per_unit: number;
  revenue_cagr: number | null;
  noi_cagr: number | null;
}

export interface ScenarioResult {
  proforma: ProformaResult;
  debt: DebtResult;
  dcf: DCFResult;
  returns: ReturnsResult;
  valuation_summary: ValuationSummary;
}

export interface OperatingStatementLine {
  label: string;
  t12_amount: number | null;
  t12_pct_income: number | null;
  t12_per_unit: number | null;
  t3_amount: number | null;
  t3_pct_income: number | null;
  t3_per_unit: number | null;
  proforma_amount: number | null;
  proforma_pct_income: number | null;
  proforma_per_unit: number | null;
  is_deduction: boolean;
  is_total: boolean;
}

export interface OperatingStatement {
  revenue_lines: OperatingStatementLine[];
  expense_lines: OperatingStatementLine[];
  summary_lines: OperatingStatementLine[];
}

export interface UWOutputs {
  proforma: ProformaResult;
  scenarios: Record<string, ScenarioResult>;
  operating_statement: OperatingStatement;
  operating_statements?: Record<string, OperatingStatement>;
}

// ---------------------------------------------------------------------------
// Default Inputs Factory
// ---------------------------------------------------------------------------

function arr8(val: number): number[] {
  return Array(8).fill(val);
}

export function createDefaultInputs(): UWInputs {
  return {
    total_units: 0,
    total_sf: 0,
    unit_mix: [],
    trailing_t12: null,
    trailing_t3: null,
    premium: { pricing_mode: 'manual', purchase_price: 0, terminal_cap_rate: 0.0525, target_cap_rate: null, target_unlevered_irr: null },
    market: { pricing_mode: 'manual', purchase_price: 0, terminal_cap_rate: 0.0550, target_cap_rate: null, target_unlevered_irr: null },
    rent_basis: 'market',
    retention_ratio: 0.55,
    renewal_rent_bump: 0.70,
    vacancy_pct: arr8(0.05),
    concession_pct: [0.02, 0.01, 0, 0, 0, 0, 0, 0],
    bad_debt_pct: [0.01, 0.005, 0.005, 0.005, 0.005, 0.005, 0.005, 0.005],
    nru_count: 2,
    nru_avg_rent: 0,
    utility_reimb_per_unit: 0,
    parking_income_per_unit: 0,
    other_income_items: [],
    utilities_per_unit: 0,
    repairs_per_unit: 0,
    make_ready_per_unit: 0,
    contract_services_per_unit: 0,
    marketing_per_unit: 0,
    payroll_items: [],
    ga_per_unit: 0,
    property_tax_mode: 'reassessment',
    current_tax_amount: 0,
    pct_of_purchase_assessed: 1.0,
    assessment_ratio: 0.40,
    millage_rate: 4.0,
    reassessment_year: 1,
    insurance_per_unit: 0,
    mgmt_fee_pct: 0.0275,
    reserves_per_unit: 200,
    reserves_inflate: false,
    contract_services_items: [],
    rental_inflation: arr8(0.02),
    expense_inflation: arr8(0.0275),
    re_tax_inflation: arr8(0.0275),
    max_ltv: 0.60,
    interest_rate: 0.0525,
    loan_term_months: 84,
    io_period_months: 84,
    amort_years: 30,
    dscr_minimum: 1.25,
    sales_expense_pct: 0.015,
    hold_period_years: 8,
    la_enabled: false,
    la_existing_balance: 0,
    la_original_amount: 0,
    la_interest_rate: 0,
    la_origination_date: null,
    la_remaining_term_months: 0,
    la_remaining_io_months: 0,
    la_amort_years: 30,
  };
}
