/**
 * UnderwritingTab — Full institutional underwriting engine.
 * Replaces the legacy Quick Underwriting mini-calculator.
 *
 * Three sections:
 *   A. Summary Card (always visible, dense metrics)
 *   B. Assumption Input Panels (accordion sections)
 *   C. Detailed Output Tables (proforma, DCF)
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { ChevronDown, ChevronRight, Save, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import type { PropertyDetail, FinancialPeriod } from '@/types/property';
import type { UWInputs, UWOutputs, ScenarioResult, ScenarioInputs } from '@/types/underwriting';
import { createDefaultInputs } from '@/types/underwriting';
import { computeUnderwriting, saveUnderwriting, loadUnderwriting } from '@/services/underwritingService';
import { fmtCurrency, fmtPercent } from '@/utils/formatUtils';
import { GLASS_CARD } from './tabUtils';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface UnderwritingTabProps {
  property: PropertyDetail;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DASH = '\u2014';

function fmt$(v: number | null | undefined, abbreviated = false): string {
  if (v == null || v === 0) return DASH;
  return fmtCurrency(v, abbreviated);
}

function fmtPct(v: number | null | undefined): string {
  if (v == null) return DASH;
  return fmtPercent(v);
}

function fmtX(v: number | null | undefined): string {
  if (v == null) return DASH;
  return `${v.toFixed(2)}x`;
}

/** Parse a formatted number input back to a raw number */
function parseNum(raw: string): number {
  const cleaned = raw.replace(/[^0-9.\-]/g, '');
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

// ---------------------------------------------------------------------------
// Accordion Section Component
// ---------------------------------------------------------------------------

function AccordionSection({
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
    <div className="border border-border/40 rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-5 py-3 bg-muted/30 hover:bg-muted/50 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <span className="font-sans text-sm font-medium text-foreground">{title}</span>
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && <div className="px-5 py-4 space-y-4">{children}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Input Field Components (Fix 4: focus/blur formatting)
// ---------------------------------------------------------------------------

function FieldRow({ label, unit, hint, children }: { label: string; unit?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <Label className="w-44 shrink-0 text-xs text-muted-foreground">{label}</Label>
      <div className="flex-1 max-w-[200px]">{children}</div>
      {unit && <span className="text-xs text-muted-foreground w-16">{unit}</span>}
      {hint && <span className="text-xs text-muted-foreground/60 ml-1">{hint}</span>}
    </div>
  );
}

function NumInput({
  value,
  onChange,
  placeholder,
  decimals = 0,
  prefix,
  readOnly,
}: {
  value: number;
  onChange: (v: number) => void;
  placeholder?: string;
  decimals?: number;
  prefix?: string;
  readOnly?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState('');

  const formatted = useMemo(() => {
    if (value == null || value === 0) return '';
    const num = decimals > 0 ? value.toFixed(decimals) : value.toLocaleString('en-US');
    return prefix ? `${prefix}${num}` : num;
  }, [value, decimals, prefix]);

  return (
    <Input
      type="text"
      value={editing ? raw : formatted}
      placeholder={placeholder ?? '0'}
      readOnly={readOnly}
      onFocus={() => {
        if (readOnly) return;
        setEditing(true);
        setRaw(value ? String(value) : '');
      }}
      onBlur={() => {
        if (readOnly) return;
        setEditing(false);
        const parsed = parseNum(raw);
        onChange(parsed);
      }}
      onChange={(e) => {
        if (editing) setRaw(e.target.value);
      }}
      className={cn('h-8 text-sm font-mono', readOnly && 'bg-muted/50 cursor-default')}
    />
  );
}

function PctInput({ value, onChange, readOnly }: { value: number; onChange: (v: number) => void; readOnly?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState('');

  const formatted = useMemo(() => {
    if (value === 0) return '';
    return `${(value * 100).toFixed(2)}%`;
  }, [value]);

  return (
    <Input
      type="text"
      value={editing ? raw : formatted}
      placeholder="0.00"
      readOnly={readOnly}
      onFocus={() => {
        if (readOnly) return;
        setEditing(true);
        setRaw(value ? (value * 100).toFixed(2) : '');
      }}
      onBlur={() => {
        if (readOnly) return;
        setEditing(false);
        const pct = parseFloat(raw.replace(/[^0-9.\-]/g, ''));
        onChange(isNaN(pct) ? 0 : pct / 100);
      }}
      onChange={(e) => {
        if (editing) setRaw(e.target.value);
      }}
      className={cn('h-8 text-sm font-mono', readOnly && 'bg-muted/50 cursor-default')}
    />
  );
}

// ---------------------------------------------------------------------------
// Summary Card (Fix 13: show all return metrics)
// ---------------------------------------------------------------------------

function SummaryCard({
  outputs,
  activeScenario,
}: {
  outputs: UWOutputs | null;
  activeScenario: 'premium' | 'market';
}) {
  const scenario: ScenarioResult | undefined = outputs?.scenarios[activeScenario];
  const vs = scenario?.valuation_summary;

  const metrics: { label: string; value: string; highlight?: boolean }[] = useMemo(() => {
    if (!vs) return [];
    const dcf = scenario?.dcf;
    const y1Dscr = dcf?.years?.[0]?.dscr;
    return [
      { label: 'Purchase Price', value: fmt$(vs.purchase_price, true) },
      { label: '$/Unit', value: fmt$(vs.price_per_unit) },
      { label: '$/SF', value: vs.price_per_sf ? `$${vs.price_per_sf.toFixed(0)}` : DASH },
      { label: 'Y1 Cap Rate', value: fmtPct(vs.cap_rates.y1_cap_rate), highlight: true },
      { label: 'Terminal Cap', value: fmtPct(vs.cap_rates.terminal_cap_rate) },
      { label: 'LTV', value: fmtPct(vs.ltv) },
      { label: 'Levered IRR', value: fmtPct(vs.levered_irr), highlight: true },
      { label: 'Unlevered IRR', value: fmtPct(vs.unlevered_irr) },
      { label: 'Y1 Cash-on-Cash', value: fmtPct(vs.y1_cash_on_cash), highlight: true },
      { label: 'Avg Cash-on-Cash', value: fmtPct(vs.avg_cash_on_cash) },
      { label: 'Equity Multiple', value: fmtX(vs.equity_multiple) },
      { label: 'Terminal Value', value: fmt$(vs.terminal_value, true) },
      { label: 'Terminal $/Unit', value: fmt$(vs.terminal_value_per_unit) },
      { label: 'DSCR', value: y1Dscr != null ? fmtX(y1Dscr) : DASH },
      { label: 'Revenue CAGR', value: fmtPct(vs.revenue_cagr) },
      { label: 'NOI CAGR', value: fmtPct(vs.noi_cagr) },
    ];
  }, [vs, scenario]);

  // Proforma summary
  const proforma = outputs?.proforma;

  return (
    <div className={cn(GLASS_CARD, 'space-y-4')}>
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-bold text-foreground">Valuation Summary</h3>
        {proforma && (
          <div className="text-right">
            <p className="font-sans text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Y1 NOI</p>
            <p className="font-display text-xl font-bold text-foreground">{fmt$(proforma.noi, true)}</p>
          </div>
        )}
      </div>

      {!vs ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          <AlertCircle className="h-5 w-5 mx-auto mb-2 opacity-50" />
          Enter purchase price and assumptions to see valuation metrics
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {metrics.map((m) => (
            <div
              key={m.label}
              className={cn(
                'p-3 rounded-xl',
                m.highlight ? 'bg-accent' : 'bg-muted/50',
              )}
            >
              <p className="font-sans text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{m.label}</p>
              <p className={cn('font-display text-lg font-bold', m.highlight ? 'text-primary' : 'text-foreground')}>
                {m.value}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Proforma Table (Fix 5: rename, Fix 6: trailing columns)
// ---------------------------------------------------------------------------

function ProformaTable({ outputs, property }: { outputs: UWOutputs | null; property: PropertyDetail }) {
  if (!outputs) return null;
  const os = outputs.operating_statement;
  const allLines = [...os.revenue_lines, ...os.expense_lines, ...os.summary_lines];

  // Determine which lines are revenue vs expense for T3 column logic
  const revenueLabels = new Set(os.revenue_lines.map((l) => l.label));
  const t12 = property.t12_financials;
  const t3 = property.t3_financials;
  const hasTrailing = !!(t12 || t3);

  // Map FinancialPeriod fields to line labels for frontend-side T12/T3 population
  function getTrailingVal(fp: FinancialPeriod | null | undefined, label: string): number | null {
    if (!fp) return null;
    const map: Record<string, number | null | undefined> = {
      'Gross Scheduled Rent': fp.gsr,
      'Gain/Loss to Lease': fp.loss_to_lease,
      'Less: Vacancy': fp.vacancy,
      'Less: Concessions': fp.concessions,
      'Less: Bad Debt': fp.bad_debt,
      'Net Rental Income': fp.net_rental_income,
      'Utility Reimbursements': fp.utility_reimbursements,
      'Parking/Storage Income': fp.parking_storage_income,
      'Other Income': fp.other_income,
      'Property Taxes': fp.real_estate_taxes,
      'Insurance': fp.insurance_amount,
      'Total Operating Expenses': fp.total_opex,
      'Net Operating Income': fp.noi,
    };
    const v = map[label];
    return v != null ? v : null;
  }

  return (
    <div className={cn(GLASS_CARD, 'overflow-x-auto')}>
      <h3 className="font-display text-lg font-bold text-foreground mb-4">Proforma</h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/40">
            <th className="text-left py-2 px-2 font-sans text-xs text-muted-foreground w-[30%]">Line Item</th>
            {hasTrailing && (
              <>
                <th className="text-right py-2 px-2 font-sans text-xs text-muted-foreground">T12</th>
                <th className="text-right py-2 px-2 font-sans text-xs text-muted-foreground whitespace-nowrap">T3 Inc / T12 Exp</th>
              </>
            )}
            <th className="text-right py-2 px-2 font-sans text-xs text-muted-foreground">Proforma</th>
            <th className="text-right py-2 px-2 font-sans text-xs text-muted-foreground">% Income</th>
            <th className="text-right py-2 px-2 font-sans text-xs text-muted-foreground">$/Unit</th>
          </tr>
        </thead>
        <tbody>
          {allLines.map((line, i) => {
            const isRevenue = revenueLabels.has(line.label);
            // T12 column: always show T12 value
            const t12Val = line.t12_amount ?? getTrailingVal(t12, line.label);
            // T3 Inc / T12 Exp: for revenue lines use T3, for expense lines use T12
            const t3ColVal = isRevenue
              ? (line.t3_amount ?? getTrailingVal(t3, line.label))
              : (line.t12_amount ?? getTrailingVal(t12, line.label));

            return (
              <tr
                key={i}
                className={cn(
                  'border-b border-border/20',
                  line.is_total && 'font-semibold bg-muted/20',
                )}
              >
                <td className={cn('py-1.5 px-2', line.is_deduction && !line.is_total && 'pl-6 text-muted-foreground')}>
                  {line.label}
                </td>
                {hasTrailing && (
                  <>
                    <td className="text-right py-1.5 px-2 font-mono text-xs text-muted-foreground">
                      {t12Val != null ? fmtCurrency(t12Val) : DASH}
                    </td>
                    <td className="text-right py-1.5 px-2 font-mono text-xs text-muted-foreground">
                      {t3ColVal != null ? fmtCurrency(t3ColVal) : DASH}
                    </td>
                  </>
                )}
                <td className="text-right py-1.5 px-2 font-mono text-xs">
                  {line.proforma_amount != null
                    ? (line.is_deduction && line.proforma_amount > 0
                      ? `(${fmtCurrency(line.proforma_amount)})`
                      : fmtCurrency(line.proforma_amount))
                    : DASH}
                </td>
                <td className="text-right py-1.5 px-2 font-mono text-xs text-muted-foreground">
                  {line.proforma_pct_income != null ? `${(line.proforma_pct_income * 100).toFixed(1)}%` : ''}
                </td>
                <td className="text-right py-1.5 px-2 font-mono text-xs text-muted-foreground">
                  {line.proforma_per_unit != null ? fmtCurrency(Math.round(line.proforma_per_unit)) : ''}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DCF Table (Fix 12: full detailed rows)
// ---------------------------------------------------------------------------

function DCFTable({ outputs, activeScenario }: { outputs: UWOutputs | null; activeScenario: 'premium' | 'market' }) {
  const scenario = outputs?.scenarios[activeScenario];
  if (!scenario || !scenario.dcf.years.length) return null;

  const years = scenario.dcf.years;

  type RowDef = { label: string; values: (number | null)[]; format: 'dollar' | 'pct' | 'x'; isTotal?: boolean; isSeparator?: boolean };

  const rows: RowDef[] = [
    // Revenue section
    { label: 'Gross Potential Rent', values: years.map((y) => y.gpr), format: 'dollar' },
    { label: 'Less: Vacancy', values: years.map((y) => -y.vacancy), format: 'dollar' },
    { label: 'Less: Concessions', values: years.map((y) => -y.concessions), format: 'dollar' },
    { label: 'Less: Bad Debt', values: years.map((y) => -y.bad_debt), format: 'dollar' },
    { label: 'Net Rental Income', values: years.map((y) => y.nri), format: 'dollar', isTotal: true },
    { label: 'Other Income', values: years.map((y) => y.other_income), format: 'dollar' },
    { label: 'Total Income', values: years.map((y) => y.total_income), format: 'dollar', isTotal: true },
    // Expense section
    { label: 'Controllable', values: years.map((y) => y.controllable_expenses), format: 'dollar' },
    { label: 'Property Taxes', values: years.map((y) => y.property_taxes), format: 'dollar' },
    { label: 'Insurance', values: years.map((y) => y.insurance), format: 'dollar' },
    { label: 'Management Fee', values: years.map((y) => y.management_fee), format: 'dollar' },
    { label: 'Total Expenses', values: years.map((y) => y.total_expenses), format: 'dollar', isTotal: true },
    // Bottom line
    { label: 'NOI', values: years.map((y) => y.noi), format: 'dollar', isTotal: true },
    { label: 'Reserves', values: years.map((y) => y.reserves), format: 'dollar' },
    { label: 'Net Cash Flow', values: years.map((y) => y.ncf), format: 'dollar', isTotal: true },
    { label: 'Debt Service', values: years.map((y) => y.debt_service), format: 'dollar' },
    { label: 'NCF After Debt', values: years.map((y) => y.ncf_after_debt), format: 'dollar', isTotal: true },
    // Metrics
    { label: 'Cash-on-Cash', values: years.map((y) => y.cash_on_cash), format: 'pct' },
    { label: 'DSCR', values: years.map((y) => y.dscr), format: 'x' },
    { label: 'Revenue Growth', values: years.map((y) => y.revenue_growth_rate), format: 'pct' },
    { label: 'NOI Growth', values: years.map((y) => y.noi_growth_rate), format: 'pct' },
  ];

  function fmtCell(v: number | null, format: string): string {
    if (v == null) return DASH;
    if (format === 'pct') return fmtPct(v);
    if (format === 'x') return `${v.toFixed(2)}x`;
    return fmtCurrency(v, true);
  }

  return (
    <div className={cn(GLASS_CARD, 'overflow-x-auto')}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-lg font-bold text-foreground">8-Year DCF</h3>
        <div className="flex gap-4 text-xs text-muted-foreground">
          {scenario.dcf.revenue_cagr != null && (
            <span>Revenue CAGR: <span className="font-mono text-foreground">{fmtPct(scenario.dcf.revenue_cagr)}</span></span>
          )}
          {scenario.dcf.noi_cagr != null && (
            <span>NOI CAGR: <span className="font-mono text-foreground">{fmtPct(scenario.dcf.noi_cagr)}</span></span>
          )}
        </div>
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border/40">
            <th className="text-left py-2 px-2 font-sans text-muted-foreground sticky left-0 bg-card/50 backdrop-blur-xl">Metric</th>
            {years.map((y) => (
              <th key={y.year} className="text-right py-2 px-2 font-sans text-muted-foreground whitespace-nowrap">
                Year {y.year}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className={cn('border-b border-border/20', row.isTotal && 'font-semibold bg-muted/20')}>
              <td className="py-1.5 px-2 font-medium whitespace-nowrap sticky left-0 bg-card/50 backdrop-blur-xl">{row.label}</td>
              {row.values.map((v, i) => (
                <td key={i} className="text-right py-1.5 px-2 font-mono whitespace-nowrap">
                  {fmtCell(v, row.format)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Growth Assumptions Table (Fix 10: text visibility)
// ---------------------------------------------------------------------------

function GrowthTable({ inputs, onChange, onSetAll }: {
  inputs: UWInputs;
  onChange: (field: string, idx: number, val: number) => void;
  onSetAll: (field: string, val: number) => void;
}) {
  const rows: { label: string; field: keyof UWInputs; values: number[] }[] = [
    { label: 'Rental Inflation', field: 'rental_inflation', values: inputs.rental_inflation },
    { label: 'Vacancy Loss', field: 'vacancy_pct', values: inputs.vacancy_pct },
    { label: 'Concession Loss', field: 'concession_pct', values: inputs.concession_pct },
    { label: 'Bad Debt', field: 'bad_debt_pct', values: inputs.bad_debt_pct },
    { label: 'Expense Inflation', field: 'expense_inflation', values: inputs.expense_inflation },
    { label: 'RE Tax Inflation', field: 're_tax_inflation', values: inputs.re_tax_inflation },
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border/40">
            <th className="text-left py-2 px-2 text-muted-foreground">Assumption</th>
            {Array.from({ length: 8 }, (_, i) => (
              <th key={i} className="text-center py-2 px-1 text-muted-foreground">Y{i + 1}</th>
            ))}
            <th className="text-center py-2 px-1 text-muted-foreground whitespace-nowrap">Set All</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.field as string} className="border-b border-border/20">
              <td className="py-1 px-2 font-medium whitespace-nowrap">{row.label}</td>
              {row.values.slice(0, 8).map((v, i) => (
                <td key={i} className="py-1 px-1">
                  <input
                    type="text"
                    className="w-14 h-7 text-center text-xs font-mono rounded border border-border/40 bg-muted/30 text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                    key={`${row.field}-${i}-${v}`}
                    defaultValue={(v * 100).toFixed(2)}
                    onBlur={(e) => {
                      const pct = parseFloat(e.target.value);
                      if (!isNaN(pct)) onChange(row.field as string, i, pct / 100);
                    }}
                  />
                </td>
              ))}
              <td className="py-1 px-1">
                <input
                  type="text"
                  className="w-14 h-7 text-center text-xs font-mono rounded border border-primary/40 bg-primary/5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground/40"
                  placeholder="—"
                  onBlur={(e) => {
                    const pct = parseFloat(e.target.value);
                    if (!isNaN(pct)) {
                      onSetAll(row.field as string, pct / 100);
                      e.target.value = '';
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                  }}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Scenario Panel (Fix 11: pricing mode toggle)
// ---------------------------------------------------------------------------

function ScenarioPanel({
  label,
  scenario,
  outputs,
  scenarioKey,
  onUpdate,
}: {
  label: string;
  scenario: ScenarioInputs;
  outputs: UWOutputs | null;
  scenarioKey: 'premium' | 'market';
  onUpdate: (updated: ScenarioInputs) => void;
}) {
  const solvedPrice = outputs?.scenarios[scenarioKey]?.valuation_summary?.purchase_price;
  const isReadOnlyPrice = scenario.pricing_mode !== 'manual';
  const displayPrice = isReadOnlyPrice && solvedPrice ? solvedPrice : (scenario.purchase_price || 0);

  return (
    <div className="space-y-3">
      <h4 className="font-sans text-xs font-semibold uppercase tracking-wider text-primary">{label}</h4>
      <FieldRow label="Pricing Mode">
        <select
          value={scenario.pricing_mode}
          onChange={(e) => onUpdate({ ...scenario, pricing_mode: e.target.value as ScenarioInputs['pricing_mode'] })}
          className="h-8 text-sm rounded-lg border border-input bg-background px-2 w-full"
        >
          <option value="manual">Manual Price</option>
          <option value="direct_cap">Direct Cap</option>
          <option value="target_irr">Target IRR</option>
        </select>
      </FieldRow>

      {scenario.pricing_mode === 'direct_cap' && (
        <FieldRow label="Target Cap Rate" unit="%">
          <PctInput
            value={scenario.target_cap_rate || 0}
            onChange={(v) => onUpdate({ ...scenario, target_cap_rate: v })}
          />
        </FieldRow>
      )}

      {scenario.pricing_mode === 'target_irr' && (
        <FieldRow label="Target Unlev IRR" unit="%">
          <PctInput
            value={scenario.target_unlevered_irr || 0}
            onChange={(v) => onUpdate({ ...scenario, target_unlevered_irr: v })}
          />
        </FieldRow>
      )}

      <FieldRow label="Purchase Price" unit="$">
        <NumInput
          value={displayPrice}
          onChange={(v) => onUpdate({ ...scenario, purchase_price: v })}
          prefix="$"
          readOnly={isReadOnlyPrice}
          placeholder="0"
        />
      </FieldRow>
      <FieldRow label="Terminal Cap Rate" unit="%">
        <PctInput
          value={scenario.terminal_cap_rate}
          onChange={(v) => onUpdate({ ...scenario, terminal_cap_rate: v })}
        />
      </FieldRow>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function UnderwritingTab({ property }: UnderwritingTabProps) {
  const [inputs, setInputs] = useState<UWInputs>(() => seedInputs(property));
  const [outputs, setOutputs] = useState<UWOutputs | null>(null);
  const [activeScenario, setActiveScenario] = useState<'premium' | 'market'>('premium');
  const [isComputing, setIsComputing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [, setLoadedModelId] = useState<number | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // T12 $/unit reference values
  const t12Ref = useMemo(() => {
    const t12 = property.t12_financials;
    const u = property.total_units || 1;
    if (!t12) return {} as Record<string, string>;
    const refs: Record<string, string> = {};
    const ref = (v: number | null | undefined) => v != null ? `T12: $${Math.round(Math.abs(v) / u).toLocaleString()}/unit` : undefined;
    // Expense references
    if (t12.real_estate_taxes != null) refs.taxes = ref(t12.real_estate_taxes)!;
    if (t12.insurance_amount != null) refs.insurance = ref(t12.insurance_amount)!;
    if (t12.total_opex != null) refs.total_opex = ref(t12.total_opex)!;
    if (t12.opex_components?.controllable_expenses != null) refs.controllable = ref(t12.opex_components.controllable_expenses)!;
    // Revenue references
    if (t12.gsr != null) refs.gsr = `T12: $${Math.round(Math.abs(t12.gsr)).toLocaleString()}`;
    if (t12.vacancy != null) refs.vacancy = `T12: $${Math.round(Math.abs(t12.vacancy)).toLocaleString()}`;
    if (t12.net_rental_income != null) refs.nri = `T12: $${Math.round(Math.abs(t12.net_rental_income)).toLocaleString()}`;
    if (t12.utility_reimbursements != null) refs.utility_reimb = ref(t12.utility_reimbursements)!;
    if (t12.parking_storage_income != null) refs.parking = ref(t12.parking_storage_income)!;
    if (t12.other_income != null) refs.other_income = `T12: $${Math.round(Math.abs(t12.other_income)).toLocaleString()}`;
    return refs;
  }, [property]);

  // Load saved model on mount
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const saved = await loadUnderwriting(property.id);
        if (saved && !cancelled) {
          setInputs(saved.inputs);
          setOutputs(saved.outputs);
          setLoadedModelId(saved.model_id);
        } else if (!cancelled) {
          // No saved model — compute with seeded defaults
          triggerCompute(inputs);
        }
      } catch {
        // API not available — compute client-side won't work, show empty state
        if (!cancelled) triggerCompute(inputs);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [property.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced compute
  const triggerCompute = useCallback(async (inp: UWInputs) => {
    setIsComputing(true);
    try {
      const result = await computeUnderwriting(inp);
      setOutputs(result);
    } catch {
      // Silently fail — outputs remain stale
    } finally {
      setIsComputing(false);
    }
  }, []);

  const updateInputs = useCallback(
    (updater: (prev: UWInputs) => UWInputs) => {
      setInputs((prev) => {
        const next = updater(prev);
        // Debounce API call
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => triggerCompute(next), 300);
        return next;
      });
    },
    [triggerCompute],
  );

  // Shorthand for updating a single top-level field
  const setField = useCallback(
    <K extends keyof UWInputs>(field: K, value: UWInputs[K]) => {
      updateInputs((prev) => ({ ...prev, [field]: value }));
    },
    [updateInputs],
  );

  // Save handler
  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setSaveStatus(null);
    try {
      const result = await saveUnderwriting(property.id, inputs);
      setLoadedModelId(result.model_id);
      setSaveStatus('Saved');
      setTimeout(() => setSaveStatus(null), 2000);
    } catch {
      setSaveStatus('Error saving');
    } finally {
      setIsSaving(false);
    }
  }, [property.id, inputs]);

  return (
    <div className="space-y-6">
      {/* ─── Scenario Toggle + Save ─── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center rounded-xl p-1 bg-muted">
          {(['premium', 'market'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setActiveScenario(s)}
              className={cn(
                'px-5 py-2 rounded-lg text-sm font-medium transition-colors capitalize',
                activeScenario === s
                  ? 'bg-accent text-primary'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {s}
            </button>
          ))}
          {isComputing && <Loader2 className="h-4 w-4 ml-2 animate-spin text-muted-foreground" />}
        </div>

        <div className="flex items-center gap-2">
          {saveStatus && (
            <span className="text-sm text-primary animate-fade-in">{saveStatus}</span>
          )}
          <Button variant="outline" size="sm" onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            <span className="ml-1.5">Save</span>
          </Button>
        </div>
      </div>

      {/* ─── Section A: Summary Card ─── */}
      <SummaryCard outputs={outputs} activeScenario={activeScenario} />

      {/* ─── Section B: Assumption Input Panels ─── */}
      <div className="space-y-3">
        {/* Scenario Settings (Fix 11: pricing mode toggle) */}
        <AccordionSection title="Scenario Settings" defaultOpen>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ScenarioPanel
              label="Premium"
              scenario={inputs.premium}
              outputs={outputs}
              scenarioKey="premium"
              onUpdate={(s) => updateInputs((p) => ({ ...p, premium: s }))}
            />
            <ScenarioPanel
              label="Market"
              scenario={inputs.market}
              outputs={outputs}
              scenarioKey="market"
              onUpdate={(s) => updateInputs((p) => ({ ...p, market: s }))}
            />
          </div>
        </AccordionSection>

        {/* Revenue Assumptions (Fix 3: content present, add NRU Avg Rent) */}
        <AccordionSection title="Revenue Assumptions">
          <div className="space-y-3">
            <FieldRow label="Rent Basis">
              <select
                value={inputs.rent_basis}
                onChange={(e) => setField('rent_basis', e.target.value as 'market' | 'inplace')}
                className="h-8 text-sm rounded-lg border border-input bg-background px-2 w-full"
              >
                <option value="market">Market Rents</option>
                <option value="inplace">In-Place Rents</option>
              </select>
            </FieldRow>
            <FieldRow label="Vacancy" unit="%">
              <PctInput value={inputs.vacancy_pct[0]} onChange={(v) => {
                const arr = [...inputs.vacancy_pct];
                arr[0] = v;
                setField('vacancy_pct', arr);
              }} />
            </FieldRow>
            <FieldRow label="Concessions (Y1)" unit="%">
              <PctInput value={inputs.concession_pct[0]} onChange={(v) => {
                const arr = [...inputs.concession_pct];
                arr[0] = v;
                setField('concession_pct', arr);
              }} />
            </FieldRow>
            <FieldRow label="Bad Debt (Y1)" unit="%">
              <PctInput value={inputs.bad_debt_pct[0]} onChange={(v) => {
                const arr = [...inputs.bad_debt_pct];
                arr[0] = v;
                setField('bad_debt_pct', arr);
              }} />
            </FieldRow>
            <FieldRow label="Non-Revenue Units" unit="units">
              <NumInput value={inputs.nru_count} onChange={(v) => setField('nru_count', Math.round(v))} />
            </FieldRow>
            <FieldRow label="NRU Avg Rent" unit="$/mo">
              <NumInput value={inputs.nru_avg_rent} onChange={(v) => setField('nru_avg_rent', v)} placeholder="Auto" />
            </FieldRow>
            <FieldRow label="Utility Reimb" unit="$/unit/yr" hint={t12Ref.utility_reimb}>
              <NumInput value={inputs.utility_reimb_per_unit} onChange={(v) => setField('utility_reimb_per_unit', v)} />
            </FieldRow>
            <FieldRow label="Parking Income" unit="$/unit/yr" hint={t12Ref.parking}>
              <NumInput value={inputs.parking_income_per_unit} onChange={(v) => setField('parking_income_per_unit', v)} />
            </FieldRow>

            {/* Other Income detail */}
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs text-muted-foreground font-semibold">Other Income Detail</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() =>
                    updateInputs((p) => ({
                      ...p,
                      other_income_items: [
                        ...p.other_income_items,
                        { line_item: '', description: '', amount_per_unit: 0, input_mode: 'per_unit_year' as const, fee_amount: 0, annual_income: 0 },
                      ],
                    }))
                  }
                >
                  + Add
                </Button>
              </div>
              {inputs.other_income_items.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 mb-1">
                  <Input
                    className="h-7 text-xs flex-1"
                    placeholder="Line item"
                    value={item.line_item}
                    onChange={(e) => {
                      const items = [...inputs.other_income_items];
                      items[idx] = { ...items[idx], line_item: e.target.value };
                      setField('other_income_items', items);
                    }}
                  />
                  <Input
                    className="h-7 text-xs w-24 font-mono"
                    placeholder="$/unit"
                    value={item.amount_per_unit || ''}
                    onChange={(e) => {
                      const items = [...inputs.other_income_items];
                      items[idx] = { ...items[idx], amount_per_unit: parseNum(e.target.value) };
                      setField('other_income_items', items);
                    }}
                  />
                  <span className="text-[10px] text-muted-foreground w-14 shrink-0">
                    {item.input_mode === 'per_unit_month' ? '$/unit/mo' : '$/unit/yr'}
                  </span>
                  <button
                    className="text-muted-foreground hover:text-destructive text-xs"
                    onClick={() => {
                      const items = inputs.other_income_items.filter((_, i) => i !== idx);
                      setField('other_income_items', items);
                    }}
                  >
                    x
                  </button>
                </div>
              ))}
            </div>
          </div>
        </AccordionSection>

        {/* Expense Assumptions (Fix 7: T12 reference values) */}
        <AccordionSection title="Expense Assumptions">
          <div className="space-y-3">
            <FieldRow label="Utilities" unit="$/unit/yr" hint={t12Ref.utilities}>
              <NumInput value={inputs.utilities_per_unit} onChange={(v) => setField('utilities_per_unit', v)} />
            </FieldRow>
            <FieldRow label="Repairs & Maintenance" unit="$/unit/yr" hint={t12Ref.repairs}>
              <NumInput value={inputs.repairs_per_unit} onChange={(v) => setField('repairs_per_unit', v)} />
            </FieldRow>
            <FieldRow label="Make Ready" unit="$/unit/yr" hint={t12Ref.make_ready}>
              <NumInput value={inputs.make_ready_per_unit} onChange={(v) => setField('make_ready_per_unit', v)} />
            </FieldRow>
            <FieldRow label="Contract Services" unit="$/unit/yr" hint={t12Ref.contract_services}>
              <NumInput value={inputs.contract_services_per_unit} onChange={(v) => setField('contract_services_per_unit', v)} />
            </FieldRow>
            <FieldRow label="Marketing" unit="$/unit/yr" hint={t12Ref.marketing}>
              <NumInput value={inputs.marketing_per_unit} onChange={(v) => setField('marketing_per_unit', v)} />
            </FieldRow>
            <FieldRow label="G&A" unit="$/unit/yr" hint={t12Ref.ga}>
              <NumInput value={inputs.ga_per_unit} onChange={(v) => setField('ga_per_unit', v)} />
            </FieldRow>
            <FieldRow label="Insurance" unit="$/unit/yr" hint={t12Ref.insurance}>
              <NumInput value={inputs.insurance_per_unit} onChange={(v) => setField('insurance_per_unit', v)} />
            </FieldRow>
            <FieldRow label="Management Fee" unit="%">
              <PctInput value={inputs.mgmt_fee_pct} onChange={(v) => setField('mgmt_fee_pct', v)} />
            </FieldRow>
            <FieldRow label="Reserves" unit="$/unit/yr">
              <NumInput value={inputs.reserves_per_unit} onChange={(v) => setField('reserves_per_unit', v)} />
            </FieldRow>

            {/* Property Tax */}
            <div className="border-t border-border/30 pt-3 mt-3">
              <FieldRow label="Tax Mode">
                <select
                  value={inputs.property_tax_mode}
                  onChange={(e) => setField('property_tax_mode', e.target.value as 'current' | 'reassessment')}
                  className="h-8 text-sm rounded-lg border border-input bg-background px-2 w-full"
                >
                  <option value="current">Use Current Taxes</option>
                  <option value="reassessment">Model Reassessment</option>
                </select>
              </FieldRow>
              {inputs.property_tax_mode === 'current' && (
                <FieldRow label="Current Tax Amount" unit="$/yr" hint={t12Ref.taxes}>
                  <NumInput value={inputs.current_tax_amount} onChange={(v) => setField('current_tax_amount', v)} prefix="$" />
                </FieldRow>
              )}
              {inputs.property_tax_mode === 'reassessment' && (
                <>
                  <FieldRow label="Current Tax Amount" unit="$/yr" hint={t12Ref.taxes}>
                    <NumInput value={inputs.current_tax_amount} onChange={(v) => setField('current_tax_amount', v)} prefix="$" />
                  </FieldRow>
                  <FieldRow label="% of Purchase Assessed" unit="%">
                    <PctInput value={inputs.pct_of_purchase_assessed} onChange={(v) => setField('pct_of_purchase_assessed', v)} />
                  </FieldRow>
                  <FieldRow label="Assessment Ratio" unit="%">
                    <PctInput value={inputs.assessment_ratio} onChange={(v) => setField('assessment_ratio', v)} />
                  </FieldRow>
                  <FieldRow label="Millage Rate" unit="%">
                    <NumInput value={inputs.millage_rate} onChange={(v) => setField('millage_rate', v)} decimals={2} />
                  </FieldRow>
                </>
              )}
            </div>

            {/* Payroll Detail (Fix 8: default positions) */}
            <div className="border-t border-border/30 pt-3 mt-3">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs text-muted-foreground font-semibold">Payroll Detail</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() =>
                    updateInputs((p) => ({
                      ...p,
                      payroll_items: [
                        ...p.payroll_items,
                        { position: '', salary: 0, bonus: 0, payroll_load_pct: 0.30 },
                      ],
                    }))
                  }
                >
                  + Add
                </Button>
              </div>
              {inputs.payroll_items.length > 0 && (
                <div className="text-xs space-y-1">
                  <div className="grid grid-cols-[1fr_80px_80px_60px_24px] gap-1 text-muted-foreground px-1">
                    <span>Position</span><span>Salary</span><span>Bonus</span><span>Load%</span><span />
                  </div>
                  {inputs.payroll_items.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-[1fr_80px_80px_60px_24px] gap-1">
                      <Input
                        className="h-7 text-xs"
                        value={item.position}
                        onChange={(e) => {
                          const items = [...inputs.payroll_items];
                          items[idx] = { ...items[idx], position: e.target.value };
                          setField('payroll_items', items);
                        }}
                      />
                      <Input
                        className="h-7 text-xs font-mono"
                        value={item.salary || ''}
                        onChange={(e) => {
                          const items = [...inputs.payroll_items];
                          items[idx] = { ...items[idx], salary: parseNum(e.target.value) };
                          setField('payroll_items', items);
                        }}
                      />
                      <Input
                        className="h-7 text-xs font-mono"
                        value={item.bonus || ''}
                        onChange={(e) => {
                          const items = [...inputs.payroll_items];
                          items[idx] = { ...items[idx], bonus: parseNum(e.target.value) };
                          setField('payroll_items', items);
                        }}
                      />
                      <Input
                        className="h-7 text-xs font-mono"
                        value={item.payroll_load_pct ? (item.payroll_load_pct * 100).toFixed(0) : ''}
                        onChange={(e) => {
                          const items = [...inputs.payroll_items];
                          items[idx] = { ...items[idx], payroll_load_pct: parseNum(e.target.value) / 100 };
                          setField('payroll_items', items);
                        }}
                      />
                      <button
                        className="text-muted-foreground hover:text-destructive text-xs"
                        onClick={() => setField('payroll_items', inputs.payroll_items.filter((_, i) => i !== idx))}
                      >
                        x
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </AccordionSection>

        {/* Growth Assumptions */}
        <AccordionSection title="Growth Assumptions">
          <GrowthTable
            inputs={inputs}
            onChange={(field, idx, val) => {
              updateInputs((prev) => {
                const arr = [...(prev[field as keyof UWInputs] as number[])];
                arr[idx] = val;
                return { ...prev, [field]: arr };
              });
            }}
            onSetAll={(field, val) => {
              updateInputs((prev) => ({
                ...prev,
                [field]: Array(8).fill(val),
              }));
            }}
          />
        </AccordionSection>

        {/* Debt Assumptions */}
        <AccordionSection title="Debt Assumptions">
          <div className="space-y-3">
            <FieldRow label="Max LTV" unit="%">
              <PctInput value={inputs.max_ltv} onChange={(v) => setField('max_ltv', v)} />
            </FieldRow>
            <FieldRow label="Interest Rate" unit="%">
              <PctInput value={inputs.interest_rate} onChange={(v) => setField('interest_rate', v)} />
            </FieldRow>
            <FieldRow label="Loan Term" unit="months">
              <NumInput value={inputs.loan_term_months} onChange={(v) => setField('loan_term_months', Math.round(v))} />
            </FieldRow>
            <FieldRow label="I/O Period" unit="months">
              <NumInput value={inputs.io_period_months} onChange={(v) => setField('io_period_months', Math.round(v))} />
            </FieldRow>
            <FieldRow label="Amortization" unit="years">
              <NumInput value={inputs.amort_years} onChange={(v) => setField('amort_years', Math.round(v))} />
            </FieldRow>
            <FieldRow label="DSCR Minimum" unit="x">
              <NumInput value={inputs.dscr_minimum} onChange={(v) => setField('dscr_minimum', v)} decimals={2} />
            </FieldRow>
            <FieldRow label="Sales Expense" unit="%">
              <PctInput value={inputs.sales_expense_pct} onChange={(v) => setField('sales_expense_pct', v)} />
            </FieldRow>
            <FieldRow label="Hold Period" unit="years">
              <NumInput value={inputs.hold_period_years} onChange={(v) => setField('hold_period_years', Math.round(v))} />
            </FieldRow>

            {/* Loan Assumption toggle */}
            <div className="border-t border-border/30 pt-3 mt-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={inputs.la_enabled}
                  onChange={(e) => setField('la_enabled', e.target.checked)}
                  className="rounded border-border accent-primary"
                />
                <span className="text-xs text-muted-foreground">Enable Loan Assumption Mode</span>
              </label>
              {inputs.la_enabled && (
                <div className="mt-3 space-y-3">
                  <FieldRow label="Existing Balance" unit="$">
                    <NumInput value={inputs.la_existing_balance} onChange={(v) => setField('la_existing_balance', v)} prefix="$" />
                  </FieldRow>
                  <FieldRow label="Original Amount" unit="$">
                    <NumInput value={inputs.la_original_amount} onChange={(v) => setField('la_original_amount', v)} prefix="$" />
                  </FieldRow>
                  <FieldRow label="Interest Rate" unit="%">
                    <PctInput value={inputs.la_interest_rate} onChange={(v) => setField('la_interest_rate', v)} />
                  </FieldRow>
                  <FieldRow label="Remaining Term" unit="months">
                    <NumInput value={inputs.la_remaining_term_months} onChange={(v) => setField('la_remaining_term_months', Math.round(v))} />
                  </FieldRow>
                  <FieldRow label="Remaining I/O" unit="months">
                    <NumInput value={inputs.la_remaining_io_months} onChange={(v) => setField('la_remaining_io_months', Math.round(v))} />
                  </FieldRow>
                </div>
              )}
            </div>
          </div>
        </AccordionSection>
      </div>

      {/* ─── Section C: Output Tables ─── */}
      <ProformaTable outputs={outputs} property={property} />
      <DCFTable outputs={outputs} activeScenario={activeScenario} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Seed Inputs from Property Data (Fix 8: payroll positions)
// ---------------------------------------------------------------------------

function seedInputs(property: PropertyDetail): UWInputs {
  const defaults = createDefaultInputs();

  defaults.total_units = property.total_units ?? 0;
  defaults.total_sf = property.total_residential_sf ?? 0;

  // Seed unit mix from property
  if (property.unit_mix && property.unit_mix.length > 0) {
    defaults.unit_mix = property.unit_mix.map((um) => ({
      floorplan: um.floorplan_name ?? um.unit_type ?? '',
      units: um.num_units ?? 0,
      sf: um.unit_sf ?? 0,
      market_rent: um.proforma_rent ?? (property.average_market_rent ?? 0),
      inplace_rent: um.in_place_rent ?? 0,
    }));
  } else if (defaults.total_units > 0 && property.average_market_rent) {
    // No unit mix extracted — create a single weighted-average floorplan
    defaults.unit_mix = [
      {
        floorplan: 'Avg',
        units: defaults.total_units,
        sf: defaults.total_sf > 0 ? Math.round(defaults.total_sf / defaults.total_units) : 0,
        market_rent: property.average_market_rent,
        inplace_rent: property.average_inplace_rent ?? property.average_market_rent,
      },
    ];
  }

  // Seed expense $/unit from trailing financials if available
  const t12 = property.t12_financials;
  if (t12 && defaults.total_units > 0) {
    const u = defaults.total_units;
    if (t12.opex_components?.property_taxes != null) {
      defaults.current_tax_amount = Math.abs(t12.opex_components.property_taxes);
    }
    if (t12.opex_components?.insurance != null) {
      defaults.insurance_per_unit = Math.round(Math.abs(t12.opex_components.insurance) / u);
    }
  }

  // Store trailing data for operating statement T12/T3 columns
  if (property.t12_financials) {
    defaults.trailing_t12 = property.t12_financials as unknown as Record<string, unknown>;
  }
  if (property.t3_financials) {
    defaults.trailing_t3 = property.t3_financials as unknown as Record<string, unknown>;
  }

  // Pre-populate default payroll positions (Fix 8)
  defaults.payroll_items = [
    { position: 'Property Manager', salary: 65000, bonus: 5000, payroll_load_pct: 0.30 },
    { position: 'Assistant Manager', salary: 45000, bonus: 2000, payroll_load_pct: 0.30 },
    { position: 'Leasing Associate', salary: 38000, bonus: 3000, payroll_load_pct: 0.30 },
    { position: 'Maintenance Director', salary: 55000, bonus: 3000, payroll_load_pct: 0.30 },
    { position: 'Maintenance Tech I', salary: 42000, bonus: 0, payroll_load_pct: 0.30 },
    { position: 'Maintenance Tech II', salary: 40000, bonus: 0, payroll_load_pct: 0.30 },
    { position: 'Groundskeeper', salary: 35000, bonus: 0, payroll_load_pct: 0.30 },
  ];

  // Pre-populate default other income items (per-unit basis)
  // Early Termination default = weighted avg rent from selected basis × (1 + Y1 rental inflation)
  let earlyTermDefault = 0;
  if (defaults.unit_mix.length > 0) {
    const totalMixUnits = defaults.unit_mix.reduce((s, um) => s + um.units, 0);
    if (totalMixUnits > 0) {
      const avgRent = defaults.unit_mix.reduce(
        (s, um) => s + (defaults.rent_basis === 'market' ? um.market_rent : um.inplace_rent) * um.units, 0
      ) / totalMixUnits;
      earlyTermDefault = Math.round(avgRent * (1 + defaults.rental_inflation[0]));
    }
  }

  defaults.other_income_items = [
    { line_item: 'NSF Fees', description: '', amount_per_unit: 0, input_mode: 'per_unit_year', fee_amount: 0, annual_income: 0 },
    { line_item: 'Application Fees', description: '', amount_per_unit: 0, input_mode: 'per_unit_year', fee_amount: 0, annual_income: 0 },
    { line_item: 'Administrative Fees', description: '', amount_per_unit: 0, input_mode: 'per_unit_year', fee_amount: 0, annual_income: 0 },
    { line_item: 'Pet Fee', description: '', amount_per_unit: 0, input_mode: 'per_unit_year', fee_amount: 0, annual_income: 0 },
    { line_item: 'Pet Rent', description: '', amount_per_unit: 0, input_mode: 'per_unit_month', fee_amount: 0, annual_income: 0 },
    { line_item: 'Early Termination Fees', description: '', amount_per_unit: earlyTermDefault, input_mode: 'per_unit_year', fee_amount: 0, annual_income: 0 },
    { line_item: 'Late Fees', description: '', amount_per_unit: 0, input_mode: 'per_unit_month', fee_amount: 0, annual_income: 0 },
    { line_item: 'Miscellaneous', description: '', amount_per_unit: 0, input_mode: 'per_unit_year', fee_amount: 0, annual_income: 0 },
  ];

  return defaults;
}
