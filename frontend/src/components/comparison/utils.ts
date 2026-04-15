/**
 * Shared utility functions for the Comparison page and subcomponents
 */
import type { PropertyDetail } from '@/services/propertyService';
import type {
  PropertyComparisonItem,
  BestValues,
  ComparisonResponse,
  ComparisonPricing,
  ComparisonBOVReturns,
  CompMetricKey,
  NormalizationMode,
} from './types';
import { EM_DASH, formatPrice, HIGHER_IS_BETTER, LOWER_IS_BETTER } from './constants';

// ============================================================
// Score Color Helpers
// ============================================================

export function getScoreHex(score: number): string {
  if (score >= 90) return '#ffffff';
  if (score >= 80) return '#d4d4d8';
  if (score >= 70) return '#a1a1aa';
  return '#71717a';
}

export function getScoreColorClass(score: number): string {
  if (score >= 80) return 'text-emerald-500';
  if (score >= 60) return 'text-amber-500';
  if (score >= 40) return 'text-amber-500';
  return 'text-rose-500';
}

export function getScoreBgClass(score: number): string {
  if (score >= 80) return 'bg-emerald-500/10';
  if (score >= 60) return 'bg-amber-500/10';
  if (score >= 40) return 'bg-amber-500/10';
  return 'bg-rose-500/10';
}

export function getScoreBarBg(score: number): string {
  if (score >= 80) return 'bg-emerald-500';
  if (score >= 60) return 'bg-amber-500';
  if (score >= 40) return 'bg-amber-500';
  return 'bg-rose-500';
}

// ============================================================
// Rank Helpers
// ============================================================

export function getRankLabel(rank: number): { label: string; colorClass: string } {
  if (rank === 1) return { label: '1ST', colorClass: 'text-amber-400' };
  if (rank === 2) return { label: '2ND', colorClass: 'text-slate-400' };
  if (rank === 3) return { label: '3RD', colorClass: 'text-amber-700' };
  return { label: `#${rank}`, colorClass: 'text-muted-foreground' };
}

// ============================================================
// Metric Accessors
// ============================================================

export function getPropertyMetric(
  property: PropertyComparisonItem,
  key: CompMetricKey
): number | null {
  switch (key) {
    case 'going_in_cap':
      return property.cap_rates.going_in ?? null;
    case 'stabilized_cap':
      return property.cap_rates.stabilized ?? null;
    case 'price_per_unit':
      return property.pricing.price_per_unit ?? null;
    case 'price_per_sf':
      return property.pricing.price_per_sf ?? null;
    case 'total_price':
      return property.pricing.price ?? null;
    case 'levered_irr':
      return property.bov_returns?.levered_irr ?? null;
    case 'unlevered_irr':
      return property.bov_returns?.unlevered_irr ?? null;
    case 'equity_multiple':
      return property.bov_returns?.equity_multiple ?? null;
    case 'noi_growth':
      return property.financials.noi_growth_pct ?? null;
    case 't12_noi':
      return property.financials.t12_noi ?? null;
    case 'y1_noi':
      return property.financials.y1_noi ?? null;
    case 'total_units':
      return property.total_units ?? null;
    case 'year_built':
      return property.year_built ?? null;
    case 'total_sf':
      return property.total_sf ?? null;
    case 'opex_ratio':
      return property.operations.opex_ratio ?? null;
    case 'opex_per_unit':
      return property.operations.opex_per_unit ?? null;
    default:
      return null;
  }
}

// ============================================================
// Best Value Checks
// ============================================================

