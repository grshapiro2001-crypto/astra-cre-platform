/**
 * TypeScript types for Underwriting Engine V2 standalone modules.
 * Mirrors backend Pydantic schemas in backend/underwriting/v2/schemas/*.
 * All percentages as decimals (0.05 = 5%). All monetary values as number.
 */

// ---------------------------------------------------------------------------
// Renovation
// ---------------------------------------------------------------------------

export type RenovationUnitTypeLabel = 'Studio' | '1BR' | '2BR' | '3BR' | '4BR';

export const RENOVATION_UNIT_TYPE_LABELS: RenovationUnitTypeLabel[] = [
  'Studio',
  '1BR',
  '2BR',
  '3BR',
  '4BR',
];

export interface RenovationUnitType {
  unit_type: RenovationUnitTypeLabel;
  units_to_renovate: number;
  rent_premium_per_month: number;
}

export interface RenovationInput {
  enabled: boolean;
  start_year: number;                        // 1..11
  duration_years: number;                    // 1..11
  cost_per_unit: number;                     // $
  unit_types: RenovationUnitType[];          // fixed length 5
  incremental_rent_growth_rates: number[];   // length 11, decimals
  downtime_months_per_unit: number;          // default 1
  finance_with_loan: boolean;                // default false
}

export interface RenovationQuarterlyCashFlow {
  quarter: number;
  fiscal_year: number;
  quarter_in_year: number;
  units_renovated: number;
  incremental_revenue_gross_annual: number;
  incremental_revenue_factor: number;
  incremental_revenue_actual_annual: number;
  renovation_capex: number;
}

export interface RenovationAnnualRollup {
  fiscal_year: number;
  renovations_completed: number;
  annual_renovation_cost: number;
  potential_rent_premium_annual: number;
  downtime_deduction: number;
  current_year_revenue_growth: number;
  incremental_rent_growth_rate: number;
  cumulative_revenue_growth: number;
}

export interface RenovationResult {
  enabled: boolean;
  total_units_renovated: number;
  total_renovation_cost: number;
  weighted_avg_rent_premium: number;
  implied_return_on_cost: number;
  avg_units_renovated_per_year: number;
  stabilized_revenue_increase: number;
  annualized_return_on_investment: number;
  quarterly_cash_flows: RenovationQuarterlyCashFlow[];
  annual_rollups: RenovationAnnualRollup[];
}

// ---------------------------------------------------------------------------
// Retail
// ---------------------------------------------------------------------------

export type RetailLeaseType = 'NNN' | 'Gross' | 'Modified Gross';

export const RETAIL_LEASE_TYPES: RetailLeaseType[] = [
  'NNN',
  'Gross',
  'Modified Gross',
];

export interface RetailTenant {
  unit_number: number;
  tenant_name: string | null;
  square_feet: number;
  annual_rent_per_sf: number;
  lease_start_date: string | null;       // ISO yyyy-mm-dd
  lease_expiration_date: string | null;  // ISO yyyy-mm-dd
  lease_type: RetailLeaseType | null;
  absorption_months: number;
}

export interface RetailScenarioAssumptions {
  discount_rate: number;
  exit_cap: number;
}

export interface RetailInput {
  enabled: boolean;
  hold_period_years: number;
  rollover_vacancy: boolean;
  vacant_leaseup_rollover_months: number;
  tenants: RetailTenant[];
  expenses_per_sf: number;
  tenant_expense_recovery: number;
  tenant_improvement_per_sf: number;
  leasing_commission_percent: number;
  tenant_capex_recovery: number;
  rental_inflation: number;
  structural_vacancy_loss: number;
  credit_loss: number;
  expense_inflation: number;
  premium: RetailScenarioAssumptions;
  market: RetailScenarioAssumptions;
  mf_ltv_ratio: number;
  transaction_cost_percent: number;
}

export interface RetailAnnualCashFlow {
  year: number;
  potential_rental_income: number;
  vacancy_loss: number;
  credit_loss: number;
  expenses: number;
  expense_reimbursements: number;
  ti_and_lc: number;
  capex_reimbursements: number;
  net_cash_flow: number;
}

