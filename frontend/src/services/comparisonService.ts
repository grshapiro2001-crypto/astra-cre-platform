/**
 * Comparison Service - API calls for property comparison
 * Phase 3B
 * NO LLM - Pure database operations
 */
import { api } from './api';

export interface ComparisonRequest {
  property_ids: number[];
}

export interface ComparisonPricing {
  price?: number;
  price_per_unit?: number;
  price_per_sf?: number;
}

export interface ComparisonCapRates {
  going_in?: number;
  stabilized?: number;
}

export interface ComparisonBOVReturns {
  tier_name?: string;
  levered_irr?: number;
  unlevered_irr?: number;
  equity_multiple?: number;
}

export interface ComparisonFinancials {
  t12_noi?: number;
  y1_noi?: number;
  noi_growth_pct?: number;
}

export interface ComparisonOperations {
  opex_ratio?: number;
  opex_per_unit?: number;
}

export interface PropertyComparisonItem {
  id: number;
  property_name: string;
  document_type: string;
  property_type?: string;
  property_address?: string;
  submarket?: string;
  total_units?: number;
  total_sf?: number;
  year_built?: number;
  pricing: ComparisonPricing;
  cap_rates: ComparisonCapRates;
  bov_returns?: ComparisonBOVReturns;
  financials: ComparisonFinancials;
  operations: ComparisonOperations;
}

export interface BestValues {
  best_price_per_unit?: number;
  best_price_per_sf?: number;
  best_going_in_cap?: number;
  best_stabilized_cap?: number;
  best_levered_irr?: number;
  best_unlevered_irr?: number;
  best_equity_multiple?: number;
  best_noi_growth?: number;
  lowest_opex_ratio?: number;
  lowest_opex_per_unit?: number;
}

export interface ComparisonResponse {
  properties: PropertyComparisonItem[];
  best_values: BestValues;
}

export const comparisonService = {
  /**
   * Compare multiple properties side-by-side
   * NO LLM - Pure database query
   */
  async compareProperties(propertyIds: number[]): Promise<ComparisonResponse> {
    const response = await api.post('/properties/compare', {
      property_ids: propertyIds
    });
    return response.data;
  }
};
