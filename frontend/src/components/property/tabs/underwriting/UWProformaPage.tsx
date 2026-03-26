/**
 * UWProformaPage — Operating statement table.
 * Shows T12, T3 Inc / T12 Exp, Proforma, % Income, $/Unit columns.
 * Uses the backend-computed OperatingStatement for data.
 */

import { useState } from 'react';
import { GLASS_CARD, SECTION_LABEL } from '../tabUtils';
import { cn } from '@/lib/utils';
import { formatCurrency } from './uwFormatters';
import type { UWSubPageProps } from './types';
import type { OperatingStatementLine } from '@/types/underwriting';

// ---------------------------------------------------------------------------
// Scenario toggle
// ---------------------------------------------------------------------------

function ScenarioToggle({
  active,
  onChange,
}: {
  active: 'premium' | 'market';
  onChange: (s: 'premium' | 'market') => void;
}) {
  return (
    <div className="flex items-center rounded-lg p-1 bg-muted/50">
      {(['premium', 'market'] as const).map((s) => (
        <button
          key={s}
          onClick={() => onChange(s)}
          className={cn(
            'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
            active === s
              ? 'bg-accent text-primary'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {s === 'premium' ? 'Premium' : 'Market'}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Table row
// ---------------------------------------------------------------------------

function fmtCell(v: number | null | undefined): string {
  if (v == null) return '—';
  return formatCurrency(v);
}

function fmtPctCell(v: number | null | undefined): string {
  if (v == null) return '—';
  return `${(v * 100).toFixed(1)}%`;
}

function StatementRow({ line }: { line: OperatingStatementLine }) {
  const isTotal = line.is_total;
  const isDeduction = line.is_deduction;

  return (
    <tr
      className={cn(
        'border-b border-border/20',
        isTotal && 'border-t border-border/40 bg-muted/20 font-semibold',
      )}
    >
      <td
        className={cn(
          'py-2 pr-4 text-xs',
          isTotal ? 'font-semibold text-foreground' : 'text-muted-foreground',
          isDeduction && !isTotal && 'pl-4',
        )}
      >
        {line.label}
      </td>
      <td className="py-2 px-2 text-right font-mono text-xs">{fmtCell(line.t12_amount)}</td>
      <td className="py-2 px-2 text-right font-mono text-xs">{fmtCell(line.t3_amount)}</td>
      <td className={cn('py-2 px-2 text-right font-mono text-xs', isTotal && 'font-bold')}>
        {fmtCell(line.proforma_amount)}
      </td>
      <td className="py-2 px-2 text-right font-mono text-xs text-muted-foreground">
        {fmtPctCell(line.proforma_pct_income)}
      </td>
      <td className="py-2 px-2 text-right font-mono text-xs text-muted-foreground">
        {fmtCell(line.proforma_per_unit)}
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Section header row
// ---------------------------------------------------------------------------

function SectionHeader({ label }: { label: string }) {
  return (
    <tr>
      <td colSpan={6} className="pt-4 pb-1">
        <span className={SECTION_LABEL}>{label}</span>
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// UWProformaPage
// ---------------------------------------------------------------------------

export function UWProformaPage({ outputs, isComputing }: UWSubPageProps) {
  const [scenario, setScenario] = useState<'premium' | 'market'>('premium');

  const os = outputs?.operating_statements?.[scenario] ?? outputs?.operating_statement;

  if (!os) {
    return (
      <div className={cn(GLASS_CARD, 'text-center py-12')}>
        <p className="text-sm text-muted-foreground">
          {isComputing ? 'Computing proforma...' : 'No proforma data available. Adjust assumptions to compute.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <ScenarioToggle active={scenario} onChange={setScenario} />
        {isComputing && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            Updating...
          </div>
        )}
      </div>

      <div className={cn(GLASS_CARD, 'overflow-x-auto')}>
        <table className="w-full">
          <thead>
            <tr className="border-b border-border/60">
              <th className="text-left py-2 text-xs text-muted-foreground font-normal w-48">
                Line Item
              </th>
              <th className="text-right py-2 px-2 text-xs text-muted-foreground font-normal w-24">
                T12
              </th>
              <th className="text-right py-2 px-2 text-xs text-muted-foreground font-normal w-24">
                T3 Inc / T12 Exp
              </th>
              <th className="text-right py-2 px-2 text-xs text-muted-foreground font-normal w-24">
                Proforma
              </th>
              <th className="text-right py-2 px-2 text-xs text-muted-foreground font-normal w-20">
                % Income
              </th>
              <th className="text-right py-2 px-2 text-xs text-muted-foreground font-normal w-20">
                $/Unit
              </th>
            </tr>
          </thead>
          <tbody>
            {/* Revenue */}
            <SectionHeader label="Revenue" />
            {os.revenue_lines.map((line, i) => (
              <StatementRow key={`rev-${i}`} line={line} />
            ))}

            {/* Expenses */}
            <SectionHeader label="Expenses" />
            {os.expense_lines.map((line, i) => (
              <StatementRow key={`exp-${i}`} line={line} />
            ))}

            {/* Summary */}
            <SectionHeader label="Bottom Line" />
            {os.summary_lines.map((line, i) => (
              <StatementRow key={`sum-${i}`} line={line} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
