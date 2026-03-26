/**
 * UWCashFlowsPage — 8-year DCF projection table.
 * Horizontally scrollable with scenario toggle.
 */

import { useState } from 'react';
import { GLASS_CARD, SECTION_LABEL } from '../tabUtils';
import { cn } from '@/lib/utils';
import { formatCurrency, formatPct, formatMultiple } from './uwFormatters';
import type { UWSubPageProps } from './types';
import type { DCFYearResult, ScenarioResult } from '@/types/underwriting';

// ---------------------------------------------------------------------------
// Scenario toggle (reused pattern)
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
// Row types
// ---------------------------------------------------------------------------

type RowDef = {
  label: string;
  key: keyof DCFYearResult | '__computed';
  format: 'currency' | 'pct' | 'multiple';
  bold?: boolean;
  separator?: boolean;
  getValue?: (year: DCFYearResult, scenario: ScenarioResult) => number | null;
};

const fmtValue = (v: number | null | undefined, format: 'currency' | 'pct' | 'multiple'): string => {
  if (v == null) return '—';
  if (format === 'currency') return formatCurrency(v);
  if (format === 'pct') return formatPct(v);
  return formatMultiple(v);
};

// ---------------------------------------------------------------------------
// Row definitions
// ---------------------------------------------------------------------------

const REVENUE_ROWS: RowDef[] = [
  { label: 'Gross Potential Income', key: 'gpr', format: 'currency' },
  { label: 'Less: Vacancy', key: 'vacancy', format: 'currency' },
  { label: 'Less: Concessions', key: 'concessions', format: 'currency' },
  { label: 'Less: Bad Debt', key: 'bad_debt', format: 'currency' },
  { label: 'Less: NRU Loss', key: 'nru_loss', format: 'currency' },
  { label: 'Net Rental Income', key: 'nri', format: 'currency', bold: true },
  { label: 'Plus: Other Income', key: 'other_income', format: 'currency' },
  { label: 'Total Operating Income', key: 'total_income', format: 'currency', bold: true, separator: true },
  { label: 'Revenue Growth Rate', key: 'revenue_growth_rate', format: 'pct' },
  { label: 'Effective Rent', key: 'effective_rent', format: 'currency' },
];

const EXPENSE_ROWS: RowDef[] = [
  { label: 'Controllable Expenses', key: 'controllable_expenses', format: 'currency' },
  { label: 'Property Taxes', key: 'property_taxes', format: 'currency' },
  { label: 'Insurance', key: 'insurance', format: 'currency' },
  { label: 'Management Fee', key: 'management_fee', format: 'currency' },
  { label: 'Total Expenses', key: 'total_expenses', format: 'currency', bold: true, separator: true },
];

const BOTTOM_ROWS: RowDef[] = [
  { label: 'Net Operating Income', key: 'noi', format: 'currency', bold: true },
  { label: 'Capital Reserves', key: 'reserves', format: 'currency' },
  { label: 'NOI After Capital', key: 'ncf', format: 'currency', bold: true },
  { label: 'NOI Growth Rate', key: 'noi_growth_rate', format: 'pct' },
];

const DEBT_ROWS: RowDef[] = [
  { label: 'Debt Service', key: 'debt_service', format: 'currency' },
  { label: 'Net Cash Flow', key: 'ncf_after_debt', format: 'currency', bold: true },
  { label: 'Cash on Cash', key: 'cash_on_cash', format: 'pct' },
  { label: 'DSCR', key: 'dscr', format: 'multiple' },
];

// ---------------------------------------------------------------------------
// UWCashFlowsPage
// ---------------------------------------------------------------------------

