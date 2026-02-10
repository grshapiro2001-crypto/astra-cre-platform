/**
 * DealScoreBadge — Circular badge showing the Deal Score (0-100)
 *
 * Sizes: sm (40px — library cards), md (64px — property detail), lg (80px — comparison)
 * Color: 80+ green, 60-79 primary/purple, 40-59 yellow, 0-39 red
 * null/undefined: muted "—"
 */
import { useState } from 'react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

interface SizeConfig {
  size: number;
  radius: number;
  strokeWidth: number;
  fontSize: string;
  hoverFontSize: string;
}

const SIZES: Record<string, SizeConfig> = {
  sm: { size: 40, radius: 16, strokeWidth: 3, fontSize: 'text-sm', hoverFontSize: 'text-[8px]' },
  md: { size: 64, radius: 26, strokeWidth: 4, fontSize: 'text-xl', hoverFontSize: 'text-[10px]' },
  lg: { size: 80, radius: 34, strokeWidth: 4.5, fontSize: 'text-2xl', hoverFontSize: 'text-xs' },
};

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-400';
  if (score >= 60) return 'text-primary';
  if (score >= 40) return 'text-yellow-400';
  return 'text-red-400';
}

function getScoreStroke(score: number): string {
  if (score >= 80) return '#4ade80';
  if (score >= 60) return 'hsl(263, 70%, 58%)';
  if (score >= 40) return '#facc15';
  return '#f87171';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface DealScoreBadgeProps {
  score: number | null | undefined;
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  animated?: boolean;
  className?: string;
}

export function DealScoreBadge({
  score,
  size = 'md',
  onClick,
  animated = true,
  className,
}: DealScoreBadgeProps) {
  const [hovered, setHovered] = useState(false);
  const config = SIZES[size];
  const circumference = 2 * Math.PI * config.radius;

  const isNull = score == null;
  const displayScore = isNull ? 0 : Math.round(score);
  const dashOffset = isNull
    ? circumference
    : circumference - (circumference * displayScore) / 100;

  return (
    <button
      type="button"
      className={cn(
        'relative shrink-0 group',
        onClick && 'cursor-pointer',
        !onClick && 'cursor-default',
        className,
      )}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label={isNull ? 'No deal score' : `Deal Score: ${displayScore}/100`}
    >
      <svg
        width={config.size}
        height={config.size}
        className="transform -rotate-90"
      >
        {/* Background circle */}
        <circle
          cx={config.size / 2}
          cy={config.size / 2}
          r={config.radius}
          fill="none"
          stroke="hsl(var(--border))"
          strokeWidth={config.strokeWidth}
        />
        {/* Score arc */}
        {!isNull && (
          <circle
            cx={config.size / 2}
            cy={config.size / 2}
            r={config.radius}
            fill="none"
            stroke={getScoreStroke(displayScore)}
            strokeWidth={config.strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={animated ? dashOffset : circumference}
            className={animated ? 'transition-[stroke-dashoffset] duration-1000 ease-out' : ''}
          />
        )}
      </svg>

      {/* Center content */}
      <div className="absolute inset-0 flex items-center justify-center">
        {isNull ? (
          <span className="font-mono text-muted-foreground font-semibold">&mdash;</span>
        ) : hovered && onClick ? (
          <span className={cn(config.hoverFontSize, 'font-semibold text-muted-foreground leading-tight text-center')}>
            View<br />Details
          </span>
        ) : (
          <span className={cn('font-mono font-bold', config.fontSize, getScoreColor(displayScore))}>
            {displayScore}
          </span>
        )}
      </div>
    </button>
  );
}
