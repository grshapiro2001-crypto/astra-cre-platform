/**
 * UWAssumptionsPage — All underwriting inputs ("the cockpit").
 * Sections: Revenue, Expenses, Tax, Growth, Debt, Renovation, Loan Assumption.
 */

import { useState, useCallback, useMemo } from 'react';
import { GLASS_CARD, SECTION_LABEL } from '../tabUtils';
import { cn } from '@/lib/utils';
import {
  CurrencyInput,
  PercentInput,
  NumericInput,
  T12Ref,
  formatCurrency,
} from './uwFormatters';
import type { UWSubPageProps } from './types';
import type { UWInputs } from '@/types/underwriting';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Get a T12 value from the trailing financials dict, divided by total_units for per-unit. */
function t12PerUnit(
  trailing: Record<string, unknown> | null | undefined,
  key: string,
  totalUnits: number,
): number | null {
  if (!trailing || !totalUnits) return null;
  const v = trailing[key];
  if (typeof v !== 'number') return null;
  return Math.round(v / totalUnits);
}

function t12Raw(
  trailing: Record<string, unknown> | null | undefined,
  key: string,
): number | null {
  if (!trailing) return null;
  const v = trailing[key];
  return typeof v === 'number' ? v : null;
}

/** Inline row wrapper for labeled inputs. */
function InputRow({
  label,
  children,
  t12Ref,
}: {
  label: string;
  children: React.ReactNode;
  t12Ref?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 py-2">
      <span className="text-xs text-muted-foreground w-40 shrink-0">{label}</span>
      <div className="w-36 shrink-0">{children}</div>
      {t12Ref && <div className="shrink-0">{t12Ref}</div>}
    </div>
  );
}

