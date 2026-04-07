/**
 * UWDetailSchedulesPage — Supporting detail tables.
 * Sections: Other Income, Payroll, Contract Services, RE Tax Calculator, Renovation Detail.
 */

import { useState, useCallback, useMemo } from 'react';
import { GLASS_CARD, SECTION_LABEL } from '../tabUtils';
import { cn } from '@/lib/utils';
import {
  CurrencyInput,
  PercentInput,
  formatCurrency,
  formatPct,
} from './uwFormatters';
import { Input } from '@/components/ui/input';
import type { UWSubPageProps } from './types';
import type {
  OtherIncomeItem,
  PayrollItem,
  ContractServiceItem,
} from '@/types/underwriting';

// ---------------------------------------------------------------------------
// Section A: Other Income
// ---------------------------------------------------------------------------

const DEFAULT_OTHER_INCOME: OtherIncomeItem = {
  line_item: '',
  description: '',
  amount_per_unit: 0,
  input_mode: 'per_unit_year',
  fee_amount: 0,
  annual_income: 0,
};

function OtherIncomeSection({
  items,
  totalUnits,
  onChange,
}: {
  items: OtherIncomeItem[];
  totalUnits: number;
  onChange: (items: OtherIncomeItem[]) => void;
}) {
  const updateItem = useCallback(
    (idx: number, patch: Partial<OtherIncomeItem>) => {
      const next = items.map((item, i) => (i === idx ? { ...item, ...patch } : item));
      onChange(next);
    },
    [items, onChange],
  );

  const addItem = useCallback(() => {
    onChange([...items, { ...DEFAULT_OTHER_INCOME }]);
  }, [items, onChange]);

  const removeItem = useCallback(
    (idx: number) => {
      onChange(items.filter((_, i) => i !== idx));
    },
    [items, onChange],
  );

  const total = useMemo(
    () =>
      items.reduce((sum, item) => {
        const annual =
          item.input_mode === 'per_unit_month'
            ? item.amount_per_unit * 12 * totalUnits
            : item.amount_per_unit * totalUnits;
        return sum + annual;
      }, 0),
    [items, totalUnits],
  );

  return (
    <div className={cn(GLASS_CARD, 'space-y-3')}>
      <h3 className="font-display text-sm font-bold text-foreground">Other Income</h3>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left py-2 text-muted-foreground font-normal w-40">Line Item</th>
              <th className="text-left py-2 text-muted-foreground font-normal w-32">Description</th>
              <th className="text-right py-2 text-muted-foreground font-normal w-24">Amount</th>
              <th className="text-center py-2 text-muted-foreground font-normal w-24">Mode</th>
              <th className="text-right py-2 text-muted-foreground font-normal w-24">Annual</th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => {
              const annual =
                item.input_mode === 'per_unit_month'
                  ? item.amount_per_unit * 12 * totalUnits
                  : item.amount_per_unit * totalUnits;
              return (
                <tr key={i} className="border-b border-white/[0.04]">
                  <td className="py-1.5">
                    <Input
                      value={item.line_item}
                      onChange={(e) => updateItem(i, { line_item: e.target.value })}
                      className="h-7 text-xs"
                      placeholder="Item name"
                    />
                  </td>
                  <td className="py-1.5 px-1">
                    <Input
                      value={item.description}
                      onChange={(e) => updateItem(i, { description: e.target.value })}
                      className="h-7 text-xs"
                      placeholder="Optional"
                    />
                  </td>
                  <td className="py-1.5 px-1">
                    <CurrencyInput
                      value={item.amount_per_unit || null}
                      onChange={(v) => updateItem(i, { amount_per_unit: v ?? 0 })}
                    />
                  </td>
                  <td className="py-1.5 px-1 text-center">
                    <button
                      onClick={() =>
                        updateItem(i, {
                          input_mode:
                            item.input_mode === 'per_unit_year'
                              ? 'per_unit_month'
                              : 'per_unit_year',
                        })
                      }
                      className="text-[10px] text-muted-foreground hover:text-foreground"
                    >
                      {item.input_mode === 'per_unit_year' ? '$/unit/yr' : '$/unit/mo'}
                    </button>
                  </td>
                  <td className="py-1.5 px-1 text-right font-mono">{formatCurrency(annual)}</td>
                  <td className="py-1.5">
                    <button
                      onClick={() => removeItem(i)}
                      className="text-muted-foreground hover:text-destructive text-xs"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-white/10">
        <button
          onClick={addItem}
          className="text-xs text-primary hover:text-primary/80 font-medium"
        >
          + Add Item
        </button>
        <div className="text-right">
          <span className="text-xs text-muted-foreground mr-3">Total:</span>
          <span className="font-mono text-sm font-bold">{formatCurrency(total)}</span>
          <span className="text-[10px] text-muted-foreground ml-2">
            ({formatCurrency(totalUnits > 0 ? Math.round(total / totalUnits) : 0)}/unit)
          </span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section B: Payroll
// ---------------------------------------------------------------------------

const DEFAULT_PAYROLL: PayrollItem = {
  position: '',
  salary: 0,
  bonus: 0,
  payroll_load_pct: 0.30,
};

function PayrollSection({
  items,
  totalUnits,
  onChange,
}: {
  items: PayrollItem[];
  totalUnits: number;
  onChange: (items: PayrollItem[]) => void;
}) {
  const updateItem = useCallback(
    (idx: number, patch: Partial<PayrollItem>) => {
      const next = items.map((item, i) => (i === idx ? { ...item, ...patch } : item));
      onChange(next);
    },
    [items, onChange],
  );

  const addItem = useCallback(() => {
    onChange([...items, { ...DEFAULT_PAYROLL }]);
  }, [items, onChange]);

  const removeItem = useCallback(
    (idx: number) => {
      onChange(items.filter((_, i) => i !== idx));
    },
    [items, onChange],
  );

  const total = useMemo(
    () =>
      items.reduce(
        (sum, p) => sum + (p.salary + p.bonus) * (1 + p.payroll_load_pct),
        0,
      ),
    [items],
  );

  return (
    <div className={cn(GLASS_CARD, 'space-y-3')}>
      <h3 className="font-display text-sm font-bold text-foreground">Payroll</h3>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left py-2 text-muted-foreground font-normal w-40">Position</th>
              <th className="text-right py-2 text-muted-foreground font-normal w-24">Salary</th>
              <th className="text-right py-2 text-muted-foreground font-normal w-20">Bonus</th>
              <th className="text-right py-2 text-muted-foreground font-normal w-20">Load %</th>
              <th className="text-right py-2 text-muted-foreground font-normal w-24">Total</th>
              <th className="text-right py-2 text-muted-foreground font-normal w-20">Per Unit</th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => {
              const itemTotal = (item.salary + item.bonus) * (1 + item.payroll_load_pct);
              return (
                <tr key={i} className="border-b border-white/[0.04]">
                  <td className="py-1.5">
                    <Input
                      value={item.position}
                      onChange={(e) => updateItem(i, { position: e.target.value })}
                      className="h-7 text-xs"
                      placeholder="Position"
                    />
                  </td>
                  <td className="py-1.5 px-1">
                    <CurrencyInput
                      value={item.salary || null}
                      onChange={(v) => updateItem(i, { salary: v ?? 0 })}
                    />
                  </td>
                  <td className="py-1.5 px-1">
                    <CurrencyInput
                      value={item.bonus || null}
                      onChange={(v) => updateItem(i, { bonus: v ?? 0 })}
                    />
                  </td>
                  <td className="py-1.5 px-1">
                    <PercentInput
                      value={item.payroll_load_pct}
                      onChange={(v) => updateItem(i, { payroll_load_pct: v ?? 0 })}
                    />
                  </td>
                  <td className="py-1.5 px-1 text-right font-mono">{formatCurrency(itemTotal)}</td>
                  <td className="py-1.5 px-1 text-right font-mono text-muted-foreground">
                    {formatCurrency(totalUnits > 0 ? Math.round(itemTotal / totalUnits) : 0)}
                  </td>
                  <td className="py-1.5">
                    <button
                      onClick={() => removeItem(i)}
                      className="text-muted-foreground hover:text-destructive text-xs"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-white/10">
        <button
          onClick={addItem}
          className="text-xs text-primary hover:text-primary/80 font-medium"
        >
          + Add Position
        </button>
        <div className="text-right">
          <span className="text-xs text-muted-foreground mr-3">Total:</span>
          <span className="font-mono text-sm font-bold">{formatCurrency(total)}</span>
          <span className="text-[10px] text-muted-foreground ml-2">
            ({formatCurrency(totalUnits > 0 ? Math.round(total / totalUnits) : 0)}/unit)
          </span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section C: Contract Services (collapsible)
// ---------------------------------------------------------------------------

const DEFAULT_CONTRACT: ContractServiceItem = {
  service: '',
  occupancy: 1.0,
  monthly_per_unit: 0,
  monthly_total: 0,
  annual_total: 0,
};

function ContractServicesSection({
  items,
  onChange,
}: {
  items: ContractServiceItem[];
  onChange: (items: ContractServiceItem[]) => void;
}) {
  const [open, setOpen] = useState(false);

  const updateItem = useCallback(
    (idx: number, patch: Partial<ContractServiceItem>) => {
      const next = items.map((item, i) => {
        if (i !== idx) return item;
        const updated = { ...item, ...patch };
        // Recompute annual from monthly_total
        updated.annual_total = (updated.monthly_total || 0) * 12;
        return updated;
      });
      onChange(next);
    },
    [items, onChange],
  );

  const addItem = useCallback(() => {
    onChange([...items, { ...DEFAULT_CONTRACT }]);
  }, [items, onChange]);

  const removeItem = useCallback(
    (idx: number) => {
      onChange(items.filter((_, i) => i !== idx));
    },
    [items, onChange],
  );

  const total = useMemo(() => items.reduce((s, c) => s + (c.annual_total || 0), 0), [items]);

  return (
    <div className={cn(GLASS_CARD, 'overflow-hidden')}>
      <button onClick={() => setOpen((p) => !p)} className="w-full flex items-center justify-between">
        <h3 className="font-display text-sm font-bold text-foreground">Contract Services</h3>
        <span className="text-muted-foreground text-xs">{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div className="mt-4 space-y-3">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-2 text-muted-foreground font-normal w-40">Service</th>
                  <th className="text-right py-2 text-muted-foreground font-normal w-24">Monthly</th>
                  <th className="text-right py-2 text-muted-foreground font-normal w-24">Annual</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={i} className="border-b border-white/[0.04]">
                    <td className="py-1.5">
                      <Input
                        value={item.service}
                        onChange={(e) => updateItem(i, { service: e.target.value })}
                        className="h-7 text-xs"
                        placeholder="Service name"
                      />
                    </td>
                    <td className="py-1.5 px-1">
                      <CurrencyInput
                        value={item.monthly_total || null}
                        onChange={(v) => updateItem(i, { monthly_total: v ?? 0 })}
                      />
                    </td>
                    <td className="py-1.5 px-1 text-right font-mono">
                      {formatCurrency(item.annual_total)}
                    </td>
                    <td className="py-1.5">
                      <button
                        onClick={() => removeItem(i)}
                        className="text-muted-foreground hover:text-destructive text-xs"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-white/10">
            <button onClick={addItem} className="text-xs text-primary hover:text-primary/80 font-medium">
              + Add Service
            </button>
            <div>
              <span className="text-xs text-muted-foreground mr-3">Total:</span>
              <span className="font-mono text-sm font-bold">{formatCurrency(total)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section D: RE Tax Calculator (read-only)
// ---------------------------------------------------------------------------

function TaxCalculatorSection({
  inputs,
  outputs,
}: {
  inputs: UWSubPageProps['inputs'];
  outputs: UWSubPageProps['outputs'];
}) {
  const scenarios = [
    { key: 'premium' as const, label: 'Premium' },
    { key: 'market' as const, label: 'Market' },
  ];

  return (
    <div className={cn(GLASS_CARD, 'space-y-3')}>
      <h3 className="font-display text-sm font-bold text-foreground">RE Tax Calculator</h3>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {scenarios.map(({ key, label }) => {
          const vs = outputs?.scenarios?.[key]?.valuation_summary;
          const purchasePrice = vs?.purchase_price ?? 0;
          const pctAssessed = inputs.pct_of_purchase_assessed;
          const assessmentRatio = inputs.assessment_ratio;
          const millageRate = inputs.millage_rate;
          const assessedValue = purchasePrice * pctAssessed;
          const taxableValue = assessedValue * assessmentRatio;
          const annualTax = taxableValue * (millageRate / 100);

          return (
            <div key={key} className="bg-white/[0.03] rounded-xl p-4 space-y-2">
              <h4 className={cn(SECTION_LABEL, 'mb-2')}>{label}</h4>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Purchase Price</span>
                  <span className="font-mono">{formatCurrency(purchasePrice)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">× % Assessed ({formatPct(pctAssessed)})</span>
                  <span className="font-mono">{formatCurrency(assessedValue)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">× Assessment Ratio ({formatPct(assessmentRatio)})</span>
                  <span className="font-mono">{formatCurrency(taxableValue)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">× Millage Rate ({millageRate.toFixed(2)}%)</span>
                  <span className="font-mono">{formatCurrency(annualTax)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-white/10 font-semibold">
                  <span>Annual Tax</span>
                  <span className="font-mono">{formatCurrency(annualTax)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// UWDetailSchedulesPage
// ---------------------------------------------------------------------------

export function UWDetailSchedulesPage({ inputs, outputs, dispatch, isComputing }: UWSubPageProps) {
  const totalUnits = inputs.total_units || 1;

  return (
    <div className="space-y-6">
      {isComputing && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
          Computing...
        </div>
      )}

      <OtherIncomeSection
        items={inputs.other_income_items}
        totalUnits={totalUnits}
        onChange={(items) => dispatch({ type: 'SET_OTHER_INCOME_ITEMS', payload: items })}
      />

      <PayrollSection
        items={inputs.payroll_items}
        totalUnits={totalUnits}
        onChange={(items) => dispatch({ type: 'SET_PAYROLL_ITEMS', payload: items })}
      />

      <ContractServicesSection
        items={inputs.contract_services_items}
        onChange={(items) => dispatch({ type: 'SET_CONTRACT_SERVICES_ITEMS', payload: items })}
      />

      <TaxCalculatorSection inputs={inputs} outputs={outputs} />
    </div>
  );
}
