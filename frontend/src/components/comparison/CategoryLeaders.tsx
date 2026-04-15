/**
 * CategoryLeaders — Trophy panel showing best property per metric
 */
import { Trophy } from 'lucide-react';
import type { PropertyComparisonItem, MetricPreset } from './types';
import { METRIC_DEFS } from './constants';
import { getPropertyMetric } from './utils';

interface CategoryLeadersProps {
  properties: PropertyComparisonItem[];
  preset: MetricPreset;
  hoveredPropertyId: number | null;
  onHover: (id: number) => void;
  onUnhover: () => void;
}

export function CategoryLeaders({
  properties,
  preset,
  hoveredPropertyId,
  onHover,
  onUnhover,
}: CategoryLeadersProps) {
  return (
    <div className="liquid-glass p-6">
      <div className="flex items-center gap-2 mb-4">
        <Trophy className="w-5 h-5 text-amber-400" />
        <h3 className="font-display text-lg font-bold text-white">Category Leaders</h3>
      </div>

      <div className="space-y-3">
        {preset.metrics.slice(0, 4).map((metric) => {
          const def = METRIC_DEFS[metric];
          const scoring = preset.scoring[metric];
          if (!scoring) return null;

          const propsWithValues = properties
            .filter((p) => getPropertyMetric(p, metric) !== null)
            .map((p) => ({ property: p, value: getPropertyMetric(p, metric)! }));

          if (propsWithValues.length === 0) return null;

          const winner = [...propsWithValues].sort((a, b) => {
            if (scoring.direction === 'higher') return b.value - a.value;
            if (scoring.direction === 'lower') return a.value - b.value;
            return 0;
          })[0];

          if (!winner) return null;

          return (
            <div
              key={metric}
              className="flex items-center justify-between p-3 rounded-xl bg-white/[0.04] cursor-pointer hover:bg-white/[0.06] transition-colors"
              onMouseEnter={() => onHover(winner.property.id)}
              onMouseLeave={onUnhover}
            >
              <div>
                <p className="text-[10px] uppercase tracking-wider text-zinc-500">
                  Best {def.label}
                </p>
                <p className="font-semibold text-sm mt-0.5 text-white">
                  {winner.property.property_name}
                </p>
              </div>
              <div className="text-right">
                <p className="font-display font-bold text-emerald-500">
                  {def.format(winner.value)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
