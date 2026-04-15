/**
 * SparklineTrend — Tiny inline SVG sparkline for rent trending
 * Falls back to em-dash when no data is available.
 */
import { EM_DASH } from './constants';

interface SparklineTrendProps {
  data: number[] | null;
}

export function SparklineTrend({ data }: SparklineTrendProps) {
  if (!data || data.length < 2) {
    return <span className="text-xs text-zinc-500">{EM_DASH}</span>;
  }

  const width = 80;
  const height = 20;
  const padding = 2;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data
    .map((v, i) => {
      const x = padding + (i / (data.length - 1)) * (width - padding * 2);
      const y = height - padding - ((v - min) / range) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(' ');

  const isUp = data[data.length - 1] >= data[0];

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="inline-block">
      <polyline
        points={points}
        fill="none"
        stroke={isUp ? '#10b981' : '#f43f5e'}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
