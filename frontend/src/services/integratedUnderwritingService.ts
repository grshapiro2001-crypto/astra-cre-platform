/**
 * Integrated underwriting service — V2 orchestrator endpoint.
 *
 * TODO(backend): the orchestrator endpoint does not yet exist. When it lands
 *   (expected path: POST /underwriting/v2/integrated), swap the mocked body
 *   for an axios/fetch call. Types already match backend Pydantic schemas
 *   (see backend/underwriting/v2/schemas/*.py).
 *
 * For now this stub returns zero-filled Result objects using the same shape
 * the real endpoint will return, so downstream code can be built against it.
 */

import type {
  IntegratedInput,
  IntegratedResult,
  RenovationResult,
  RetailResult,
  RetailScenarioResult,
  TaxAbatementResult,
} from '@/types/underwritingV2';

function emptyRenovationResult(enabled: boolean): RenovationResult {
  return {
    enabled,
    total_units_renovated: 0,
    total_renovation_cost: 0,
    weighted_avg_rent_premium: 0,
    implied_return_on_cost: 0,
    avg_units_renovated_per_year: 0,
    stabilized_revenue_increase: 0,
    annualized_return_on_investment: 0,
    quarterly_cash_flows: [],
    annual_rollups: [],
  };
}

function emptyRetailScenarioResult(name: string): RetailScenarioResult {
  return {
    scenario_name: name,
    discount_rate: 0,
    exit_cap: 0,
    annual_cash_flows: [],
    retail_value: 0,
    year_1_cap_rate: 0,
    value_per_retail_sf: 0,
    maximum_debt_proceeds: 0,
    implied_ltv: 0,
  };
}

function emptyRetailResult(enabled: boolean): RetailResult {
  return {
    enabled,
    total_square_feet: 0,
    weighted_average_rent_per_sf: 0,
    premium: emptyRetailScenarioResult('premium'),
    market: emptyRetailScenarioResult('market'),
  };
}

function emptyTaxAbatementResult(enabled: boolean): TaxAbatementResult {
  return {
    enabled,
    annual_total_taxes: [],
    annual_abatement_percent: [],
    annual_abatement_savings: [],
    npv_abatement: 0,
    taxes_after_abatement: [],
  };
}

export async function runIntegratedUnderwriting(
  payload: IntegratedInput,
): Promise<IntegratedResult> {
  // Simulate a tiny amount of async latency so callers don't block the
  // render synchronously. Remove once the real endpoint is wired.
  await new Promise((resolve) => setTimeout(resolve, 0));
  return {
    renovation: emptyRenovationResult(Boolean(payload.renovation?.enabled)),
    retail: emptyRetailResult(Boolean(payload.retail?.enabled)),
    tax_abatement: emptyTaxAbatementResult(Boolean(payload.tax_abatement?.enabled)),
  };
}
