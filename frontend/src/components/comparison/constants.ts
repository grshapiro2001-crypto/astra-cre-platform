/**
 * Shared constants for the Comparison page and subcomponents
 */
import { fmtPercent, fmtCapRate } from '@/utils/formatUtils';
import type { CompMetricKey, MetricDef, MetricPreset, TableSectionDef } from './types';

// ============================================================
// Formatting
// ============================================================

export const EM_DASH = '\u2014';

export function formatPrice(num: number | null | undefined): string {
  if (num == null) return EM_DASH;
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `$${Math.round(num / 1_000).toLocaleString()}K`;
  return `$${num.toLocaleString()}`;
}

// ============================================================
// Colors
// ============================================================

export const PROPERTY_COLORS = ['#ffffff', '#d4d4d8', '#a1a1aa', '#71717a', '#52525b'];

// ============================================================
// Metric Definitions
// ============================================================

export const METRIC_DEFS: Record<CompMetricKey, MetricDef> = {
  going_in_cap: {
    label: 'Going-In Cap',
    format: (v) => (v != null ? fmtCapRate(v) : EM_DASH),
    category: 'returns',
  },
  stabilized_cap: {
    label: 'Stabilized Cap',
    format: (v) => (v != null ? fmtCapRate(v) : EM_DASH),
    category: 'returns',
  },
  price_per_unit: {
    label: '$/Unit',
    format: (v) => (v != null ? `$${Math.round(v).toLocaleString()}` : EM_DASH),
    category: 'pricing',
  },
  price_per_sf: {
    label: '$/SF',
    format: (v) => (v != null ? `$${v.toFixed(2)}` : EM_DASH),
    category: 'pricing',
  },
  total_price: {
    label: 'Total Price',
    format: formatPrice,
    category: 'pricing',
  },
  levered_irr: {
    label: 'Levered IRR',
    format: (v) => (v != null ? fmtPercent(v) : EM_DASH),
    category: 'returns',
  },
  unlevered_irr: {
    label: 'Unlevered IRR',
    format: (v) => (v != null ? fmtPercent(v) : EM_DASH),
    category: 'returns',
  },
  equity_multiple: {
    label: 'Equity Multiple',
    format: (v) => (v != null ? `${v.toFixed(2)}x` : EM_DASH),
    category: 'returns',
  },
  noi_growth: {
    label: 'NOI Growth',
    format: (v) => (v != null ? fmtPercent(v) : EM_DASH),
    category: 'financials',
  },
  t12_noi: {
    label: 'T12 NOI',
    format: formatPrice,
    category: 'financials',
  },
  y1_noi: {
    label: 'Y1 NOI',
    format: formatPrice,
    category: 'financials',
  },
  total_units: {
    label: 'Units',
    format: (v) => (v != null ? v.toLocaleString() : EM_DASH),
    category: 'info',
  },
  year_built: {
    label: 'Year Built',
    format: (v) => (v != null ? v.toString() : EM_DASH),
    category: 'info',
  },
  total_sf: {
    label: 'Total SF',
    format: (v) => (v != null ? v.toLocaleString() : EM_DASH),
    category: 'info',
  },
  opex_ratio: {
    label: 'OpEx Ratio',
    format: (v) => (v != null ? fmtPercent(v, 1) : EM_DASH),
    category: 'operations',
  },
  opex_per_unit: {
    label: 'OpEx/Unit',
    format: (v) => (v != null ? `$${Math.round(v).toLocaleString()}` : EM_DASH),
    category: 'operations',
  },
};

// ============================================================
// Scoring Presets
// ============================================================

export const DEFAULT_PRESETS: Record<string, MetricPreset> = {
  'value-add': {
    name: 'Value-Add Screen',
    metrics: [
      'going_in_cap',
      'price_per_unit',
      'noi_growth',
      'levered_irr',
      'year_built',
    ],
    scoring: {
      going_in_cap: { weight: 25, target: 5.0, direction: 'higher' },
      price_per_unit: { weight: 25, target: 200000, direction: 'lower' },
      noi_growth: { weight: 20, target: 5.0, direction: 'higher' },
      levered_irr: { weight: 15, target: 15, direction: 'higher' },
      year_built: { weight: 15, target: 2015, direction: 'higher' },
    },
  },
  'core-plus': {
    name: 'Core-Plus Analysis',
    metrics: [
      'stabilized_cap',
      'equity_multiple',
      'opex_ratio',
      'price_per_sf',
      't12_noi',
    ],
    scoring: {
      stabilized_cap: { weight: 25, target: 5.5, direction: 'higher' },
      equity_multiple: { weight: 25, target: 2.0, direction: 'higher' },
      opex_ratio: { weight: 20, target: 40, direction: 'lower' },
      price_per_sf: { weight: 15, target: 200, direction: 'lower' },
      t12_noi: { weight: 15, target: 3000000, direction: 'higher' },
    },
  },
  'broker-comp': {
    name: 'Broker Comp Set',
    metrics: [
      'total_price',
      'price_per_unit',
      'price_per_sf',
      'going_in_cap',
      'total_units',
    ],
    scoring: {
      total_price: { weight: 20, target: 50000000, direction: 'neutral' },
      price_per_unit: { weight: 25, target: 220000, direction: 'neutral' },
      price_per_sf: { weight: 20, target: 220, direction: 'neutral' },
      going_in_cap: { weight: 25, target: 5.0, direction: 'higher' },
      total_units: { weight: 10, target: 250, direction: 'neutral' },
    },
  },
};

