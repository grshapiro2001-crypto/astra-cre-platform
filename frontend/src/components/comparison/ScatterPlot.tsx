/**
 * ScatterPlot — Cap Rate vs $/Unit scatter visualization
 */
import { useMemo, useState } from 'react';
import type { PropertyComparisonItem } from './types';
import { PROPERTY_COLORS, EM_DASH, METRIC_DEFS } from './constants';
import { getPropertyMetric, computeCompAverage } from './utils';

interface ScatterPlotProps {
  properties: PropertyComparisonItem[];
  subjectId: number | null;
}

export function ScatterPlot({ properties, subjectId }: ScatterPlotProps) {
  const [hoveredId, setHoveredId] = useState<number | null>(null);

  const plotData = useMemo(() => {
    const points = properties
      .map((p, i) => {
        const capRate = getPropertyMetric(p, 'going_in_cap');
        const pricePerUnit = getPropertyMetric(p, 'price_per_unit');
        if (capRate == null || pricePerUnit == null) return null;
        return {
          property: p,
          x: capRate,
          y: pricePerUnit,
          isSubject: p.id === subjectId,
          color: PROPERTY_COLORS[i % PROPERTY_COLORS.length],
          units: p.total_units ?? 100,
        };
      })
      .filter(Boolean) as Array<{
        property: PropertyComparisonItem;
        x: number;
        y: number;
        isSubject: boolean;
        color: string;
        units: number;
      }>;

    if (points.length === 0) return null;

    const xValues = points.map((p) => p.x);
    const yValues = points.map((p) => p.y);
    const xMin = Math.min(...xValues) - 0.5;
    const xMax = Math.max(...xValues) + 0.5;
    const yMin = Math.min(...yValues) * 0.9;
    const yMax = Math.max(...yValues) * 1.1;

    const avgCapRate = computeCompAverage(properties, 'going_in_cap', subjectId);
    const avgPPU = computeCompAverage(properties, 'price_per_unit', subjectId);

    return { points, xMin, xMax, yMin, yMax, avgCapRate, avgPPU };
  }, [properties, subjectId]);

  if (!plotData || plotData.points.length < 2) {
    return (
      <div className="liquid-glass p-6 text-center">
        <p className="text-sm text-zinc-500">Not enough data for scatter plot (need cap rate + $/unit for at least 2 properties)</p>
      </div>
    );
  }

  const { points, xMin, xMax, yMin, yMax, avgCapRate, avgPPU } = plotData;

  const svgW = 480;
  const svgH = 320;
  const pad = { top: 30, right: 30, bottom: 45, left: 70 };
  const plotW = svgW - pad.left - pad.right;
  const plotH = svgH - pad.top - pad.bottom;

  const scaleX = (v: number) => pad.left + ((v - xMin) / (xMax - xMin)) * plotW;
  const scaleY = (v: number) => pad.top + plotH - ((v - yMin) / (yMax - yMin)) * plotH;

  // Generate axis ticks
  const xTicks = Array.from({ length: 5 }, (_, i) => xMin + (i / 4) * (xMax - xMin));
  const yTicks = Array.from({ length: 5 }, (_, i) => yMin + (i / 4) * (yMax - yMin));

  return (
    <div className="liquid-glass p-6">
      <h3 className="font-display text-lg font-bold text-white mb-4">
        Cap Rate vs $/Unit
      </h3>

      <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full">
        {/* Grid lines */}
        {xTicks.map((tick, i) => (
          <line
            key={`xg-${i}`}
            x1={scaleX(tick)} y1={pad.top}
            x2={scaleX(tick)} y2={pad.top + plotH}
            stroke="rgba(255,255,255,0.04)"
            strokeWidth="1"
          />
        ))}
        {yTicks.map((tick, i) => (
          <line
            key={`yg-${i}`}
            x1={pad.left} y1={scaleY(tick)}
            x2={pad.left + plotW} y2={scaleY(tick)}
            stroke="rgba(255,255,255,0.04)"
            strokeWidth="1"
          />
        ))}

        {/* Comp average crosshairs */}
        {avgCapRate != null && (
          <line
            x1={scaleX(avgCapRate)} y1={pad.top}
            x2={scaleX(avgCapRate)} y2={pad.top + plotH}
            stroke="rgba(255,255,255,0.15)"
            strokeWidth="1"
            strokeDasharray="4,4"
          />
        )}
        {avgPPU != null && (
          <line
            x1={pad.left} y1={scaleY(avgPPU)}
            x2={pad.left + plotW} y2={scaleY(avgPPU)}
            stroke="rgba(255,255,255,0.15)"
            strokeWidth="1"
            strokeDasharray="4,4"
          />
        )}

        {/* Data points */}
        {points.map((pt, i) => {
          const cx = scaleX(pt.x);
          const cy = scaleY(pt.y);
          const r = pt.isSubject ? 7 : Math.max(4, Math.min(6, pt.units / 80));
          const isHovered = hoveredId === pt.property.id;

          return (
            <g
              key={pt.property.id}
              onMouseEnter={() => setHoveredId(pt.property.id)}
              onMouseLeave={() => setHoveredId(null)}
              className="cursor-pointer"
            >
              <circle
                cx={cx} cy={cy} r={r + 2}
                fill="transparent"
              />
              <circle
                cx={cx} cy={cy}
                r={isHovered ? r + 2 : r}
                fill={pt.isSubject ? '#eeecea' : pt.color}
                fillOpacity={pt.isSubject ? 1 : 0.7}
                stroke={pt.isSubject ? '#eeecea' : 'transparent'}
                strokeWidth={pt.isSubject ? 2 : 0}
                className="transition-all duration-150"
              />
              {/* Label */}
              {(isHovered || pt.isSubject) && (
                <text
                  x={cx}
                  y={cy - r - 6}
                  textAnchor="middle"
                  fill="rgba(255,255,255,0.7)"
                  fontSize="9"
                  fontFamily="'Inter', system-ui, sans-serif"
                >
                  {pt.property.property_name.length > 18
                    ? pt.property.property_name.slice(0, 16) + '...'
                    : pt.property.property_name}
                </text>
              )}
              {/* Hover tooltip */}
              {isHovered && (
                <text
                  x={cx}
                  y={cy + r + 14}
                  textAnchor="middle"
                  fill="rgba(255,255,255,0.5)"
                  fontSize="8"
                  fontFamily="'Inter', system-ui, sans-serif"
                >
                  {METRIC_DEFS.going_in_cap.format(pt.x)} | {METRIC_DEFS.price_per_unit.format(pt.y)}
                </text>
              )}
            </g>
          );
        })}

        {/* X-axis labels */}
        {xTicks.map((tick, i) => (
          <text
            key={`xl-${i}`}
            x={scaleX(tick)}
            y={svgH - 10}
            textAnchor="middle"
            fill="rgba(255,255,255,0.3)"
            fontSize="9"
            fontFamily="'Inter', system-ui, sans-serif"
          >
            {tick.toFixed(1)}%
          </text>
        ))}
        <text
          x={pad.left + plotW / 2}
          y={svgH - 0}
          textAnchor="middle"
          fill="rgba(255,255,255,0.4)"
          fontSize="10"
          fontFamily="'Inter', system-ui, sans-serif"
        >
          Cap Rate
        </text>

        {/* Y-axis labels */}
        {yTicks.map((tick, i) => (
          <text
            key={`yl-${i}`}
            x={pad.left - 8}
            y={scaleY(tick) + 3}
            textAnchor="end"
            fill="rgba(255,255,255,0.3)"
            fontSize="9"
            fontFamily="'Inter', system-ui, sans-serif"
          >
            ${Math.round(tick / 1000)}K
          </text>
        ))}
        <text
          x={12}
          y={pad.top + plotH / 2}
          textAnchor="middle"
          fill="rgba(255,255,255,0.4)"
          fontSize="10"
          fontFamily="'Inter', system-ui, sans-serif"
          transform={`rotate(-90, 12, ${pad.top + plotH / 2})`}
        >
          $/Unit
        </text>
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 mt-3">
        {points.map((pt) => (
          <div key={pt.property.id} className="flex items-center gap-1.5">
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: pt.isSubject ? '#eeecea' : pt.color }}
            />
            <span className="text-[10px] text-zinc-500">
              {pt.property.property_name}
              {pt.isSubject && ' (Subject)'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
