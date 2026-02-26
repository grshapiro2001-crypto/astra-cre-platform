/**
 * AnalyticsRow — Bottom row of 3 analytics cards
 *
 * 1. Pipeline by Stage (Donut chart)
 * 2. By Submarket (Horizontal bars — volume $)
 * 3. Score Distribution (Dot plot)
 */
import React, { useMemo } from 'react';
import type { DashboardDeal } from '@/components/dashboard/DealCard';
import type { PipelineStage } from '@/components/dashboard/PresetDropdown';

// ============================================================
// Types
// ============================================================

interface AnalyticsRowProps {
  deals: DashboardDeal[];
  stages: PipelineStage[];
  stageMap: Record<number, string>;
}

// ============================================================
// Helpers
// ============================================================

const formatDollarCompact = (num: number): string => {
  if (num >= 1_000_000_000) return `$${(num / 1_000_000_000).toFixed(1)}B`;
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `$${(num / 1_000).toFixed(0)}K`;
  return `$${num}`;
};

const SCORE_COLORS = {
  high: '#10B981',
  medium: '#F59E0B',
  low: '#EF4444',
} as const;

// ============================================================
// 1. Pipeline by Stage — Donut
// ============================================================

const PipelineDonut: React.FC<{ deals: DashboardDeal[]; stages: PipelineStage[]; stageMap: Record<number, string> }> = ({
  deals,
  stages,
  stageMap,
}) => {
  const stageData = useMemo(() => {
    const counts: Record<string, number> = {};
    stages.forEach((s) => (counts[s.id] = 0));
    deals.forEach((d) => {
      const sid = stageMap[d.id] || stages[0]?.id || 'screening';
      if (counts[sid] !== undefined) counts[sid]++;
      else if (stages.length > 0) counts[stages[0].id]++;
    });
    return stages.map((s) => ({ ...s, count: counts[s.id] || 0 }));
  }, [deals, stages, stageMap]);

  const total = deals.length;
  const size = 120;
  const radius = 44;
  const strokeWidth = 18;

  // Build conic segments as SVG arcs
  let cumAngle = -90; // start at top
  const segments = stageData
    .filter((s) => s.count > 0)
    .map((s) => {
      const pct = s.count / total;
      const angle = pct * 360;
      const startAngle = cumAngle;
      cumAngle += angle;
      return { ...s, startAngle, angle, pct };
    });

  const polarToCartesian = (cx: number, cy: number, r: number, angleDeg: number) => {
    const rad = (angleDeg * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };

  const describeArc = (cx: number, cy: number, r: number, startAngle: number, endAngle: number) => {
    const start = polarToCartesian(cx, cy, r, endAngle);
    const end = polarToCartesian(cx, cy, r, startAngle);
    const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;
    return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
  };

  return (
    <div className="bg-card/50 border border-border/60 rounded-2xl p-4">
      <h3 className="font-mono text-2xs uppercase tracking-wider text-muted-foreground font-semibold mb-4">
        Pipeline by Stage
      </h3>
      <div className="flex items-center gap-4">
        {/* Donut */}
        <div className="relative shrink-0">
          <svg width={size} height={size}>
            {total === 0 ? (
              <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={strokeWidth} className="text-border" />
            ) : (
              segments.map((seg) => (
                <path
                  key={seg.id}
                  d={describeArc(size / 2, size / 2, radius, seg.startAngle, seg.startAngle + seg.angle - 0.5)}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                />
              ))
            )}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-mono text-lg font-bold text-foreground">{total}</span>
            <span className="font-mono text-2xs uppercase text-muted-foreground">Deals</span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex-1 space-y-1.5">
          {stageData.map((s) => (
            <div key={s.id} className="flex items-center gap-2 text-xs">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
              <span className="text-muted-foreground truncate flex-1">{s.label}</span>
              <span className="font-mono font-semibold text-foreground">{s.count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ============================================================
// 2. By Submarket — Horizontal Bars (Volume $)
// ============================================================

const SubmarketBars: React.FC<{ deals: DashboardDeal[] }> = ({ deals }) => {
  const submarketData = useMemo(() => {
    const bySubmarket: Record<string, number> = {};
    deals.forEach((d) => {
      const sm = d.submarket || 'Unknown';
      bySubmarket[sm] = (bySubmarket[sm] || 0) + (d.dealValue ?? 0);
    });
    return Object.entries(bySubmarket)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
  }, [deals]);

  const maxVolume = submarketData.length > 0 ? submarketData[0][1] : 1;

  return (
    <div className="bg-card/50 border border-border/60 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-mono text-2xs uppercase tracking-wider text-muted-foreground font-semibold">
          By Submarket
        </h3>
        <span className="font-mono text-2xs uppercase text-muted-foreground/50">Volume $</span>
      </div>
      <div className="space-y-2.5">
        {submarketData.length === 0 ? (
          <p className="text-xs text-muted-foreground">No submarket data</p>
        ) : (
          submarketData.map(([name, volume]) => (
            <div key={name}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-foreground truncate max-w-[60%]">{name}</span>
                <span className="font-mono text-2xs text-muted-foreground">{formatDollarCompact(volume)}</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary/70 to-primary"
                  style={{ width: `${Math.max(4, (volume / maxVolume) * 100)}%` }}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// ============================================================
// 3. Score Distribution — Dot Plot
// ============================================================

const ScoreDistribution: React.FC<{ deals: DashboardDeal[] }> = ({ deals }) => {
  const scored = useMemo(
    () => deals.filter((d) => d.dealScore != null).map((d) => ({ id: d.id, score: d.dealScore! })),
    [deals],
  );

  const strong = scored.filter((d) => d.score >= 80).length;
  const review = scored.filter((d) => d.score >= 60 && d.score < 80).length;
  const weak = scored.filter((d) => d.score < 60).length;

  // Build dot positions — stack vertically at each score "bucket" (width of 5)
  const dotPositions = useMemo(() => {
    const buckets: Record<number, number[]> = {};
    scored.forEach((d) => {
      const bucket = Math.floor(d.score / 5) * 5;
      if (!buckets[bucket]) buckets[bucket] = [];
      buckets[bucket].push(d.id);
    });

    const positions: { id: number; x: number; y: number; score: number; color: string }[] = [];
    Object.entries(buckets).forEach(([bucketStr, ids]) => {
      const bucket = Number(bucketStr);
      ids.forEach((id, idx) => {
        const deal = scored.find((d) => d.id === id)!;
        const color = deal.score >= 80 ? SCORE_COLORS.high : deal.score >= 60 ? SCORE_COLORS.medium : SCORE_COLORS.low;
        positions.push({
          id,
          x: (bucket / 100) * 100,
          y: idx,
          score: deal.score,
          color,
        });
      });
    });
    return positions;
  }, [scored]);

  const maxStack = Math.max(1, ...Object.values(
    scored.reduce<Record<number, number>>((acc, d) => {
      const b = Math.floor(d.score / 5) * 5;
      acc[b] = (acc[b] || 0) + 1;
      return acc;
    }, {}),
  ));

  const plotHeight = Math.max(40, maxStack * 10 + 10);

  return (
    <div className="bg-card/50 border border-border/60 rounded-2xl p-4">
      <h3 className="font-mono text-2xs uppercase tracking-wider text-muted-foreground font-semibold mb-3">
        Score Distribution
      </h3>

      {/* Summary numbers */}
      <div className="flex items-center gap-4 mb-4">
        <div className="text-center">
          <p className="font-mono text-lg font-bold" style={{ color: SCORE_COLORS.high }}>{strong}</p>
          <p className="text-2xs text-muted-foreground">Strong (80+)</p>
        </div>
        <div className="text-center">
          <p className="font-mono text-lg font-bold" style={{ color: SCORE_COLORS.medium }}>{review}</p>
          <p className="text-2xs text-muted-foreground">Review (60-79)</p>
        </div>
        <div className="text-center">
          <p className="font-mono text-lg font-bold" style={{ color: SCORE_COLORS.low }}>{weak}</p>
          <p className="text-2xs text-muted-foreground">Weak (&lt;60)</p>
        </div>
      </div>

      {/* Dot plot */}
      {scored.length > 0 ? (
        <div className="relative" style={{ height: plotHeight }}>
          {/* Axis line */}
          <div className="absolute bottom-0 left-0 right-0 h-px bg-border" />
          {/* Axis labels */}
          <span className="absolute bottom-[-14px] left-0 font-mono text-2xs text-muted-foreground/50">0</span>
          <span className="absolute bottom-[-14px] left-1/2 -translate-x-1/2 font-mono text-2xs text-muted-foreground/50">50</span>
          <span className="absolute bottom-[-14px] right-0 font-mono text-2xs text-muted-foreground/50">100</span>

          {/* Zone backgrounds */}
          <div className="absolute inset-0 flex">
            <div className="flex-[60] bg-red-500/3" />
            <div className="flex-[20] bg-yellow-500/3" />
            <div className="flex-[20] bg-green-500/3" />
          </div>

          {/* Dots */}
          {dotPositions.map((dot) => (
            <div
              key={dot.id}
              className="absolute w-2.5 h-2.5 rounded-full"
              style={{
                left: `${dot.x}%`,
                bottom: `${4 + dot.y * 10}px`,
                backgroundColor: dot.color,
              }}
              title={`Score: ${Math.round(dot.score)}`}
            />
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No scored deals</p>
      )}

      {scored.length > 0 && <div className="h-4" />}
    </div>
  );
};

// ============================================================
// Main AnalyticsRow
// ============================================================

export const AnalyticsRow: React.FC<AnalyticsRowProps> = ({ deals, stages, stageMap }) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <PipelineDonut deals={deals} stages={stages} stageMap={stageMap} />
      <SubmarketBars deals={deals} />
      <ScoreDistribution deals={deals} />
    </div>
  );
};
