/**
 * useComparison — Custom hook encapsulating comparison data fetching and scoring state
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { propertyService, type PropertyDetail, type PropertyListItem } from '@/services/propertyService';
import { scoringService } from '@/services/scoringService';
import type { DealScoreResult } from '@/services/scoringService';
import { rankProperties } from '@/utils/criteriaEvaluation';
import type {
  ComparisonResponse,
  PropertyComparisonItem,
  CompMetricKey,
  MetricPreset,
  DealScore,
  ScoreBreakdownItem,
  ScoredProperty,
  SensitivityImpact,
  Criterion,
  PropertyRanking,
} from '@/components/comparison/types';
import { getPropertyMetric, transformToComparisonData } from '@/components/comparison/utils';
import { DEFAULT_PRESETS } from '@/components/comparison/constants';

export interface UseComparisonReturn {
  // Data
  data: ComparisonResponse | null;
  isLoading: boolean;
  error: string | null;
  properties: PropertyComparisonItem[];
  bestValues: ComparisonResponse['best_values'] | null;

  // Scoring
  apiScores: Record<number, DealScoreResult>;
  scoredProperties: ScoredProperty[];
  scoresByProperty: Record<number, Record<string, number>>;

  // Criteria (deep view)
  criteria: Criterion[];
  setCriteria: React.Dispatch<React.SetStateAction<Criterion[]>>;
  rankings: Map<number, PropertyRanking>;

  // Picker
  showPicker: boolean;
  allProperties: PropertyListItem[];
  pickerLoading: boolean;
  pickerSelected: Set<number>;
  togglePicker: (id: number) => void;
  startComparison: () => void;

  // Calculators
  calculateSensitivity: (property: PropertyComparisonItem, capRate: number) => SensitivityImpact | null;
  calculateDealScore: (property: PropertyComparisonItem, preset: MetricPreset) => DealScore | null;

  // Derived
  totalValue: number;
  gridColsClass: string;

  // Deep table sort
  tableSortByScore: 'asc' | 'desc' | null;
  setTableSortByScore: React.Dispatch<React.SetStateAction<'asc' | 'desc' | null>>;
  tableSortedScoredProperties: ScoredProperty[];

  // Score modal
  scoreModalPropertyId: number | null;
  setScoreModalPropertyId: React.Dispatch<React.SetStateAction<number | null>>;

  // Selected preset
  selectedPreset: string;
  setSelectedPreset: React.Dispatch<React.SetStateAction<string>>;
  currentPreset: MetricPreset;
}

export function useComparison(): UseComparisonReturn {
  const [searchParams, setSearchParams] = useSearchParams();

  // API State
  const [data, setData] = useState<ComparisonResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Real API scores
  const [apiScores, setApiScores] = useState<Record<number, DealScoreResult>>({});
  const [scoreModalPropertyId, setScoreModalPropertyId] = useState<number | null>(null);

  // Investment Criteria State (for deep view table highlighting)
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [rankings, setRankings] = useState<Map<number, PropertyRanking>>(new Map());

  // Deep table sort by deal score
  const [tableSortByScore, setTableSortByScore] = useState<'asc' | 'desc' | null>(null);

  // Preset
  const [selectedPreset, setSelectedPreset] = useState<string>('value-add');

  // Property picker (shown when no IDs are in the URL)
  const [showPicker, setShowPicker] = useState(false);
  const [allProperties, setAllProperties] = useState<PropertyListItem[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerSelected, setPickerSelected] = useState<Set<number>>(new Set());

  // Picker helpers
  const togglePicker = useCallback((id: number) => {
    setPickerSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < 10) {
        next.add(id);
      }
      return next;
    });
  }, []);

  const startComparison = useCallback(() => {
    if (pickerSelected.size < 2) return;
    setSearchParams({ ids: [...pickerSelected].join(',') });
  }, [pickerSelected, setSearchParams]);

  // Fetch comparison data
  useEffect(() => {
    const fetchComparison = async () => {
      const idsParam = searchParams.get('ids');
      const propertyIds = idsParam
        ? idsParam.split(',').map(Number).filter((n) => !isNaN(n))
        : [];

      if (propertyIds.length < 2) {
        setShowPicker(true);
        setIsLoading(false);
        if (!allProperties.length) {
          setPickerLoading(true);
          try {
            const result = await propertyService.listProperties();
            setAllProperties(result.properties);
          } catch {
            /* ignore */
          } finally {
            setPickerLoading(false);
          }
        }
        return;
      }

      setShowPicker(false);
      setIsLoading(true);
      setError(null);

      try {
        const results = await Promise.allSettled(
          propertyIds.map((id) => propertyService.getProperty(id))
        );
        const properties: PropertyDetail[] = [];
        for (const r of results) {
          if (r.status === 'fulfilled') properties.push(r.value);
        }
        if (properties.length < 2) {
          setError('Could not load enough properties for comparison.');
          return;
        }
        const comparisonData = transformToComparisonData(properties);
        setData(comparisonData);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load comparison data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchComparison();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Fetch API scores when data loads
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
  const currentPreset = DEFAULT_PRESETS[selectedPreset] ?? DEFAULT_PRESETS['value-add'];

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
    (property: PropertyComparisonItem, capRate: number): SensitivityImpact | null => {
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

  // Total portfolio value
  const totalValue = useMemo(() => {
    if (!data?.properties) return 0;
    return data.properties.reduce((sum, p) => sum + (p.pricing.price ?? 0), 0);
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

  // Deep table: sorted properties by deal score when sort is active
  const tableSortedScoredProperties = useMemo(() => {
    if (!tableSortByScore) return scoredProperties;
    return [...scoredProperties].sort((a, b) => {
      const scoreA = apiScores[a.property.id]?.total_score ?? -1;
      const scoreB = apiScores[b.property.id]?.total_score ?? -1;
      return tableSortByScore === 'desc' ? scoreB - scoreA : scoreA - scoreB;
    });
  }, [scoredProperties, apiScores, tableSortByScore]);

  const properties = data?.properties ?? [];
  const bestValues = data?.best_values ?? null;

  return {
    data,
    isLoading,
    error,
    properties,
    bestValues,
    apiScores,
    scoredProperties,
    scoresByProperty,
    criteria,
    setCriteria,
    rankings,
    showPicker,
    allProperties,
    pickerLoading,
    pickerSelected,
    togglePicker,
    startComparison,
    calculateSensitivity,
    calculateDealScore,
    totalValue,
    gridColsClass,
    tableSortByScore,
    setTableSortByScore,
    tableSortedScoredProperties,
    scoreModalPropertyId,
    setScoreModalPropertyId,
    selectedPreset,
    setSelectedPreset,
    currentPreset,
  };
}
