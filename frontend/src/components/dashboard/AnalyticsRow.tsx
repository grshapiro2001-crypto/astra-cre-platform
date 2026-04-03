/**
 * AnalyticsRow — Bottom row of 3 analytics cards
 *
 * 1. Pipeline by Stage (Donut chart)
 * 2. By Submarket (Horizontal bars — volume $)
 * 3. Score Distribution (Dot plot)
 */
import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { DonutChart } from '@/components/ui/donut-chart';
import type { DonutChartSegment } from '@/components/ui/donut-chart';
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

// Score colors defined in KanbanBoard.tsx (shared)

// ============================================================
// 1. Pipeline by Stage — Donut
// ============================================================

const PipelineDonut: React.FC<{ deals: DashboardDeal[]; stages: PipelineStage[]; stageMap: Record<number, string> }> = ({
  deals,
  stages,
  stageMap,
}) => {
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);

  const stageData = useMemo(() => {
    const counts: Record<string, number> = {};
    const volumes: Record<string, number> = {};
    stages.forEach((s) => { counts[s.id] = 0; volumes[s.id] = 0; });
    deals.forEach((d) => {
      const sid = stageMap[d.id] || stages[0]?.id || 'screening';
      if (counts[sid] !== undefined) { counts[sid]++; volumes[sid] += d.dealValue || 0; }
      else if (stages.length > 0) { counts[stages[0].id]++; volumes[stages[0].id] += d.dealValue || 0; }
    });
    return stages.map((s) => ({ ...s, count: counts[s.id] || 0, volume: volumes[s.id] || 0 }));
  }, [deals, stages, stageMap]);

  const total = deals.length;
  const chartData: DonutChartSegment[] = stageData.map(s => ({
    value: s.count,
    color: s.color,
    label: s.label,
    volume: s.volume,
    count: s.count,
  }));

  const activeStage = stageData.find(s => s.label === hoveredLabel);
  const displayValue = activeStage?.count ?? total;
  const displayLabel = activeStage?.label ?? 'Total Deals';

  return (
    <div className="liquid-glass shim p-5">
      <h3 className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-4">
        Pipeline by Stage
      </h3>
      <div className="flex flex-col items-center gap-4">
        <DonutChart
          data={chartData}
          size={160}
          strokeWidth={22}
          animationDuration={1}
          animationDelayPerSegment={0.05}
          highlightOnHover={true}
          onSegmentHover={(seg) => setHoveredLabel(seg?.label ?? null)}
          centerContent={
            <AnimatePresence mode="wait">
              <motion.div
                key={displayLabel}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.2, ease: 'circOut' }}
                className="flex flex-col items-center justify-center text-center"
              >
                <p className="text-zinc-500 text-[10px] font-medium truncate max-w-[80px]">{displayLabel}</p>
                <p className="text-3xl font-extrabold text-foreground" style={{ color: activeStage?.color }}>
                  {displayValue}
                </p>
                {activeStage && (
                  <p className="text-sm font-medium text-zinc-500">
                    [{((activeStage.count / total) * 100).toFixed(0)}%]
                  </p>
                )}
              </motion.div>
            </AnimatePresence>
          }
        />

        {/* Legend */}
        <div className="flex flex-col gap-1 w-full pt-3 border-t border-white/[0.04]">
          {stageData.map((s) => (
            <motion.div
              key={s.id}
              className={cn(
                'flex items-center justify-between py-1 px-2 rounded-lg transition-all duration-200 cursor-pointer',
                hoveredLabel === s.label && 'bg-white/[0.04]',
                hoveredLabel != null && hoveredLabel !== s.label && 'opacity-40',
              )}
              onMouseEnter={() => setHoveredLabel(s.label)}
              onMouseLeave={() => setHoveredLabel(null)}
            >
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color, opacity: s.color === '#ffffff' ? 0.8 : 1 }} />
                <span className="text-[11px] font-medium text-foreground">{s.label}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-zinc-500">{s.volume > 0 ? formatDollarCompact(s.volume) : '\u2014'}</span>
                <span className="text-[11px] font-bold text-zinc-300">{s.count}</span>
              </div>
            </motion.div>
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
    <div className="liquid-glass shim p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-sans text-[10px] font-normal uppercase tracking-[0.14em] text-muted-foreground">
          By Submarket
        </h3>
        <span className="font-sans text-[10px] font-normal uppercase tracking-[0.14em] text-muted-foreground/50">Volume $</span>
      </div>
      <div className="space-y-2.5">
        {submarketData.length === 0 ? (
          <p className="text-xs text-muted-foreground">No submarket data</p>
        ) : (
          submarketData.map(([name, volume]) => (
            <div key={name}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-foreground truncate max-w-[60%]">{name}</span>
                <span className="font-display text-2xs text-muted-foreground">{formatDollarCompact(volume)}</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-white/30 to-white/70"
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
  const [hoveredIdx, setHoveredIdx] = React.useState<number | null>(null);

  const scored = useMemo(
    () => deals.filter((d) => d.dealScore != null && d.units > 0).map((d) => ({
      id: d.id, name: d.name, score: d.dealScore!, units: d.units,
      price: d.dealValue, capRate: d.capRate,
    })),
    [deals],
  );

  const maxUnits = Math.max(1, ...scored.map(d => d.units));

  // SVG dimensions
  const vbW = 340, vbH = 200;
  const pad = { top: 12, right: 20, bottom: 36, left: 38 };
  const plotW = vbW - pad.left - pad.right;
  const plotH = vbH - pad.top - pad.bottom;
  const zoneX = (s: number) => pad.left + (s / 100) * plotW;

  const hovered = hoveredIdx != null ? scored[hoveredIdx] : null;

  return (
    <div className="liquid-glass shim p-5 pb-3">
      <h3 className="font-sans text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-3">
        Score Distribution
      </h3>

      <div style={{ width: '100%', height: 0, paddingBottom: '58%', position: 'relative' }}>
        <svg
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
          viewBox={`0 0 ${vbW} ${vbH}`}
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Plot bg */}
          <rect x={pad.left} y={pad.top} width={plotW} height={plotH} fill="rgba(255,255,255,0.008)" rx="4" />

          {/* Zone dividers */}
          <line x1={zoneX(65)} y1={pad.top} x2={zoneX(65)} y2={pad.top + plotH} stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" strokeDasharray="2 3" />
          <line x1={zoneX(80)} y1={pad.top} x2={zoneX(80)} y2={pad.top + plotH} stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" strokeDasharray="2 3" />

          {/* Grid lines */}
          {[100, 200, 300, 400].map(u => {
            const y = pad.top + plotH - (u / (maxUnits * 1.1)) * plotH;
            return y >= pad.top + 4 ? (
              <g key={u}>
                <line x1={pad.left} y1={y} x2={pad.left + plotW} y2={y} stroke="rgba(255,255,255,0.025)" strokeWidth="0.5" />
                <text x={pad.left - 8} y={y + 3} textAnchor="end" fill="rgba(255,255,255,0.18)" fontSize="7.5" fontFamily="Inter">{u}</text>
              </g>
            ) : null;
          })}

          {/* X-axis ticks */}
          {[0, 20, 40, 60, 80, 100].map(s => (
            <g key={s}>
              <line x1={zoneX(s)} y1={pad.top + plotH} x2={zoneX(s)} y2={pad.top + plotH + 4} stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
              <text x={zoneX(s)} y={pad.top + plotH + 16} textAnchor="middle" fill="rgba(255,255,255,0.18)" fontSize="7.5" fontFamily="Inter">{s}</text>
            </g>
          ))}

          {/* Axis labels */}
          <text x={pad.left + plotW / 2} y={vbH - 2} textAnchor="middle" fill="rgba(255,255,255,0.12)" fontSize="7" fontFamily="Inter" fontWeight="500" letterSpacing="0.1em">SCORE</text>
          <text x="6" y={pad.top + plotH / 2} textAnchor="middle" fill="rgba(255,255,255,0.12)" fontSize="7" fontFamily="Inter" fontWeight="500" letterSpacing="0.1em" transform={`rotate(-90, 6, ${pad.top + plotH / 2})`}>UNITS</text>

          {/* Axes */}
          <line x1={pad.left} y1={pad.top + plotH} x2={pad.left + plotW} y2={pad.top + plotH} stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
          <line x1={pad.left} y1={pad.top} x2={pad.left} y2={pad.top + plotH} stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />

          {/* Data dots */}
          {scored.map((d, i) => {
            const cx = pad.left + (d.score / 100) * plotW;
            const cy = pad.top + plotH - (d.units / (maxUnits * 1.1)) * plotH;
            const isHovered = hoveredIdx === i;
            const isDimmed = hoveredIdx != null && hoveredIdx !== i;
            return (
              <g
                key={d.id}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
                style={{ cursor: 'pointer', opacity: isDimmed ? 0.15 : 1, transition: 'opacity 0.3s' }}
              >
                <circle cx={cx} cy={cy} r="14" fill="transparent" />
                <circle
                  cx={cx} cy={cy} r={isHovered ? 6 : 4.5}
                  fill="white" fillOpacity={isHovered ? 0.6 : 0.28}
                  style={{ transition: 'all 0.25s cubic-bezier(0.16,1,0.3,1)', filter: isHovered ? 'drop-shadow(0 0 6px rgba(255,255,255,0.25))' : 'none' }}
                />
                {isHovered && (
                  <g>
                    <rect x={cx - 50} y={cy - 38} width={100} height={30} rx={8} fill="rgba(12,12,15,0.94)" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
                    <text x={cx} y={cy - 26} textAnchor="middle" fill="#eeecea" fontSize="8.5" fontWeight="600" fontFamily="Inter">{d.name}</text>
                    <text x={cx} y={cy - 15} textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize="7" fontFamily="Inter">
                      {d.score} score · {d.units}u{d.capRate ? ` · ${d.capRate.toFixed(2)}%` : ''}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Detail bar */}
      <div className="flex items-center px-1 pt-2 min-h-[24px]">
        <span className="text-[10px] text-zinc-600 transition-all duration-200">
          {hovered ? (
            <><span className="text-foreground font-semibold">{hovered.name}</span> · <span className="text-zinc-400">{hovered.score}</span> · {hovered.units}u{hovered.price ? ` · ${formatDollarCompact(hovered.price)}` : ''}</>
          ) : (
            scored.length > 0 ? '' : 'No scored deals'
          )}
        </span>
      </div>
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
