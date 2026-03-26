/**
 * uwFormatters — Reusable formatted input components for the UW sub-pages.
 * Currency/percent/numeric inputs with focus/blur formatting.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Pure formatting helpers
// ---------------------------------------------------------------------------

/** Format a number as $1,234,567. Returns "—" for null/undefined. */
export function formatCurrency(v: number | null | undefined): string {
  if (v == null) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(v);
}

/** Format a decimal as "5.25%". Returns "—" for null. */
export function formatPct(v: number | null | undefined, decimals = 2): string {
  if (v == null) return '—';
  return `${(v * 100).toFixed(decimals)}%`;
}

/** Format as $1,234/unit. Returns "—" for null. */
export function formatPerUnit(v: number | null | undefined): string {
  if (v == null) return '—';
  return formatCurrency(Math.round(v));
}

/** Format a number with commas. Returns "—" for null. */
export function formatNumber(v: number | null | undefined): string {
  if (v == null) return '—';
  return v.toLocaleString('en-US');
}

/** Format a decimal multiplier as "1.25x". Returns "—" for null. */
export function formatMultiple(v: number | null | undefined): string {
  if (v == null) return '—';
  return `${v.toFixed(2)}x`;
}

// ---------------------------------------------------------------------------
// Parse helpers
// ---------------------------------------------------------------------------

function stripNonNumeric(s: string): string {
  return s.replace(/[^0-9.\-]/g, '');
}

function parseNum(s: string): number | null {
  const clean = stripNonNumeric(s);
  if (clean === '' || clean === '-') return null;
  const n = Number(clean);
  return isNaN(n) ? null : n;
}

// ---------------------------------------------------------------------------
// CurrencyInput
// ---------------------------------------------------------------------------

interface CurrencyInputProps {
  value: number | null;
  onChange: (v: number | null) => void;
  suffix?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function CurrencyInput({
  value,
  onChange,
  suffix,
  placeholder,
  className,
  disabled,
}: CurrencyInputProps) {
  const [focused, setFocused] = useState(false);
  const [localValue, setLocalValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!focused) {
      setLocalValue(value != null ? String(value) : '');
    }
  }, [value, focused]);

  const displayValue = focused
    ? localValue
    : value != null
      ? formatCurrency(value)
      : '';

  const handleFocus = useCallback(() => {
    setFocused(true);
    setLocalValue(value != null ? String(value) : '');
  }, [value]);

  const handleBlur = useCallback(() => {
    setFocused(false);
    const parsed = parseNum(localValue);
    if (parsed !== value) onChange(parsed);
  }, [localValue, value, onChange]);

  return (
    <div className={cn('relative flex items-center', className)}>
      <Input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        value={displayValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder ?? '$0'}
        disabled={disabled}
        className={cn(
          'font-mono text-sm h-8',
          suffix && 'pr-16',
        )}
      />
      {suffix && (
        <span className="absolute right-3 text-[10px] text-muted-foreground pointer-events-none">
          {suffix}
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PercentInput
// ---------------------------------------------------------------------------

interface PercentInputProps {
  /** Stored as decimal (0.05 = 5%). Displayed as 5.00 when editing, "5.00%" when blurred. */
  value: number | null;
  onChange: (v: number | null) => void;
  decimals?: number;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function PercentInput({
  value,
  onChange,
  decimals = 2,
  placeholder,
  className,
  disabled,
}: PercentInputProps) {
  const [focused, setFocused] = useState(false);
  const [localValue, setLocalValue] = useState('');

  useEffect(() => {
    if (!focused) {
      setLocalValue(value != null ? (value * 100).toFixed(decimals) : '');
    }
  }, [value, focused, decimals]);

  const displayValue = focused
    ? localValue
    : value != null
      ? `${(value * 100).toFixed(decimals)}%`
      : '';

  const handleFocus = useCallback(() => {
    setFocused(true);
    setLocalValue(value != null ? (value * 100).toFixed(decimals) : '');
  }, [value, decimals]);

  const handleBlur = useCallback(() => {
    setFocused(false);
    const parsed = parseNum(localValue);
    const asDecimal = parsed != null ? parsed / 100 : null;
    if (asDecimal !== value) onChange(asDecimal);
  }, [localValue, value, onChange]);

  return (
    <div className={cn('relative flex items-center', className)}>
      <Input
        type="text"
        inputMode="decimal"
        value={displayValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder ?? '0.00%'}
        disabled={disabled}
        className="font-mono text-sm h-8"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// NumericInput (plain numbers — months, years, counts)
// ---------------------------------------------------------------------------

interface NumericInputProps {
  value: number | null;
  onChange: (v: number | null) => void;
  suffix?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  integer?: boolean;
}

export function NumericInput({
  value,
  onChange,
  suffix,
  placeholder,
  className,
  disabled,
  integer,
}: NumericInputProps) {
  const [focused, setFocused] = useState(false);
  const [localValue, setLocalValue] = useState('');

  useEffect(() => {
    if (!focused) {
      setLocalValue(value != null ? String(value) : '');
    }
  }, [value, focused]);

  const displayValue = focused
    ? localValue
    : value != null
      ? suffix ? `${value} ${suffix}` : String(value)
      : '';

  const handleFocus = useCallback(() => {
    setFocused(true);
    setLocalValue(value != null ? String(value) : '');
  }, [value]);

  const handleBlur = useCallback(() => {
    setFocused(false);
    let parsed = parseNum(localValue);
    if (parsed != null && integer) parsed = Math.round(parsed);
    if (parsed !== value) onChange(parsed);
  }, [localValue, value, onChange, integer]);

  return (
    <div className={cn('relative flex items-center', className)}>
      <Input
        type="text"
        inputMode="decimal"
        value={displayValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder ?? '0'}
        disabled={disabled}
        className={cn(
          'font-mono text-sm h-8',
          suffix && focused && 'pr-12',
        )}
      />
      {suffix && focused && (
        <span className="absolute right-3 text-[10px] text-muted-foreground pointer-events-none">
          {suffix}
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// T12 Reference label (small muted text showing trailing actual)
// ---------------------------------------------------------------------------

interface T12RefProps {
  label?: string;
  value: number | null | undefined;
  format?: 'currency' | 'pct';
}

export function T12Ref({ label = 'T12', value, format = 'currency' }: T12RefProps) {
  if (value == null) return null;
  const formatted = format === 'pct' ? formatPct(value) : formatCurrency(value);
  return (
    <span className="text-[10px] text-muted-foreground/70 font-mono whitespace-nowrap">
      {label}: {formatted}
    </span>
  );
}
