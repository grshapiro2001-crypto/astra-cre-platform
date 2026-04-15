/**
 * MetricBars — Key metrics bar-race comparison panel
 */
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PropertyComparisonItem, MetricPreset } from './types';
import { METRIC_DEFS, EM_DASH } from './constants';
import { getPropertyMetric } from './utils';

interface MetricBarsProps {
  properties: PropertyComparisonItem[];
  preset: MetricPreset;
  animated: boolean;
  hoveredPropertyId: number | null;
  onHover: (id: number) => void;
  onUnhover: () => void;
}

export function MetricBars({
  properties,
  preset,
  animated,
  hoveredPropertyId,
  onHover,
  onUnhover,
}: MetricBarsProps) {
  return (
    <div className="liquid-glass p-6">
      <h3 className="font-display text-lg font-bold text-white mb-6">
        Key Metrics Comparison
      </h3>

      <div className="space-y-6">
        {preset.metrics.map((metric) => {
          const def = METRIC_DEFS[metric];
          const scoring = preset.scoring[metric];
          if (!scoring) return null;

          const propsWithValues = properties
            .filter((p) => getPropertyMetric(p, metric) !== null)
            .map((p) => ({ property: p, value: getPropertyMetric(p, metric)! }));

          if (propsWithValues.length === 0) return null;

          const maxVal = Math.max(...propsWithValues.map((pv) => pv.value));
          const minVal = Math.min(...propsWithValues.map((pv) => pv.value));

          const sorted = [...propsWithValues].sort((a, b) => {
            if (scoring.direction === 'higher') return b.value - a.value;
            if (scoring.direction === 'lower') return a.value - b.value;
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
                  <span className="font-semibold text-white">{def.label}</span>
                  {scoring.direction !== 'neutral' && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-zinc-400">
                      {scoring.direction === 'higher' ? 'Higher is better' : 'Lower is better'}
                    </span>
                  )}
                </div>
                <span className="text-xs text-zinc-500 font-display">
                  Target: {def.format(scoring.target)}
                </span>
              </div>

              {/* Bars */}
              <div className="space-y-2">
                {sorted.map((pv, i) => {
                  const barWidth =
                    maxVal > minVal
                      ? ((pv.value - minVal) / (maxVal - minVal)) * 80 + 20
                      : 100;
                  const isWinner = i === 0;
                  const isHovered = hoveredPropertyId === pv.property.id;

                  return (
                    <div
                      key={pv.property.id}
                      className={cn(
                        'flex items-center gap-3 cursor-pointer transition-opacity duration-200',
                        hoveredPropertyId !== null && !isHovered && 'opacity-40'
                      )}
                      onMouseEnter={() => onHover(pv.property.id)}
                      onMouseLeave={onUnhover}
                    >
                      <div
                        className={cn(
                          'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                          isWinner ? 'bg-emerald-500 text-white' : 'bg-white/5 text-zinc-500'
                        )}
                      >
                        {isWinner ? <Star className="w-3 h-3" /> : i + 1}
                      </div>

                      <span
                        className={cn(
                          'w-28 text-sm truncate shrink-0 transition-colors',
                          isHovered ? 'text-ivory' : 'text-zinc-500'
                        )}
                      >
                        {pv.property.property_name}
                      </span>

                      <div className="flex-1 h-8 rounded-lg overflow-hidden relative bg-white/[0.04]">
                        <div
                          className={cn(
                            'h-full rounded-lg transition-all duration-700 ease-out',
                            isWinner ? 'bg-emerald-500' : 'bg-white/20'
                          )}
                          style={{ width: animated ? `${barWidth}%` : '0%' }}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 font-display text-sm font-semibold text-white">
                          {def.format(pv.value)}
                        </span>
                      </div>
                    </div>
                  );
                })}

                {/* N/A entries */}
                {propsWithNull.map((property) => (
                  <div key={property.id} className="flex items-center gap-3 opacity-40">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 bg-white/5 text-zinc-500">
                      {EM_DASH}
                    </div>
                    <span className="w-28 text-sm truncate shrink-0 text-zinc-500">
                      {property.property_name}
                    </span>
                    <div className="flex-1 h-8 rounded-lg flex items-center justify-center bg-white/[0.04]">
                      <span className="font-display text-sm text-zinc-500">{EM_DASH}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