/** Collapsible section wrapper. */
function CollapsibleSection({
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
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center justify-between"
      >
        <h3 className="font-display text-sm font-bold text-foreground">{title}</h3>
        <span className="text-muted-foreground text-xs">{open ? '▾' : '▸'}</span>
      </button>
      {open && <div className="mt-4 space-y-2">{children}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section A: Revenue
// ---------------------------------------------------------------------------

function RevenueSection({ inputs, dispatch }: Pick<UWSubPageProps, 'inputs' | 'dispatch'>) {
  const t12 = inputs.trailing_t12 as Record<string, unknown> | null;
  const units = inputs.total_units || 1;

  const update = useCallback(
    (patch: Partial<UWInputs>) => dispatch({ type: 'SET_INPUTS', payload: patch }),
    [dispatch],
  );

  return (
    <div className={cn(GLASS_CARD, 'space-y-3')}>
      <h3 className="font-display text-sm font-bold text-foreground">Revenue Assumptions</h3>

      {/* Rent Basis */}
      <div className="flex items-center gap-3 py-2">
        <span className="text-xs text-muted-foreground w-40 shrink-0">Rent Basis</span>
        <div className="flex items-center rounded-lg p-1 bg-muted/50">
          {(['market', 'inplace'] as const).map((basis) => (
            <button
              key={basis}
              onClick={() => update({ rent_basis: basis })}
              className={cn(
                'px-3 py-1 rounded-md text-xs font-medium transition-colors',
                inputs.rent_basis === basis
                  ? 'bg-accent text-primary'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {basis === 'market' ? 'Market Rents' : 'In-Place Rents'}
            </button>
          ))}
        </div>
      </div>

      {/* Vacancy / Concession / Bad Debt (Y1 values) */}
      <InputRow
        label="Vacancy"
        t12Ref={<T12Ref value={t12Raw(t12, 'vacancy_rate_pct')} format="pct" />}
      >
        <PercentInput
          value={inputs.vacancy_pct[0] ?? null}
          onChange={(v) => {
            const arr = [...inputs.vacancy_pct];
            arr[0] = v ?? 0;
            dispatch({ type: 'SET_INFLATION_CURVE', curve: 'vacancy_pct', values: arr });
          }}
        />
      </InputRow>

      <InputRow label="Concessions">
        <PercentInput
          value={inputs.concession_pct[0] ?? null}
          onChange={(v) => {
            const arr = [...inputs.concession_pct];
            arr[0] = v ?? 0;
            dispatch({ type: 'SET_INFLATION_CURVE', curve: 'concession_pct', values: arr });
          }}
        />
      </InputRow>

      <InputRow label="Bad Debt">
        <PercentInput
          value={inputs.bad_debt_pct[0] ?? null}
          onChange={(v) => {
            const arr = [...inputs.bad_debt_pct];
            arr[0] = v ?? 0;
            dispatch({ type: 'SET_INFLATION_CURVE', curve: 'bad_debt_pct', values: arr });
          }}
        />
      </InputRow>

      {/* NRU */}
      <InputRow label="NRU Count">
        <NumericInput
          value={inputs.nru_count}
          onChange={(v) => update({ nru_count: v ?? 0 })}
          integer
        />
      </InputRow>
      <InputRow label="NRU Avg Rent">
        <CurrencyInput
          value={inputs.nru_avg_rent || null}
          onChange={(v) => update({ nru_avg_rent: v ?? 0 })}
          suffix="/mo"
        />
      </InputRow>

      {/* Other Income */}
      <InputRow
        label="Utility Reimb."
        t12Ref={<T12Ref value={t12PerUnit(t12, 'utility_reimbursements', units)} />}
      >
        <CurrencyInput
          value={inputs.utility_reimb_per_unit || null}
          onChange={(v) => update({ utility_reimb_per_unit: v ?? 0 })}
          suffix="/unit/yr"
        />
      </InputRow>

      <InputRow
        label="Parking/Storage"
        t12Ref={<T12Ref value={t12PerUnit(t12, 'parking_storage_income', units)} />}
      >
        <CurrencyInput
          value={inputs.parking_income_per_unit || null}
          onChange={(v) => update({ parking_income_per_unit: v ?? 0 })}
          suffix="/unit/yr"
        />
      </InputRow>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section B: Expenses
// ---------------------------------------------------------------------------

function ExpenseSection({ inputs, dispatch }: Pick<UWSubPageProps, 'inputs' | 'dispatch'>) {
  const t12 = inputs.trailing_t12 as Record<string, unknown> | null;
  const units = inputs.total_units || 1;

  const update = useCallback(
    (patch: Partial<UWInputs>) => dispatch({ type: 'SET_INPUTS', payload: patch }),
    [dispatch],
  );

  const payrollTotal = useMemo(
    () =>
      inputs.payroll_items.reduce(
        (sum, p) => sum + (p.salary + p.bonus) * (1 + p.payroll_load_pct),
        0,
      ),
    [inputs.payroll_items],
  );

  const expenseRows: { label: string; field: keyof UWInputs; t12Key?: string }[] = [
    { label: 'Utilities', field: 'utilities_per_unit', t12Key: 'utilities' },
    { label: 'Repairs & Maint.', field: 'repairs_per_unit', t12Key: 'repairs_maintenance' },
    { label: 'Make Ready', field: 'make_ready_per_unit', t12Key: 'make_ready' },
    { label: 'Contract Services', field: 'contract_services_per_unit', t12Key: 'contract_services' },
    { label: 'Marketing', field: 'marketing_per_unit', t12Key: 'marketing' },
    { label: 'G&A', field: 'ga_per_unit', t12Key: 'general_admin' },
    { label: 'Insurance', field: 'insurance_per_unit', t12Key: 'insurance_amount' },
  ];

  return (
    <div className={cn(GLASS_CARD, 'space-y-3')}>
      <h3 className="font-display text-sm font-bold text-foreground">Expense Assumptions</h3>

      {expenseRows.map(({ label, field, t12Key }) => (
        <InputRow
          key={field}
          label={label}
          t12Ref={t12Key ? <T12Ref value={t12PerUnit(t12, t12Key, units)} /> : undefined}
        >
          <CurrencyInput
            value={(inputs[field] as number) || null}
            onChange={(v) => update({ [field]: v ?? 0 })}
            suffix="/unit/yr"
          />
        </InputRow>
      ))}

      {/* Payroll — read-only total here, editable in Detail Schedules */}
      <InputRow label="Payroll" t12Ref={<T12Ref value={t12PerUnit(t12, 'payroll', units)} />}>
        <div className="font-mono text-sm text-foreground h-8 flex items-center">
          {formatCurrency(payrollTotal)}
          <span className="text-[10px] text-muted-foreground ml-1">
            ({formatCurrency(units > 0 ? Math.round(payrollTotal / units) : 0)}/unit)
          </span>
        </div>
      </InputRow>

      {/* Management Fee */}
      <InputRow label="Management Fee">
        <PercentInput
          value={inputs.mgmt_fee_pct}
          onChange={(v) => update({ mgmt_fee_pct: v ?? 0 })}
        />
      </InputRow>

      {/* Reserves */}
      <InputRow label="Reserves">
        <CurrencyInput
          value={inputs.reserves_per_unit || null}
          onChange={(v) => update({ reserves_per_unit: v ?? 0 })}
          suffix="/unit/yr"
        />
      </InputRow>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section C: Tax
// ---------------------------------------------------------------------------

function TaxSection({ inputs, outputs, dispatch }: Pick<UWSubPageProps, 'inputs' | 'outputs' | 'dispatch'>) {
  const update = useCallback(
    (patch: Partial<UWInputs>) => dispatch({ type: 'SET_INPUTS', payload: patch }),
    [dispatch],
  );

  const premiumTax = outputs?.scenarios?.premium?.proforma?.expenses?.property_taxes;
  const marketTax = outputs?.scenarios?.market?.proforma?.expenses?.property_taxes;

  return (
    <div className={cn(GLASS_CARD, 'space-y-3')}>
      <h3 className="font-display text-sm font-bold text-foreground">Tax Assumptions</h3>

      <InputRow label="Assessment Ratio">
        <PercentInput
          value={inputs.assessment_ratio}
          onChange={(v) => update({ assessment_ratio: v ?? 0 })}
        />
      </InputRow>

      <InputRow label="Millage Rate">
        <PercentInput
          value={inputs.millage_rate / 100}
          onChange={(v) => update({ millage_rate: (v ?? 0) * 100 })}
          decimals={4}
        />
      </InputRow>

      <InputRow label="% Assessed (Prem.)">
        <PercentInput
          value={inputs.pct_of_purchase_assessed}
          onChange={(v) => update({ pct_of_purchase_assessed: v ?? 0 })}
        />
      </InputRow>

      {/* Computed tax output */}
      <div className="flex gap-6 pt-2 border-t border-border/40">
        <div className="space-y-0.5">
          <span className={SECTION_LABEL}>Projected Y1 Tax (Prem.)</span>
          <p className="font-mono text-sm text-foreground">{formatCurrency(premiumTax)}</p>
        </div>
        <div className="space-y-0.5">
          <span className={SECTION_LABEL}>Projected Y1 Tax (Mkt.)</span>
          <p className="font-mono text-sm text-foreground">{formatCurrency(marketTax)}</p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section D: Growth / Inflation Curves
// ---------------------------------------------------------------------------

type CurveKey = 'rental_inflation' | 'expense_inflation' | 're_tax_inflation' | 'vacancy_pct' | 'concession_pct' | 'bad_debt_pct';

const GROWTH_ROWS: { label: string; curve: CurveKey }[] = [
  { label: 'Rental Inflation', curve: 'rental_inflation' },
  { label: 'Vacancy', curve: 'vacancy_pct' },
  { label: 'Concessions', curve: 'concession_pct' },
  { label: 'Bad Debt', curve: 'bad_debt_pct' },
  { label: 'Expense Inflation', curve: 'expense_inflation' },
  { label: 'RE Tax Inflation', curve: 're_tax_inflation' },
];

function GrowthSection({ inputs, dispatch }: Pick<UWSubPageProps, 'inputs' | 'dispatch'>) {
  const [setAllValues, setSetAllValues] = useState<Record<CurveKey, string>>({
    rental_inflation: '',
    expense_inflation: '',
    re_tax_inflation: '',
    vacancy_pct: '',
    concession_pct: '',
    bad_debt_pct: '',
  });

  const handleSetAll = useCallback(
    (curve: CurveKey, rawValue: string) => {
      setSetAllValues((prev) => ({ ...prev, [curve]: rawValue }));
      const stripped = rawValue.replace(/[^0-9.\-]/g, '');
      if (stripped === '') return;
      const num = Number(stripped);
      if (isNaN(num)) return;
      const decimal = num / 100;
      dispatch({
        type: 'SET_INFLATION_CURVE',
        curve,
        values: Array(8).fill(decimal),
      });
    },
    [dispatch],
  );

  const handleCellChange = useCallback(
    (curve: CurveKey, yearIdx: number, val: number | null) => {
      const arr = [...(inputs[curve] as number[])];
      arr[yearIdx] = val ?? 0;
      dispatch({ type: 'SET_INFLATION_CURVE', curve, values: arr });
    },
    [dispatch, inputs],
  );

  return (
    <div className={cn(GLASS_CARD, 'space-y-3')}>
      <h3 className="font-display text-sm font-bold text-foreground">Growth / Inflation Curves</h3>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border/40">
              <th className="text-left py-2 text-muted-foreground font-normal w-36">Assumption</th>
              {Array.from({ length: 8 }, (_, i) => (
                <th key={i} className="text-center py-2 text-muted-foreground font-normal w-16">
                  Y{i + 1}
                </th>
              ))}
              <th className="text-center py-2 text-muted-foreground font-normal w-20">Set All</th>
            </tr>
          </thead>
          <tbody>
            {GROWTH_ROWS.map(({ label, curve }) => {
              const values = inputs[curve] as number[];
              return (
                <tr key={curve} className="border-b border-border/20">
                  <td className="py-1.5 text-muted-foreground">{label}</td>
                  {values.slice(0, 8).map((v, i) => (
                    <td key={i} className="py-1.5 px-0.5">
                      <PercentInput
                        value={v}
                        onChange={(val) => handleCellChange(curve, i, val)}
                        className="w-16"
                        decimals={2}
                      />
                    </td>
                  ))}
                  <td className="py-1.5 px-0.5">
                    <input
                      type="text"
                      value={setAllValues[curve]}
                      onChange={(e) => handleSetAll(curve, e.target.value)}
                      placeholder="%"
                      className="w-16 h-8 px-2 rounded-md border border-input bg-background text-xs font-mono text-center focus:outline-none focus:ring-1 focus:ring-primary/30"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section E: Debt
// ---------------------------------------------------------------------------

function DebtSection({ inputs, dispatch }: Pick<UWSubPageProps, 'inputs' | 'dispatch'>) {
  const update = useCallback(
    (patch: Partial<UWInputs>) => dispatch({ type: 'SET_INPUTS', payload: patch }),
    [dispatch],
  );

  return (
    <div className={cn(GLASS_CARD, 'space-y-3')}>
      <h3 className="font-display text-sm font-bold text-foreground">Debt Assumptions</h3>

      <InputRow label="Max LTV">
        <PercentInput value={inputs.max_ltv} onChange={(v) => update({ max_ltv: v ?? 0 })} />
      </InputRow>
      <InputRow label="Interest Rate">
        <PercentInput value={inputs.interest_rate} onChange={(v) => update({ interest_rate: v ?? 0 })} />
      </InputRow>
      <InputRow label="Loan Term">
        <NumericInput
          value={inputs.loan_term_months}
          onChange={(v) => update({ loan_term_months: v ?? 0 })}
          suffix="mo"
          integer
        />
      </InputRow>
      <InputRow label="I/O Period">
        <NumericInput
          value={inputs.io_period_months}
          onChange={(v) => update({ io_period_months: v ?? 0 })}
          suffix="mo"
          integer
        />
      </InputRow>
      <InputRow label="Amortization">
        <NumericInput
          value={inputs.amort_years}
          onChange={(v) => update({ amort_years: v ?? 0 })}
          suffix="yr"
          integer
        />
      </InputRow>
      <InputRow label="DSCR Minimum">
        <NumericInput
          value={inputs.dscr_minimum}
          onChange={(v) => update({ dscr_minimum: v ?? 0 })}
          suffix="x"
        />
      </InputRow>
      <InputRow label="Sales Expense">
        <PercentInput
          value={inputs.sales_expense_pct}
          onChange={(v) => update({ sales_expense_pct: v ?? 0 })}
        />
      </InputRow>
      <InputRow label="Hold Period">
        <NumericInput
          value={inputs.hold_period_years}
          onChange={(v) => update({ hold_period_years: v ?? 0 })}
          suffix="yr"
          integer
        />
      </InputRow>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section F: Renovation (collapsible)
// ---------------------------------------------------------------------------

function RenovationSection(_props: Pick<UWSubPageProps, 'inputs' | 'dispatch'>) {
  // Renovation not yet in UWInputs type — placeholder for future Phase
  return (
    <CollapsibleSection title="Renovation Assumptions">
      <p className="text-xs text-muted-foreground italic">
        Renovation module will be enabled in a future update. The backend engine supports it — frontend inputs are pending.
      </p>
    </CollapsibleSection>
  );
}

// ---------------------------------------------------------------------------
// Section G: Loan Assumption (collapsible)
// ---------------------------------------------------------------------------

function LoanAssumptionSection({ inputs, dispatch }: Pick<UWSubPageProps, 'inputs' | 'dispatch'>) {
  const update = useCallback(
    (patch: Partial<UWInputs>) => dispatch({ type: 'SET_INPUTS', payload: patch }),
    [dispatch],
  );

  return (
    <CollapsibleSection title="Loan Assumption">
      <div className="flex items-center gap-3 py-2">
        <span className="text-xs text-muted-foreground w-40">Enable</span>
        <button
          onClick={() => update({ la_enabled: !inputs.la_enabled })}
          className={cn(
            'w-10 h-5 rounded-full transition-colors relative',
            inputs.la_enabled ? 'bg-primary' : 'bg-muted',
          )}
        >
          <span
            className={cn(
              'absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform',
              inputs.la_enabled ? 'translate-x-5' : 'translate-x-0.5',
            )}
          />
        </button>
      </div>

      {inputs.la_enabled && (
        <div className="space-y-2">
          <InputRow label="Existing Balance">
            <CurrencyInput
              value={inputs.la_existing_balance || null}
              onChange={(v) => update({ la_existing_balance: v ?? 0 })}
            />
          </InputRow>
          <InputRow label="Interest Rate">
            <PercentInput
              value={inputs.la_interest_rate}
              onChange={(v) => update({ la_interest_rate: v ?? 0 })}
            />
          </InputRow>
          <InputRow label="Remaining Term">
            <NumericInput
              value={inputs.la_remaining_term_months}
              onChange={(v) => update({ la_remaining_term_months: v ?? 0 })}
              suffix="mo"
              integer
            />
          </InputRow>
          <InputRow label="Remaining I/O">
            <NumericInput
              value={inputs.la_remaining_io_months}
              onChange={(v) => update({ la_remaining_io_months: v ?? 0 })}
              suffix="mo"
              integer
            />
          </InputRow>
          <InputRow label="Amortization">
            <NumericInput
              value={inputs.la_amort_years}
              onChange={(v) => update({ la_amort_years: v ?? 0 })}
              suffix="yr"
              integer
            />
          </InputRow>
        </div>
      )}
    </CollapsibleSection>
  );
}

// ---------------------------------------------------------------------------
// UWAssumptionsPage
// ---------------------------------------------------------------------------

export function UWAssumptionsPage({ inputs, outputs, dispatch, isComputing }: UWSubPageProps) {
  return (
    <div className="space-y-6">
      {isComputing && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          Computing...
        </div>
      )}

      <RevenueSection inputs={inputs} dispatch={dispatch} />
      <ExpenseSection inputs={inputs} dispatch={dispatch} />
      <TaxSection inputs={inputs} outputs={outputs} dispatch={dispatch} />
      <GrowthSection inputs={inputs} dispatch={dispatch} />
      <DebtSection inputs={inputs} dispatch={dispatch} />
      <RenovationSection inputs={inputs} dispatch={dispatch} />
      <LoanAssumptionSection inputs={inputs} dispatch={dispatch} />
    </div>
  );
}
