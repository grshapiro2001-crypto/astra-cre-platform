/**
 * Centralized formatting utilities for the Astra CRE Platform.
 *
 * The Claude extraction pipeline returns percentage values in two
 * different forms depending on the source document:
 *   • Decimal form:  0.0693  (meaning 6.93%)
 *   • Percentage form: 5.50  (meaning 5.50%)
 *
 * The `normalizePercent` helper detects which form a value is in and
 * converts it to a standard percentage number (e.g. 6.93).  All
 * display components should use this helper rather than appending "%"
 * directly to raw values.
 *
 * Rule of thumb used for detection:
 *   • |value| <= 1  → treat as decimal, multiply by 100
 *   • |value| > 1   → already a percentage, use as-is
 *
 * This heuristic works for all CRE metrics because cap rates, IRRs,
 * cash-on-cash, and other rates are virtually never above 100%.
 */

// ---------------------------------------------------------------------------
// Percentage helpers
// ---------------------------------------------------------------------------

/**
 * Normalise a value that may be in decimal (0.0693) or percentage (6.93)
 * form into a standard percentage number (6.93).
 */
export const normalizePercent = (value: number): number => {
  // Values between -1 and 1 (exclusive) are treated as decimals.
  // This covers every realistic CRE percentage metric.
  if (Math.abs(value) <= 1) {
    return value * 100;
  }
  return value;
};

/**
 * Format a percentage value for display.  Handles null/undefined, detects
 * decimal vs percentage form, and applies consistent precision.
 *
 * @param value    Raw value from the API / extraction
 * @param decimals Number of decimal places (default 2)
 * @param fallback String to show when value is null/undefined
 */
export const fmtPercent = (
  value: number | null | undefined,
  decimals = 2,
  fallback = '---',
): string => {
  if (value == null) return fallback;
  return `${normalizePercent(value).toFixed(decimals)}%`;
};

/**
 * Format a cap rate value.  Same as fmtPercent but with a CRE-specific
 * name for readability.
 */
export const fmtCapRate = (
  value: number | null | undefined,
  decimals = 2,
  fallback = '—',
): string => {
  if (value == null) return fallback;
  return `${normalizePercent(value).toFixed(decimals)}%`;
};

// ---------------------------------------------------------------------------
// Currency helpers
// ---------------------------------------------------------------------------

/**
 * Format a dollar value, optionally abbreviated (e.g. $12.3M, $450K).
 */
export const fmtCurrency = (
  value: number | null | undefined,
  abbreviated = false,
): string => {
  if (value == null) return '---';
  if (abbreviated) {
    if (Math.abs(value) >= 1_000_000)
      return `$${(value / 1_000_000).toFixed(1)}M`;
    if (Math.abs(value) >= 1_000)
      return `$${(value / 1_000).toFixed(0)}K`;
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
};

// ---------------------------------------------------------------------------
// Numeric helpers
// ---------------------------------------------------------------------------

/**
 * Format a plain number with locale grouping.
 */
export const fmtNumber = (
  value: number | null | undefined,
  fallback = 'N/A',
): string => {
  if (value == null) return fallback;
  return value.toLocaleString('en-US');
};
