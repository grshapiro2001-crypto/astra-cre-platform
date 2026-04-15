/**
 * DealScoreCard — Individual property card in Quick Analysis view
 */
import { Link } from 'react-router-dom';
import { Star, ArrowRight, Pin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DealScoreBadge } from '@/components/scoring/DealScoreBadge';
import type { ScoredProperty, MetricPreset } from './types';
import type { DealScoreResult } from '@/services/scoringService';
import { PROPERTY_COLORS, METRIC_DEFS, EM_DASH, formatPrice } from './constants';
import { getPropertyMetric, getScoreBarBg, getRankLabel } from './utils';

interface DealScoreCardProps {
  scoredProperty: ScoredProperty;
  index: number;
  animated: boolean;
  isHovered: boolean;
  isSubject: boolean;
  apiScore?: DealScoreResult;
  currentPreset: MetricPreset;
  onHover: (id: number) => void;
  onUnhover: () => void;
  onScoreClick: (id: number) => void;
  onSetSubject: (id: number) => void;
}

export function DealScoreCard({
  scoredProperty,
  index,
  animated,
  isHovered,
  isSubject,
  apiScore,
  currentPreset,
  onHover,
  onUnhover,
  onScoreClick,
  onSetSubject,
}: DealScoreCardProps) {
  const { property, score, rank } = scoredProperty;
  const rankInfo = getRankLabel(rank);
  const scoreTotal = score?.total ?? 0;

  return (
    <div
      className="relative group cursor-pointer"
      onMouseEnter={() => onHover(property.id)}
      onMouseLeave={onUnhover}
    >
      <div
        className={cn(
          'deal-card relative overflow-hidden transition-all duration-300',
          isHovered && 'border-white/20 shadow-xl shadow-white/5 -translate-y-1',
          isSubject && 'ring-1 ring-ivory/30',
        )}
      >
        {/* Rank Badge */}
        <div className="absolute top-3 left-3 z-10 px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 bg-black/60 backdrop-blur-sm">
          {rank === 1 && <Star className="w-3 h-3 text-amber-400 fill-amber-400" />}
          <span className={rankInfo.colorClass}>{rankInfo.label}</span>
        </div>

        {/* Subject Badge */}
        {isSubject && (
          <div className="absolute top-3 right-3 z-10 px-2 py-0.5 rounded text-[9px] uppercase tracking-wider font-bold text-ivory bg-white/10 backdrop-blur-sm">
            Subject
          </div>
        )}

        {/* Color Banner */}
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
          <div className="absolute inset-0 bg-gradient-to-t from-[#0c0c0f] via-[#0c0c0f]/60 to-transparent" />
          <div className="absolute bottom-2 left-4 font-display text-5xl font-bold text-white/5">
            {property.property_name.charAt(0)}
          </div>
        </div>

        {/* Content */}
        <div className="p-4 pt-0">
          {/* Name + Score */}
          <div className="flex items-start justify-between mb-3">
            <div className="min-w-0 pr-2">
              <h3 className="font-display text-lg font-bold text-white truncate">
                {property.property_name}
              </h3>
              <p className="text-xs mt-0.5 text-zinc-500 truncate">
                {property.submarket ?? property.property_address ?? property.document_type}
              </p>
            </div>

            <DealScoreBadge
              score={apiScore?.total_score ?? (scoreTotal > 0 ? scoreTotal : null)}
              size="lg"
              animated={animated}
              onClick={() => {
                if (apiScore) onScoreClick(property.id);
              }}
            />
          </div>

          {/* Static Metrics */}
          <div className="grid grid-cols-2 gap-3 py-3 mb-3 border-t border-b border-white/5">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">Units</p>
              <p className="font-display text-base font-semibold text-white">
                {property.total_units?.toLocaleString() ?? EM_DASH}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">Year Built</p>
              <p className="font-display text-base font-semibold text-white">
                {property.year_built ?? EM_DASH}
              </p>
            </div>
          </div>

          {/* Score Breakdown Preview (top 3 metrics) */}
          <div className="space-y-2">
            {currentPreset.metrics.slice(0, 3).map((metric) => {
              const def = METRIC_DEFS[metric];
              const metricScore = score?.breakdown[metric]?.score ?? 0;
              const metricValue = getPropertyMetric(property, metric);

              return (
                <div key={metric} className="flex items-center gap-2">
                  <span className="text-xs w-20 truncate text-zinc-500">{def.label}</span>
                  <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-white/5">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-700 ease-out',
                        getScoreBarBg(metricScore)
                      )}
                      style={{
                        width: animated ? `${metricScore}%` : '0%',
                        transitionDelay: `${index * 100 + 300}ms`,
                      }}
                    />
                  </div>
                  <span className="font-display text-xs w-16 text-right text-white">
                    {def.format(metricValue)}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Price + Actions */}
          <div className="mt-4 flex items-end justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">Asking</p>
              <p className="font-display text-xl font-bold text-white">
                {formatPrice(property.pricing.price)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); onSetSubject(property.id); }}
                className={cn(
                  'p-1.5 rounded-lg border transition-all',
                  isSubject
                    ? 'border-ivory/30 bg-ivory/10 text-ivory'
                    : 'border-white/10 text-zinc-500 hover:text-white opacity-0 group-hover:opacity-100'
                )}
                title="Set as subject"
              >
                <Pin className="w-3.5 h-3.5" />
              </button>
              <Link
                to={`/library/${property.id}`}
                className="text-xs font-semibold flex items-center gap-1 text-ivory hover:gap-2 transition-all"
              >
                Details
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