// ============================================================
// Table Sections (Deep View)
// ============================================================

export const TABLE_SECTIONS: TableSectionDef[] = [
  {
    title: 'PROPERTY INFORMATION',
    rows: [
      {
        label: 'Location',
        getValue: (p) => p.property_address ?? EM_DASH,
      },
      {
        label: 'Submarket',
        getValue: (p) => p.submarket ?? EM_DASH,
      },
      {
        label: 'Units',
        getValue: (p) => p.total_units?.toLocaleString() ?? EM_DASH,
        metricKey: 'total_units',
      },
      {
        label: 'Total SF',
        getValue: (p) => p.total_sf?.toLocaleString() ?? EM_DASH,
        metricKey: 'total_sf',
      },
      {
        label: 'Year Built',
        getValue: (p) => p.year_built?.toString() ?? EM_DASH,
        metricKey: 'year_built',
      },
    ],
  },
  {
    title: 'PRICING',
    rows: [
      {
        label: 'Total Price',
        getValue: (p) => formatPrice(p.pricing.price),
        metricKey: 'total_price',
        normalizable: true,
        getRawValue: (p) => p.pricing.price,
      },
      {
        label: '$/Unit',
        getValue: (p) => METRIC_DEFS.price_per_unit.format(p.pricing.price_per_unit),
        metricKey: 'price_per_unit',
        criteriaKey: 'price_per_unit',
      },
      {
        label: '$/SF',
        getValue: (p) => METRIC_DEFS.price_per_sf.format(p.pricing.price_per_sf),
        metricKey: 'price_per_sf',
        criteriaKey: 'price_per_sf',
      },
    ],
  },
  {
    title: 'CAP RATES & RETURNS',
    rows: [
      {
        label: 'Going-In Cap',
        getValue: (p) => METRIC_DEFS.going_in_cap.format(p.cap_rates.going_in),
        metricKey: 'going_in_cap',
        criteriaKey: 'going_in_cap',
      },
      {
        label: 'Stabilized Cap',
        getValue: (p) => METRIC_DEFS.stabilized_cap.format(p.cap_rates.stabilized),
        metricKey: 'stabilized_cap',
        criteriaKey: 'stabilized_cap',
      },
      {
        label: 'Levered IRR',
        getValue: (p) => METRIC_DEFS.levered_irr.format(p.bov_returns?.levered_irr),
        metricKey: 'levered_irr',
        criteriaKey: 'levered_irr',
      },
      {
        label: 'Unlevered IRR',
        getValue: (p) => METRIC_DEFS.unlevered_irr.format(p.bov_returns?.unlevered_irr),
        metricKey: 'unlevered_irr',
        criteriaKey: 'unlevered_irr',
      },
      {
        label: 'Equity Multiple',
        getValue: (p) => METRIC_DEFS.equity_multiple.format(p.bov_returns?.equity_multiple),
        metricKey: 'equity_multiple',
      },
    ],
  },
  {
    title: 'FINANCIALS',
    rows: [
      {
        label: 'T12 NOI',
        getValue: (p) => formatPrice(p.financials.t12_noi),
        metricKey: 't12_noi',
        normalizable: true,
        getRawValue: (p) => p.financials.t12_noi,
      },
      {
        label: 'Y1 NOI',
        getValue: (p) => formatPrice(p.financials.y1_noi),
        metricKey: 'y1_noi',
        normalizable: true,
        getRawValue: (p) => p.financials.y1_noi,
      },
      {
        label: 'NOI Growth',
        getValue: (p) => METRIC_DEFS.noi_growth.format(p.financials.noi_growth_pct),
        metricKey: 'noi_growth',
        criteriaKey: 'noi_growth',
      },
    ],
  },
  {
    title: 'OPERATIONS',
    rows: [
      {
        label: 'Economic Occupancy',
        getValue: (p) => p.operations.economic_occupancy != null ? fmtPercent(p.operations.economic_occupancy, 1) : EM_DASH,
      },
      {
        label: 'OpEx Ratio',
        getValue: (p) => METRIC_DEFS.opex_ratio.format(p.operations.opex_ratio),
        metricKey: 'opex_ratio',
      },
      {
        label: 'OpEx/Unit',
        getValue: (p) => METRIC_DEFS.opex_per_unit.format(p.operations.opex_per_unit),
        metricKey: 'opex_per_unit',
      },
    ],
  },
];

/** Metrics that are financial amounts subject to normalization */
export const NORMALIZABLE_METRICS: Set<CompMetricKey> = new Set([
  'total_price', 't12_noi', 'y1_noi',
]);

/** Metrics where higher is favorable */
export const HIGHER_IS_BETTER: Set<CompMetricKey> = new Set([
  'going_in_cap', 'stabilized_cap', 'levered_irr', 'unlevered_irr',
  'equity_multiple', 'noi_growth', 'total_units', 'total_sf',
]);

/** Metrics where lower is favorable */
export const LOWER_IS_BETTER: Set<CompMetricKey> = new Set([
  'price_per_unit', 'price_per_sf', 'total_price', 'opex_ratio', 'opex_per_unit',
]);