export function isBestApiValue(
  property: PropertyComparisonItem,
  metricKey: CompMetricKey,
  bestValues: BestValues
): boolean {
  switch (metricKey) {
    case 'price_per_unit':
      return property.pricing.price_per_unit != null && property.pricing.price_per_unit === bestValues.best_price_per_unit;
    case 'price_per_sf':
      return property.pricing.price_per_sf != null && property.pricing.price_per_sf === bestValues.best_price_per_sf;
    case 'going_in_cap':
      return property.cap_rates.going_in != null && property.cap_rates.going_in === bestValues.best_going_in_cap;
    case 'stabilized_cap':
      return property.cap_rates.stabilized != null && property.cap_rates.stabilized === bestValues.best_stabilized_cap;
    case 'levered_irr':
      return property.bov_returns?.levered_irr != null && property.bov_returns.levered_irr === bestValues.best_levered_irr;
    case 'unlevered_irr':
      return property.bov_returns?.unlevered_irr != null && property.bov_returns.unlevered_irr === bestValues.best_unlevered_irr;
    case 'equity_multiple':
      return property.bov_returns?.equity_multiple != null && property.bov_returns.equity_multiple === bestValues.best_equity_multiple;
    case 'noi_growth':
      return property.financials.noi_growth_pct != null && property.financials.noi_growth_pct === bestValues.best_noi_growth;
    case 'opex_ratio':
      return property.operations.opex_ratio != null && property.operations.opex_ratio === bestValues.lowest_opex_ratio;
    case 'opex_per_unit':
      return property.operations.opex_per_unit != null && property.operations.opex_per_unit === bestValues.lowest_opex_per_unit;
    default:
      return false;
  }
}

// ============================================================
// Subject Delta Computation
// ============================================================

export interface DeltaResult {
  delta: number;
  deltaFormatted: string;
  isFavorable: boolean;
}

export function computeDelta(
  subjectValue: number | null,
  compValue: number | null,
  metricKey: CompMetricKey
): DeltaResult | null {
  if (subjectValue == null || compValue == null) return null;
  const delta = compValue - subjectValue;
  if (delta === 0) return { delta: 0, deltaFormatted: EM_DASH, isFavorable: true };

  const isHigherBetter = HIGHER_IS_BETTER.has(metricKey);
  const isLowerBetter = LOWER_IS_BETTER.has(metricKey);

  let isFavorable = true;
  if (isHigherBetter) isFavorable = delta > 0;
  else if (isLowerBetter) isFavorable = delta < 0;

  // Format the delta
  const absDelta = Math.abs(delta);
  const sign = delta > 0 ? '+' : '-';
  let formatted: string;

  if (metricKey === 'total_price' || metricKey === 't12_noi' || metricKey === 'y1_noi') {
    formatted = `${sign}${formatPrice(absDelta).replace('$', '$')}`;
  } else if (metricKey === 'price_per_unit' || metricKey === 'opex_per_unit') {
    formatted = `${sign}$${Math.round(absDelta).toLocaleString()}`;
  } else if (metricKey === 'price_per_sf') {
    formatted = `${sign}$${absDelta.toFixed(2)}`;
  } else if (metricKey === 'equity_multiple') {
    formatted = `${sign}${absDelta.toFixed(2)}x`;
  } else if (metricKey === 'going_in_cap' || metricKey === 'stabilized_cap' ||
             metricKey === 'levered_irr' || metricKey === 'unlevered_irr' ||
             metricKey === 'noi_growth' || metricKey === 'opex_ratio') {
    formatted = `${sign}${absDelta.toFixed(2)}%`;
  } else {
    formatted = `${sign}${absDelta.toLocaleString()}`;
  }

  return { delta, deltaFormatted: formatted, isFavorable };
}

// ============================================================
// Normalization
// ============================================================

export function normalizeValue(
  value: number | null | undefined,
  property: PropertyComparisonItem,
  mode: NormalizationMode
): number | null {
  if (value == null) return null;
  if (mode === 'absolute') return value;
  if (mode === 'per_unit') {
    const units = property.total_units;
    return units && units > 0 ? value / units : null;
  }
  if (mode === 'per_sf') {
    const sf = property.total_sf;
    return sf && sf > 0 ? value / sf : null;
  }
  return value;
}

// ============================================================
// Economic Occupancy Calculator
// ============================================================

