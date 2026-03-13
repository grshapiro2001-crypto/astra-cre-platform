/**
 * UnderwritingTab — Full institutional underwriting engine.
 * Replaces the legacy Quick Underwriting mini-calculator.
 *
 * Three sections:
 *   A. Summary Card (always visible, dense metrics)
 *   B. Assumption Input Panels (accordion sections)
 *   C. Detailed Output Tables (operating statement, DCF)
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { ChevronDown, ChevronRight, Save, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import type { PropertyDetail } from '@/types/property';
import type { UWInputs, UWOutputs, ScenarioResult } from '@/types/underwriting';
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

/** Format number for display in inputs */
function displayNum(v: number, decimals = 0): string {
  if (v === 0) return '';
  return decimals > 0 ? v.toFixed(decimals) : v.toLocaleString('en-US');
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
// Input Field Components
// ---------------------------------------------------------------------------

function FieldRow({ label, unit, children }: { label: string; unit?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <Label className="w-44 shrink-0 text-xs text-muted-foreground">{label}</Label>
      <div className="flex-1 max-w-[200px]">{children}</div>
      {unit && <span className="text-xs text-muted-foreground w-16">{unit}</span>}
    </div>
  );
}

function NumInput({
  value,
  onChange,
  placeholder,
  decimals = 0,
}: {
  value: number;
  onChange: (v: number) => void;
  placeholder?: string;
  decimals?: number;
}) {
  return (
    <Input
      type="text"
      value={displayNum(value, decimals)}
      placeholder={placeholder ?? '0'}
      onChange={(e) => onChange(parseNum(e.target.value))}
      className="h-8 text-sm font-mono"
    />
  );
}

function PctInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  // Display as percentage, store as decimal
  const display = value === 0 ? '' : (value * 100).toFixed(2);
  return (
    <Input
      type="text"
      value={display}
      placeholder="0.00"
      onChange={(e) => {
        const pct = parseFloat(e.target.value.replace(/[^0-9.\-]/g, ''));
        onChange(isNaN(pct) ? 0 : pct / 100);
      }}
      className="h-8 text-sm font-mono"
    />
  );
}

// ---------------------------------------------------------------------------
// Summary Card
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
    ];
  }, [vs]);

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
// Operating Statement Table
// ---------------------------------------------------------------------------

