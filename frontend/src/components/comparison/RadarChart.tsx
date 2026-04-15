/**
 * RadarChart — SVG multi-metric radar visualization
 */
import type { RadarChartProps } from './types';
import { PROPERTY_COLORS, METRIC_DEFS } from './constants';

export function RadarChart({ properties, metrics, scoresByProperty }: RadarChartProps) {
  if (metrics.length < 3) return null;

  const cx = 150;
  const cy = 150;
  const radius = 100;
  const numMetrics = metrics.length;
  const rings = [0.2, 0.4, 0.6, 0.8, 1.0];

  const getPoint = (metricIdx: number, value: number) => {
    const angle = (metricIdx / numMetrics) * 2 * Math.PI - Math.PI / 2;
    return {
      x: cx + radius * value * Math.cos(angle),
      y: cy + radius * value * Math.sin(angle),
    };
  };

  return (
    <svg viewBox="0 0 300 300" className="w-full max-w-[380px] mx-auto">
      {/* Concentric rings */}
      {rings.map((ring, i) => {
        const points = metrics
          .map((_, j) => {
            const pt = getPoint(j, ring);
            return `${pt.x},${pt.y}`;
          })
          .join(' ');
        return (
          <polygon
            key={i}
            points={points}
            fill="none"
            stroke="rgba(255,255,255,0.04)"
            strokeWidth="0.5"
          />
        );
      })}

      {/* Axis lines */}
      {metrics.map((_, i) => {
        const end = getPoint(i, 1);
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={end.x}
            y2={end.y}
            stroke="rgba(255,255,255,0.04)"
            strokeWidth="0.5"
          />
        );
      })}

      {/* Property polygons */}
      {properties.map((prop, propIdx) => {
        const scores = scoresByProperty[prop.id] ?? {};
        const points = metrics
          .map((metric, j) => {
            const score = (scores[metric] ?? 0) / 100;
            const pt = getPoint(j, score);
            return `${pt.x},${pt.y}`;
          })
          .join(' ');
        const color = PROPERTY_COLORS[propIdx % PROPERTY_COLORS.length];
        return (
          <polygon
            key={prop.id}
            points={points}
            fill={color}
            fillOpacity={0.12}
            stroke={color}
            strokeWidth="2"
            strokeLinejoin="round"
          />
        );
      })}

      {/* Data point dots */}
      {properties.map((prop, propIdx) => {
        const scores = scoresByProperty[prop.id] ?? {};
        const color = PROPERTY_COLORS[propIdx % PROPERTY_COLORS.length];
        return metrics.map((metric, j) => {
          const score = (scores[metric] ?? 0) / 100;
          const pt = getPoint(j, score);
          return (
            <circle
              key={`${prop.id}-${metric}`}
              cx={pt.x}
              cy={pt.y}
              r="3"
              fill={color}
            />
          );
        });
      })}

      {/* Axis labels */}
      {metrics.map((metric, i) => {
        const labelRadius = radius + 28;
        const angle = (i / numMetrics) * 2 * Math.PI - Math.PI / 2;
        const lx = cx + labelRadius * Math.cos(angle);
        const ly = cy + labelRadius * Math.sin(angle);
        const def = METRIC_DEFS[metric];

        let textAnchor: 'start' | 'middle' | 'end' = 'middle';
        if (Math.cos(angle) > 0.3) textAnchor = 'start';
        else if (Math.cos(angle) < -0.3) textAnchor = 'end';

        return (
          <text
            key={i}
            x={lx}
            y={ly}
            textAnchor={textAnchor}
            dominantBaseline="central"
            fill="rgba(255,255,255,0.4)"
            fontSize="10"
            fontFamily="'Inter', system-ui, sans-serif"
          >
            {def.label}
          </text>
        );
      })}
    </svg>
  );
}