export function calculateEconomicOccupancy(property: PropertyDetail): number | undefined {
  const t12Metrics = property.calculated_metrics?.t12;
  if (t12Metrics?.economic_occupancy != null) {
    return t12Metrics.economic_occupancy;
  }

  const t12 = property.t12_financials;
  if (!t12?.gsr || t12.gsr === 0) return undefined;

  const deductions =
    (t12.vacancy ?? 0) +
    (t12.concessions ?? 0) +
    (t12.bad_debt ?? 0) +
    (t12.non_revenue_units ?? 0);

  const economicRent = t12.gsr - deductions;
  return (economicRent / t12.gsr) * 100;
}

// ============================================================
// Transform PropertyDetail[] → ComparisonResponse
// ============================================================

export function transformToComparisonData(properties: PropertyDetail[]): ComparisonResponse {
  const comparisonItems: PropertyComparisonItem[] = properties.map(prop => {
    let goingInCap: number | undefined;
    let stabilizedCap: number | undefined;

    if (prop.bov_pricing_tiers?.length) {
      const firstTier = prop.bov_pricing_tiers[0];
      const goingInCapRate = firstTier.cap_rates.find(cr =>
        cr.cap_rate_type.toLowerCase().includes('going') ||
        cr.cap_rate_type.toLowerCase().includes('trailing')
      );
      const stabilizedCapRate = firstTier.cap_rates.find(cr =>
        cr.cap_rate_type.toLowerCase().includes('stabilized')
      );
      goingInCap = goingInCapRate?.cap_rate_value ?? undefined;
      stabilizedCap = stabilizedCapRate?.cap_rate_value ?? undefined;
    }

    if (!goingInCap && prop.t12_financials?.noi && prop.bov_pricing_tiers?.[0]?.pricing) {
      goingInCap = (prop.t12_financials.noi / prop.bov_pricing_tiers[0].pricing) * 100;
    }

    let noiGrowthPct: number | undefined;
    if (prop.t12_financials?.noi && prop.y1_financials?.noi) {
      noiGrowthPct = ((prop.y1_financials.noi - prop.t12_financials.noi) / prop.t12_financials.noi) * 100;
    }

    const firstTier = prop.bov_pricing_tiers?.[0];
    const pricing: ComparisonPricing = {
      price: firstTier?.pricing ?? undefined,
      price_per_unit: firstTier?.price_per_unit ?? undefined,
      price_per_sf: firstTier?.price_per_sf ?? undefined,
    };

    const bovReturns: ComparisonBOVReturns | undefined = firstTier?.return_metrics ? {
      tier_name: firstTier.tier_label ?? undefined,
      levered_irr: firstTier.return_metrics.levered_irr ?? undefined,
      unlevered_irr: firstTier.return_metrics.unlevered_irr ?? undefined,
      equity_multiple: firstTier.return_metrics.equity_multiple ?? undefined,
    } : undefined;

    let opexRatio: number | undefined;
    if (prop.calculated_metrics?.t12?.opex_ratio != null) {
      opexRatio = prop.calculated_metrics.t12.opex_ratio;
    } else if (prop.t12_financials?.total_opex && prop.t12_financials?.gsr) {
      opexRatio = (prop.t12_financials.total_opex / prop.t12_financials.gsr) * 100;
    }

    let opexPerUnit: number | undefined;
    if (prop.t12_financials?.total_opex && prop.total_units) {
      opexPerUnit = prop.t12_financials.total_opex / prop.total_units;
    }

    const economicOccupancy = calculateEconomicOccupancy(prop);

    return {
      id: prop.id,
      property_name: prop.deal_name,
      document_type: prop.document_type,
      property_type: prop.property_type ?? undefined,
      property_address: prop.property_address ?? undefined,
      submarket: prop.submarket ?? undefined,
      total_units: prop.total_units ?? undefined,
      total_sf: prop.total_residential_sf ?? undefined,
      year_built: prop.year_built ?? undefined,
      pricing,
      cap_rates: {
        going_in: goingInCap,
        stabilized: stabilizedCap,
      },
      bov_returns: bovReturns,
      financials: {
        t12_noi: prop.t12_financials?.noi ?? undefined,
        y1_noi: prop.y1_financials?.noi ?? undefined,
        noi_growth_pct: noiGrowthPct,
      },
      operations: {
        opex_ratio: opexRatio,
        opex_per_unit: opexPerUnit,
        economic_occupancy: economicOccupancy,
      },
    };
  });

  const bestValues: BestValues = {
    best_price_per_unit: undefined,
    best_price_per_sf: undefined,
    best_going_in_cap: undefined,
    best_stabilized_cap: undefined,
    best_levered_irr: undefined,
    best_unlevered_irr: undefined,
    best_equity_multiple: undefined,
    best_noi_growth: undefined,
    lowest_opex_ratio: undefined,
    lowest_opex_per_unit: undefined,
    best_economic_occupancy: undefined,
  };

  comparisonItems.forEach(item => {
    if (item.pricing.price_per_unit != null) {
      if (bestValues.best_price_per_unit == null || item.pricing.price_per_unit < bestValues.best_price_per_unit)
        bestValues.best_price_per_unit = item.pricing.price_per_unit;
    }
    if (item.pricing.price_per_sf != null) {
      if (bestValues.best_price_per_sf == null || item.pricing.price_per_sf < bestValues.best_price_per_sf)
        bestValues.best_price_per_sf = item.pricing.price_per_sf;
    }
    if (item.cap_rates.going_in != null) {
      if (bestValues.best_going_in_cap == null || item.cap_rates.going_in > bestValues.best_going_in_cap)
        bestValues.best_going_in_cap = item.cap_rates.going_in;
    }
    if (item.cap_rates.stabilized != null) {
      if (bestValues.best_stabilized_cap == null || item.cap_rates.stabilized > bestValues.best_stabilized_cap)
        bestValues.best_stabilized_cap = item.cap_rates.stabilized;
    }
    if (item.bov_returns?.levered_irr != null) {
      if (bestValues.best_levered_irr == null || item.bov_returns.levered_irr > bestValues.best_levered_irr)
        bestValues.best_levered_irr = item.bov_returns.levered_irr;
    }
    if (item.bov_returns?.unlevered_irr != null) {
      if (bestValues.best_unlevered_irr == null || item.bov_returns.unlevered_irr > bestValues.best_unlevered_irr)
        bestValues.best_unlevered_irr = item.bov_returns.unlevered_irr;
    }
    if (item.bov_returns?.equity_multiple != null) {
      if (bestValues.best_equity_multiple == null || item.bov_returns.equity_multiple > bestValues.best_equity_multiple)
        bestValues.best_equity_multiple = item.bov_returns.equity_multiple;
    }
    if (item.financials.noi_growth_pct != null) {
      if (bestValues.best_noi_growth == null || item.financials.noi_growth_pct > bestValues.best_noi_growth)
        bestValues.best_noi_growth = item.financials.noi_growth_pct;
    }
    if (item.operations.opex_ratio != null) {
      if (bestValues.lowest_opex_ratio == null || item.operations.opex_ratio < bestValues.lowest_opex_ratio)
        bestValues.lowest_opex_ratio = item.operations.opex_ratio;
    }
    if (item.operations.opex_per_unit != null) {
      if (bestValues.lowest_opex_per_unit == null || item.operations.opex_per_unit < bestValues.lowest_opex_per_unit)
        bestValues.lowest_opex_per_unit = item.operations.opex_per_unit;
    }
    if (item.operations.economic_occupancy != null) {
      if (bestValues.best_economic_occupancy == null || item.operations.economic_occupancy > bestValues.best_economic_occupancy)
        bestValues.best_economic_occupancy = item.operations.economic_occupancy;
    }
  });

  return { properties: comparisonItems, best_values: bestValues };
}

// ============================================================
// Comp Average Calculator
// ============================================================

export function computeCompAverage(
  properties: PropertyComparisonItem[],
  metricKey: CompMetricKey,
  subjectId?: number | null
): number | null {
  const comps = subjectId != null ? properties.filter(p => p.id !== subjectId) : properties;
  const values = comps.map(p => getPropertyMetric(p, metricKey)).filter((v): v is number => v != null);
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}
