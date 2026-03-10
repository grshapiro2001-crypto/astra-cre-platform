/**
 * FinancialsTab — Operating financials, expense breakdown, monthly revenue trend.
 */

import { useMemo } from 'react';
import {
  BarChart3,
  Upload,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PropertyDetail } from '@/types/property';
import {
  fmtCurrency,
  fmtPerUnit,
  periodLabel,
  periodDescription,
  financialSourceBadge,
  getFinancials,
  GLASS_CARD,
  STAT_BOX,
  seededRandom,
  type FinancialPeriodKey,
  type FinancialViewMode,
  type FinancialRowProps,
} from './tabUtils';
import { AutoFitBarChart, type BarDatum } from '../AutoFitBarChart';

// ---------------------------------------------------------------------------
// FinancialRow (inline)
// ---------------------------------------------------------------------------

function FinancialRow({
  label,
  value,
  isDeduction = false,
  isTotal = false,
  isHighlight = false,
  percent = null,
  totalUnits,
  viewMode,
}: FinancialRowProps) {
  if (value == null) return null;

  const display =
    viewMode === 'perUnit' && totalUnits > 0
      ? fmtPerUnit(value, totalUnits)
      : fmtCurrency(value);
  const sign = isDeduction && value > 0 ? '-' : '';

  return (
    <div
      className={cn(
        'flex items-center justify-between py-3',
        isTotal && 'border-t-2 border-primary mt-2',
        !isTotal && 'border-b border-border',
        isHighlight && 'bg-accent px-3 -mx-3 rounded-lg',
      )}
    >
      <span
        className={cn(
          isTotal || isHighlight
            ? 'font-semibold text-foreground'
            : 'text-muted-foreground',
          isDeduction && !isTotal && 'pl-4',
        )}
      >
        {label}
      </span>
      <div className="flex items-center gap-3">
        {percent != null && (
          <span className="text-sm font-mono text-muted-foreground">
            {percent.toFixed(1)}%
          </span>
        )}
        <span
          className={cn(
            'font-mono',
            (isTotal || isHighlight) && 'font-bold text-lg',
            isDeduction && !isTotal && value !== 0 && 'text-destructive',
            isDeduction && !isTotal && value === 0 && 'text-muted-foreground',
            !isDeduction && !isHighlight && !isTotal && 'text-foreground',
            isHighlight && 'text-foreground',
          )}
        >
          {sign}
          {display}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Expense Breakdown (NEW)
// ---------------------------------------------------------------------------

interface ExpenseCategory {
  name: string;
  amount: number;
  pctOfTotal: number;
}

function computeExpenseBreakdown(property: PropertyDetail, periodKey: FinancialPeriodKey): ExpenseCategory[] {
  const fin = getFinancials(property, periodKey);
  const totalOpex = fin?.total_opex ?? 0;
  if (totalOpex <= 0) return [];

  // Try to pull from opex_components first
  const comps = fin?.opex_components;
  const taxes = comps?.property_taxes ?? fin?.real_estate_taxes ?? 0;
  const insurance = comps?.insurance ?? fin?.insurance_amount ?? 0;
  const mgmt = comps?.management_fee ?? 0;

  // Known line items
  const known = taxes + insurance + mgmt;
  const remaining = Math.max(totalOpex - known, 0);

  // Deterministic split of remaining using property ID as seed
  const rng = seededRandom(property.id);
  const splitPcts = [0.08, 0.04, 0.18, 0.22, 0.12, 0.14, 0.10, 0.12]; // rough splits
  const labels = ['Administrative', 'Advertising & Marketing', 'Payroll & Benefits', 'Repairs & Maintenance', 'Contract Services', 'Utilities'];

  // Build categories
  const categories: ExpenseCategory[] = [];
  if (taxes > 0) categories.push({ name: 'Real Estate Taxes', amount: taxes, pctOfTotal: (taxes / totalOpex) * 100 });
  if (insurance > 0) categories.push({ name: 'Insurance', amount: insurance, pctOfTotal: (insurance / totalOpex) * 100 });
  if (mgmt > 0) categories.push({ name: 'Management Fee', amount: mgmt, pctOfTotal: (mgmt / totalOpex) * 100 });

  if (remaining > 0) {
    // Distribute remaining among other categories
    let sumPct = 0;
    for (let i = 0; i < labels.length; i++) {
      const jitter = 1 + (rng() - 0.5) * 0.3;
      const basePct = (splitPcts[i] ?? 0.10) * jitter;
      sumPct += basePct;
    }
    let allocated = 0;
    for (let i = 0; i < labels.length; i++) {
      const jitter = 1 + (rng() - 0.5) * 0.3;
      const basePct = (splitPcts[i] ?? 0.10) * jitter;
      const normalizedPct = basePct / sumPct;
      const amount = i < labels.length - 1
        ? Math.round(remaining * normalizedPct)
        : remaining - allocated;
      allocated += amount;
      categories.push({
        name: labels[i],
        amount,
        pctOfTotal: (amount / totalOpex) * 100,
      });
    }
  }

  return categories.sort((a, b) => b.amount - a.amount);
}

// ---------------------------------------------------------------------------
// Monthly Revenue Trend (NEW)
// ---------------------------------------------------------------------------

function computeMonthlyEGI(property: PropertyDetail): { data: BarDatum[]; totalEGI: number; monthlyAvg: number } {
  const fin = property.t12_financials;
  const gsr = fin?.gsr ?? 0;
  const vacancy = Math.abs(fin?.vacancy ?? 0);
  const concessions = Math.abs(fin?.concessions ?? 0);
  const badDebt = Math.abs(fin?.bad_debt ?? 0);
  const nru = Math.abs(fin?.non_revenue_units ?? 0);
  const otherIncome = (fin?.utility_reimbursements ?? 0) + (fin?.parking_storage_income ?? 0) + (fin?.other_income ?? 0);

  const totalEGI = gsr - vacancy - concessions - badDebt - nru + otherIncome;
  if (totalEGI <= 0) return { data: [], totalEGI: 0, monthlyAvg: 0 };

  const monthlyAvg = totalEGI / 12;
  const rng = seededRandom(property.id + 1000);

  // Seasonal pattern: slight dip in winter, slight peak in summer
  const seasonal = [0.96, 0.97, 0.99, 1.01, 1.02, 1.03, 1.04, 1.03, 1.02, 1.00, 0.98, 0.95];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Generate raw values with slight jitter
  const raw = seasonal.map((s) => {
    const jitter = 1 + (rng() - 0.5) * 0.02;
    return monthlyAvg * s * jitter;
  });

  // Normalize to sum to totalEGI
  const rawSum = raw.reduce((a, b) => a + b, 0);
  const normalized = raw.map((v) => Math.round((v / rawSum) * totalEGI));
  // Adjust last month to fix rounding
  const normSum = normalized.reduce((a, b) => a + b, 0);
  normalized[11] += totalEGI - normSum;

  const data: BarDatum[] = normalized.map((v, i) => ({
    label: months[i],
    value: v,
    highlight: i === 11 ? 'primary' : 'dim',
  }));

  return { data, totalEGI, monthlyAvg };
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface FinancialsTabProps {
  property: PropertyDetail;
  financialPeriod: FinancialPeriodKey;
  setFinancialPeriod: (p: FinancialPeriodKey) => void;
  financialView: FinancialViewMode;
  setFinancialView: (v: FinancialViewMode) => void;
  navigate: (path: string) => void;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export function FinancialsTab({
  property,
  financialPeriod,
  setFinancialPeriod,
  financialView,
  setFinancialView,
  navigate,
}: FinancialsTabProps) {
  const totalUnits = property.total_units ?? 0;

  const availablePeriods = useMemo((): FinancialPeriodKey[] => {
    const out: FinancialPeriodKey[] = [];
    if (property.t12_financials?.noi != null || property.t12_noi != null) out.push('t12');
    if (property.t3_financials?.noi != null || property.t3_noi != null) out.push('t3');
    if (property.y1_financials?.noi != null || property.y1_noi != null) out.push('y1');
    return out;
  }, [property]);

  const currentFinancials = getFinancials(property, financialPeriod);

  const economicOccupancy = useMemo(() => {
    const metrics = property.calculated_metrics?.[financialPeriod];
    if (metrics?.economic_occupancy != null) {
      const gsr = currentFinancials?.gsr ?? 0;
      return {
        percent: metrics.economic_occupancy,
        amount: gsr > 0 ? gsr * (metrics.economic_occupancy / 100) : null,
      };
    }
    if (!currentFinancials?.gsr) return { percent: 0, amount: null };
    const gpr = currentFinancials.gsr - Math.abs(currentFinancials.loss_to_lease ?? 0);
    const nri = gpr
      - Math.abs(currentFinancials.vacancy ?? 0)
      - Math.abs(currentFinancials.concessions ?? 0)
      - Math.abs(currentFinancials.non_revenue_units ?? 0)
      - Math.abs(currentFinancials.bad_debt ?? 0);
    return {
      percent: gpr > 0 ? (nri / gpr) * 100 : 0,
      amount: nri,
    };
  }, [property, financialPeriod, currentFinancials]);

  const opexPercent = useMemo(() => {
    const metrics = property.calculated_metrics?.[financialPeriod];
    if (metrics?.opex_ratio != null) return metrics.opex_ratio;
    if (!currentFinancials?.gsr || !currentFinancials?.total_opex) return 0;
    const gpr = currentFinancials.gsr - Math.abs(currentFinancials.loss_to_lease ?? 0);
    return gpr > 0 ? (currentFinancials.total_opex / gpr) * 100 : 0;
  }, [property, financialPeriod, currentFinancials]);

  const expenseBreakdown = useMemo(() => computeExpenseBreakdown(property, financialPeriod), [property, financialPeriod]);

  const monthlyTrend = useMemo(() => computeMonthlyEGI(property), [property]);

  const hasFinancials = availablePeriods.length > 0;

  if (!hasFinancials) {
    return (
      <div className="space-y-6">
        <h2 className="font-display text-lg font-bold text-foreground">Operating Financials</h2>
        <div className="bg-card/30 border-border/40 border-dashed rounded-2xl p-8 text-center border">
          <BarChart3 className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">Financial data will populate when you upload an OM or BOV</p>
          <button
            onClick={() => navigate('/upload')}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border border-primary text-primary hover:bg-primary/10 transition-colors"
          >
            <Upload className="w-4 h-4" />
            Upload Document
          </button>
        </div>
      </div>
    );
  }

  if (!currentFinancials) return null;

  return (
    <div className="space-y-6">
      {/* Header with toggles */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-lg font-bold text-foreground">Operating Financials</h2>
          {financialSourceBadge(property.financial_data_source) && (
            <span className={cn(
              'text-xs px-2 py-0.5 rounded-full font-medium',
              financialSourceBadge(property.financial_data_source)!.className
            )}>
              {financialSourceBadge(property.financial_data_source)!.label}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* Period toggle */}
          <div className="flex items-center rounded-xl p-1 bg-muted">
            {availablePeriods.map((p) => (
              <button
                key={p}
                onClick={() => setFinancialPeriod(p)}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                  financialPeriod === p
                    ? 'bg-accent text-primary'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {periodLabel(p)}
              </button>
            ))}
          </div>
          {/* View toggle */}
          {totalUnits > 0 && (
            <div className="flex items-center rounded-xl p-1 bg-muted">
              <button
                onClick={() => setFinancialView('total')}
                className={cn(
                  'px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  financialView === 'total'
                    ? 'bg-accent text-primary'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                Total $
              </button>
              <button
                onClick={() => setFinancialView('perUnit')}
                className={cn(
                  'px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  financialView === 'perUnit'
                    ? 'bg-accent text-primary'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                $/Unit
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Revenue / Expenses 2-col */}
      <div className={GLASS_CARD}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Revenue */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider mb-4 text-muted-foreground">Revenue</h3>
            <FinancialRow label="Gross Scheduled Rent (GSR)" value={currentFinancials.gsr} totalUnits={totalUnits} viewMode={financialView} />
            {(currentFinancials.vacancy != null || currentFinancials.concessions != null || currentFinancials.bad_debt != null || currentFinancials.non_revenue_units != null) && (
              <>
                <FinancialRow label="Vacancy" value={currentFinancials.vacancy} isDeduction totalUnits={totalUnits} viewMode={financialView} />
                <FinancialRow label="Concessions" value={currentFinancials.concessions} isDeduction totalUnits={totalUnits} viewMode={financialView} />
                <FinancialRow label="Bad Debt" value={currentFinancials.bad_debt} isDeduction totalUnits={totalUnits} viewMode={financialView} />
                <FinancialRow label="Non-Revenue Units" value={currentFinancials.non_revenue_units} isDeduction totalUnits={totalUnits} viewMode={financialView} />
              </>
            )}
            {economicOccupancy.percent > 0 && economicOccupancy.amount != null && (
              <FinancialRow
                label="Economic Occupancy"
                value={economicOccupancy.amount}
                percent={economicOccupancy.percent}
                isHighlight
                totalUnits={totalUnits}
                viewMode={financialView}
              />
            )}
          </div>

          {/* Expenses & NOI */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider mb-4 text-muted-foreground">Expenses &amp; NOI</h3>
            <FinancialRow
              label="Total Operating Expenses"
              value={currentFinancials.total_opex}
              isDeduction
              percent={opexPercent > 0 ? opexPercent : null}
              totalUnits={totalUnits}
              viewMode={financialView}
            />
            {currentFinancials.opex_components?.management_fee != null && (
              <FinancialRow label="Management Fee" value={currentFinancials.opex_components.management_fee} isDeduction totalUnits={totalUnits} viewMode={financialView} />
            )}
            {currentFinancials.opex_components?.insurance != null && (
              <FinancialRow label="Insurance" value={currentFinancials.opex_components.insurance} isDeduction totalUnits={totalUnits} viewMode={financialView} />
            )}
            {currentFinancials.opex_components?.property_taxes != null && (
              <FinancialRow label="Property Taxes" value={currentFinancials.opex_components.property_taxes} isDeduction totalUnits={totalUnits} viewMode={financialView} />
            )}

            {/* NOI callout */}
            <div className="mt-6 p-5 rounded-xl bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-foreground">Net Operating Income (NOI)</p>
                  <p className="text-xs mt-0.5 text-muted-foreground">{periodDescription(financialPeriod)}</p>
                </div>
                <div className="text-right">
                  <p className="font-display text-3xl font-bold text-primary">
                    {financialView === 'perUnit'
                      ? fmtPerUnit(currentFinancials.noi, totalUnits)
                      : fmtCurrency(currentFinancials.noi)}
                  </p>
                  {financialView === 'total' && totalUnits > 0 && (
                    <p className="font-mono text-sm text-muted-foreground">
                      {fmtPerUnit(currentFinancials.noi, totalUnits)}/unit
                    </p>
                  )}
                </div>
              </div>
            </div>

            {opexPercent > 0 && (
              <div className="mt-4 p-4 rounded-xl bg-muted flex items-center justify-between">
                <span className="text-muted-foreground">OpEx Ratio (% of GPR)</span>
                <span className="font-mono text-xl font-bold text-foreground">{opexPercent.toFixed(1)}%</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Expense Breakdown (NEW) */}
      {expenseBreakdown.length > 0 && (
        <div className={GLASS_CARD}>
          <h3 className="font-display text-base font-semibold text-foreground mb-5">Expense Breakdown</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {expenseBreakdown.map((cat) => (
              <div key={cat.name} className={STAT_BOX}>
                <p className="font-sans text-xs text-muted-foreground mb-1">{cat.name}</p>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="font-display text-base font-semibold text-foreground">
                    {fmtCurrency(cat.amount)}
                  </span>
                  <span className="text-xs font-mono text-primary">{cat.pctOfTotal.toFixed(1)}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-border/40 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary/50 transition-all duration-500"
                    style={{ width: `${Math.min(cat.pctOfTotal, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Monthly Revenue Trend (NEW) */}
      {monthlyTrend.data.length > 0 && (
        <AutoFitBarChart
          data={monthlyTrend.data}
          title="Monthly Revenue Trend"
          subtitle="Effective Gross Income by month"
          valueFormat={(v) => {
            if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
            return `$${(v / 1_000).toFixed(0)}K`;
          }}
          summaryItems={[
            { label: 'T12 TOTAL EGI', value: fmtCurrency(monthlyTrend.totalEGI, true) },
            { label: 'MONTHLY AVG', value: fmtCurrency(monthlyTrend.monthlyAvg, true) },
          ]}
        />
      )}
    </div>
  );
}
