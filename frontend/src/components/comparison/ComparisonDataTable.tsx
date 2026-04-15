/**
 * ComparisonDataTable — Deep view data table with sorting, subject pinning,
 * normalization, deltas, score rings, and comp average footer
 */
import { useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpDown, ArrowUp, ArrowDown, Check, Pin, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DealScoreBadge } from '@/components/scoring/DealScoreBadge';
import type {
  PropertyComparisonItem,
  BestValues,
  ScoredProperty,
  NormalizationMode,
  SortConfig,
  CompMetricKey,
} from './types';
import type { Criterion, PropertyRanking, CriteriaMetricKey } from '@/utils/criteriaEvaluation';
import { getGradientColor } from '@/utils/criteriaEvaluation';
import type { DealScoreResult } from '@/services/scoringService';
import { TABLE_SECTIONS, METRIC_DEFS, EM_DASH, formatPrice, NORMALIZABLE_METRICS } from './constants';
import {
  getPropertyMetric,
  isBestApiValue,
  getScoreColorClass,
  getScoreBgClass,
  computeDelta,
  normalizeValue,
  computeCompAverage,
} from './utils';

interface ComparisonDataTableProps {
  properties: PropertyComparisonItem[];
  scoredProperties: ScoredProperty[];
  bestValues: BestValues;
  criteria: Criterion[];
  rankings: Map<number, PropertyRanking>;
  apiScores: Record<number, DealScoreResult>;
  hoveredPropertyId: number | null;
  subjectId: number | null;
  normalizationMode: NormalizationMode;
  sortConfig: SortConfig;
  onSort: (config: SortConfig) => void;
  onHover: (id: number) => void;
  onUnhover: () => void;
  onScoreClick: (id: number) => void;
  onSetSubject: (id: number) => void;
}

