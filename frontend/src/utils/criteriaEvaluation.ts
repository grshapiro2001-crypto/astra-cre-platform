/**
 * Investment Criteria Ranking Utility
 *
 * This module provides types and functions for ranking properties based on
 * selected metrics in the comparison view. Uses gradient highlighting to show
 * relative performance.
 */

import { PropertyComparisonItem } from '../services/comparisonService';
import { fmtPercent } from './formatUtils';

/**
 * Supported metric keys matching ComparisonResponse data structure
 */
export type MetricKey =
  | 'going_in_cap'
  | 'stabilized_cap'
  | 'levered_irr'
  | 'unlevered_irr'
  | 'price_per_unit'
  | 'price_per_sf'
  | 'noi_growth';

/**
 * Direction type - which is better
 */
export type DirectionType = 'highest' | 'lowest';

/**
 * Single investment criterion (SIMPLIFIED)
 */
export interface Criterion {
  id: string;
  metric: MetricKey;
  label: string; // Display name
  direction: DirectionType; // Highest or Lowest is better
}

/**
 * Ranking result for a single property
 */
export interface PropertyRanking {
  propertyId: number;
  avgRank: number; // Average rank across all criteria (1 = best)
  ranksByMetric: Map<MetricKey, number>; // Individual ranks for each metric
}

/**
 * Configuration for each supported metric
 */
export interface MetricConfig {
  label: string;
  path: string[]; // Nested path to value in PropertyComparisonItem
  formatter: (value: number) => string;
  defaultDirection: DirectionType;
}

/**
 * Configuration for all supported metrics
 */
export const METRIC_CONFIGS: Record<MetricKey, MetricConfig> = {
  going_in_cap: {
    label: 'Going-In Cap Rate',
    path: ['cap_rates', 'going_in'],
    formatter: (val) => fmtPercent(val),
    defaultDirection: 'highest', // Higher is better
  },
  stabilized_cap: {
    label: 'Stabilized Cap Rate',
    path: ['cap_rates', 'stabilized'],
    formatter: (val) => fmtPercent(val),
    defaultDirection: 'highest',
  },
  levered_irr: {
    label: 'Levered IRR',
    path: ['bov_returns', 'levered_irr'],
    formatter: (val) => fmtPercent(val),
    defaultDirection: 'highest',
  },
  unlevered_irr: {
    label: 'Unlevered IRR',
    path: ['bov_returns', 'unlevered_irr'],
    formatter: (val) => fmtPercent(val),
    defaultDirection: 'highest',
  },
  price_per_unit: {
    label: 'Price per Unit',
    path: ['pricing', 'price_per_unit'],
    formatter: (val) => `$${val.toLocaleString()}`,
    defaultDirection: 'lowest', // Lower is better
  },
  price_per_sf: {
    label: 'Price per SF',
    path: ['pricing', 'price_per_sf'],
    formatter: (val) => `$${val.toFixed(2)}`,
    defaultDirection: 'lowest', // Lower is better
  },
  noi_growth: {
    label: 'NOI Growth',
    path: ['financials', 'noi_growth_pct'],
    formatter: (val) => fmtPercent(val),
    defaultDirection: 'highest',
  },
};

/**
 * Extract metric value from property data using path
 */
function getMetricValue(property: PropertyComparisonItem, path: string[]): number | null {
  let value: any = property;
  for (const key of path) {
    value = value?.[key];
    if (value === undefined || value === null) return null;
  }
  return typeof value === 'number' ? value : null;
}

/**
 * Rank properties by a single metric
 * Returns Map of propertyId -> rank (1 = best, N = worst)
 */
function rankPropertiesByMetric(
  properties: PropertyComparisonItem[],
  metric: MetricKey,
  direction: DirectionType
): Map<number, number> {
  const config = METRIC_CONFIGS[metric];

  // Filter out properties that don't have this metric
  const validProperties = properties.filter(p => {
    const value = getMetricValue(p, config.path);
    return value !== null;
  });

  // Sort based on direction
  const sorted = [...validProperties].sort((a, b) => {
    const aVal = getMetricValue(a, config.path)!;
    const bVal = getMetricValue(b, config.path)!;

    // Highest: sort descending (biggest first)
    // Lowest: sort ascending (smallest first)
    return direction === 'highest' ? bVal - aVal : aVal - bVal;
  });

  // Assign ranks
  const ranks = new Map<number, number>();
  sorted.forEach((prop, idx) => {
    ranks.set(prop.id, idx + 1);
  });

  // Properties without this metric get worst rank
  const worstRank = sorted.length + 1;
  properties.forEach(p => {
    if (!ranks.has(p.id)) {
      ranks.set(p.id, worstRank);
    }
  });

  return ranks;
}

/**
 * Calculate rankings for all properties based on criteria
 * Returns Map of propertyId -> PropertyRanking
 */
export function rankProperties(
  properties: PropertyComparisonItem[],
  criteria: Criterion[]
): Map<number, PropertyRanking> {
  const rankings = new Map<number, PropertyRanking>();

  // If no criteria, return empty map
  if (criteria.length === 0) {
    return rankings;
  }

  // Calculate ranks for each criterion
  const ranksByMetric = new Map<MetricKey, Map<number, number>>();

  for (const criterion of criteria) {
    const metricRanks = rankPropertiesByMetric(
      properties,
      criterion.metric,
      criterion.direction
    );
    ranksByMetric.set(criterion.metric, metricRanks);
  }

  // Calculate average rank for each property
  for (const property of properties) {
    let totalRank = 0;
    const propertyRanksByMetric = new Map<MetricKey, number>();

    for (const criterion of criteria) {
      const metricRanks = ranksByMetric.get(criterion.metric)!;
      const rank = metricRanks.get(property.id) || properties.length;
      propertyRanksByMetric.set(criterion.metric, rank);
      totalRank += rank;
    }

    const avgRank = totalRank / criteria.length;

    rankings.set(property.id, {
      propertyId: property.id,
      avgRank,
      ranksByMetric: propertyRanksByMetric,
    });
  }

  return rankings;
}

/**
 * Get gradient color class based on average rank
 * Best properties = green, worst = red
 */
export function getGradientColor(avgRank: number, totalProperties: number): string {
  if (totalProperties <= 1) return '';

  // Normalize rank to 0-1 scale (0 = best, 1 = worst)
  const normalized = (avgRank - 1) / (totalProperties - 1);

  // Apply gradient based on normalized rank
  if (normalized <= 0.2) {
    return 'bg-emerald-500 text-white'; // Best 20%
  } else if (normalized <= 0.4) {
    return 'bg-emerald-300 text-emerald-900'; // Good
  } else if (normalized <= 0.6) {
    return 'bg-yellow-200 text-yellow-900'; // Middle
  } else if (normalized <= 0.8) {
    return 'bg-orange-300 text-orange-900'; // Below average
  } else {
    return 'bg-red-400 text-white'; // Worst 20%
  }
}
