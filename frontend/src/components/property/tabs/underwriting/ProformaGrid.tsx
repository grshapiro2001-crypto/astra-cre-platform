/**
 * ProformaGrid — Excel-like year-by-year proforma grid.
 *
 * Renders the full operating statement as an interactive table with:
 *   - Sticky left label column
 *   - Scrollable year columns (Y1..Yn)
 *   - Growth % column
 *   - T12 reference column
 *   - Inline editing for overridable cells
 *   - Pin system for cell overrides
 *   - Excel-style keyboard navigation (Tab, Enter, Escape, Arrow keys)
 */

import { useState, useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { SECTION_LABEL } from '../tabUtils';
import { formatCurrencyAccounting, formatPct, parseRawNumber } from './uwFormatters';
import { GridCell, type CellType } from './GridCell';
import { OverridePopover } from './OverridePopover';
import { useGridKeyboard, type GridCoord } from './useGridKeyboard';
import type { UWSubPageProps } from './types';
import type { DCFYearResult } from '@/types/underwriting';

// ---------------------------------------------------------------------------
// Row definitions — maps DCFYearResult fields to grid rows
// ---------------------------------------------------------------------------

interface ProformaRowDef {
  label: string;
  key: string;
  format: 'currency' | 'pct';
  bold?: boolean;
  separator?: boolean;
  isTotal?: boolean;
  isDeduction?: boolean;
  isOverridable?: boolean;
  formulaDesc?: string;
  section: 'revenue' | 'expense' | 'bottom' | 'debt';
  /** Key for the growth rate array on UWInputs (if this row has a meaningful growth rate) */
  growthKey?: string;
}

const REVENUE_ROWS: ProformaRowDef[] = [
  { label: 'Gross Potential Income', key: 'gpr', format: 'currency', section: 'revenue', isOverridable: true, formulaDesc: 'GSR + Gain/Loss to Lease', growthKey: 'rental_inflation' },
  { label: 'Less: Vacancy', key: 'vacancy', format: 'currency', isDeduction: true, section: 'revenue', isOverridable: true, formulaDesc: 'GPI \u00d7 Vacancy %' },
  { label: 'Less: Concessions', key: 'concessions', format: 'currency', isDeduction: true, section: 'revenue', isOverridable: true, formulaDesc: 'GPI \u00d7 Concession %' },
  { label: 'Less: Bad Debt', key: 'bad_debt', format: 'currency', isDeduction: true, section: 'revenue', isOverridable: true, formulaDesc: 'GPI \u00d7 Bad Debt %' },
  { label: 'Less: NRU Loss', key: 'nru_loss', format: 'currency', isDeduction: true, section: 'revenue', isOverridable: true, formulaDesc: 'NRU Count \u00d7 Avg Rent \u00d7 12' },
  { label: 'Net Rental Income', key: 'nri', format: 'currency', bold: true, section: 'revenue', isOverridable: true, formulaDesc: 'GPI - Vacancy - Concessions - Bad Debt - NRU Loss' },
  { label: 'Plus: Other Income', key: 'other_income', format: 'currency', section: 'revenue', isOverridable: true, formulaDesc: 'Utility Reimb. + Parking + Other + Custom Revenue' },
  { label: 'Total Operating Income', key: 'total_income', format: 'currency', bold: true, separator: true, isTotal: true, section: 'revenue', isOverridable: true, formulaDesc: 'NRI + Other Income' },
  { label: 'Revenue Growth Rate', key: 'revenue_growth_rate', format: 'pct', section: 'revenue' },
  { label: 'Effective Rent', key: 'effective_rent', format: 'currency', section: 'revenue' },
];

const EXPENSE_ROWS: ProformaRowDef[] = [
  { label: 'Controllable Expenses', key: 'controllable_expenses', format: 'currency', section: 'expense', isOverridable: true, formulaDesc: 'Sum of per-unit controllable OpEx + Custom Expenses', growthKey: 'expense_inflation' },
  { label: 'Property Taxes', key: 'property_taxes', format: 'currency', section: 'expense', isOverridable: true, formulaDesc: 'Y1 Tax \u00d7 Cumulative Tax Inflation', growthKey: 're_tax_inflation' },
  { label: 'Insurance', key: 'insurance', format: 'currency', section: 'expense', isOverridable: true, formulaDesc: 'Y1 Insurance \u00d7 Cumulative Expense Inflation', growthKey: 'expense_inflation' },
  { label: 'Management Fee', key: 'management_fee', format: 'currency', section: 'expense', isOverridable: true, formulaDesc: 'Total Income \u00d7 Mgmt Fee %' },
  { label: 'Total Expenses', key: 'total_expenses', format: 'currency', bold: true, separator: true, isTotal: true, section: 'expense', isOverridable: true, formulaDesc: 'Controllable + Taxes + Insurance + Mgmt Fee' },
];

const BOTTOM_ROWS: ProformaRowDef[] = [
  { label: 'Net Operating Income', key: 'noi', format: 'currency', bold: true, section: 'bottom', isOverridable: true, formulaDesc: 'Total Income - Total Expenses' },
  { label: 'Capital Reserves', key: 'reserves', format: 'currency', section: 'bottom', isOverridable: true, formulaDesc: 'Reserves/Unit \u00d7 Units' },
  { label: 'NOI After Capital', key: 'ncf', format: 'currency', bold: true, section: 'bottom', isOverridable: true, formulaDesc: 'NOI - Capital Reserves' },
  { label: 'NOI Growth Rate', key: 'noi_growth_rate', format: 'pct', section: 'bottom' },
];

const DEBT_ROWS: ProformaRowDef[] = [
  { label: 'Debt Service', key: 'debt_service', format: 'currency', section: 'debt' },
  { label: 'Net Cash Flow', key: 'ncf_after_debt', format: 'currency', bold: true, section: 'debt' },
  { label: 'Cash on Cash', key: 'cash_on_cash', format: 'pct', section: 'debt' },
  { label: 'DSCR', key: 'dscr', format: 'pct', section: 'debt' },
];

interface SectionDef {
  label: string;
  rows: ProformaRowDef[];
}

const ALL_SECTIONS: SectionDef[] = [
  { label: 'REVENUE', rows: REVENUE_ROWS },
  { label: 'EXPENSES', rows: EXPENSE_ROWS },
  { label: 'NET OPERATING INCOME', rows: BOTTOM_ROWS },
  { label: 'DEBT', rows: DEBT_ROWS },
];

// Flatten rows for indexing (section headers are NOT rows in the grid coordinate system)
function flattenRows(): ProformaRowDef[] {
  const flat: ProformaRowDef[] = [];
  for (const section of ALL_SECTIONS) {
    for (const row of section.rows) {
      flat.push(row);
    }
  }
  return flat;
}

// ---------------------------------------------------------------------------
// T12 key mapping — map DCF keys to trailing_t12 dict keys
// ---------------------------------------------------------------------------

const T12_KEY_MAP: Record<string, string> = {
  gpr: 'gsr',
  vacancy: 'vacancy',
  concessions: 'concessions',
  bad_debt: 'bad_debt',
  nri: 'net_rental_income',
  other_income: 'other_income',
  total_income: 'total_income',
  controllable_expenses: 'controllable_expenses',
  property_taxes: 'real_estate_taxes',
  insurance: 'insurance_amount',
  management_fee: 'management_fee_amount',
  total_expenses: 'total_opex',
  noi: 'noi',
};

// ---------------------------------------------------------------------------
// ProformaGrid component
// ---------------------------------------------------------------------------

interface ProformaGridProps extends UWSubPageProps {
  scenario: 'premium' | 'market';
}

export function ProformaGrid({ inputs, outputs, dispatch, scenario }: ProformaGridProps) {
  const scenarioResult = outputs?.scenarios?.[scenario];
  const years = scenarioResult?.dcf?.years ?? [];
  const holdPeriod = years.length;
  const t12 = (inputs.trailing_t12 ?? {}) as Record<string, number>;
  const overrides = (inputs.overrides ?? {})[scenario] ?? {};

  // Flatten all rows for coordinate mapping
  const allRows = useMemo(() => flattenRows(), []);

  // Column indices: 0 = label (not navigable), 1 = growth (not navigable), 2 = T12 (not navigable), 3..3+holdPeriod-1 = year cols
  const FIRST_YEAR_COL = 3;
  const totalCols = FIRST_YEAR_COL + holdPeriod;

  // Editing state
  const [editingCell, setEditingCell] = useState<GridCoord | null>(null);
  const [editValue, setEditValue] = useState('');
  const [popoverCell, setPopoverCell] = useState<GridCoord | null>(null);

  const isCellNavigable = useCallback(
    (row: number, col: number) => {
      if (col < FIRST_YEAR_COL) return false;
      if (row < 0 || row >= allRows.length) return false;
      const rowDef = allRows[row];
      return !!rowDef.isOverridable;
    },
    [allRows, FIRST_YEAR_COL],
  );

  const startEdit = useCallback(
    (coord: GridCoord) => {
      const rowDef = allRows[coord.row];
      if (!rowDef?.isOverridable) return;
      const yrIdx = coord.col - FIRST_YEAR_COL;
      if (yrIdx < 0 || yrIdx >= holdPeriod) return;

      const yr = years[yrIdx];
      const val = yr[rowDef.key as keyof DCFYearResult] as number | null;
      setEditingCell(coord);
      setEditValue(val != null ? String(Math.round(val)) : '');
      setPopoverCell(null);
    },
    [allRows, FIRST_YEAR_COL, holdPeriod, years],
  );

  const commitEdit = useCallback(() => {
    if (!editingCell) return;
    const rowDef = allRows[editingCell.row];
    const yrIdx = editingCell.col - FIRST_YEAR_COL;
    const parsed = parseRawNumber(editValue);

    if (parsed != null && rowDef) {
      const overrideKey = `${rowDef.key}:${yrIdx}`;
      dispatch({ type: 'SET_OVERRIDE', scenario, key: overrideKey, value: parsed });
    }
    setEditingCell(null);
  }, [editingCell, editValue, allRows, FIRST_YEAR_COL, dispatch, scenario]);

  const cancelEdit = useCallback(() => {
    setEditingCell(null);
  }, []);

  const handleDeleteOverride = useCallback(
    (coord: GridCoord) => {
      const rowDef = allRows[coord.row];
      if (!rowDef) return;
      const yrIdx = coord.col - FIRST_YEAR_COL;
      const overrideKey = `${rowDef.key}:${yrIdx}`;
      if (overrideKey in overrides) {
        dispatch({ type: 'REMOVE_OVERRIDE', scenario, key: overrideKey });
      }
    },
    [allRows, FIRST_YEAR_COL, overrides, dispatch, scenario],
  );

  const keyboard = useGridKeyboard({
    rowCount: allRows.length,
    colCount: totalCols,
    isCellNavigable,
    onStartEdit: startEdit,
    onCommitEdit: commitEdit,
    onCancelEdit: cancelEdit,
    onDeleteOverride: handleDeleteOverride,
    isEditing: editingCell != null,
  });

  // Cell click handler
  const handleCellClick = useCallback(
    (rowIdx: number, colIdx: number) => {
      const rowDef = allRows[rowIdx];
      if (!rowDef?.isOverridable) return;
      keyboard.setFocused({ row: rowIdx, col: colIdx });
      // Open popover for computed (non-overridden) cells; direct edit for overridden
      const yrIdx = colIdx - FIRST_YEAR_COL;
      const overrideKey = `${rowDef.key}:${yrIdx}`;
      if (overrideKey in overrides) {
        startEdit({ row: rowIdx, col: colIdx });
      } else {
        setPopoverCell({ row: rowIdx, col: colIdx });
      }
    },
    [allRows, keyboard, FIRST_YEAR_COL, overrides, startEdit],
  );

  // Get cell type for a given row + year
  const getCellType = useCallback(
    (rowDef: ProformaRowDef, yrIdx: number): CellType => {
      if (rowDef.isTotal) return 'total';
      const overrideKey = `${rowDef.key}:${yrIdx}`;
      if (overrideKey in overrides) return 'override';
      return 'computed';
    },
    [overrides],
  );

  // Get the computed (pre-override) value for a cell
  const getComputedValue = useCallback(
    (rowDef: ProformaRowDef, yrIdx: number): number => {
      const yr = years[yrIdx];
      if (!yr) return 0;
      if (yr.computed_values && rowDef.key in yr.computed_values) {
        return yr.computed_values[rowDef.key];
      }
      return (yr[rowDef.key as keyof DCFYearResult] as number) ?? 0;
    },
    [years],
  );

  // Get the growth rate display for a row
  const getGrowthDisplay = useCallback(
    (rowDef: ProformaRowDef): string => {
      if (!rowDef.growthKey) return '';
      const arr = inputs[rowDef.growthKey as keyof typeof inputs];
      if (!Array.isArray(arr) || arr.length === 0) return '';
      // Show Y1 rate
      const rate = arr[0] as number;
      return formatPct(rate, 1);
    },
    [inputs],
  );

  if (!years.length) {
    return null;
  }

  // Track row index across sections for coordinate system
  let globalRowIdx = 0;

  return (
    <div
      ref={keyboard.gridRef}
      onKeyDown={keyboard.handleKeyDown}
      tabIndex={0}
      className="outline-none"
    >
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-white/[0.06]">
              {/* Label column — sticky */}
              <th className="text-left py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-normal sticky left-0 bg-[#0c0c0f] z-10 w-48 min-w-[192px]">
                Line Item
              </th>
              {/* Growth column */}
              <th className="text-right py-2 px-2 text-[10px] uppercase tracking-wider text-muted-foreground font-normal w-16">
                Growth
              </th>
              {/* T12 column */}
              <th className="text-right py-2 px-2 text-[10px] uppercase tracking-wider text-muted-foreground font-normal w-24 bg-white/[0.02]">
                T12
              </th>
              {/* Year columns */}
              {years.map((yr) => (
                <th
                  key={yr.year}
                  className="text-right py-2 px-2 text-[10px] uppercase tracking-wider text-muted-foreground font-normal w-[110px] min-w-[110px]"
                >
                  Y{yr.year}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ALL_SECTIONS.map((section) => {
              const sectionRows = section.rows.map((rowDef) => {
                const thisRowIdx = globalRowIdx++;
                return { rowDef, rowIdx: thisRowIdx };
              });

              return (
                <React.Fragment key={section.label}>
                  {/* Section header */}
                  <tr>
                    <td
                      colSpan={totalCols}
                      className="pt-5 pb-1 sticky left-0 bg-[#0c0c0f] z-10"
                    >
                      <span className={SECTION_LABEL}>{section.label}</span>
                    </td>
                  </tr>

                  {/* Data rows */}
                  {sectionRows.map(({ rowDef, rowIdx }) => (
                    <tr
                      key={rowDef.key}
                      className={cn(
                        'border-b border-white/[0.04]',
                        rowDef.isTotal && 'border-t border-white/[0.08] bg-white/[0.03]',
                        rowDef.separator && 'border-t border-white/[0.08]',
                      )}
                    >
                      {/* Label cell — sticky */}
                      <td
                        className={cn(
                          'py-1.5 pr-4 text-xs whitespace-nowrap sticky left-0 bg-[#0c0c0f] z-10',
                          rowDef.bold ? 'font-semibold text-foreground' : 'text-muted-foreground',
                          rowDef.isDeduction && !rowDef.isTotal && 'pl-4',
                        )}
                      >
                        {rowDef.label}
                      </td>

                      {/* Growth cell */}
                      <td className="py-1.5 px-2 text-right font-mono text-[10px] text-muted-foreground/60">
                        {getGrowthDisplay(rowDef)}
                      </td>

                      {/* T12 cell */}
                      <td className="py-1.5 px-2 text-right font-mono text-xs text-muted-foreground bg-white/[0.02]">
                        {T12_KEY_MAP[rowDef.key] && t12[T12_KEY_MAP[rowDef.key]] != null
                          ? formatCurrencyAccounting(t12[T12_KEY_MAP[rowDef.key]])
                          : ''}
                      </td>

                      {/* Year cells */}
                      {years.map((yr, yrIdx) => {
                        const colIdx = FIRST_YEAR_COL + yrIdx;
                        const val = yr[rowDef.key as keyof DCFYearResult] as number | null;
                        const cellType = getCellType(rowDef, yrIdx);
                        const isFocused =
                          keyboard.focused?.row === rowIdx &&
                          keyboard.focused?.col === colIdx;
                        const isEditingThis =
                          editingCell?.row === rowIdx &&
                          editingCell?.col === colIdx;
                        const isPopoverOpen =
                          popoverCell?.row === rowIdx &&
                          popoverCell?.col === colIdx;

                        // Non-overridable cells — plain display
                        if (!rowDef.isOverridable) {
                          const isNeg = val != null && val < 0;
                          return (
                            <td
                              key={yrIdx}
                              className={cn(
                                'py-1.5 px-2 text-right font-mono text-xs whitespace-nowrap',
                                rowDef.bold && 'font-semibold',
                                rowDef.isTotal && 'bg-white/[0.03]',
                                isNeg && 'text-red-400/70',
                                !isNeg && 'text-muted-foreground',
                              )}
                            >
                              {val != null
                                ? rowDef.format === 'pct'
                                  ? formatPct(val)
                                  : formatCurrencyAccounting(val)
                                : '—'}
                            </td>
                          );
                        }

                        // Overridable cells — full GridCell with popover
                        const computedVal = getComputedValue(rowDef, yrIdx);
                        const overrideKey = `${rowDef.key}:${yrIdx}`;
                        const currentOverride = overrideKey in overrides ? overrides[overrideKey] : null;

                        const cellElement = (
                          <GridCell
                            value={val}
                            computedValue={computedVal}
                            format={rowDef.format}
                            cellType={cellType}
                            bold={rowDef.bold}
                            isFocused={isFocused}
                            isEditing={isEditingThis}
                            editValue={editValue}
                            onClick={() => handleCellClick(rowIdx, colIdx)}
                            onEditChange={setEditValue}
                            onEditCommit={(v) => {
                              if (v != null) {
                                dispatch({
                                  type: 'SET_OVERRIDE',
                                  scenario,
                                  key: overrideKey,
                                  value: v,
                                });
                              }
                              setEditingCell(null);
                            }}
                            onEditCancel={cancelEdit}
                          />
                        );

                        if (isPopoverOpen && !isEditingThis) {
                          return (
                            <OverridePopover
                              key={yrIdx}
                              open={true}
                              onOpenChange={(open) => {
                                if (!open) setPopoverCell(null);
                              }}
                              computedValue={computedVal}
                              overrideValue={currentOverride}
                              formulaDesc={rowDef.formulaDesc ?? ''}
                              label={`${rowDef.label} — Y${yr.year}`}
                              onApplyOverride={(v) => {
                                dispatch({
                                  type: 'SET_OVERRIDE',
                                  scenario,
                                  key: overrideKey,
                                  value: v,
                                });
                              }}
                              onRemoveOverride={() => {
                                dispatch({
                                  type: 'REMOVE_OVERRIDE',
                                  scenario,
                                  key: overrideKey,
                                });
                              }}
                            >
                              {cellElement}
                            </OverridePopover>
                          );
                        }

                        return (
                          <React.Fragment key={yrIdx}>
                            {cellElement}
                          </React.Fragment>
                        );
                      })}
                    </tr>
                  ))}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Override summary */}
      {Object.keys(overrides).length > 0 && (
        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <span className="inline-block w-3 h-3 rounded bg-[#eeecea]/[0.06] border border-[#eeecea]/10" />
            <span>{Object.keys(overrides).length} cell{Object.keys(overrides).length !== 1 ? 's' : ''} overridden</span>
          </div>
          <button
            onClick={() => dispatch({ type: 'CLEAR_OVERRIDES', scenario })}
            className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            Clear all overrides
          </button>
        </div>
      )}
    </div>
  );
}

// Need React import for JSX fragments
import React from 'react';
