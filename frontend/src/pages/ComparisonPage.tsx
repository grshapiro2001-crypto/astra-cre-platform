/**
 * ComparisonPage - Property comparison view (V3 Design)
 * "The Deal Decision Accelerator"
 *
 * Features:
 * - Quick view vs Deep analysis mode toggle
 * - Deal scores with animated scoring circles
 * - Bar race metric comparisons
 * - Sensitivity analysis (what-if cap rate slider)
 * - Category leaders panel
 * - Radar chart for multi-metric comparison (SVG)
 * - CSV export
 * - Investment criteria filtering (deep view)
 * - Preset scoring templates
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  Zap,
  Layers,
  Bookmark,
  Download,
  SlidersHorizontal,
  Trophy,
  Sparkles,
  Star,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  comparisonService,
  type ComparisonResponse,
  type PropertyComparisonItem,
  type BestValues,
} from '@/services/comparisonService';
import { scoringService } from '@/services/scoringService';
import type { DealScoreResult } from '@/services/scoringService';
import { DealScoreBadge } from '@/components/scoring/DealScoreBadge';
import { DealScoreModal } from '@/components/scoring/DealScoreModal';
import { exportComparisonToCSV } from '@/utils/csvExport';
import { InvestmentCriteriaPanel } from '@/components/comparison/InvestmentCriteriaPanel';
import {
  type Criterion,
  type PropertyRanking,
  type MetricKey as CriteriaMetricKey,
  rankProperties,
  getGradientColor,
} from '@/utils/criteriaEvaluation';
import { ComparisonSkeleton } from '@/components/ui/PageSkeleton';

// ============================================================
// Types
// ============================================================

type ViewMode = 'quick' | 'deep';
type ScoringDirection = 'higher' | 'lower' | 'neutral';

type CompMetricKey =
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

interface ScoringConfig {
  weight: number;
  target: number;
  direction: ScoringDirection;
}

interface MetricPreset {
  name: string;
  metrics: CompMetricKey[];
  scoring: Record<string, ScoringConfig>;
}

interface MetricDef {
  label: string;
  format: (v: number | null | undefined) => string;
  category: 'info' | 'pricing' | 'returns' | 'financials' | 'operations';
}

interface ScoreBreakdownItem {
  score: number;
  weight: number;
  value: number | null;
}

interface DealScore {
  total: number;
  breakdown: Record<string, ScoreBreakdownItem>;
}

interface ScoredProperty {
  property: PropertyComparisonItem;
  score: DealScore | null;
  rank: number;
}

interface SensitivityImpact {
  originalPrice: number;
  newPrice: number;
  priceChange: number;
  priceChangePct: number;
}

interface TableRowDef {
  label: string;
  getValue: (p: PropertyComparisonItem) => string;
  metricKey?: CompMetricKey;
  criteriaKey?: CriteriaMetricKey;
}

interface TableSectionDef {
  title: string;
  rows: TableRowDef[];
}

interface RadarChartProps {
  properties: PropertyComparisonItem[];
  metrics: CompMetricKey[];
  scoresByProperty: Record<number, Record<string, number>>;
}

// ============================================================
// Helpers
// ============================================================

const EM_DASH = '\u2014';

function formatPrice(num: number | null | undefined): string {
  if (num == null) return EM_DASH;
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `$${Math.round(num / 1_000).toLocaleString()}K`;
  return `$${num.toLocaleString()}`;
}

function getPropertyMetric(
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

function getScoreHex(score: number): string {
  if (score >= 80) return '#10b981';
  if (score >= 60) return '#8b5cf6';
  if (score >= 40) return '#f59e0b';
  return '#f43f5e';
}

function getScoreColorClass(score: number): string {
  if (score >= 80) return 'text-emerald-500 dark:text-emerald-400';
  if (score >= 60) return 'text-violet-500 dark:text-violet-400';
  if (score >= 40) return 'text-amber-500 dark:text-amber-400';
  return 'text-rose-500 dark:text-rose-400';
}

function getScoreBgClass(score: number): string {
  if (score >= 80) return 'bg-emerald-500/10 dark:bg-emerald-500/15';
  if (score >= 60) return 'bg-violet-500/10 dark:bg-violet-500/15';
  if (score >= 40) return 'bg-amber-500/10 dark:bg-amber-500/15';
  return 'bg-rose-500/10 dark:bg-rose-500/15';
}

function getScoreBarBg(score: number): string {
  if (score >= 80) return 'bg-emerald-500';
  if (score >= 60) return 'bg-violet-500';
  if (score >= 40) return 'bg-amber-500';
  return 'bg-rose-500';
}

function getRankLabel(rank: number): { label: string; colorClass: string } {
  if (rank === 1) return { label: '1ST', colorClass: 'text-amber-400' };
  if (rank === 2) return { label: '2ND', colorClass: 'text-slate-400' };
  if (rank === 3) return { label: '3RD', colorClass: 'text-amber-700 dark:text-amber-600' };
  return { label: `#${rank}`, colorClass: 'text-muted-foreground' };
}

function isBestApiValue(
  property: PropertyComparisonItem,
  metricKey: CompMetricKey,
  bestValues: BestValues
): boolean {
  switch (metricKey) {
    case 'price_per_unit':
      return (
        property.pricing.price_per_unit != null &&
        property.pricing.price_per_unit === bestValues.best_price_per_unit
      );
    case 'price_per_sf':
      return (
        property.pricing.price_per_sf != null &&
        property.pricing.price_per_sf === bestValues.best_price_per_sf
      );
    case 'going_in_cap':
      return (
        property.cap_rates.going_in != null &&
        property.cap_rates.going_in === bestValues.best_going_in_cap
      );
    case 'stabilized_cap':
      return (
        property.cap_rates.stabilized != null &&
        property.cap_rates.stabilized === bestValues.best_stabilized_cap
      );
    case 'levered_irr':
      return (
        property.bov_returns?.levered_irr != null &&
        property.bov_returns.levered_irr === bestValues.best_levered_irr
      );
    case 'unlevered_irr':
      return (
        property.bov_returns?.unlevered_irr != null &&
        property.bov_returns.unlevered_irr === bestValues.best_unlevered_irr
      );
    case 'equity_multiple':
      return (
        property.bov_returns?.equity_multiple != null &&
        property.bov_returns.equity_multiple === bestValues.best_equity_multiple
      );
    case 'noi_growth':
      return (
        property.financials.noi_growth_pct != null &&
        property.financials.noi_growth_pct === bestValues.best_noi_growth
      );
    case 'opex_ratio':
      return (
        property.operations.opex_ratio != null &&
        property.operations.opex_ratio === bestValues.lowest_opex_ratio
      );
    case 'opex_per_unit':
      return (
        property.operations.opex_per_unit != null &&
        property.operations.opex_per_unit === bestValues.lowest_opex_per_unit
      );
    default:
      return false;
  }
}

// ============================================================
// Constants
// ============================================================

const PROPERTY_COLORS = ['#8b5cf6', '#10b981', '#f59e0b', '#f43f5e', '#0ea5e9'];

const METRIC_DEFS: Record<CompMetricKey, MetricDef> = {
  going_in_cap: {
    label: 'Going-In Cap',
    format: (v) => (v != null ? `${v.toFixed(2)}%` : EM_DASH),
    category: 'returns',
  },
  stabilized_cap: {
    label: 'Stabilized Cap',
    format: (v) => (v != null ? `${v.toFixed(2)}%` : EM_DASH),
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
    format: (v) => (v != null ? `${v.toFixed(2)}%` : EM_DASH),
    category: 'returns',
  },
  unlevered_irr: {
    label: 'Unlevered IRR',
    format: (v) => (v != null ? `${v.toFixed(2)}%` : EM_DASH),
    category: 'returns',
  },
  equity_multiple: {
    label: 'Equity Multiple',
    format: (v) => (v != null ? `${v.toFixed(2)}x` : EM_DASH),
    category: 'returns',
  },
  noi_growth: {
    label: 'NOI Growth',
    format: (v) => (v != null ? `${v.toFixed(2)}%` : EM_DASH),
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
    format: (v) => (v != null ? `${v.toFixed(1)}%` : EM_DASH),
    category: 'operations',
  },
  opex_per_unit: {
    label: 'OpEx/Unit',
    format: (v) => (v != null ? `$${Math.round(v).toLocaleString()}` : EM_DASH),
    category: 'operations',
  },
};

const DEFAULT_PRESETS: Record<string, MetricPreset> = {
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

const TABLE_SECTIONS: TableSectionDef[] = [
  {
    title: 'PROPERTY INFORMATION',
    rows: [
      {
        label: 'Location',
        getValue: (p) => p.property_address ?? 'N/A',
      },
      {
        label: 'Submarket',
        getValue: (p) => p.submarket ?? 'N/A',
      },
      {
        label: 'Units',
        getValue: (p) => p.total_units?.toLocaleString() ?? 'N/A',
        metricKey: 'total_units',
      },
      {
        label: 'Total SF',
        getValue: (p) => p.total_sf?.toLocaleString() ?? 'N/A',
        metricKey: 'total_sf',
      },
      {
        label: 'Year Built',
        getValue: (p) => p.year_built?.toString() ?? 'N/A',
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
      },
      {
        label: 'Y1 NOI',
        getValue: (p) => formatPrice(p.financials.y1_noi),
        metricKey: 'y1_noi',
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

// ============================================================
// RadarChart Sub-component
// ============================================================

function RadarChart({ properties, metrics, scoresByProperty }: RadarChartProps) {
  if (metrics.length < 3) return null;

  const cx = 150;
  const cy = 150;
  const radius = 100;
  const numMetrics = metrics.length;
  const rings = [0.2, 0.4, 0.6, 0.8, 1.0];

  const getPoint = (metricIdx: number, value: number) => {
    const angle = (metricIdx / numMetrics) * 2 * Math.PI - Math.PI / 2;
    return {
      x: cx + radius * value * Math.cos(angle),
      y: cy + radius * value * Math.sin(angle),
    };
  };

  return (
    <svg viewBox="0 0 300 300" className="w-full max-w-[380px] mx-auto">
      {/* Concentric rings */}
      {rings.map((ring, i) => {
        const points = metrics
          .map((_, j) => {
            const pt = getPoint(j, ring);
            return `${pt.x},${pt.y}`;
          })
          .join(' ');
        return (
          <polygon
            key={i}
            points={points}
            fill="none"
            stroke="hsl(var(--border))"
            strokeWidth="0.5"
            opacity={0.6}
          />
        );
      })}

      {/* Axis lines */}
      {metrics.map((_, i) => {
        const end = getPoint(i, 1);
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={end.x}
            y2={end.y}
            stroke="hsl(var(--border))"
            strokeWidth="0.5"
            opacity={0.6}
          />
        );
      })}

      {/* Property polygons */}
      {properties.map((prop, propIdx) => {
        const scores = scoresByProperty[prop.id] ?? {};
        const points = metrics
          .map((metric, j) => {
            const score = (scores[metric] ?? 0) / 100;
            const pt = getPoint(j, score);
            return `${pt.x},${pt.y}`;
          })
          .join(' ');
        const color = PROPERTY_COLORS[propIdx % PROPERTY_COLORS.length];
        return (
          <polygon
            key={prop.id}
            points={points}
            fill={color}
            fillOpacity={0.12}
            stroke={color}
            strokeWidth="2"
            strokeLinejoin="round"
          />
        );
      })}

      {/* Data point dots */}
      {properties.map((prop, propIdx) => {
        const scores = scoresByProperty[prop.id] ?? {};
        const color = PROPERTY_COLORS[propIdx % PROPERTY_COLORS.length];
        return metrics.map((metric, j) => {
          const score = (scores[metric] ?? 0) / 100;
          const pt = getPoint(j, score);
          return (
            <circle
              key={`${prop.id}-${metric}`}
              cx={pt.x}
              cy={pt.y}
              r="3"
              fill={color}
            />
          );
        });
      })}

      {/* Axis labels */}
      {metrics.map((metric, i) => {
        const labelRadius = radius + 28;
        const angle = (i / numMetrics) * 2 * Math.PI - Math.PI / 2;
        const lx = cx + labelRadius * Math.cos(angle);
        const ly = cy + labelRadius * Math.sin(angle);
        const def = METRIC_DEFS[metric];

        let textAnchor: 'start' | 'middle' | 'end' = 'middle';
        if (Math.cos(angle) > 0.3) textAnchor = 'start';
        else if (Math.cos(angle) < -0.3) textAnchor = 'end';

        return (
          <text
            key={i}
            x={lx}
            y={ly}
            textAnchor={textAnchor}
            dominantBaseline="central"
            fill="hsl(var(--muted-foreground))"
            fontSize="10"
            fontFamily="'JetBrains Mono', monospace"
          >
            {def.label}
          </text>
        );
      })}
    </svg>
  );
}

