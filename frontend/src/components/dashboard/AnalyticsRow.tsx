/**
 * AnalyticsRow — Bottom row of 3 analytics cards
 *
 * 1. Pipeline by Stage (Donut chart)
 * 2. By Submarket (Horizontal bars — volume $)
 * 3. Score Distribution (Dot plot)
 */
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
// 2. By Location — Color-coded Horizontal Bars
// ============================================================

const SUBMARKET_COLORS = [
  { base: '#3B82F6', muted: 'rgba(59,130,246,0.35)', dim: 'rgba(59,130,246,0.10)', glow: 'rgba(59,130,246,0.08)' },
  { base: '#8B5CF6', muted: 'rgba(139,92,246,0.35)', dim: 'rgba(139,92,246,0.10)', glow: 'rgba(139,92,246,0.08)' },
  { base: '#F59E0B', muted: 'rgba(245,158,11,0.35)', dim: 'rgba(245,158,11,0.10)', glow: 'rgba(245,158,11,0.08)' },
  { base: '#22C55E', muted: 'rgba(34,197,94,0.35)',  dim: 'rgba(34,197,94,0.10)',  glow: 'rgba(34,197,94,0.08)' },
  { base: '#EC4899', muted: 'rgba(236,72,153,0.35)', dim: 'rgba(236,72,153,0.10)', glow: 'rgba(236,72,153,0.08)' },
] as const;

const SubmarketBars: React.FC<{ deals: DashboardDeal[] }> = ({ deals }) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const submarketData = useMemo(() => {
    const bySubmarket: Record<string, { volume: number; count: number }> = {};
    deals.forEach((d) => {
      const sm = d.submarket || 'Unknown';
      if (!bySubmarket[sm]) bySubmarket[sm] = { volume: 0, count: 0 };
      bySubmarket[sm].volume += d.dealValue ?? 0;
      bySubmarket[sm].count++;
    });
    return Object.entries(bySubmarket)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 6);
  }, [deals]);

  const maxVolume = submarketData.length > 0 ? submarketData[0].volume : 1;
  const totalVolume = submarketData.reduce((sum, d) => sum + d.volume, 0);

  return (
    <div className="liquid-glass shim p-5 flex flex-col">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">By Location</h3>
        <span className="text-[9px] font-medium uppercase tracking-[0.14em] text-muted-foreground/40">
          {totalVolume > 0 ? formatDollarCompact(totalVolume) : 'Volume $'}
        </span>
      </div>
      <div className="flex flex-col gap-3 flex-1">
        {submarketData.length === 0 ? (
          <p className="text-xs text-muted-foreground">No submarket data</p>
        ) : (
          submarketData.map((entry, i) => {
            const color = SUBMARKET_COLORS[i % SUBMARKET_COLORS.length];
            const pct = totalVolume > 0 ? (entry.volume / totalVolume) * 100 : 0;
            const barWidth = Math.max(3, (entry.volume / maxVolume) * 100);
            const isHovered = hoveredIdx === i;
            const isDimmed = hoveredIdx !== null && hoveredIdx !== i;
            return (
              <motion.div
                key={entry.name}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
                className={cn('group rounded-lg px-2.5 py-2 -mx-1 transition-all duration-300 cursor-default', isHovered && 'bg-white/[0.03]')}
                style={{ opacity: isDimmed ? 0.35 : 1, transition: 'opacity 0.3s ease, background-color 0.3s ease' }}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-1.5 h-1.5 rounded-full shrink-0 transition-transform duration-300"
                      style={{ backgroundColor: color.base, opacity: 0.7, transform: isHovered ? 'scale(1.4)' : 'scale(1)', boxShadow: isHovered ? `0 0 6px ${color.glow}` : 'none' }} />
                    <span className="text-[11px] font-medium text-foreground truncate">{entry.name}</span>
                  </div>
                  <AnimatePresence mode="wait">
                    {isHovered ? (
                      <motion.span key="pct" initial={{ opacity: 0, x: 4 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -4 }}
                        transition={{ duration: 0.15 }} className="text-[10px] font-semibold tabular-nums" style={{ color: color.base }}>
                        {pct.toFixed(1)}%
                      </motion.span>
                    ) : (
                      <motion.span key="vol" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }} className="text-[10px] text-zinc-500 tabular-nums">
                        {formatDollarCompact(entry.volume)}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
                <div className="h-[6px] rounded-full overflow-hidden" style={{ backgroundColor: color.dim }}>
                  <motion.div className="h-full rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${barWidth}%` }}
                    transition={{ duration: 0.8, delay: 0.1 + i * 0.06, ease: [0.22, 1, 0.36, 1] }}
                    style={{
                      background: isHovered ? `linear-gradient(90deg, ${color.muted} 0%, ${color.base} 100%)` : `linear-gradient(90deg, ${color.dim} 0%, ${color.muted} 100%)`,
                      boxShadow: isHovered ? `0 0 12px ${color.glow}` : 'none',
                      transition: 'background 0.3s ease, box-shadow 0.3s ease',
                    }} />
                </div>
              </motion.div>
            );
          })
        )}
      </div>
      <div className="flex items-center justify-between pt-3 mt-auto border-t border-white/[0.04]">
        <AnimatePresence mode="wait">
          {hoveredIdx !== null && submarketData[hoveredIdx] ? (
            <motion.div key={`hover-${hoveredIdx}`} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18 }} className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: SUBMARKET_COLORS[hoveredIdx % SUBMARKET_COLORS.length].base, opacity: 0.7 }} />
              <span className="text-[10px] font-semibold text-foreground">{submarketData[hoveredIdx].name}</span>
              <span className="text-[10px] text-zinc-500 tabular-nums">{formatDollarCompact(submarketData[hoveredIdx].volume)}</span>
            </motion.div>
          ) : (
            <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }} className="flex items-center justify-between w-full">
              <span className="text-[10px] text-zinc-600">{submarketData.length} submarkets</span>
              <span className="text-[10px] text-zinc-600 tabular-nums">{deals.length} deals</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

