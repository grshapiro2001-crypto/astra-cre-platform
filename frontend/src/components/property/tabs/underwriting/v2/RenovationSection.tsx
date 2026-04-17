/**
 * RenovationSection — standalone v2 module input form.
 *
 * Fields map 1:1 to backend/underwriting/v2/schemas/renovation.py :: RenovationInput.
 * Fixed 5-row unit-type grid (Studio, 1BR, 2BR, 3BR, 4BR). Rows with zero
 * units-to-renovate render at reduced opacity (visual hint, still editable).
 *
 * Growth rates: a single "Incremental Rent Growth %" input is expanded to
 * an 11-year array behind the scenes. TODO: once the Valuation assumptions
 * store exposes per-year growth curves, source from there instead.
 */

import { useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';
import {
  CurrencyInput,
  NumericInput,
  PercentInput,
  formatCurrency,
  formatNumber,
  formatPct,
} from '../uwFormatters';
import type { UWSubPageProps } from '../types';
import type { RenovationInput } from '@/types/underwritingV2';
import { RENOVATION_UNIT_TYPE_LABELS } from '@/types/underwritingV2';
import {
  EM_DASH,
  EnableToggle,
  FieldRow,
  V2CollapsibleSection,
  PreviewStat,
} from './shared';

type Props = Pick<UWSubPageProps, 'inputs' | 'dispatch'>;

const YEAR_OPTIONS = [1, 2, 3, 4, 5];

export function RenovationSection({ inputs, dispatch }: Props) {
  const reno = inputs.renovation;

  const setField = useCallback(
    <K extends Exclude<keyof RenovationInput, 'unit_types'>>(
      field: K,
      value: RenovationInput[K],
    ) => dispatch({ type: 'SET_RENOVATION_FIELD', field, value }),
    [dispatch],
  );

  const growthSingle = reno.incremental_rent_growth_rates[0] ?? 0;
  const setGrowth = useCallback(
    (v: number) =>
      setField('incremental_rent_growth_rates', Array(11).fill(v)),
    [setField],
  );

  // Computed preview: total units, total cost, weighted avg premium, RoC.
  const { totalUnits, totalCost, wtdAvgPremium, impliedRoC } = useMemo(() => {
    const units = reno.unit_types.reduce(
      (sum, u) => sum + (u.units_to_renovate || 0),
      0,
    );
    const cost = units * (reno.cost_per_unit || 0);
    if (units === 0) {
      return { totalUnits: 0, totalCost: 0, wtdAvgPremium: 0, impliedRoC: 0 };
    }
    const weighted = reno.unit_types.reduce(
      (sum, u) =>
        sum + (u.units_to_renovate || 0) * (u.rent_premium_per_month || 0),
      0,
    );
    const avg = weighted / units;
    const roc = reno.cost_per_unit > 0 ? (avg * 12) / reno.cost_per_unit : 0;
    return {
      totalUnits: units,
      totalCost: cost,
      wtdAvgPremium: avg,
      impliedRoC: roc,
    };
  }, [reno.unit_types, reno.cost_per_unit]);

  return (
    <V2CollapsibleSection title="Renovation Assumptions">
      <EnableToggle
        id="renovation-enabled"
        enabled={reno.enabled}
        onChange={(next) => setField('enabled', next)}
      />

      <div
        className={cn(
          'space-y-4 transition-opacity',
          !reno.enabled && 'opacity-40 pointer-events-none select-none',
        )}
        aria-hidden={!reno.enabled}
      >
        {/* Global inputs */}
        <div className="space-y-1">
          <div className="flex items-center gap-3 py-2">
            <label
              htmlFor="reno-start-year"
              className="text-xs text-muted-foreground w-40 shrink-0"
            >
              Start Year
            </label>
            <select
              id="reno-start-year"
              value={reno.start_year}
              onChange={(e) => setField('start_year', Number(e.target.value))}
              disabled={!reno.enabled}
              className="w-36 h-8 px-2 rounded-md border border-white/10 bg-white/[0.03] text-foreground text-xs font-mono focus:outline-none focus:ring-1 focus:ring-white/20 disabled:opacity-50"
            >
              {YEAR_OPTIONS.map((y) => (
                <option key={y} value={y}>
                  Y{y}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-3 py-2">
            <label
              htmlFor="reno-duration"
              className="text-xs text-muted-foreground w-40 shrink-0"
            >
              Duration Years
            </label>
            <select
              id="reno-duration"
              value={reno.duration_years}
              onChange={(e) => setField('duration_years', Number(e.target.value))}
              disabled={!reno.enabled}
              className="w-36 h-8 px-2 rounded-md border border-white/10 bg-white/[0.03] text-foreground text-xs font-mono focus:outline-none focus:ring-1 focus:ring-white/20 disabled:opacity-50"
            >
              {YEAR_OPTIONS.map((y) => (
                <option key={y} value={y}>
                  {y} yr
                </option>
              ))}
            </select>
          </div>
          <FieldRow label="Cost per Unit">
            <CurrencyInput
              value={reno.cost_per_unit || null}
              onChange={(v) => setField('cost_per_unit', v ?? 0)}
              disabled={!reno.enabled}
            />
          </FieldRow>
          <FieldRow label="Downtime Months">
            <NumericInput
              value={reno.downtime_months_per_unit}
              onChange={(v) => setField('downtime_months_per_unit', v ?? 0)}
              suffix="mo"
              integer
              disabled={!reno.enabled}
            />
          </FieldRow>
          <FieldRow
            label="Growth Rate %"
            hint="applied to all 11 years"
          >
            <PercentInput
              value={growthSingle}
              onChange={(v) => setGrowth(v ?? 0)}
              disabled={!reno.enabled}
            />
          </FieldRow>
          <div className="flex items-center gap-3 py-2">
            <span className="text-xs text-muted-foreground w-40 shrink-0">
              Finance with Loan
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={reno.finance_with_loan}
              onClick={() =>
                setField('finance_with_loan', !reno.finance_with_loan)
              }
              disabled={!reno.enabled}
              className={cn(
                'w-10 h-5 rounded-full transition-colors relative focus:outline-none focus:ring-1 focus:ring-white/20',
                reno.finance_with_loan ? 'bg-white' : 'bg-white/10',
                !reno.enabled && 'opacity-50',
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 w-4 h-4 rounded-full transition-transform',
                  reno.finance_with_loan
                    ? 'bg-[#060608] translate-x-5'
                    : 'bg-white translate-x-0.5',
                )}
              />
            </button>
          </div>
        </div>

        {/* Unit type grid */}
        <div className="pt-3 border-t border-white/10">
          <h4 className="text-xs uppercase tracking-wider text-muted-foreground/70 mb-2">
            Unit Types
          </h4>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/10 text-muted-foreground font-normal">
                <th className="text-left py-2 pr-2 font-normal w-24">Type</th>
                <th className="text-right py-2 pr-2 font-normal">
                  Units to Renovate
                </th>
                <th className="text-right py-2 pr-2 font-normal">
                  Rent Premium $/mo
                </th>
              </tr>
            </thead>
            <tbody>
              {RENOVATION_UNIT_TYPE_LABELS.map((label, i) => {
                const row = reno.unit_types[i];
                if (!row) return null;
                const empty = (row.units_to_renovate || 0) === 0;
                return (
                  <tr
                    key={label}
                    className={cn(
                      'border-b border-white/[0.04] transition-opacity',
                      empty && 'opacity-50',
                    )}
                  >
                    <td className="py-1.5 pr-2 text-muted-foreground">{label}</td>
                    <td className="py-1.5 pr-2">
                      <NumericInput
                        value={row.units_to_renovate || null}
                        onChange={(v) =>
                          dispatch({
                            type: 'SET_RENOVATION_UNIT_TYPE',
                            index: i,
                            patch: { units_to_renovate: v ?? 0 },
                          })
                        }
                        integer
                        disabled={!reno.enabled}
                        className="w-24"
                      />
                    </td>
                    <td className="py-1.5 pr-2">
                      <CurrencyInput
                        value={row.rent_premium_per_month || null}
                        onChange={(v) =>
                          dispatch({
                            type: 'SET_RENOVATION_UNIT_TYPE',
                            index: i,
                            patch: { rent_premium_per_month: v ?? 0 },
                          })
                        }
                        suffix="/mo"
                        disabled={!reno.enabled}
                        className="w-32"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Computed preview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-3 border-t border-white/10">
          <PreviewStat
            label="Total Units Renovated"
            value={totalUnits > 0 ? formatNumber(totalUnits) : EM_DASH}
          />
          <PreviewStat
            label="Total Renovation Cost"
            value={totalCost > 0 ? formatCurrency(totalCost) : EM_DASH}
          />
          <PreviewStat
            label="Wtd. Avg Rent Premium"
            value={
              wtdAvgPremium > 0
                ? `${formatCurrency(wtdAvgPremium)}/mo`
                : EM_DASH
            }
          />
          <PreviewStat
            label="Implied Return on Cost"
            value={impliedRoC > 0 ? formatPct(impliedRoC) : EM_DASH}
          />
        </div>
      </div>
    </V2CollapsibleSection>
  );
}