// ============================================================
// ComparisonPage Component
// ============================================================

export const ComparisonPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // API State
  const [data, setData] = useState<ComparisonResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // UI State
  const [viewMode, setViewMode] = useState<ViewMode>('quick');
  const [hoveredPropertyId, setHoveredPropertyId] = useState<number | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<string>('value-add');
  const [sensitivityCapRate, setSensitivityCapRate] = useState(5.15);
  const [showSaveModal, setShowSaveModal] = useState(false);

  // Real API scores
  const [apiScores, setApiScores] = useState<Record<number, DealScoreResult>>({});
  const [scoreModalPropertyId, setScoreModalPropertyId] = useState<number | null>(null);
  const [animated, setAnimated] = useState(false);

  // Investment Criteria State (for deep view table highlighting)
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [rankings, setRankings] = useState<Map<number, PropertyRanking>>(new Map());

  // Trigger animation after mount
  useEffect(() => {
    const timer = setTimeout(() => setAnimated(true), 150);
    return () => clearTimeout(timer);
  }, []);

  // Fetch comparison data from API
  useEffect(() => {
    const fetchComparison = async () => {
      const idsParam = searchParams.get('ids');
      if (!idsParam) {
        setError('No properties selected');
        setIsLoading(false);
        return;
      }

      const propertyIds = idsParam
        .split(',')
        .map(Number)
        .filter((n) => !isNaN(n));

      if (propertyIds.length < 2) {
        setError('Please select at least 2 properties');
        setIsLoading(false);
        return;
      }

      if (propertyIds.length > 5) {
        setError('Cannot compare more than 5 properties');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const result = await comparisonService.compareProperties(propertyIds);
        setData(result);
      } catch (err: unknown) {
        if (err && typeof err === 'object' && 'response' in err) {
          const axiosErr = err as { response?: { data?: { detail?: string } } };
          setError(
            axiosErr.response?.data?.detail || 'Failed to load comparison data'
          );
        } else {
          setError('Failed to load comparison data');
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchComparison();
  }, [searchParams]);

  // Fetch real API scores when comparison data loads
  useEffect(() => {
    if (!data?.properties?.length) return;
    const ids = data.properties.map((p) => p.id);
    scoringService.getScores(ids).then(setApiScores).catch(() => {});
  }, [data]);

  // Re-rank when criteria or data changes (for deep view table)
  useEffect(() => {
    if (!data?.properties) {
      setRankings(new Map());
      return;
    }
    const newRankings = rankProperties(data.properties, criteria);
    setRankings(newRankings);
  }, [data, criteria]);

  // Current preset
  const currentPreset =
    DEFAULT_PRESETS[selectedPreset] ?? DEFAULT_PRESETS['value-add'];

  // Deal score calculator
  const calculateDealScore = useCallback(
    (property: PropertyComparisonItem, preset: MetricPreset): DealScore | null => {
      if (!preset?.scoring) return null;

      let totalScore = 0;
      let totalWeight = 0;
      const breakdown: Record<string, ScoreBreakdownItem> = {};

      for (const [metric, config] of Object.entries(preset.scoring)) {
        const value = getPropertyMetric(property, metric as CompMetricKey);

        if (value === null) {
          breakdown[metric] = { score: 0, weight: config.weight, value: null };
          continue;
        }

        let score = 0;
        const { target, direction, weight } = config;

        if (direction === 'higher') {
          const ratio = value / target;
          score = Math.min(100, Math.max(0, ratio * 80 + 20));
          if (value >= target) score = Math.min(100, 80 + (ratio - 1) * 40);
        } else if (direction === 'lower') {
          const ratio = target / value;
          score = Math.min(100, Math.max(0, ratio * 80 + 20));
          if (value <= target) score = Math.min(100, 80 + (ratio - 1) * 40);
        } else {
          score = 70;
        }

        score = Math.round(score);
        breakdown[metric] = { score, weight, value };
        totalScore += score * weight;
        totalWeight += weight;
      }

      return {
        total: totalWeight > 0 ? Math.round(totalScore / totalWeight) : 0,
        breakdown,
      };
    },
    []
  );

  // Scored and ranked properties
  const scoredProperties: ScoredProperty[] = useMemo(() => {
    if (!data?.properties) return [];

    return data.properties
      .map((p) => ({
        property: p,
        score: calculateDealScore(p, currentPreset),
        rank: 0,
      }))
      .sort((a, b) => (b.score?.total ?? 0) - (a.score?.total ?? 0))
      .map((sp, idx) => ({ ...sp, rank: idx + 1 }));
  }, [data, currentPreset, calculateDealScore]);

  // Scores indexed by property ID for the radar chart
  const scoresByProperty = useMemo(() => {
    const result: Record<number, Record<string, number>> = {};
    for (const sp of scoredProperties) {
      const metricScores: Record<string, number> = {};
      if (sp.score) {
        for (const [key, item] of Object.entries(sp.score.breakdown)) {
          metricScores[key] = item.score;
        }
      }
      result[sp.property.id] = metricScores;
    }
    return result;
  }, [scoredProperties]);

  // Sensitivity calculator
  const calculateSensitivity = useCallback(
    (
      property: PropertyComparisonItem,
      capRate: number
    ): SensitivityImpact | null => {
      const noi = property.financials.t12_noi ?? property.financials.y1_noi;
      const originalPrice = property.pricing.price;
      if (!noi || !originalPrice || capRate <= 0) return null;

      const newPrice = noi / (capRate / 100);
      const priceChange = newPrice - originalPrice;
      const priceChangePct = (priceChange / originalPrice) * 100;

      return { originalPrice, newPrice, priceChange, priceChangePct };
    },
    []
  );

  // CSV export handler
  const handleExportCSV = () => {
    if (data) {
      exportComparisonToCSV(data);
    }
  };

  // Total portfolio value
  const totalValue = useMemo(() => {
    if (!data?.properties) return 0;
    return data.properties.reduce(
      (sum, p) => sum + (p.pricing.price ?? 0),
      0
    );
  }, [data]);

  // Grid cols class
  const gridColsClass = useMemo(() => {
    const count = data?.properties.length ?? 2;
    const map: Record<number, string> = {
      2: 'grid-cols-1 sm:grid-cols-2',
      3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
      4: 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-4',
      5: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5',
    };
    return map[count] ?? 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-4';
  }, [data]);

  // Cell-level criteria gradient for the deep table
  const getCellGradient = useCallback(
    (propertyId: number, metricKey?: CriteriaMetricKey): string => {
      if (!criteria.length || !rankings.size || !metricKey) return '';
      const activeCriterion = criteria.find((c) => c.metric === metricKey);
      if (!activeCriterion) return '';
      const ranking = rankings.get(propertyId);
      if (!ranking) return '';
      const metricRank = ranking.ranksByMetric.get(metricKey);
      if (!metricRank) return '';
      return getGradientColor(metricRank, data?.properties.length ?? 0);
    },
    [criteria, rankings, data]
  );

  // These are only used in the content branch (guarded by `!data ? null :`)
  const properties = data?.properties ?? [];
  const bestValues = data?.best_values as NonNullable<ComparisonResponse['best_values']>;

  // ============================================================
  // Render
  // ============================================================
  return (
    <AnimatePresence mode="wait">
      {isLoading ? (
        <motion.div key="skeleton" initial={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
          <ComparisonSkeleton />
        </motion.div>
      ) : error ? (
        <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
          <div className="max-w-4xl mx-auto">
            <div className="border border-rose-200 dark:border-rose-800 rounded-2xl bg-rose-50 dark:bg-rose-950/30 p-6">
              <h2 className="text-lg font-display font-semibold text-rose-900 dark:text-rose-200 mb-2">
                Error
              </h2>
              <p className="text-sm text-rose-800 dark:text-rose-300">{error}</p>
              <button
                onClick={() => navigate('/library')}
                className="mt-4 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                Back to Library
              </button>
            </div>
          </div>
        </motion.div>
      ) : !data ? null : (
        <motion.div key="content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
    <div className="min-h-full -m-4 lg:-m-6">
      {/* ===== TOOLBAR ===== */}
      <div className="sticky top-16 z-20 bg-background/85 backdrop-blur-xl border-b border-border">
        <div className="px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            {/* Left: Back + Title */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(-1)}
                className="p-2.5 rounded-xl border border-border bg-card hover:bg-accent transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-muted-foreground" />
              </button>
              <div>
                <h1 className="font-display text-2xl font-bold text-foreground">
                  Deal Comparison
                </h1>
                <p className="text-sm mt-0.5 text-muted-foreground">
                  <span className="font-mono text-primary">
                    {properties.length}
                  </span>{' '}
                  properties{' '}
                  <span className="font-mono ml-1">
                    {formatPrice(totalValue)}
                  </span>{' '}
                  total
                </p>
              </div>
            </div>

            {/* Center: View Toggle */}
            <div className="flex items-center rounded-xl p-1.5 bg-muted border border-border">
              {(
                [
                  { id: 'quick' as ViewMode, label: 'Quick Analysis', Icon: Zap },
                  { id: 'deep' as ViewMode, label: 'Deep Dive', Icon: Layers },
                ] as const
              ).map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => setViewMode(mode.id)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all',
                    viewMode === mode.id
                      ? 'bg-primary text-white shadow-md shadow-primary/30'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <mode.Icon className="w-4 h-4" />
                  {mode.label}
                </button>
              ))}
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowSaveModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border border-border bg-card text-muted-foreground hover:bg-accent transition-colors"
              >
                <Bookmark className="w-4 h-4" />
                Save
              </button>
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border border-border bg-card text-muted-foreground hover:bg-accent transition-colors"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ===== MAIN CONTENT ===== */}
      <div className="p-6 lg:p-8 space-y-6">
        {/* ===== PRESET SELECTOR ===== */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Scoring Template
            </h2>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {Object.entries(DEFAULT_PRESETS).map(([key, preset]) => (
              <button
                key={key}
                onClick={() => setSelectedPreset(key)}
                className={cn(
                  'px-4 py-2.5 rounded-xl text-sm font-medium transition-all border',
                  selectedPreset === key
                    ? 'bg-primary/10 dark:bg-primary/15 border-primary text-primary'
                    : 'bg-card border-border text-muted-foreground hover:bg-accent'
                )}
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>

        {/* ===== QUICK ANALYSIS VIEW ===== */}
        {viewMode === 'quick' && (
          <div
            className={cn(
              'transition-opacity duration-500',
              animated ? 'opacity-100' : 'opacity-0'
            )}
          >
            {/* Deal Score Cards */}
            <div className={cn('grid gap-4 mb-8', gridColsClass)}>
              {scoredProperties.map((sp, index) => {
                const { property, score, rank } = sp;
                const rankInfo = getRankLabel(rank);
                const isHovered = hoveredPropertyId === property.id;
                const scoreTotal = score?.total ?? 0;

                return (
                  <div
                    key={property.id}
                    className="relative group cursor-pointer"
                    onMouseEnter={() => setHoveredPropertyId(property.id)}
                    onMouseLeave={() => setHoveredPropertyId(null)}
                  >
                    <div
                      className={cn(
                        'relative rounded-2xl overflow-hidden transition-all duration-300 border bg-card',
                        isHovered
                          ? 'border-primary/40 shadow-xl shadow-primary/10 -translate-y-1'
                          : 'border-border'
                      )}
                    >
                      {/* Rank Badge */}
                      <div className="absolute top-3 left-3 z-10 px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 bg-black/60 dark:bg-black/70 backdrop-blur-sm">
                        {rank === 1 && (
                          <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                        )}
                        <span className={rankInfo.colorClass}>
                          {rankInfo.label}
                        </span>
                      </div>

                      {/* Color Banner (property header) */}
                      <div
                        className="relative h-24 overflow-hidden"
                        style={{
                          background: `linear-gradient(135deg, ${
                            PROPERTY_COLORS[index % PROPERTY_COLORS.length]
                          }30, ${
                            PROPERTY_COLORS[index % PROPERTY_COLORS.length]
                          }10)`,
                        }}
                      >
                        <div className="absolute inset-0 bg-gradient-to-t from-card via-card/60 to-transparent" />
                        <div className="absolute bottom-2 left-4 font-display text-5xl font-bold text-foreground/5">
                          {property.property_name.charAt(0)}
                        </div>
                      </div>

                      {/* Content */}
                      <div className="p-4 pt-0">
                        {/* Name + Score */}
                        <div className="flex items-start justify-between mb-3">
                          <div className="min-w-0 pr-2">
                            <h3 className="font-display text-lg font-bold text-foreground truncate">
                              {property.property_name}
                            </h3>
                            <p className="text-xs mt-0.5 text-muted-foreground truncate">
                              {property.submarket ??
                                property.property_address ??
                                property.document_type}
                            </p>
                          </div>

                          {/* Score Circle — uses real API score if available */}
                          <DealScoreBadge
                            score={
                              apiScores[property.id]?.total_score ?? (scoreTotal > 0 ? scoreTotal : null)
                            }
                            size="lg"
                            animated={animated}
                            onClick={() => {
                              if (apiScores[property.id]) {
                                setScoreModalPropertyId(property.id);
                              }
                            }}
                          />
                          {/* Legacy Score Circle (hidden — replaced by DealScoreBadge) */}
                          <div className="hidden relative shrink-0">
                            <svg
                              width="56"
                              height="56"
                              className="transform -rotate-90"
                            >
                              <circle
                                cx="28"
                                cy="28"
                                r="24"
                                fill="none"
                                stroke="hsl(var(--border))"
                                strokeWidth="4"
                              />
                              <circle
                                cx="28"
                                cy="28"
                                r="24"
                                fill="none"
                                stroke={getScoreHex(scoreTotal)}
                                strokeWidth="4"
                                strokeLinecap="round"
                                strokeDasharray={150.8}
                                strokeDashoffset={
                                  animated
                                    ? 150.8 - (150.8 * scoreTotal) / 100
                                    : 150.8
                                }
                                className="transition-[stroke-dashoffset] duration-1000 ease-out"
                                style={{
                                  transitionDelay: `${index * 100}ms`,
                                }}
                              />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span
                                className={cn(
                                  'font-mono text-lg font-bold',
                                  getScoreColorClass(scoreTotal)
                                )}
                              >
                                {scoreTotal}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Static Metrics */}
                        <div className="grid grid-cols-2 gap-3 py-3 mb-3 border-t border-b border-border">
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                              Units
                            </p>
                            <p className="font-mono text-base font-semibold text-foreground">
                              {property.total_units?.toLocaleString() ?? EM_DASH}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                              Year Built
                            </p>
                            <p className="font-mono text-base font-semibold text-foreground">
                              {property.year_built ?? EM_DASH}
                            </p>
                          </div>
                        </div>

                        {/* Score Breakdown Preview (top 3 metrics) */}
                        <div className="space-y-2">
                          {currentPreset.metrics.slice(0, 3).map((metric) => {
                            const def = METRIC_DEFS[metric];
                            const metricScore =
                              score?.breakdown[metric]?.score ?? 0;
                            const metricValue = getPropertyMetric(
                              property,
                              metric
                            );

                            return (
                              <div
                                key={metric}
                                className="flex items-center gap-2"
                              >
                                <span className="text-xs w-20 truncate text-muted-foreground">
                                  {def.label}
                                </span>
                                <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-border">
                                  <div
                                    className={cn(
                                      'h-full rounded-full transition-all duration-700 ease-out',
                                      getScoreBarBg(metricScore)
                                    )}
                                    style={{
                                      width: animated
                                        ? `${metricScore}%`
                                        : '0%',
                                      transitionDelay: `${
                                        index * 100 + 300
                                      }ms`,
                                    }}
                                  />
                                </div>
                                <span className="font-mono text-xs w-16 text-right text-foreground">
                                  {def.format(metricValue)}
                                </span>
                              </div>
                            );
                          })}
                        </div>

                        {/* Price + Details link */}
                        <div className="mt-4 flex items-end justify-between">
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                              Asking
                            </p>
                            <p className="font-display text-xl font-bold text-foreground">
                              {formatPrice(property.pricing.price)}
                            </p>
                          </div>
                          <Link
                            to={`/library/${property.id}`}
                            className="text-xs font-semibold flex items-center gap-1 text-primary hover:gap-2 transition-all"
                          >
                            Details
                            <ArrowRight className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Two Column Layout: Bars + Sidebar */}
            <div className="grid grid-cols-12 gap-6">
              {/* Left: Metric Comparison Bars */}
              <div className="col-span-12 lg:col-span-8">
                <div className="rounded-2xl p-6 border border-border bg-card">
                  <h3 className="font-display text-lg font-bold text-foreground mb-6">
                    Key Metrics Comparison
                  </h3>

                  <div className="space-y-6">
                    {currentPreset.metrics.map((metric) => {
                      const def = METRIC_DEFS[metric];
                      const scoring = currentPreset.scoring[metric];
                      if (!scoring) return null;

                      const propsWithValues = properties
                        .filter(
                          (p) => getPropertyMetric(p, metric) !== null
                        )
                        .map((p) => ({
                          property: p,
                          value: getPropertyMetric(p, metric)!,
                        }));

                      if (propsWithValues.length === 0) return null;

                      const maxVal = Math.max(
                        ...propsWithValues.map((pv) => pv.value)
                      );
                      const minVal = Math.min(
                        ...propsWithValues.map((pv) => pv.value)
                      );

                      const sorted = [...propsWithValues].sort((a, b) => {
                        if (scoring.direction === 'higher')
                          return b.value - a.value;
                        if (scoring.direction === 'lower')
                          return a.value - b.value;
                        return 0;
                      });

                      const propsWithNull = properties.filter(
                        (p) => getPropertyMetric(p, metric) === null
                      );

                      return (
                        <div key={metric}>
                          {/* Metric Header */}
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-foreground">
                                {def.label}
                              </span>
                              {scoring.direction !== 'neutral' && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 dark:bg-primary/15 text-primary">
                                  {scoring.direction === 'higher'
                                    ? 'Higher is better'
                                    : 'Lower is better'}
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground font-mono">
                              Target: {def.format(scoring.target)}
                            </span>
                          </div>

                          {/* Bars */}
                          <div className="space-y-2">
                            {sorted.map((pv, i) => {
                              const barWidth =
                                maxVal > minVal
                                  ? ((pv.value - minVal) /
                                      (maxVal - minVal)) *
                                      80 +
                                    20
                                  : 100;
                              const isWinner = i === 0;
                              const isHovered =
                                hoveredPropertyId === pv.property.id;

                              return (
                                <div
                                  key={pv.property.id}
                                  className={cn(
                                    'flex items-center gap-3 cursor-pointer transition-opacity duration-200',
                                    hoveredPropertyId !== null &&
                                      !isHovered &&
                                      'opacity-40'
                                  )}
                                  onMouseEnter={() =>
                                    setHoveredPropertyId(pv.property.id)
                                  }
                                  onMouseLeave={() =>
                                    setHoveredPropertyId(null)
                                  }
                                >
                                  {/* Rank indicator */}
                                  <div
                                    className={cn(
                                      'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                                      isWinner
                                        ? 'bg-emerald-500 text-white'
                                        : 'bg-muted text-muted-foreground'
                                    )}
                                  >
                                    {isWinner ? (
                                      <Star className="w-3 h-3" />
                                    ) : (
                                      i + 1
                                    )}
                                  </div>

                                  {/* Name */}
                                  <span
                                    className={cn(
                                      'w-28 text-sm truncate shrink-0 transition-colors',
                                      isHovered
                                        ? 'text-primary'
                                        : 'text-muted-foreground'
                                    )}
                                  >
                                    {pv.property.property_name}
                                  </span>

                                  {/* Bar */}
                                  <div className="flex-1 h-8 rounded-lg overflow-hidden relative bg-muted">
                                    <div
                                      className={cn(
                                        'h-full rounded-lg transition-all duration-700 ease-out',
                                        isWinner
                                          ? 'bg-emerald-500 dark:bg-emerald-400'
                                          : 'bg-primary/60'
                                      )}
                                      style={{
                                        width: animated
                                          ? `${barWidth}%`
                                          : '0%',
                                      }}
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-sm font-semibold text-foreground">
                                      {def.format(pv.value)}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}

                            {/* N/A entries */}
                            {propsWithNull.map((property) => (
                              <div
                                key={property.id}
                                className="flex items-center gap-3 opacity-40"
                              >
                                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 bg-muted text-muted-foreground">
                                  {EM_DASH}
                                </div>
                                <span className="w-28 text-sm truncate shrink-0 text-muted-foreground">
                                  {property.property_name}
                                </span>
                                <div className="flex-1 h-8 rounded-lg flex items-center justify-center bg-muted">
                                  <span className="font-mono text-sm text-muted-foreground">
                                    N/A
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Right: Sensitivity + Leaders + Recommendation */}
              <div className="col-span-12 lg:col-span-4 space-y-6">
                {/* Sensitivity Analysis */}
                <div className="rounded-2xl p-6 border border-border bg-card">
                  <div className="flex items-center gap-2 mb-4">
                    <SlidersHorizontal className="w-5 h-5 text-primary" />
                    <h3 className="font-display text-lg font-bold text-foreground">
                      What-If Analysis
                    </h3>
                  </div>

                  <p className="text-sm mb-6 text-muted-foreground">
                    Adjust cap rate to see impact on pricing
                  </p>

                  {/* Cap Rate Slider */}
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground">
                        Target Cap Rate
                      </span>
                      <span className="font-mono text-lg font-bold text-primary">
                        {sensitivityCapRate.toFixed(2)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="3"
                      max="8"
                      step="0.05"
                      value={sensitivityCapRate}
                      onChange={(e) =>
                        setSensitivityCapRate(parseFloat(e.target.value))
                      }
                      className="w-full accent-primary"
                    />
                    <div className="flex justify-between text-xs mt-1 text-muted-foreground font-mono">
                      <span>3.00%</span>
                      <span>8.00%</span>
                    </div>
                  </div>

                  {/* Impact Preview */}
                  <div className="space-y-3">
                    {properties.slice(0, 3).map((property) => {
                      const impact = calculateSensitivity(
                        property,
                        sensitivityCapRate
                      );
                      if (!impact) return null;

                      return (
                        <div
                          key={property.id}
                          className="p-3 rounded-xl bg-muted"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-semibold text-sm text-foreground truncate mr-2">
                              {property.property_name}
                            </span>
                            <span
                              className={cn(
                                'text-xs font-mono font-semibold whitespace-nowrap',
                                impact.priceChange < 0
                                  ? 'text-emerald-500 dark:text-emerald-400'
                                  : 'text-rose-500 dark:text-rose-400'
                              )}
                            >
                              {impact.priceChange < 0 ? '-' : '+'}
                              {formatPrice(Math.abs(impact.priceChange))}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="text-muted-foreground">
                                New Price:{' '}
                              </span>
                              <span className="font-mono text-foreground">
                                {formatPrice(impact.newPrice)}
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">
                                Change:{' '}
                              </span>
                              <span
                                className={cn(
                                  'font-mono',
                                  impact.priceChangePct < 0
                                    ? 'text-emerald-500 dark:text-emerald-400'
                                    : 'text-rose-500 dark:text-rose-400'
                                )}
                              >
                                {impact.priceChangePct > 0 ? '+' : ''}
                                {impact.priceChangePct.toFixed(1)}%
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Category Leaders */}
                <div className="rounded-2xl p-6 border border-border bg-card">
                  <div className="flex items-center gap-2 mb-4">
                    <Trophy className="w-5 h-5 text-amber-400" />
                    <h3 className="font-display text-lg font-bold text-foreground">
                      Category Leaders
                    </h3>
                  </div>

                  <div className="space-y-3">
                    {currentPreset.metrics.slice(0, 4).map((metric) => {
                      const def = METRIC_DEFS[metric];
                      const scoring = currentPreset.scoring[metric];
                      if (!scoring) return null;

                      const propsWithValues = properties
                        .filter(
                          (p) => getPropertyMetric(p, metric) !== null
                        )
                        .map((p) => ({
                          property: p,
                          value: getPropertyMetric(p, metric)!,
                        }));

                      if (propsWithValues.length === 0) return null;

                      const winner = [...propsWithValues].sort((a, b) => {
                        if (scoring.direction === 'higher')
                          return b.value - a.value;
                        if (scoring.direction === 'lower')
                          return a.value - b.value;
                        return 0;
                      })[0];

                      if (!winner) return null;

                      return (
                        <div
                          key={metric}
                          className="flex items-center justify-between p-3 rounded-xl bg-muted cursor-pointer hover:bg-accent transition-colors"
                          onMouseEnter={() =>
                            setHoveredPropertyId(winner.property.id)
                          }
                          onMouseLeave={() => setHoveredPropertyId(null)}
                        >
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                              Best {def.label}
                            </p>
                            <p className="font-semibold text-sm mt-0.5 text-foreground">
                              {winner.property.property_name}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-mono font-bold text-emerald-500 dark:text-emerald-400">
                              {def.format(winner.value)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Winner / Recommendation Panel */}
                <div className="rounded-2xl p-6 relative overflow-hidden border border-border bg-gradient-to-br from-card to-primary/5">
                  <div className="absolute top-4 right-4 opacity-10">
                    <Sparkles className="w-20 h-20 text-primary" />
                  </div>

                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-5 h-5 text-primary" />
                    <span className="text-xs font-bold uppercase tracking-wider text-primary">
                      Recommendation
                    </span>
                  </div>

                  {scoredProperties.length > 0 && (
                    <p className="text-sm leading-relaxed relative z-10 text-foreground">
                      Based on your{' '}
                      <strong>{currentPreset.name}</strong> criteria,{' '}
                      <strong className="text-emerald-500 dark:text-emerald-400">
                        {scoredProperties[0].property.property_name}
                      </strong>{' '}
                      leads with a score of{' '}
                      <strong className="font-mono">
                        {scoredProperties[0].score?.total ?? 0}
                      </strong>
                      .
                      {scoredProperties[0].property.cap_rates.going_in !=
                        null &&
                        ` Strong yield at ${scoredProperties[0].property.cap_rates.going_in.toFixed(
                          2
                        )}% cap.`}
                      {scoredProperties.length > 1 &&
                        ` Runner-up: ${scoredProperties[1].property.property_name} (${scoredProperties[1].score?.total ?? 0}).`}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===== DEEP ANALYSIS VIEW ===== */}
        {viewMode === 'deep' && (
          <div className="space-y-6 transition-opacity duration-300 opacity-100">
            {/* Investment Criteria Panel */}
            <InvestmentCriteriaPanel
              criteria={criteria}
              onCriteriaChange={setCriteria}
            />

            {/* Radar Chart */}
            {currentPreset.metrics.length >= 3 && (
              <div className="rounded-2xl p-6 border border-border bg-card">
                <h3 className="font-display text-lg font-bold text-foreground mb-4">
                  Multi-Metric Radar
                </h3>

                {/* Legend */}
                <div className="flex flex-wrap items-center gap-4 mb-4">
                  {scoredProperties.map((sp, idx) => (
                    <div
                      key={sp.property.id}
                      className="flex items-center gap-2"
                    >
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{
                          backgroundColor:
                            PROPERTY_COLORS[
                              idx % PROPERTY_COLORS.length
                            ],
                        }}
                      />
                      <span className="text-sm text-foreground">
                        {sp.property.property_name}
                      </span>
                      <span
                        className={cn(
                          'font-mono text-xs',
                          getScoreColorClass(sp.score?.total ?? 0)
                        )}
                      >
                        ({sp.score?.total ?? 0})
                      </span>
                    </div>
                  ))}
                </div>

                <RadarChart
                  properties={properties}
                  metrics={currentPreset.metrics}
                  scoresByProperty={scoresByProperty}
                />
              </div>
            )}

            {/* Full Data Table */}
            <div className="rounded-2xl overflow-hidden border border-border bg-card">
              {/* Table Header */}
              <div
                className="grid items-center p-4 bg-muted border-b border-border"
                style={{
                  gridTemplateColumns: `200px repeat(${properties.length}, 1fr)`,
                }}
              >
                <div className="font-display font-bold text-foreground">
                  Metric
                </div>
                {scoredProperties.map((sp) => (
                  <div
                    key={sp.property.id}
                    className="text-center"
                    onMouseEnter={() =>
                      setHoveredPropertyId(sp.property.id)
                    }
                    onMouseLeave={() => setHoveredPropertyId(null)}
                  >
                    <div className="flex items-center justify-center gap-2 mb-1">
                      {sp.rank === 1 && (
                        <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                      )}
                      <Link
                        to={`/library/${sp.property.id}`}
                        className="font-display font-bold text-foreground hover:text-primary transition-colors"
                      >
                        {sp.property.property_name}
                      </Link>
                    </div>
                    <div
                      className={cn(
                        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold',
                        getScoreBgClass(sp.score?.total ?? 0),
                        getScoreColorClass(sp.score?.total ?? 0)
                      )}
                    >
                      Score: {sp.score?.total ?? 0}
                    </div>
                  </div>
                ))}
              </div>

              {/* Table Sections */}
              {TABLE_SECTIONS.map((section) => (
                <div key={section.title}>
                  {/* Section Header */}
                  <div className="px-4 py-2 bg-primary/5 dark:bg-primary/10">
                    <span className="text-xs font-bold uppercase tracking-wider text-primary">
                      {section.title}
                    </span>
                  </div>

                  {/* Section Rows */}
                  {section.rows.map((row, rowIdx) => (
                    <div
                      key={row.label}
                      className={cn(
                        'grid items-center p-4 border-b border-border transition-colors',
                        rowIdx % 2 === 1 && 'bg-muted/30'
                      )}
                      style={{
                        gridTemplateColumns: `200px repeat(${properties.length}, 1fr)`,
                      }}
                    >
                      <div className="text-sm text-muted-foreground">
                        {row.label}
                      </div>

                      {scoredProperties.map((sp) => {
                        const value = row.getValue(sp.property);
                        const isBest =
                          row.metricKey != null &&
                          isBestApiValue(
                            sp.property,
                            row.metricKey,
                            bestValues
                          );
                        const isHovered =
                          hoveredPropertyId === sp.property.id;
                        const gradientClass = getCellGradient(
                          sp.property.id,
                          row.criteriaKey
                        );

                        return (
                          <div
                            key={sp.property.id}
                            className="text-center"
                            onMouseEnter={() =>
                              setHoveredPropertyId(sp.property.id)
                            }
                            onMouseLeave={() =>
                              setHoveredPropertyId(null)
                            }
                          >
                            <span
                              className={cn(
                                'font-mono text-sm inline-flex items-center gap-1 px-2 py-1 rounded-lg transition-all',
                                isBest && 'font-bold',
                                isBest
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-foreground',
                                isHovered &&
                                  !gradientClass &&
                                  'bg-primary/10 dark:bg-primary/15',
                                isBest &&
                                  !gradientClass &&
                                  'bg-emerald-500/10 dark:bg-emerald-500/15',
                                gradientClass
                              )}
                            >
                              {isBest && (
                                <Check className="w-3 h-3" />
                              )}
                              {value}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ===== SAVE MODAL ===== */}
      {showSaveModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setShowSaveModal(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl p-6 border border-border bg-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-xl font-bold mb-4 text-foreground">
              Save to Comparison Library
            </h3>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block text-muted-foreground">
                  Comparison Name
                </label>
                <input
                  type="text"
                  placeholder="e.g., Q1 Southeast Value-Add Pipeline"
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block text-muted-foreground">
                  Tags
                </label>
                <input
                  type="text"
                  placeholder="e.g., Georgia, Value-Add, 2024"
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block text-muted-foreground">
                  Notes
                </label>
                <textarea
                  placeholder="Add notes about this comparison..."
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all resize-none bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowSaveModal(false)}
                className="flex-1 py-3 rounded-xl text-sm font-medium bg-muted text-muted-foreground hover:bg-accent transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => setShowSaveModal(false)}
                className="flex-1 py-3 rounded-xl text-sm font-semibold text-white bg-primary hover:bg-primary/90 shadow-md shadow-primary/30 transition-colors"
              >
                Save Comparison
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Deal Score Modal */}
      <DealScoreModal
        open={scoreModalPropertyId !== null}
        onClose={() => setScoreModalPropertyId(null)}
        scoreData={scoreModalPropertyId ? apiScores[scoreModalPropertyId] ?? null : null}
        propertyName={
          scoreModalPropertyId
            ? data?.properties.find((p) => p.id === scoreModalPropertyId)?.property_name
            : undefined
        }
      />
    </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