export function UWCashFlowsPage({ outputs, isComputing }: UWSubPageProps) {
  const [scenario, setScenario] = useState<'premium' | 'market'>('premium');

  const scenarioResult = outputs?.scenarios?.[scenario];
  const years = scenarioResult?.dcf?.years ?? [];
  const reversion = scenarioResult?.returns?.reversion;

  if (!years.length) {
    return (
      <div className={cn(GLASS_CARD, 'text-center py-12')}>
        <p className="text-sm text-muted-foreground">
          {isComputing ? 'Computing cash flows...' : 'No cash flow data available.'}
        </p>
      </div>
    );
  }

  const renderRow = (row: RowDef) => {
    return (
      <tr
        key={row.label}
        className={cn(
          'border-b border-border/20',
          row.bold && 'bg-muted/20',
          row.separator && 'border-t border-border/40',
        )}
      >
        <td
          className={cn(
            'py-2 pr-4 text-xs whitespace-nowrap sticky left-0 bg-card/50 backdrop-blur-sm',
            row.bold ? 'font-semibold text-foreground' : 'text-muted-foreground',
          )}
        >
          {row.label}
        </td>
        {years.map((yr) => {
          const val = row.getValue
            ? row.getValue(yr, scenarioResult!)
            : (yr[row.key as keyof DCFYearResult] as number | null);
          return (
            <td
              key={yr.year}
              className={cn(
                'py-2 px-2 text-right font-mono text-xs whitespace-nowrap',
                row.bold && 'font-bold',
              )}
            >
              {fmtValue(val, row.format)}
            </td>
          );
        })}
      </tr>
    );
  };

  const renderSectionHeader = (label: string) => (
    <tr key={`hdr-${label}`}>
      <td colSpan={years.length + 1} className="pt-4 pb-1 sticky left-0 bg-card/50 backdrop-blur-sm">
        <span className={SECTION_LABEL}>{label}</span>
      </td>
    </tr>
  );

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
              <th className="text-left py-2 text-xs text-muted-foreground font-normal sticky left-0 bg-card/50 backdrop-blur-sm w-44">
                Line Item
              </th>
              {years.map((yr) => (
                <th
                  key={yr.year}
                  className="text-right py-2 px-2 text-xs text-muted-foreground font-normal w-24"
                >
                  Y{yr.year}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {renderSectionHeader('Revenue')}
            {REVENUE_ROWS.map(renderRow)}

            {renderSectionHeader('Expenses')}
            {EXPENSE_ROWS.map(renderRow)}

            {renderSectionHeader('Bottom Line')}
            {BOTTOM_ROWS.map(renderRow)}

            {renderSectionHeader('Debt')}
            {DEBT_ROWS.map(renderRow)}

            {/* Reversion — only in exit year */}
            {reversion && (
              <>
                {renderSectionHeader('Reversion')}
                <tr className="border-b border-border/20">
                  <td className="py-2 pr-4 text-xs text-muted-foreground sticky left-0 bg-card/50">
                    Gross Selling Price
                  </td>
                  {years.map((yr, i) => (
                    <td key={yr.year} className="py-2 px-2 text-right font-mono text-xs">
                      {i === years.length - 1 ? formatCurrency(reversion.gross_selling_price) : ''}
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-border/20">
                  <td className="py-2 pr-4 text-xs text-muted-foreground sticky left-0 bg-card/50">
                    Less: Transaction Costs
                  </td>
                  {years.map((yr, i) => (
                    <td key={yr.year} className="py-2 px-2 text-right font-mono text-xs">
                      {i === years.length - 1 ? formatCurrency(reversion.sales_expenses) : ''}
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-border/20">
                  <td className="py-2 pr-4 text-xs text-muted-foreground sticky left-0 bg-card/50">
                    Less: Principal Outstanding
                  </td>
                  {years.map((yr, i) => (
                    <td key={yr.year} className="py-2 px-2 text-right font-mono text-xs">
                      {i === years.length - 1 ? formatCurrency(reversion.principal_outstanding) : ''}
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-border/20 bg-muted/20">
                  <td className="py-2 pr-4 text-xs font-semibold text-foreground sticky left-0 bg-card/50">
                    Net Sales Proceeds
                  </td>
                  {years.map((yr, i) => (
                    <td key={yr.year} className="py-2 px-2 text-right font-mono text-xs font-bold">
                      {i === years.length - 1 ? formatCurrency(reversion.net_proceeds) : ''}
                    </td>
                  ))}
                </tr>
              </>
            )}

            {/* Summary metrics */}
            {scenarioResult && (
              <>
                {renderSectionHeader('Summary')}
                <tr className="border-b border-border/20">
                  <td className="py-2 pr-4 text-xs text-muted-foreground sticky left-0 bg-card/50">
                    Revenue CAGR
                  </td>
                  <td colSpan={years.length} className="py-2 px-2 text-right font-mono text-xs">
                    {formatPct(scenarioResult.dcf.revenue_cagr)}
                  </td>
                </tr>
                <tr className="border-b border-border/20">
                  <td className="py-2 pr-4 text-xs text-muted-foreground sticky left-0 bg-card/50">
                    NOI CAGR
                  </td>
                  <td colSpan={years.length} className="py-2 px-2 text-right font-mono text-xs">
                    {formatPct(scenarioResult.dcf.noi_cagr)}
                  </td>
                </tr>
                <tr className="border-b border-border/20">
                  <td className="py-2 pr-4 text-xs text-muted-foreground sticky left-0 bg-card/50">
                    Unlevered IRR
                  </td>
                  <td colSpan={years.length} className="py-2 px-2 text-right font-mono text-xs">
                    {formatPct(scenarioResult.returns.unlevered_irr)}
                  </td>
                </tr>
                <tr className="border-b border-border/20">
                  <td className="py-2 pr-4 text-xs text-muted-foreground sticky left-0 bg-card/50">
                    Leveraged IRR
                  </td>
                  <td colSpan={years.length} className="py-2 px-2 text-right font-mono text-xs">
                    {formatPct(scenarioResult.returns.levered_irr)}
                  </td>
                </tr>
                <tr className="border-b border-border/20">
                  <td className="py-2 pr-4 text-xs text-muted-foreground sticky left-0 bg-card/50">
                    Avg Cash-on-Cash
                  </td>
                  <td colSpan={years.length} className="py-2 px-2 text-right font-mono text-xs">
                    {formatPct(scenarioResult.returns.avg_cash_on_cash)}
                  </td>
                </tr>
                <tr className="border-b border-border/20">
                  <td className="py-2 pr-4 text-xs text-muted-foreground sticky left-0 bg-card/50">
                    Equity Multiple
                  </td>
                  <td colSpan={years.length} className="py-2 px-2 text-right font-mono text-xs">
                    {formatMultiple(scenarioResult.returns.equity_multiple)}
                  </td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
