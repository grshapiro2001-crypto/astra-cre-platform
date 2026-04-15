/**
 * SummaryStatsStrip — 4-6 liquid glass metric cards comparing subject to comp average
 */
import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { PropertyComparisonItem } from './types';
import { EM_DASH, METRIC_DEFS } from './constants';
import { getPropertyMetric, computeCompAverage } from './utils';

interface SummaryStatsStripProps {
  properties: PropertyComparisonItem[];
  subjectId: number | null;
  avgScore: number | null;
}

interface StatCard {
  label: string;
  subjectValue: string;
  compAvg: string;
  delta: string;
  isFavorable: boolean;
}

export function SummaryStatsStrip({
  properties,
  subjectId,
  avgScore,
}: SummaryStatsStripProps) {
  const subject = useMemo(
    () => (subjectId != null ? properties.find((p) => p.id === subjectId) : null),
    [properties, subjectId]
  );

  const cards = useMemo<StatCard[]>(() => {
    const result: StatCard[] = [];

    const addCard = (
      label: string,
      metricKey: 'going_in_cap' | 'price_per_unit' | 'noi_growth' | 'opex_ratio',
      higherIsBetter: boolean,
      formatter: (v: number | null | undefined) => string
    ) => {
      const avg = computeCompAverage(properties, metricKey, subjectId);
      const subVal = subject ? getPropertyMetric(subject, metricKey) : null;

      if (avg == null && subVal == null) return;

      let delta = EM_DASH;
      let isFavorable = true;
      if (subVal != null && avg != null) {
        const d = subVal - avg;
        const sign = d >= 0 ? '+' : '';
        if (metricKey === 'price_per_unit') {
          delta = `${sign}$${Math.round(d).toLocaleString()}`;
        } else {
          delta = `${sign}${d.toFixed(2)}%`;
        }
        isFavorable = higherIsBetter ? d >= 0 : d <= 0;
      }

      result.push({
        label,
        subjectValue: subject ? formatter(subVal) : EM_DASH,
        compAvg: avg != null ? formatter(avg) : EM_DASH,
        delta,
        isFavorable,
      });
    };

    addCard('Cap Rate', 'going_in_cap', true, (v) => METRIC_DEFS.going_in_cap.format(v));
    addCard('$/Unit', 'price_per_unit', false, (v) => METRIC_DEFS.price_per_unit.format(v));
    addCard('NOI Growth', 'noi_growth', true, (v) => METRIC_DEFS.noi_growth.format(v));
    addCard('OpEx Ratio', 'opex_ratio', false, (v) => METRIC_DEFS.opex_ratio.format(v));

    // Add score card
    if (avgScore != null) {
      result.push({
        label: 'Avg Deal Score',
        subjectValue: EM_DASH,
        compAvg: Math.round(avgScore).toString(),
        delta: EM_DASH,
        isFavorable: true,
      });
    }

    return result;
  }, [properties, subjectId, subject, avgScore]);

  if (cards.length === 0) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {cards.map((card) => (
        <div key={card.label} className="liquid-glass p-4">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold mb-2">
            {card.label}
          </p>
          {subject ? (
            <>
              <p className="font-display text-xl font-extrabold tracking-tight text-white">
                {card.subjectValue}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-zinc-500">Avg: {card.compAvg}</span>
                {card.delta !== EM_DASH && (
                  <span
                    className={cn(
                      'text-xs font-display font-semibold',
                      card.isFavorable ? 'text-emerald-500' : 'text-rose-500'
                    )}
                  >
                    {card.delta}
                  </span>
                )}
              </div>
            </>
          ) : (
            <p className="font-display text-xl font-extrabold tracking-tight text-white">
              {card.compAvg}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
