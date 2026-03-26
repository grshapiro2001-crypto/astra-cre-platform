/**
 * UWT12MappingPage — T12 Operating Statement Analysis
 *
 * Two-column layout: raw line items (left) with category dropdowns (right),
 * plus a category summary panel at the bottom.
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import { GLASS_CARD } from '../tabUtils';
import { formatCurrency } from './uwFormatters';
import {
  getT12LineItems,
  bulkUpdateCategories,
  applyMapping,
} from '@/services/t12MappingService';
import type { T12LineItem, T12LineItemsResponse } from '@/types/t12Mapping';
import type { UWSubPageProps } from './types';
import type { PropertyDetail } from '@/types/property';
import type { UWInputs } from '@/types/underwriting';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface UWT12MappingPageProps extends UWSubPageProps {
  property: PropertyDetail;
}

const MONTH_ORDER = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function UWT12MappingPage({ property, dispatch }: UWT12MappingPageProps) {
  const [lineItems, setLineItems] = useState<T12LineItem[]>([]);
  const [categories, setCategories] = useState<{ revenue: string[]; expense: string[] }>({
    revenue: [],
    expense: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isApplying, setIsApplying] = useState(false);
  const [applyStatus, setApplyStatus] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const pendingChanges = useRef<Map<number, string>>(new Map());
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const totalUnits = property.total_units || 1;

  // Load line items on mount
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data: T12LineItemsResponse = await getT12LineItems(property.id);
        if (!cancelled) {
          setLineItems(data.items);
          setCategories(data.categories);
          setIsLoading(false);
        }
      } catch {
        if (!cancelled) setIsLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [property.id]);

  // Flush pending changes
  const flushPendingChanges = useCallback(async () => {
    if (pendingChanges.current.size === 0) return;
    const updates = Array.from(pendingChanges.current.entries()).map(([id, mapped_category]) => ({
      id,
      mapped_category,
    }));
    pendingChanges.current.clear();
    try {
      await bulkUpdateCategories(property.id, updates);
    } catch (e) {
      console.error('Failed to save category changes:', e);
    }
  }, [property.id]);

  // Handle category change
  const handleCategoryChange = useCallback(
    (itemId: number, newCategory: string) => {
      // Optimistic local update
      setLineItems((prev) =>
        prev.map((item) =>
          item.id === itemId
            ? { ...item, mapped_category: newCategory || null, user_confirmed: true }
            : item,
        ),
      );
      // Queue for bulk update
      pendingChanges.current.set(itemId, newCategory);
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => flushPendingChanges(), 1000);
    },
    [flushPendingChanges],
  );

  // Toggle monthly detail expansion
  const toggleExpand = useCallback((itemId: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }, []);

  // Handle Apply Mapping
  const handleApplyMapping = useCallback(async () => {
    setIsApplying(true);
    setApplyStatus(null);
    try {
      // Flush any pending changes first
      await flushPendingChanges();
      const result = await applyMapping(property.id);

      // Merge updated UW fields into inputs
      if (result.updated_uw_fields) {
        dispatch({
          type: 'SET_INPUTS',
          payload: result.updated_uw_fields as Partial<UWInputs>,
        });
      }

      setApplyStatus('T12 mapping applied — Proforma and Assumptions updated');
      setTimeout(() => {
        setApplyStatus(null);
        dispatch({ type: 'SET_ACTIVE_SUB_TAB', payload: 'proforma' });
      }, 2000);
    } catch {
      setApplyStatus('Failed to apply mapping');
    } finally {
      setIsApplying(false);
    }
  }, [property.id, flushPendingChanges, dispatch]);

  // Compute category summary from current local state
  const categorySummary = useMemo(() => {
    const totals: Record<string, { annual: number; t3: number; item_count: number; per_unit: number }> = {};
    let totalRev = 0;
    let totalExp = 0;

    const revenueSet = new Set(categories.revenue);
    const expenseSet = new Set(categories.expense);

    for (const item of lineItems) {
      if (item.is_subtotal || item.is_section_header) continue;
      const cat = item.mapped_category;
      if (!cat || cat === 'Exclude' || cat === 'TOTAL') continue;

      if (!totals[cat]) {
        totals[cat] = { annual: 0, t3: 0, item_count: 0, per_unit: 0 };
      }
      totals[cat].annual += item.annual_total || 0;
      totals[cat].t3 += item.t3_value || 0;
      totals[cat].item_count += 1;
      totals[cat].per_unit = totals[cat].annual / totalUnits;

      if (revenueSet.has(cat)) totalRev += item.annual_total || 0;
      if (expenseSet.has(cat)) totalExp += item.annual_total || 0;
    }

    return { totals, totalRev, totalExp, noi: totalRev - totalExp };
  }, [lineItems, categories, totalUnits]);

  if (isLoading) {
    return (
      <div className={cn(GLASS_CARD, 'text-center py-16')}>
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">Loading T12 line items...</p>
      </div>
    );
  }

  if (lineItems.length === 0) {
    return (
      <div className={cn(GLASS_CARD, 'text-center py-16')}>
        <p className="text-sm text-muted-foreground">
          No T12 line items found. Upload a T12 Excel file to enable line item mapping.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className={cn(GLASS_CARD, 'flex items-center justify-between py-4')}>
        <div>
          <h3 className="text-base font-semibold text-foreground">T12 Operating Statement Analysis</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {lineItems.filter((i) => !i.is_subtotal && !i.is_section_header).length} line items
            &middot; {lineItems.filter((i) => i.user_confirmed).length} confirmed
          </p>
        </div>
        <div className="flex items-center gap-3">
          {applyStatus && (
            <span
              className={cn(
                'text-xs',
                applyStatus.includes('Failed') ? 'text-destructive' : 'text-emerald-500',
              )}
            >
              {applyStatus}
            </span>
          )}
          <button
            onClick={handleApplyMapping}
            disabled={isApplying}
            className={cn(
              'px-4 py-1.5 rounded-lg text-xs font-medium transition-colors',
              'bg-amber-500/90 text-white hover:bg-amber-500',
              isApplying && 'opacity-50 cursor-not-allowed',
            )}
          >
            {isApplying ? 'Applying...' : 'Apply Mapping'}
          </button>
        </div>
      </div>

      {/* Line Items Table */}
      <div className={cn(GLASS_CARD, 'p-0 overflow-hidden')}>
        <div className="max-h-[600px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-card/90 backdrop-blur-sm z-10 border-b border-border/40">
              <tr>
                <th className="text-left pl-4 py-2 font-medium text-muted-foreground w-6"></th>
                <th className="text-left py-2 font-medium text-muted-foreground">Line Item</th>
                <th className="text-right py-2 pr-4 font-medium text-muted-foreground w-28">Annual Total</th>
                <th className="text-right py-2 pr-4 font-medium text-muted-foreground w-28">T3 Ann.</th>
                <th className="text-left py-2 pl-4 font-medium text-muted-foreground w-48">Category</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((item) => (
                <LineItemRow
                  key={item.id}
                  item={item}
                  categories={item.section === 'revenue' ? categories.revenue : categories.expense}
                  isExpanded={expandedRows.has(item.id)}
                  onToggleExpand={() => toggleExpand(item.id)}
                  onCategoryChange={(cat) => handleCategoryChange(item.id, cat)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Category Summary */}
      <CategorySummaryPanel
        summary={categorySummary}
        totalUnits={totalUnits}
        revenueCategories={categories.revenue}
        expenseCategories={categories.expense}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// LineItemRow
// ---------------------------------------------------------------------------

interface LineItemRowProps {
  item: T12LineItem;
  categories: string[];
  isExpanded: boolean;
  onToggleExpand: () => void;
  onCategoryChange: (category: string) => void;
}

function LineItemRow({ item, categories, isExpanded, onToggleExpand, onCategoryChange }: LineItemRowProps) {
  if (item.is_section_header) {
    return (
      <tr className="border-t border-border/30">
        <td colSpan={5} className="pl-4 py-2 font-semibold text-foreground bg-muted/30 text-xs uppercase tracking-wide">
          {item.raw_label}
        </td>
      </tr>
    );
  }

  if (item.is_subtotal) {
    return (
      <tr className="border-t border-border/20 bg-muted/10">
        <td className="w-6"></td>
        <td className="py-1.5 text-muted-foreground font-medium">{item.raw_label}</td>
        <td className="text-right pr-4 font-mono text-muted-foreground">
          {formatCurrency(item.annual_total)}
        </td>
        <td className="text-right pr-4 font-mono text-muted-foreground">
          {formatCurrency(item.t3_value)}
        </td>
        <td className="pl-4 text-muted-foreground italic text-[10px]">subtotal</td>
      </tr>
    );
  }

  // Confidence indicator color
  const confidence = item.auto_confidence ?? 0;
  const borderColor =
    item.user_confirmed
      ? 'border-l-emerald-500'
      : confidence > 0.8
        ? 'border-l-emerald-400'
        : confidence > 0.5
          ? 'border-l-amber-400'
          : 'border-l-red-400/50';

  const hasMonthly = item.monthly_values && Object.keys(item.monthly_values).length > 0;

  return (
    <>
      <tr className={cn('border-t border-border/10 hover:bg-muted/20 border-l-2', borderColor)}>
        {/* Expand toggle */}
        <td className="w-6 text-center">
          {hasMonthly && (
            <button onClick={onToggleExpand} className="p-0.5 text-muted-foreground hover:text-foreground">
              {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </button>
          )}
        </td>
        {/* Label */}
        <td className="py-1.5">
          <span className="text-foreground">{item.raw_label}</span>
          {item.gl_code && (
            <span className="ml-2 text-[10px] text-muted-foreground/50">{item.gl_code}</span>
          )}
        </td>
        {/* Annual total */}
        <td className="text-right pr-4 font-mono tabular-nums text-foreground">
          {formatCurrency(item.annual_total)}
        </td>
        {/* T3 annualized */}
        <td className="text-right pr-4 font-mono tabular-nums text-muted-foreground">
          {formatCurrency(item.t3_value)}
        </td>
        {/* Category dropdown */}
        <td className="pl-4 py-1">
          <select
            value={item.mapped_category || ''}
            onChange={(e) => onCategoryChange(e.target.value)}
            className={cn(
              'w-full text-xs px-2 py-1 rounded border bg-background text-foreground',
              'border-border/50 focus:border-primary focus:ring-1 focus:ring-primary/30 outline-none',
              !item.mapped_category && 'text-muted-foreground',
            )}
          >
            <option value="">— Select —</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </td>
      </tr>
      {/* Expandable monthly detail */}
      {isExpanded && hasMonthly && (
        <tr className="border-t border-border/5">
          <td></td>
          <td colSpan={4} className="py-1 px-2">
            <div className="flex gap-1 text-[10px] font-mono text-muted-foreground overflow-x-auto">
              {MONTH_ORDER.map((m) => {
                const val = item.monthly_values?.[m];
                return (
                  <div key={m} className="flex flex-col items-center min-w-[56px]">
                    <span className="text-muted-foreground/60">{m}</span>
                    <span className={val != null && val < 0 ? 'text-red-400' : ''}>
                      {val != null ? formatCurrency(val) : '—'}
                    </span>
                  </div>
                );
              })}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Category Summary Panel
// ---------------------------------------------------------------------------

interface CategorySummaryPanelProps {
  summary: {
    totals: Record<string, { annual: number; t3: number; item_count: number; per_unit: number }>;
    totalRev: number;
    totalExp: number;
    noi: number;
  };
  totalUnits: number;
  revenueCategories: string[];
  expenseCategories: string[];
}

function CategorySummaryPanel({ summary, totalUnits, revenueCategories, expenseCategories }: CategorySummaryPanelProps) {
  const revCats = revenueCategories.filter((c) => c !== 'Exclude' && summary.totals[c]);
  const expCats = expenseCategories.filter((c) => c !== 'Exclude' && summary.totals[c]);

  return (
    <div className={cn(GLASS_CARD, 'p-0 overflow-hidden')}>
      <div className="px-4 py-2 border-b border-border/40">
        <h4 className="text-xs font-semibold text-foreground uppercase tracking-wide">Category Summary</h4>
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border/30">
            <th className="text-left pl-4 py-1.5 font-medium text-muted-foreground">Category</th>
            <th className="text-right pr-4 py-1.5 font-medium text-muted-foreground w-28">T12 Total</th>
            <th className="text-right pr-4 py-1.5 font-medium text-muted-foreground w-28">T3 Ann.</th>
            <th className="text-right pr-4 py-1.5 font-medium text-muted-foreground w-24">$/Unit</th>
            <th className="text-right pr-4 py-1.5 font-medium text-muted-foreground w-16"># Items</th>
          </tr>
        </thead>
        <tbody>
          {/* Revenue section */}
          {revCats.length > 0 && (
            <>
              <tr>
                <td colSpan={5} className="pl-4 pt-2 pb-1 font-semibold text-muted-foreground text-[10px] uppercase tracking-wider">
                  Revenue
                </td>
              </tr>
              {revCats.map((cat) => {
                const t = summary.totals[cat];
                return (
                  <SummaryRow key={cat} label={cat} annual={t.annual} t3={t.t3} perUnit={t.per_unit} count={t.item_count} />
                );
              })}
              <tr className="border-t border-border/30 font-medium">
                <td className="pl-4 py-1">Total Revenue</td>
                <td className="text-right pr-4 font-mono">{formatCurrency(summary.totalRev)}</td>
                <td className="text-right pr-4 font-mono text-muted-foreground">—</td>
                <td className="text-right pr-4 font-mono">{formatCurrency(summary.totalRev / totalUnits)}</td>
                <td></td>
              </tr>
            </>
          )}
          {/* Expense section */}
          {expCats.length > 0 && (
            <>
              <tr>
                <td colSpan={5} className="pl-4 pt-3 pb-1 font-semibold text-muted-foreground text-[10px] uppercase tracking-wider">
                  Expenses
                </td>
              </tr>
              {expCats.map((cat) => {
                const t = summary.totals[cat];
                return (
                  <SummaryRow key={cat} label={cat} annual={t.annual} t3={t.t3} perUnit={t.per_unit} count={t.item_count} />
                );
              })}
              <tr className="border-t border-border/30 font-medium">
                <td className="pl-4 py-1">Total Expenses</td>
                <td className="text-right pr-4 font-mono">{formatCurrency(summary.totalExp)}</td>
                <td className="text-right pr-4 font-mono text-muted-foreground">—</td>
                <td className="text-right pr-4 font-mono">{formatCurrency(summary.totalExp / totalUnits)}</td>
                <td></td>
              </tr>
            </>
          )}
          {/* NOI */}
          <tr className="border-t-2 border-border/60 font-semibold bg-muted/20">
            <td className="pl-4 py-1.5">NOI</td>
            <td className={cn('text-right pr-4 font-mono', summary.noi < 0 ? 'text-red-400' : 'text-emerald-500')}>
              {formatCurrency(summary.noi)}
            </td>
            <td className="text-right pr-4">—</td>
            <td className={cn('text-right pr-4 font-mono', summary.noi < 0 ? 'text-red-400' : 'text-emerald-500')}>
              {formatCurrency(summary.noi / totalUnits)}
            </td>
            <td></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function SummaryRow({
  label,
  annual,
  t3,
  perUnit,
  count,
}: {
  label: string;
  annual: number;
  t3: number;
  perUnit: number;
  count: number;
}) {
  return (
    <tr className="border-t border-border/10 hover:bg-muted/10">
      <td className="pl-6 py-1 text-foreground">{label}</td>
      <td className="text-right pr-4 font-mono tabular-nums">{formatCurrency(annual)}</td>
      <td className="text-right pr-4 font-mono tabular-nums text-muted-foreground">{formatCurrency(t3)}</td>
      <td className="text-right pr-4 font-mono tabular-nums">{formatCurrency(perUnit)}</td>
      <td className="text-right pr-4 text-muted-foreground">{count}</td>
    </tr>
  );
}
