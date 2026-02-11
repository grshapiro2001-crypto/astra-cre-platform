/**
 * Screening verdict badge — PASS / FAIL / REVIEW
 */
import { CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ScreeningBadgeProps {
  verdict: string | null | undefined;
  size?: 'sm' | 'md';
  onClick?: () => void;
}

const CONFIG: Record<string, {
  label: string;
  icon: typeof CheckCircle;
  badgeClass: string;
}> = {
  PASS: {
    label: 'PASS',
    icon: CheckCircle,
    badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  },
  FAIL: {
    label: 'FAIL',
    icon: XCircle,
    badgeClass: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
  },
  REVIEW: {
    label: 'REVIEW',
    icon: AlertTriangle,
    badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  },
};

export const ScreeningBadge = ({ verdict, size = 'sm', onClick }: ScreeningBadgeProps) => {
  if (!verdict) return null;

  const cfg = CONFIG[verdict.toUpperCase()];
  if (!cfg) return null;

  const Icon = cfg.icon;

  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1 rounded-lg border font-bold uppercase tracking-wider transition-all',
        cfg.badgeClass,
        onClick && 'cursor-pointer hover:opacity-80',
        !onClick && 'cursor-default',
        size === 'sm' && 'px-2 py-0.5 text-[10px]',
        size === 'md' && 'px-2.5 py-1 text-xs',
      )}
    >
      <Icon className={cn(size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5')} />
      {cfg.label}
    </button>
  );
};