export function ComparisonDataTable({
  properties,
  scoredProperties,
  bestValues,
  criteria,
  rankings,
  apiScores,
  hoveredPropertyId,
  subjectId,
  normalizationMode,
  sortConfig,
  onSort,
  onHover,
  onUnhover,
  onScoreClick,
  onSetSubject,
}: ComparisonDataTableProps) {
  // Sort properties: subject always first, then by sortConfig
  const sortedProperties = useMemo(() => {
    const subject = subjectId != null ? properties.find((p) => p.id === subjectId) : null;
    const comps = properties.filter((p) => p.id !== subjectId);

    if (sortConfig) {
      comps.sort((a, b) => {
        let aVal: number | null = null;
        let bVal: number | null = null;

        if (sortConfig.key === 'deal_score') {
          aVal = apiScores[a.id]?.total_score ?? scoredProperties.find(sp => sp.property.id === a.id)?.score?.total ?? null;
          bVal = apiScores[b.id]?.total_score ?? scoredProperties.find(sp => sp.property.id === b.id)?.score?.total ?? null;
        } else if (sortConfig.key === 'name') {
          return sortConfig.direction === 'asc'
            ? a.property_name.localeCompare(b.property_name)
            : b.property_name.localeCompare(a.property_name);
        } else {
          aVal = getPropertyMetric(a, sortConfig.key);
          bVal = getPropertyMetric(b, sortConfig.key);
        }

        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return 1;
        if (bVal == null) return -1;
        return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
      });
    }

    return subject ? [subject, ...comps] : comps;
  }, [properties, subjectId, sortConfig, apiScores, scoredProperties]);

  const subject = subjectId != null ? properties.find((p) => p.id === subjectId) : null;

  // Cell gradient for criteria highlighting
  const getCellGradient = useCallback(
    (propertyId: number, metricKey?: CriteriaMetricKey): string => {
      if (!criteria.length || !rankings.size || !metricKey) return '';
      const activeCriterion = criteria.find((c) => c.metric === metricKey);
      if (!activeCriterion) return '';
      const ranking = rankings.get(propertyId);
      if (!ranking) return '';
      const metricRank = ranking.ranksByMetric.get(metricKey);
      if (!metricRank) return '';
      return getGradientColor(metricRank, properties.length);
    },
    [criteria, rankings, properties.length]
  );

  const handleSortClick = (key: CompMetricKey | 'deal_score' | 'name') => {
    if (sortConfig?.key === key) {
      if (sortConfig.direction === 'desc') {
        onSort({ key, direction: 'asc' });
      } else {
        onSort(null as unknown as SortConfig); // clear sort
      }
    } else {
      onSort({ key, direction: 'desc' });
    }
  };

  const getSortIcon = (key: string) => {
    if (sortConfig?.key !== key) return <ArrowUpDown className="w-3 h-3 opacity-30" />;
    return sortConfig.direction === 'desc'
      ? <ArrowDown className="w-3 h-3 text-ivory" />
      : <ArrowUp className="w-3 h-3 text-ivory" />;
  };

  // Get display value for a cell (with normalization)
  const getCellValue = (
    property: PropertyComparisonItem,
    row: typeof TABLE_SECTIONS[0]['rows'][0]
  ): string => {
    if (normalizationMode !== 'absolute' && row.normalizable && row.getRawValue) {
      const raw = row.getRawValue(property);
      const normalized = normalizeValue(raw, property, normalizationMode);
      if (normalized == null) return EM_DASH;
      if (normalizationMode === 'per_unit') return `$${Math.round(normalized).toLocaleString()}/unit`;
      if (normalizationMode === 'per_sf') return `$${normalized.toFixed(2)}/sf`;
    }
    return row.getValue(property);
  };

  return (
    <div className="rounded-2xl overflow-hidden border border-white/5 bg-[#0c0c0f]">
      {/* Table Header */}
      <div
        className="grid items-center p-4 bg-white/[0.03] border-b border-white/5"
        style={{
          gridTemplateColumns: `200px repeat(${sortedProperties.length}, 1fr)`,
        }}
      >
        <div className="font-display font-bold text-white">
          <button
            onClick={() => handleSortClick('name')}
            className="flex items-center gap-1 hover:text-ivory transition-colors"
          >
            Metric {getSortIcon('name')}
          </button>
        </div>
        {sortedProperties.map((property) => {
          const isSubject = property.id === subjectId;
          const sp = scoredProperties.find((sp) => sp.property.id === property.id);
          const score = apiScores[property.id]?.total_score ?? sp?.score?.total ?? null;

          return (
            <div
              key={property.id}
              className={cn('text-center', isSubject && 'bg-white/[0.02] -mx-1 px-1 rounded')}
              onMouseEnter={() => onHover(property.id)}
              onMouseLeave={onUnhover}
            >
              <div className="flex items-center justify-center gap-2 mb-1">
                {sp?.rank === 1 && <Star className="w-4 h-4 text-amber-400 fill-amber-400" />}
                <Link
                  to={`/library/${property.id}`}
                  className="font-display font-bold text-white hover:text-ivory transition-colors text-sm"
                >
                  {property.property_name}
                </Link>
                <button
                  onClick={() => onSetSubject(property.id)}
                  className={cn(
                    'p-0.5 rounded transition-all',
                    isSubject ? 'text-ivory' : 'text-zinc-600 hover:text-zinc-400'
                  )}
                  title={isSubject ? 'Subject property' : 'Set as subject'}
                >
                  <Pin className="w-3 h-3" />
                </button>
              </div>
              {isSubject && (
                <span className="text-[8px] uppercase tracking-wider font-bold text-ivory bg-white/10 px-1.5 py-0.5 rounded">
                  Subject
                </span>
              )}
              {/* Score Ring */}
              <div className="flex justify-center mt-1">
                <DealScoreBadge
                  score={score}
                  size="sm"
                  onClick={() => {
                    if (apiScores[property.id]) onScoreClick(property.id);
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Deal Score Sortable Row */}
      <div
        className="grid items-center px-4 py-3 border-b border-white/5 bg-white/[0.02]"
        style={{
          gridTemplateColumns: `200px repeat(${sortedProperties.length}, 1fr)`,
        }}
      >
        <button
          onClick={() => handleSortClick('deal_score')}
          className="flex items-center gap-1.5 text-sm font-semibold text-zinc-400 hover:text-white transition-colors"
        >
          Deal Score {getSortIcon('deal_score')}
        </button>
        {sortedProperties.map((property) => {
          const score = apiScores[property.id]?.total_score
            ?? scoredProperties.find((sp) => sp.property.id === property.id)?.score?.total
            ?? 0;
          return (
            <div key={property.id} className="text-center">
              <span
                className={cn(
                  'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold',
                  getScoreBgClass(score),
                  getScoreColorClass(score)
                )}
              >
                {score}
              </span>
            </div>
          );
        })}
      </div>

      {/* Table Sections */}
      {TABLE_SECTIONS.map((section) => (
        <div key={section.title}>
          {/* Section Header */}
          <div
            className="grid items-center px-4 py-2 bg-white/[0.02] border-b border-white/5"
            style={{
              gridTemplateColumns: `200px repeat(${sortedProperties.length}, 1fr)`,
            }}
          >
            <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              {section.title}
            </div>
            {sortedProperties.map((p) => (
              <div key={p.id} />
            ))}
          </div>

          {/* Section Rows */}
          {section.rows.map((row) => (
            <div
              key={row.label}
              className="grid items-center px-4 py-2.5 border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors"
              style={{
                gridTemplateColumns: `200px repeat(${sortedProperties.length}, 1fr)`,
              }}
            >
              <div className="flex items-center gap-1.5">
                <span className="text-sm text-zinc-400">{row.label}</span>
                {row.metricKey && (
                  <button
                    onClick={() => handleSortClick(row.metricKey!)}
                    className="opacity-0 hover:opacity-100 group-hover:opacity-50 transition-opacity"
                  >
                    {getSortIcon(row.metricKey)}
                  </button>
                )}
              </div>
              {sortedProperties.map((property) => {
                const isSubject = property.id === subjectId;
                const cellValue = getCellValue(property, row);
                const isBest = row.metricKey ? isBestApiValue(property, row.metricKey, bestValues) : false;
                const gradientBg = getCellGradient(property.id, row.criteriaKey);

                // Compute delta vs subject
                let deltaEl: React.ReactNode = null;
                if (subject && !isSubject && row.metricKey) {
                  const subjectVal = getPropertyMetric(subject, row.metricKey);
                  const compVal = getPropertyMetric(property, row.metricKey);
                  const delta = computeDelta(subjectVal, compVal, row.metricKey);
                  if (delta && delta.delta !== 0) {
                    deltaEl = (
                      <span
                        className={cn(
                          'text-[10px] font-display',
                          delta.isFavorable ? 'text-emerald-500' : 'text-rose-500'
                        )}
                      >
                        {delta.deltaFormatted}
                      </span>
                    );
                  }
                }

                return (
                  <div
                    key={property.id}
                    className={cn(
                      'text-center transition-colors',
                      isSubject && 'bg-white/[0.02]',
                      hoveredPropertyId === property.id && 'bg-white/[0.03]',
                    )}
                    style={gradientBg ? { background: gradientBg } : undefined}
                    onMouseEnter={() => onHover(property.id)}
                    onMouseLeave={onUnhover}
                  >
                    <div className="flex flex-col items-center">
                      <span className={cn(
                        'font-display text-sm',
                        isBest ? 'text-emerald-500 font-semibold' : 'text-white'
                      )}>
                        {isBest && <Check className="w-3 h-3 inline mr-1" />}
                        {cellValue}
                      </span>
                      {deltaEl}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      ))}

      {/* Comp Average Footer Row */}
      <div
        className="grid items-center px-4 py-3 border-t-2 border-white/10 bg-white/[0.03]"
        style={{
          gridTemplateColumns: `200px repeat(${sortedProperties.length}, 1fr)`,
        }}
      >
        <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
          Comp Average
        </div>
        {sortedProperties.map((property) => {
          const isSubject = property.id === subjectId;
          if (isSubject) {
            return <div key={property.id} className="text-center text-xs text-zinc-600">{EM_DASH}</div>;
          }
          return <div key={property.id} />;
        })}
      </div>
      {/* Avg values per section metric */}
      {TABLE_SECTIONS.flatMap((section) =>
        section.rows
          .filter((row) => row.metricKey)
          .map((row) => {
            const avg = computeCompAverage(properties, row.metricKey!, subjectId);
            if (avg == null) return null;

            return (
              <div
                key={`avg-${row.label}`}
                className="grid items-center px-4 py-1.5 border-b border-white/[0.02] bg-white/[0.02]"
                style={{
                  gridTemplateColumns: `200px repeat(${sortedProperties.length}, 1fr)`,
                }}
              >
                <span className="text-xs text-zinc-500 italic">{row.label}</span>
                {sortedProperties.map((property) => {
                  const isSubject = property.id === subjectId;
                  if (isSubject) {
                    return <div key={property.id} />;
                  }
                  const formatter = row.metricKey ? METRIC_DEFS[row.metricKey]?.format : undefined;
                  return (
                    <div key={property.id} className="text-center">
                      <span className="text-xs text-zinc-500 font-display">
                        {formatter ? formatter(avg) : avg.toFixed(1)}
                      </span>
                    </div>
                  );
                })}
              </div>
            );
          })
      )}
    </div>
  );
}
