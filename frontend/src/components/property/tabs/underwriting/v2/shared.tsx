/**
 * Shared helpers for the V2 standalone module sections
 * (Renovation / Retail / Tax Abatement).
 *
 * Reuses the Loan Assumption enable-toggle pattern from
 * UWAssumptionsPage.tsx so visual hierarchy stays consistent.
 */

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { GLASS_CARD } from '../../tabUtils';

/** Em dash used for missing / not-applicable values across v2 sections. */
export const EM_DASH = '—';

/** Collapsible card matching the existing CollapsibleSection pattern. */
export function V2CollapsibleSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={cn(GLASS_CARD, 'overflow-hidden')}>
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        aria-expanded={open}
        className="w-full flex items-center justify-between"
      >
        <h3 className="font-display text-sm font-bold text-foreground">{title}</h3>
        <span className="text-muted-foreground text-xs">{open ? '▾' : '▸'}</span>
      </button>
      {open && <div className="mt-4 space-y-2">{children}</div>}
    </div>
  );
}

/** Enable toggle — matches Loan Assumption visual treatment exactly. */
export function EnableToggle({
  enabled,
  onChange,
  label = 'Enable',
  id,
}: {
  enabled: boolean;
  onChange: (next: boolean) => void;
  label?: string;
  id?: string;
}) {
  return (
    <div className="flex items-center gap-3 py-2">
      <label
        htmlFor={id}
        className="text-xs text-muted-foreground w-40 cursor-pointer"
      >
        {label}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={() => onChange(!enabled)}
        className={cn(
          'w-10 h-5 rounded-full transition-colors relative focus:outline-none focus:ring-1 focus:ring-white/20',
          enabled ? 'bg-white' : 'bg-white/10',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 w-4 h-4 rounded-full transition-transform',
            enabled ? 'bg-[#060608] translate-x-5' : 'bg-white translate-x-0.5',
          )}
        />
      </button>
    </div>
  );
}

/** Inline labeled field row — mirrors the InputRow in UWAssumptionsPage. */
export function FieldRow({
  label,
  htmlFor,
  children,
  hint,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
  hint?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 py-2">
      <label
        htmlFor={htmlFor}
        className="text-xs text-muted-foreground w-40 shrink-0"
      >
        {label}
      </label>
      <div className="w-36 shrink-0">{children}</div>
      {hint && (
        <span className="text-[10px] text-muted-foreground/70 font-mono">
          {hint}
        </span>
      )}
    </div>
  );
}

/** Row of read-only computed preview metrics. */
export function PreviewStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="space-y-0.5">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70">
        {label}
      </span>
      <p className="font-mono text-sm text-foreground">{value}</p>
    </div>
  );
}
