/**
 * AutoFitBarChart — Reusable bar chart with auto-fit Y-axis.
 * Used by Financials (Monthly Revenue Trend) and Unit Mix (Lease Expiration).
 * Pure div/CSS rendering, no chart library needed.
 */

import { useMemo } from 'react';
import { STAT_BOX, SECTION_LABEL } from './tabs/tabUtils';

export interface BarDatum {
  label: string;
  value: number;
  highlight?: 'primary' | 'accent' | 'warning' | 'dim';
}

export interface SummaryItem {
  label: string;
  value: string;
}

export interface LegendItem {
  color: string;
  label: string;
}

interface AutoFitBarChartProps {
  data: BarDatum[];
  valueFormat?: (v: number) => string;
  height?: number;
  summaryItems?: SummaryItem[];
  legend?: LegendItem[];
  title?: string;
  subtitle?: string;
}

function computeAxis(data: BarDatum[]): { min: number; max: number; ticks: number[] } {
  if (data.length === 0) return { min: 0, max: 100, ticks: [0, 25, 50, 75, 100] };

  const values = data.map((d) => d.value);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const range = rawMax - rawMin || rawMax || 100;

  const padding = range * 0.15;
  let min = Math.max(0, rawMin - padding);
  let max = rawMax + padding;

  // Round to clean intervals
  const rawStep = (max - min) / 4;
  // Find a nice step: 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, ...
  const niceSteps = [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000, 250000, 500000, 1000000];
  let step = niceSteps[0];
  for (const s of niceSteps) {
    if (s >= rawStep) { step = s; break; }
    step = s;
  }

  min = Math.floor(min / step) * step;
  max = Math.ceil(max / step) * step;
  if (max === min) max = min + step * 4;

  const ticks: number[] = [];
  for (let v = min; v <= max; v += step) {
    ticks.push(v);
  }
  // Ensure we have 4-6 ticks
  if (ticks.length > 7) {
    const newStep = step * 2;
    ticks.length = 0;
    for (let v = Math.floor(min / newStep) * newStep; v <= max; v += newStep) {
      ticks.push(v);
    }
  }

  return { min: ticks[0], max: ticks[ticks.length - 1], ticks };
}

function defaultFormat(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return v.toString();
}

function barColorClass(highlight?: BarDatum['highlight']): string {
  switch (highlight) {
    case 'primary': return 'bg-primary';
    case 'accent': return 'bg-primary/60';
    case 'warning': return 'bg-amber-400';
    case 'dim': return 'bg-primary/30';
    default: return 'bg-primary/40';
  }
}

export function AutoFitBarChart({
  data,
  valueFormat,
  height = 280,
  summaryItems,
  legend,
  title,
  subtitle,
}: AutoFitBarChartProps) {
  const fmt = valueFormat ?? defaultFormat;
  const axis = useMemo(() => computeAxis(data), [data]);
  const axisRange = axis.max - axis.min || 1;

  return (
    <div className="bg-card/50 backdrop-blur-xl border border-border/60 rounded-2xl p-7">
      {/* Header */}
      {(title || subtitle) && (
        <div className="mb-5">
          {title && <h3 className="font-display text-base font-semibold text-foreground">{title}</h3>}
          {subtitle && <p className="font-sans text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
      )}

      {/* Summary row */}
      {summaryItems && summaryItems.length > 0 && (
        <div className="flex gap-4 mb-6">
          {summaryItems.map((item) => (
            <div key={item.label} className={STAT_BOX + ' flex-1'}>
              <p className={SECTION_LABEL}>{item.label}</p>
              <p className="font-display text-lg font-semibold text-foreground mt-1">{item.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Chart area */}
      <div className="flex" style={{ height }}>
        {/* Y-axis labels */}
        <div className="flex flex-col justify-between pr-3 text-right" style={{ minWidth: 52 }}>
          {[...axis.ticks].reverse().map((tick) => (
            <span key={tick} className="text-[10px] font-mono text-muted-foreground leading-none">
              {fmt(tick)}
            </span>
          ))}
        </div>

        {/* Bars area */}
        <div className="flex-1 relative border-l border-border/40">
          {/* Grid lines */}
          {axis.ticks.map((tick) => {
            const pct = ((tick - axis.min) / axisRange) * 100;
            return (
              <div
                key={tick}
                className="absolute w-full border-t border-border/30"
                style={{ bottom: `${pct}%` }}
              />
            );
          })}

          {/* Bars */}
          <div className="absolute inset-0 flex items-end px-1">
            {data.map((d, i) => {
              const barPct = axisRange > 0 ? ((d.value - axis.min) / axisRange) * 100 : 0;
              return (
                <div key={i} className="flex-1 flex flex-col items-center justify-end h-full px-[2px]" style={{ minWidth: 0 }}>
                  {/* Value label */}
                  <span className="text-[9px] font-mono text-muted-foreground mb-1 whitespace-nowrap">
                    {fmt(d.value)}
                  </span>
                  {/* Bar */}
                  <div
                    className={`w-[80%] rounded-t-[4px] transition-all duration-300 ${barColorClass(d.highlight)}`}
                    style={{ height: `${Math.max(barPct, 1)}%` }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* X-axis labels */}
      <div className="flex ml-[52px] border-t border-border/40 pt-2">
        {data.map((d, i) => (
          <div key={i} className="flex-1 text-center">
            <span className="text-[10px] font-sans text-muted-foreground">{d.label}</span>
          </div>
        ))}
      </div>

      {/* Legend */}
      {legend && legend.length > 0 && (
        <div className="flex gap-4 mt-4 justify-center">
          {legend.map((item) => (
            <div key={item.label} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: item.color }} />
              <span className="text-[10px] font-sans text-muted-foreground">{item.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