// ============================================================
// 3. Score Distribution — Dot Plot (click navigates to deal)
// ============================================================

/** Deterministic jitter to de-overlap dots */
const jitter = (id: number, axis: 'x' | 'y'): number => {
  const seed = id * 2654435761;
  const offset = axis === 'x' ? 0 : 13;
  const hash = ((seed + offset) >>> 0) % 1000;
  return ((hash / 1000) - 0.5) * 2;
};

const ScoreDistribution: React.FC<{ deals: DashboardDeal[] }> = ({ deals }) => {
  const navigate = useNavigate();
  const [hoveredIdx, setHoveredIdx] = React.useState<number | null>(null);

  const scored = useMemo(
    () => deals.filter((d) => d.dealScore != null && d.units > 0).map((d) => ({
      id: d.id, name: d.name, score: d.dealScore!, units: d.units,
    })),
    [deals],
  );

  const maxUnits = Math.max(1, ...scored.map(d => d.units));
  const vbW = 340, vbH = 220;
  const pad = { top: 28, right: 20, bottom: 36, left: 38 };
  const plotW = vbW - pad.left - pad.right;
  const plotH = vbH - pad.top - pad.bottom;
  const zoneX = (s: number) => pad.left + (s / 100) * plotW;
  const hovered = hoveredIdx != null ? scored[hoveredIdx] : null;
  const avgScore = scored.length > 0 ? Math.round(scored.reduce((s, d) => s + d.score, 0) / scored.length) : null;

  return (
    <div className="liquid-glass shim p-5 pb-3 overflow-visible [&::after]:rounded-[20px]">
      <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-3 block">Score Distribution</span>

      <div className="w-full" style={{ aspectRatio: '340 / 220' }}>
        <svg className="w-full h-full block" viewBox={`0 0 ${vbW} ${vbH}`} preserveAspectRatio="xMidYMid meet">
          {/* Zone fills */}
          <rect x={pad.left} y={pad.top} width={zoneX(65) - pad.left} height={plotH} fill="rgba(255,255,255,0.0)" />
          <rect x={zoneX(65)} y={pad.top} width={zoneX(80) - zoneX(65)} height={plotH} fill="rgba(255,255,255,0.006)" />
          <rect x={zoneX(80)} y={pad.top} width={pad.left + plotW - zoneX(80)} height={plotH} fill="rgba(255,255,255,0.012)" />

          {/* Plot bg */}
          <rect x={pad.left} y={pad.top} width={plotW} height={plotH} fill="rgba(255,255,255,0.012)" rx="3" />

          {/* Zone dividers + labels */}
          <line x1={zoneX(65)} y1={pad.top} x2={zoneX(65)} y2={pad.top + plotH} stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" strokeDasharray="2 3" />
          <line x1={zoneX(80)} y1={pad.top} x2={zoneX(80)} y2={pad.top + plotH} stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" strokeDasharray="2 3" />
          <text x={zoneX(65) + 3} y={pad.top + 8} fill="rgba(255,255,255,0.10)" fontSize="5.5" fontFamily="Inter">65</text>
          <text x={zoneX(80) + 3} y={pad.top + 8} fill="rgba(255,255,255,0.10)" fontSize="5.5" fontFamily="Inter">80</text>

          {/* Dynamic Y-axis grid */}
          {(() => {
            const niceMax = maxUnits * 1.1;
            const step = niceMax <= 100 ? 25 : niceMax <= 500 ? 100 : niceMax <= 2000 ? 500 : 1000;
            const ticks: number[] = [];
            for (let v = step; v < niceMax; v += step) ticks.push(v);
            return ticks.map(u => {
              const y = pad.top + plotH - (u / niceMax) * plotH;
              return y >= pad.top + 6 ? (
                <g key={u}>
                  <line x1={pad.left} y1={y} x2={pad.left + plotW} y2={y} stroke="rgba(255,255,255,0.025)" strokeWidth="0.5" />
                  <text x={pad.left - 6} y={y + 2.5} textAnchor="end" fill="rgba(255,255,255,0.16)" fontSize="6.5" fontFamily="Inter" fontWeight="400">{u}</text>
                </g>
              ) : null;
            });
          })()}

          {/* X-axis ticks */}
          {[0, 20, 40, 60, 80, 100].map(s => (
            <g key={s}>
              <line x1={zoneX(s)} y1={pad.top + plotH} x2={zoneX(s)} y2={pad.top + plotH + 3} stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
              <text x={zoneX(s)} y={pad.top + plotH + 14} textAnchor="middle" fill="rgba(255,255,255,0.18)" fontSize="6.5" fontFamily="Inter">{s}</text>
            </g>
          ))}

          {/* Axis labels */}
          <text x={pad.left + plotW / 2} y={vbH - 2} textAnchor="middle" fill="rgba(255,255,255,0.10)" fontSize="6" fontFamily="Inter" fontWeight="500" letterSpacing="0.1em">SCORE</text>
          <text x="6" y={pad.top + plotH / 2} textAnchor="middle" fill="rgba(255,255,255,0.10)" fontSize="6" fontFamily="Inter" fontWeight="500" letterSpacing="0.1em" transform={`rotate(-90, 6, ${pad.top + plotH / 2})`}>UNITS</text>

          {/* Axes */}
          <line x1={pad.left} y1={pad.top + plotH} x2={pad.left + plotW} y2={pad.top + plotH} stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
          <line x1={pad.left} y1={pad.top} x2={pad.left} y2={pad.top + plotH} stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />

          {/* Data dots */}
          {scored.map((d, i) => {
            const niceMax = maxUnits * 1.1;
            const cx = pad.left + (d.score / 100) * plotW + jitter(d.id, 'x') * 6;
            const cy = pad.top + plotH - (d.units / niceMax) * plotH + jitter(d.id, 'y') * 6;
            const isHovered = hoveredIdx === i;
            const isDimmed = hoveredIdx != null && hoveredIdx !== i;

            const ttW = 110, ttH = 32, ttGap = 8;
            const rawTtX = cx - ttW / 2;
            const ttX = Math.max(pad.left + 2, Math.min(rawTtX, pad.left + plotW - ttW - 2));
            const flipBelow = cy - ttH - ttGap < pad.top;
            const ttY = flipBelow ? cy + ttGap + 2 : cy - ttH - ttGap;

            return (
              <g key={d.id}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
                onClick={() => navigate(`/library/${d.id}`)}
                style={{ cursor: 'pointer', opacity: isDimmed ? 0.08 : 1, transition: 'opacity 0.3s' }}>
                <circle cx={cx} cy={cy} r="12" fill="transparent" />
                <circle cx={cx} cy={cy} r={isHovered ? 5.5 : 3.5} fill="white"
                  fillOpacity={isHovered ? 0.7 : 0.22}
                  style={{ transition: 'r 0.2s cubic-bezier(0.22,1,0.36,1), fill-opacity 0.2s ease-out, filter 0.2s ease-out',
                    filter: isHovered ? 'drop-shadow(0 0 4px rgba(255,255,255,0.18))' : 'none' }} />
                {isHovered && (
                  <g style={{ pointerEvents: 'none' }}>
                    <rect x={ttX} y={ttY} width={ttW} height={ttH} rx={6} fill="rgba(8,8,11,0.96)" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />
                    <text x={ttX + ttW / 2} y={ttY + 13} textAnchor="middle" fill="#eeecea" fontSize="8.5" fontWeight="600" fontFamily="Inter">
                      {d.name.length > 20 ? d.name.slice(0, 19) + '\u2026' : d.name}
                    </text>
                    <text x={ttX + ttW / 2} y={ttY + 24} textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize="6.5" fontFamily="Inter">
                      Score {d.score}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Detail bar */}
      <div className="flex items-center justify-between px-1 pt-2 min-h-[24px] border-t border-white/[0.04]">
        <AnimatePresence mode="wait">
          {hovered ? (
            <motion.div key={hovered.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18, ease: 'easeOut' }} className="flex items-center gap-2">
              <span className="text-[10px] font-semibold text-foreground">{hovered.name}</span>
              <span className="text-[10px] text-zinc-500 tabular-nums">Score {hovered.score}</span>
            </motion.div>
          ) : (
            <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }} className="flex items-center justify-between w-full">
              <span className="text-[10px] text-zinc-600">{scored.length > 0 ? `${scored.length} deals scored` : 'No scored deals'}</span>
              {avgScore != null && <span className="text-[10px] text-zinc-600 tabular-nums">avg {avgScore}</span>}
            </motion.div>
          )}
        </AnimatePresence>
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