function OperatingStatementTable({ outputs }: { outputs: UWOutputs | null }) {
  if (!outputs) return null;
  const os = outputs.operating_statement;
  const allLines = [...os.revenue_lines, ...os.expense_lines, ...os.summary_lines];

  return (
    <div className={cn(GLASS_CARD, 'overflow-x-auto')}>
      <h3 className="font-display text-lg font-bold text-foreground mb-4">Operating Statement</h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/40">
            <th className="text-left py-2 px-2 font-sans text-xs text-muted-foreground w-[40%]">Line Item</th>
            <th className="text-right py-2 px-2 font-sans text-xs text-muted-foreground">Proforma</th>
            <th className="text-right py-2 px-2 font-sans text-xs text-muted-foreground">% Income</th>
            <th className="text-right py-2 px-2 font-sans text-xs text-muted-foreground">$/Unit</th>
          </tr>
        </thead>
        <tbody>
          {allLines.map((line, i) => (
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
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DCF Table
// ---------------------------------------------------------------------------

function DCFTable({ outputs, activeScenario }: { outputs: UWOutputs | null; activeScenario: 'premium' | 'market' }) {
  const scenario = outputs?.scenarios[activeScenario];
  if (!scenario || !scenario.dcf.years.length) return null;

  const years = scenario.dcf.years;

  const rows: { label: string; values: (number | null)[]; format: 'dollar' | 'pct' | 'x' }[] = [
    { label: 'Total Income', values: years.map((y) => y.total_income), format: 'dollar' },
    { label: 'Total Expenses', values: years.map((y) => y.total_expenses), format: 'dollar' },
    { label: 'NOI', values: years.map((y) => y.noi), format: 'dollar' },
    { label: 'Reserves', values: years.map((y) => y.reserves), format: 'dollar' },
    { label: 'Net Cash Flow', values: years.map((y) => y.ncf), format: 'dollar' },
    { label: 'Debt Service', values: years.map((y) => y.debt_service), format: 'dollar' },
    { label: 'NCF After Debt', values: years.map((y) => y.ncf_after_debt), format: 'dollar' },
    { label: 'Cash-on-Cash', values: years.map((y) => y.cash_on_cash), format: 'pct' },
    { label: 'DSCR', values: years.map((y) => y.dscr), format: 'x' },
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
            <tr key={row.label} className="border-b border-border/20">
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
// Growth Assumptions Table (editable)
// ---------------------------------------------------------------------------

function GrowthTable({ inputs, onChange }: { inputs: UWInputs; onChange: (field: string, idx: number, val: number) => void }) {
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
                    className="w-14 h-7 text-center text-xs font-mono rounded border border-border/40 bg-muted/30 focus:outline-none focus:ring-1 focus:ring-primary/50"
                    value={(v * 100).toFixed(2)}
                    onChange={(e) => {
                      const pct = parseFloat(e.target.value);
                      if (!isNaN(pct)) onChange(row.field as string, i, pct / 100);
                    }}
                  />
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
        {/* Scenario Settings */}
        <AccordionSection title="Scenario Settings" defaultOpen>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h4 className="font-sans text-xs font-semibold uppercase tracking-wider text-primary">Premium</h4>
              <FieldRow label="Purchase Price" unit="$">
                <NumInput
                  value={inputs.premium.purchase_price}
                  onChange={(v) => updateInputs((p) => ({ ...p, premium: { ...p.premium, purchase_price: v } }))}
                  placeholder="0"
                />
              </FieldRow>
              <FieldRow label="Terminal Cap Rate" unit="%">
                <PctInput
                  value={inputs.premium.terminal_cap_rate}
                  onChange={(v) => updateInputs((p) => ({ ...p, premium: { ...p.premium, terminal_cap_rate: v } }))}
                />
              </FieldRow>
            </div>
            <div className="space-y-3">
              <h4 className="font-sans text-xs font-semibold uppercase tracking-wider text-primary">Market</h4>
              <FieldRow label="Purchase Price" unit="$">
                <NumInput
                  value={inputs.market.purchase_price}
                  onChange={(v) => updateInputs((p) => ({ ...p, market: { ...p.market, purchase_price: v } }))}
                  placeholder="0"
                />
              </FieldRow>
              <FieldRow label="Terminal Cap Rate" unit="%">
                <PctInput
                  value={inputs.market.terminal_cap_rate}
                  onChange={(v) => updateInputs((p) => ({ ...p, market: { ...p.market, terminal_cap_rate: v } }))}
                />
              </FieldRow>
            </div>
          </div>
        </AccordionSection>

        {/* Revenue Assumptions */}
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
            <FieldRow label="Utility Reimb" unit="$/unit/yr">
              <NumInput value={inputs.utility_reimb_per_unit} onChange={(v) => setField('utility_reimb_per_unit', v)} />
            </FieldRow>
            <FieldRow label="Parking Income" unit="$/unit/yr">
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
                        { line_item: '', description: '', fee_amount: 0, annual_income: 0 },
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
                    className="h-7 text-xs w-28 font-mono"
                    placeholder="Annual $"
                    value={item.annual_income || ''}
                    onChange={(e) => {
                      const items = [...inputs.other_income_items];
                      items[idx] = { ...items[idx], annual_income: parseNum(e.target.value) };
                      setField('other_income_items', items);
                    }}
                  />
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

        {/* Expense Assumptions */}
        <AccordionSection title="Expense Assumptions">
          <div className="space-y-3">
            <FieldRow label="Utilities" unit="$/unit/yr">
              <NumInput value={inputs.utilities_per_unit} onChange={(v) => setField('utilities_per_unit', v)} />
            </FieldRow>
            <FieldRow label="Repairs & Maintenance" unit="$/unit/yr">
              <NumInput value={inputs.repairs_per_unit} onChange={(v) => setField('repairs_per_unit', v)} />
            </FieldRow>
            <FieldRow label="Make Ready" unit="$/unit/yr">
              <NumInput value={inputs.make_ready_per_unit} onChange={(v) => setField('make_ready_per_unit', v)} />
            </FieldRow>
            <FieldRow label="Contract Services" unit="$/unit/yr">
              <NumInput value={inputs.contract_services_per_unit} onChange={(v) => setField('contract_services_per_unit', v)} />
            </FieldRow>
            <FieldRow label="Marketing" unit="$/unit/yr">
              <NumInput value={inputs.marketing_per_unit} onChange={(v) => setField('marketing_per_unit', v)} />
            </FieldRow>
            <FieldRow label="G&A" unit="$/unit/yr">
              <NumInput value={inputs.ga_per_unit} onChange={(v) => setField('ga_per_unit', v)} />
            </FieldRow>
            <FieldRow label="Insurance" unit="$/unit/yr">
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
              <FieldRow label="Current Tax Amount" unit="$/yr">
                <NumInput value={inputs.current_tax_amount} onChange={(v) => setField('current_tax_amount', v)} />
              </FieldRow>
              {inputs.property_tax_mode === 'reassessment' && (
                <>
                  <FieldRow label="Assessment Ratio" unit="%">
                    <PctInput value={inputs.assessment_ratio} onChange={(v) => setField('assessment_ratio', v)} />
                  </FieldRow>
                  <FieldRow label="Millage Rate">
                    <NumInput value={inputs.millage_rate} onChange={(v) => setField('millage_rate', v)} decimals={4} />
                  </FieldRow>
                </>
              )}
            </div>

            {/* Payroll Detail */}
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
                    <NumInput value={inputs.la_existing_balance} onChange={(v) => setField('la_existing_balance', v)} />
                  </FieldRow>
                  <FieldRow label="Original Amount" unit="$">
                    <NumInput value={inputs.la_original_amount} onChange={(v) => setField('la_original_amount', v)} />
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
      <OperatingStatementTable outputs={outputs} />
      <DCFTable outputs={outputs} activeScenario={activeScenario} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Seed Inputs from Property Data
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

  // Pre-populate default payroll positions
  defaults.payroll_items = [
    { position: 'Property Manager', salary: 65000, bonus: 5000, payroll_load_pct: 0.30 },
    { position: 'Assistant Manager', salary: 45000, bonus: 2000, payroll_load_pct: 0.30 },
    { position: 'Leasing Associate', salary: 38000, bonus: 3000, payroll_load_pct: 0.30 },
    { position: 'Maintenance Director', salary: 55000, bonus: 3000, payroll_load_pct: 0.30 },
    { position: 'Maintenance Tech', salary: 42000, bonus: 0, payroll_load_pct: 0.30 },
    { position: 'Groundskeeper', salary: 35000, bonus: 0, payroll_load_pct: 0.30 },
  ];

  // Pre-populate default other income items
  defaults.other_income_items = [
    { line_item: 'Application Fees', description: '', fee_amount: 0, annual_income: 0 },
    { line_item: 'Pet Rent', description: '', fee_amount: 0, annual_income: 0 },
    { line_item: 'Late Fees', description: '', fee_amount: 0, annual_income: 0 },
    { line_item: 'Cable Revenue', description: '', fee_amount: 0, annual_income: 0 },
    { line_item: 'Miscellaneous', description: '', fee_amount: 0, annual_income: 0 },
  ];

  return defaults;
}
