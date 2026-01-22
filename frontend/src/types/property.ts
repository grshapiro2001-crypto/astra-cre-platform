/**
 * Type definitions for property data and PDF extraction results
 */

export interface OpExComponents {
  controllable_expenses?: number | null;
  management_fee?: number | null;
  insurance?: number | null;
  property_taxes?: number | null;
}

export interface FinancialPeriod {
  period_label: string;  // Exact label from document (e.g., "T-12", "Trailing 3 Months", "Year 1")
  gsr?: number | null;
  vacancy?: number | null;
  concessions?: number | null;
  bad_debt?: number | null;
  non_revenue_units?: number | null;
  total_opex?: number | null;
  opex_components?: OpExComponents;
  noi?: number | null;
}

export interface CalculatedMetrics {
  economic_occupancy: number;  // Percentage
  opex_ratio: number;  // Percentage
  formula_econ_occ: string;  // Human-readable formula
  formula_opex: string;  // Human-readable formula
}

export interface PropertyInfo {
  deal_name?: string | null;
  property_address?: string | null;
  property_type?: string | null;
  submarket?: string | null;
  year_built?: number | null;
  total_units?: number | null;
  total_sf?: number | null;
}

export interface AverageRents {
  market_rent?: number | null;
  in_place_rent?: number | null;
}

export interface SourceNotes {
  property_info_source?: string | null;
  financials_source?: string | null;
}

// Phase 3A: BOV Pricing Tier Types
export interface BOVCapRate {
  cap_rate_type: string;  // "trailing", "proforma", "stabilized", etc.
  cap_rate_value?: number | null;
  noi_basis?: number | null;
  qualifier?: string | null;
}

export interface BOVLoanAssumptions {
  leverage?: number | null;
  loan_amount?: number | null;
  interest_rate?: number | null;
  io_period_months?: number | null;
  amortization_years?: number | null;
}

export interface BOVReturnMetrics {
  unlevered_irr?: number | null;
  levered_irr?: number | null;
  equity_multiple?: number | null;
  avg_cash_on_cash?: number | null;
}

export interface BOVTerminalAssumptions {
  terminal_cap_rate?: number | null;
  hold_period_years?: number | null;
}

export interface BOVPricingTier {
  pricing_tier_id: string;
  tier_label?: string | null;
  tier_type?: string | null;  // "asking_price", "market_assumption", or null
  pricing?: number | null;
  price_per_unit?: number | null;
  price_per_sf?: number | null;
  cap_rates: BOVCapRate[];
  loan_assumptions?: BOVLoanAssumptions | null;
  return_metrics?: BOVReturnMetrics | null;
  terminal_assumptions?: BOVTerminalAssumptions | null;
}

export interface ExtractionResult {
  document_type: 'OM' | 'BOV' | 'Unknown';
  confidence: 'high' | 'medium' | 'low';
  property_info: PropertyInfo;
  average_rents?: AverageRents;
  financials_by_period: {
    t12?: FinancialPeriod | null;
    t3?: FinancialPeriod | null;
    y1?: FinancialPeriod | null;
  };
  calculated_metrics: {
    t12?: CalculatedMetrics;
    t3?: CalculatedMetrics;
    y1?: CalculatedMetrics;
  };
  bov_pricing_tiers?: BOVPricingTier[];  // Phase 3A: BOV pricing tiers
  source_notes?: SourceNotes;
  missing_fields: string[];
}

export interface UploadResponse {
  success: boolean;
  filename: string;
  file_path: string;
  extraction_result: ExtractionResult;
}
