/**
 * Shared helpers and types for PropertyDetail tab components.
 * Extracted from the monolithic PropertyDetail.tsx.
 */

import { cn } from '@/lib/utils';
import type { FinancialPeriod, PropertyDetail } from '@/types/property';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FinancialPeriodKey = 't3' | 't12' | 'y1';
export type FinancialViewMode = 'total' | 'perUnit';

export interface FinancialRowProps {
  label: string;
  value: number | null | undefined;
  isDeduction?: boolean;
  isTotal?: boolean;
  isHighlight?: boolean;
  percent?: number | null;
  totalUnits: number;
  viewMode: FinancialViewMode;
}

/** Props shared across all tab components */
export interface SharedTabProps {
  property: PropertyDetail;
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

export const fmtCurrency = (
  value: number | null | undefined,
  abbreviated = false,
): string => {
  if (value == null) return '---';
  if (abbreviated) {
    if (Math.abs(value) >= 1_000_000)
      return `$${(value / 1_000_000).toFixed(1)}M`;
    if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
};

export const fmtPerUnit = (
  value: number | null | undefined,
  units: number,
): string => {
  if (value == null || units === 0) return '---';
  return fmtCurrency(Math.round(value / units));
};

export const fmtDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const fmtNumber = (value: number | null | undefined): string => {
  if (value == null) return 'N/A';
  return value.toLocaleString('en-US');
};

export const periodLabel = (key: FinancialPeriodKey): string => {
  switch (key) {
    case 't3':
      return 'T3';
    case 't12':
      return 'T12';
    case 'y1':
      return 'Y1 Pro Forma';
  }
};

export const periodDescription = (key: FinancialPeriodKey): string => {
  switch (key) {
    case 't3':
      return 'Trailing 3 Month (Annualized)';
    case 't12':
      return 'Trailing 12 Month';
    case 'y1':
      return 'Year 1 Pro Forma';
  }
};

export const docBadgeClass = (docType: string): string => {
  const d = docType.toUpperCase();
  if (d === 'BOV')
    return 'bg-blue-500/10 text-blue-600 dark:text-blue-400';
  if (d === 'OM')
    return 'bg-primary/10 text-primary dark:text-primary';
  return 'bg-muted text-muted-foreground';
};

export const docCategoryBadge = (category: string): { label: string; className: string } => {
  switch (category.toLowerCase()) {
    case 'om':
      return { label: 'OM', className: 'bg-red-500/20 text-red-400' };
    case 'bov':
      return { label: 'BOV', className: 'bg-blue-500/20 text-blue-400' };
    case 'rent_roll':
      return { label: 'Rent Roll', className: 'bg-primary/20 text-primary' };
    case 't12':
      return { label: 'T-12', className: 'bg-amber-500/20 text-amber-400' };
    default:
      return { label: category || 'Other', className: 'bg-gray-500/20 text-gray-400' };
  }
};

export const fmtShortDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

export const financialSourceBadge = (source: string | null | undefined): { label: string; className: string } | null => {
  if (!source) return null;
  switch (source) {
    case 't12_excel':
      return { label: 'T-12 Excel', className: 'bg-primary/20 text-primary' };
    case 'rent_roll_excel':
      return { label: 'Rent Roll Excel', className: 'bg-primary/20 text-primary' };
    case 'om':
      return { label: 'From OM', className: 'bg-gray-500/20 text-gray-400' };
    case 'bov':
      return { label: 'From BOV', className: 'bg-gray-500/20 text-gray-400' };
    default:
      return null;
  }
};

export const ecoOccTextClass = (pct: number): string => {
  if (pct >= 90) return 'text-emerald-600 dark:text-emerald-400';
  if (pct >= 85) return 'text-amber-600 dark:text-amber-400';
  return 'text-rose-600 dark:text-rose-400';
};

export const ecoOccBgClass = (pct: number): string => {
  if (pct >= 90)
    return 'bg-emerald-500/10 border-emerald-500/20';
  if (pct >= 85)
    return 'bg-amber-500/10 border-amber-500/20';
  return 'bg-rose-500/10 border-rose-500/20';
};

// ---------------------------------------------------------------------------
// FinancialRow component
// ---------------------------------------------------------------------------

export { cn };

export const getFinancials = (
  property: PropertyDetail,
  key: FinancialPeriodKey,
): FinancialPeriod | null => {
  const nested = key === 't3' ? property.t3_financials
    : key === 't12' ? property.t12_financials
    : property.y1_financials;
  if (nested) return nested;

  // Fall back to flat NOI fields for OM properties
  const noi = key === 't3' ? property.t3_noi
    : key === 't12' ? property.t12_noi
    : property.y1_noi;
  if (noi == null) return null;

  return { period_label: key, noi };
};

// Glass card style
export const GLASS_CARD = 'bg-card/50 backdrop-blur-xl border border-border/60 rounded-2xl p-7';

// Section header label style
export const SECTION_LABEL = 'font-sans text-[11px] uppercase tracking-[0.18em] text-muted-foreground';

// Stat box style
export const STAT_BOX = 'bg-muted/50 rounded-[10px] p-5 border border-border/40';

/**
 * Deterministic pseudo-random number generator (mulberry32).
 * Used to generate seeded distributions for charts.
 */
export function seededRandom(seed: number): () => number {
  let t = seed;
  return () => {
    t = (t + 0x6D2B79F5) | 0;
    let v = t;
    v = Math.imul(v ^ (v >>> 15), v | 1);
    v ^= v + Math.imul(v ^ (v >>> 7), v | 61);
    return ((v ^ (v >>> 14)) >>> 0) / 4294967296;
  };
}