export interface RetailScenarioResult {
  scenario_name: string;
  discount_rate: number;
  exit_cap: number;
  annual_cash_flows: RetailAnnualCashFlow[];
  retail_value: number;
  year_1_cap_rate: number;
  value_per_retail_sf: number;
  maximum_debt_proceeds: number;
  implied_ltv: number;
}

export interface RetailResult {
  enabled: boolean;
  total_square_feet: number;
  weighted_average_rent_per_sf: number;
  premium: RetailScenarioResult;
  market: RetailScenarioResult;
}

// ---------------------------------------------------------------------------
// Tax Abatement
// ---------------------------------------------------------------------------

export interface TaxAbatementInput {
  enabled: boolean;
  hold_period_years: number;
  fair_market_value: number;
  sales_percent_pp: number;
  apt_percent: number;
  assessment_ratio: number;
  millage_rate: number;
  re_tax_inflation: number[];          // length >= hold_period_years
  storm_street_lights_y1: number;
  abatement_y1_percent: number;
  abatement_spread: number;
  discount_rate: number;
}

export interface TaxAbatementResult {
  enabled: boolean;
  annual_total_taxes: number[];
  annual_abatement_percent: number[];
  annual_abatement_savings: number[];
  npv_abatement: number;
  taxes_after_abatement: number[];
}

// ---------------------------------------------------------------------------
// Integrated payload (orchestrator stub — backend endpoint TBD)
// ---------------------------------------------------------------------------

export interface IntegratedInput {
  renovation?: RenovationInput;
  retail?: RetailInput;
  tax_abatement?: TaxAbatementInput;
}

export interface IntegratedResult {
  renovation: RenovationResult;
  retail: RetailResult;
  tax_abatement: TaxAbatementResult;
}

// ---------------------------------------------------------------------------
// Default factories
// ---------------------------------------------------------------------------

export function createDefaultRenovationInput(): RenovationInput {
  return {
    enabled: false,
    start_year: 1,
    duration_years: 2,
    cost_per_unit: 10000,
    unit_types: RENOVATION_UNIT_TYPE_LABELS.map((t) => ({
      unit_type: t,
      units_to_renovate: 0,
      rent_premium_per_month: 0,
    })),
    // TODO: expand to per-year curve once Valuation!C18:M18 equivalent lives
    // in the deal assumptions store. For now all 11 years share one rate.
    incremental_rent_growth_rates: Array(11).fill(0.02),
    downtime_months_per_unit: 1,
    finance_with_loan: false,
  };
}

export function createDefaultRetailInput(): RetailInput {
  return {
    enabled: false,
    hold_period_years: 10,
    rollover_vacancy: false,
    vacant_leaseup_rollover_months: 6,
    tenants: [],
    expenses_per_sf: 0,
    tenant_expense_recovery: 1.0,
    tenant_improvement_per_sf: 0,
    leasing_commission_percent: 0.05,
    tenant_capex_recovery: 1.0,
    rental_inflation: 0.03,
    structural_vacancy_loss: 0.05,
    credit_loss: 0.05,
    expense_inflation: 0.0275,
    premium: { discount_rate: 0.08, exit_cap: 0.065 },
    market: { discount_rate: 0.09, exit_cap: 0.075 },
    mf_ltv_ratio: 0.6,
    transaction_cost_percent: 0.015,
  };
}

export function createDefaultTaxAbatementInput(): TaxAbatementInput {
  return {
    enabled: false,
    hold_period_years: 10,
    fair_market_value: 0,
    sales_percent_pp: 1.0,
    apt_percent: 1.0,
    assessment_ratio: 0.4,
    millage_rate: 0.04,
    re_tax_inflation: Array(10).fill(0.0275),
    storm_street_lights_y1: 0,
    abatement_y1_percent: 0.5,
    abatement_spread: 0.05,
    discount_rate: 0.08,
  };
}

export function createDefaultRetailTenant(unitNumber: number): RetailTenant {
  return {
    unit_number: unitNumber,
    tenant_name: '',
    square_feet: 0,
    annual_rent_per_sf: 0,
    lease_start_date: null,
    lease_expiration_date: null,
    lease_type: 'NNN',
    absorption_months: 0,
  };
}
