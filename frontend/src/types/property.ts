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
  // Granular financial line items
  loss_to_lease?: number | null;
  vacancy_rate_pct?: number | null;
  credit_loss?: number | null;
  net_rental_income?: number | null;
  utility_reimbursements?: number | null;
  parking_storage_income?: number | null;
  other_income?: number | null;
  management_fee_pct?: number | null;
  real_estate_taxes?: number | null;
  insurance_amount?: number | null;
  replacement_reserves?: number | null;
  net_cash_flow?: number | null;
  expense_ratio_pct?: number | null;
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
  metro?: string | null;
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

export interface UnitMixItem {
  id: number;
  floorplan_name: string | null;
  unit_type: string | null;
  bedroom_count: number | null;
  bathroom_count: number | null;
  num_units: number | null;
  unit_sf: number | null;
  in_place_rent: number | null;
  proforma_rent: number | null;
  proforma_rent_psf: number | null;
  renovation_premium: number | null;
}

export interface RentCompItem {
  id: number;
  comp_name: string;
  location: string | null;
  num_units: number | null;
  avg_unit_sf: number | null;
  in_place_rent: number | null;
  in_place_rent_psf: number | null;
  bedroom_type: string | null;
  is_new_construction: boolean;
}

export interface RenovationData {
  renovation_cost_per_unit?: number | null;
  renovation_total_cost?: number | null;
  renovation_rent_premium?: number | null;
  renovation_roi_pct?: number | null;
  renovation_duration_years?: number | null;
  renovation_stabilized_revenue?: number | null;
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
  renovation?: RenovationData;  // Renovation assumptions from extraction
  unit_mix?: UnitMixItem[];  // Unit mix floorplan data from extraction
  rent_comps?: RentCompItem[];  // Rent comparable properties from extraction
  source_notes?: SourceNotes;
  missing_fields: string[];
}

export interface UploadResponse {
  success: boolean;
  filename: string;
  file_path: string;
  extraction_result: ExtractionResult;
}

/** Alias for backwards compatibility */
export type FinancialPeriodData = FinancialPeriod;

/** Property detail as returned from the API */
export interface PropertyDetail {
  id: number;
  deal_folder_id?: number | null;
  deal_name: string;
  uploaded_filename?: string;
  document_type: string;
  document_subtype?: string;
  property_address?: string | null;
  property_type?: string | null;
  submarket?: string | null;
  metro?: string | null;
  year_built?: number | null;
  total_units?: number | null;
  total_residential_sf?: number | null;
  average_market_rent?: number | null;
  average_inplace_rent?: number | null;
  // Renovation assumptions
  renovation_cost_per_unit?: number | null;
  renovation_total_cost?: number | null;
  renovation_rent_premium?: number | null;
  renovation_roi_pct?: number | null;
  renovation_duration_years?: number | null;
  renovation_stabilized_revenue?: number | null;
  // Financials
  t12_financials?: FinancialPeriod | null;
  t3_financials?: FinancialPeriod | null;
  y1_financials?: FinancialPeriod | null;
  calculated_metrics?: {
    t12?: CalculatedMetrics;
    t3?: CalculatedMetrics;
    y1?: CalculatedMetrics;
  };
  bov_pricing_tiers?: BOVPricingTier[];
  // Unit mix and rent comps
  unit_mix?: UnitMixItem[];
  rent_comps?: RentCompItem[];
  source_notes?: SourceNotes;
  missing_fields?: string[];
  upload_date?: string;
  last_analyzed_at?: string;
  analysis_count?: number;
  raw_pdf_path?: string;
  user_id?: string;
  screening_verdict?: string | null;
  screening_score?: number | null;
  screening_details_json?: string | null;
}

/** Property list item for library views */
export interface PropertyListItem {
  id: number;
  deal_folder_id?: number | null;
  deal_name: string;
  property_name?: string;
  document_type: string;
  document_subtype?: string;
  property_type?: string | null;
  property_address?: string | null;
  submarket?: string | null;
  total_units?: number | null;
  upload_date?: string;
  screening_verdict?: string | null;
  screening_score?: number | null;
  pipeline_stage?: string;
  pipeline_notes?: string | null;
  t12_noi?: number | null;
  y1_noi?: number | null;
  t3_noi?: number | null;
}

/** Investment criteria for deal screening */
export interface InvestmentCriteria {
  id: number;
  user_id: string;
  criteria_name: string;
  min_units?: number | null;
  max_units?: number | null;
  property_types?: string | null;
  target_markets?: string | null;
  min_year_built?: number | null;
  min_cap_rate?: number | null;
  max_cap_rate?: number | null;
  min_economic_occupancy?: number | null;
  max_opex_ratio?: number | null;
  min_noi?: number | null;
  max_price_per_unit?: number | null;
  min_deal_score?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
}

/** Screening check result */
export interface ScreeningCheck {
  criterion: string;
  value: number | null;
  result: 'PASS' | 'FAIL' | 'SKIP';
}

/** Full screening result for a property */
export interface ScreeningResult {
  property_id: number;
  property_name: string;
  verdict: 'PASS' | 'FAIL' | 'REVIEW';
  score: number;
  checks: ScreeningCheck[];
  summary: string;
}

/** Screening summary item */
export interface ScreeningSummaryItem {
  property_id: number;
  property_name: string;
  verdict: 'PASS' | 'FAIL' | 'REVIEW';
  score: number;
  summary: string;
}
