/**
 * Shared types for the Comparison page and subcomponents
 */
import type { Criterion, PropertyRanking, MetricKey as CriteriaMetricKey } from '@/utils/criteriaEvaluation';

// Re-export API-facing types from the comparison service
export type {
  ComparisonPricing,
  ComparisonCapRates,
  ComparisonBOVReturns,
  ComparisonFinancials,
  ComparisonOperations,
  PropertyComparisonItem,
  BestValues,
  ComparisonResponse,
} from '@/services/comparisonService';

// Re-export criteria types for convenience
export type { Criterion, PropertyRanking, CriteriaMetricKey };

// ============================================================
// UI-only types
// ============================================================

export type ViewMode = 'quick' | 'deep';
export type DeepViewMode = 'table' | 'scatter';
export type ScoringDirection = 'higher' | 'lower' | 'neutral';
export type NormalizationMode = 'absolute' | 'per_unit' | 'per_sf';

export type CompMetricKey =
  | 'going_in_cap'
  | 'stabilized_cap'
  | 'price_per_unit'
  | 'price_per_sf'
  | 'total_price'
  | 'levered_irr'
  | 'unlevered_irr'
  | 'equity_multiple'
  | 'noi_growth'
  | 't12_noi'
  | 'y1_noi'
  | 'total_units'
  | 'year_built'
  | 'total_sf'
  | 'opex_ratio'
  | 'opex_per_unit';

export interface ScoringConfig {
  weight: number;
  target: number;
  direction: ScoringDirection;
}

export interface MetricPreset {
  name: string;
  metrics: CompMetricKey[];
  scoring: Record<string, ScoringConfig>;
}

export interface MetricDef {
  label: string;
  format: (v: number | null | undefined) => string;
  category: 'info' | 'pricing' | 'returns' | 'financials' | 'operations';
}

export interface ScoreBreakdownItem {
  score: number;
  weight: number;
  value: number | null;
}

export interface DealScore {
  total: number;
  breakdown: Record<string, ScoreBreakdownItem>;
}

export interface ScoredProperty {
  property: import('@/services/comparisonService').PropertyComparisonItem;
  score: DealScore | null;
  rank: number;
}

export interface SensitivityImpact {
  originalPrice: number;
  newPrice: number;
  priceChange: number;
  priceChangePct: number;
}

export interface TableRowDef {
  label: string;
  getValue: (p: import('@/services/comparisonService').PropertyComparisonItem) => string;
  metricKey?: CompMetricKey;
  criteriaKey?: CriteriaMetricKey;
  /** Whether this metric is a financial amount that can be normalized per-unit or per-sf */
  normalizable?: boolean;
  getRawValue?: (p: import('@/services/comparisonService').PropertyComparisonItem) => number | null | undefined;
}

export interface TableSectionDef {
  title: string;
  rows: TableRowDef[];
}

export interface RadarChartProps {
  properties: import('@/services/comparisonService').PropertyComparisonItem[];
  metrics: CompMetricKey[];
  scoresByProperty: Record<number, Record<string, number>>;
}

export interface SortConfig {
  key: CompMetricKey | 'deal_score' | 'name';
  direction: 'asc' | 'desc';
}
