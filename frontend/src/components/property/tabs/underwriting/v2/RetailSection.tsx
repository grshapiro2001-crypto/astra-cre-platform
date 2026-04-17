/**
 * RetailSection — standalone v2 module input form.
 *
 * Fields map 1:1 to backend/underwriting/v2/schemas/retail.py :: RetailInput.
 * Dynamic tenant table (up to 6 tenants recommended; no hard cap enforced).
 */

import { useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { X, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  CurrencyInput,
  NumericInput,
  PercentInput,
  formatCurrency,
  formatNumber,
} from '../uwFormatters';
import type { UWSubPageProps } from '../types';
import type { RetailInput, RetailLeaseType } from '@/types/underwritingV2';
import {
  RETAIL_LEASE_TYPES,
  createDefaultRetailInput,
} from '@/types/underwritingV2';
import {
  EM_DASH,
  EnableToggle,
  FieldRow,
  V2CollapsibleSection,
  PreviewStat,
} from './shared';

type Props = Partial<Pick<UWSubPageProps, 'inputs' | 'dispatch'>>;

// Defense-in-depth: if the reducer slice is missing (e.g. loaded state from a
// model saved before PR #155), fall back to defaults so the section renders
// collapsed and disabled instead of crashing the error boundary.
const noopDispatch: UWSubPageProps['dispatch'] = () => undefined;

export function RetailSection({ inputs, dispatch = noopDispatch }: Props) {
  const retail = inputs?.retail ?? createDefaultRetailInput();
  const tenants = retail.tenants ?? [];

  type RetailScalarKey = Exclude<keyof RetailInput, 'tenants' | 'premium' | 'market'>;
  const setField = useCallback(
    <K extends RetailScalarKey>(field: K, value: RetailInput[K]) => {
      dispatch({ type: 'SET_RETAIL_FIELD', field, value });
    },
    [dispatch],
  );

  const setScenario = useCallback(
    (scenario: 'premium' | 'market', patch: Partial<RetailInput['premium']>) =>
      dispatch({ type: 'SET_RETAIL_SCENARIO', scenario, patch }),
    [dispatch],
  );

  const addTenant = useCallback(
    () => dispatch({ type: 'ADD_RETAIL_TENANT' }),
    [dispatch],
  );

  const removeTenant = useCallback(
    (index: number) => dispatch({ type: 'REMOVE_RETAIL_TENANT', index }),
    [dispatch],
  );

  const { totalSf, wtdAvgRent } = useMemo(() => {
    const total = tenants.reduce((sum, t) => sum + (t.square_feet || 0), 0);
    if (total === 0) return { totalSf: 0, wtdAvgRent: 0 };
    const weighted = tenants.reduce(
      (sum, t) => sum + (t.square_feet || 0) * (t.annual_rent_per_sf || 0),
      0,
    );
    return { totalSf: total, wtdAvgRent: weighted / total };
  }, [tenants]);

  return (
    <V2CollapsibleSection title="Retail Assumptions">
      <EnableToggle
        id="retail-enabled"
        enabled={retail.enabled}
        onChange={(next) => setField('enabled', next)}
      />

      <div
        className={cn(
          'space-y-4 transition-opacity',
          !retail.enabled && 'opacity-40 pointer-events-none select-none',
        )}
        aria-hidden={!retail.enabled}
      >
        {/* Global assumptions */}
        <div className="space-y-1">
          <FieldRow label="Hold Period">
            <NumericInput
              value={retail.hold_period_years}
              onChange={(v) => setField('hold_period_years', v ?? 0)}
              suffix="yr"
              integer
              disabled={!retail.enabled}
            />
          </FieldRow>
          <FieldRow label="Expenses / SF">
            <CurrencyInput
              value={retail.expenses_per_sf || null}
              onChange={(v) => setField('expenses_per_sf', v ?? 0)}
              suffix="/sf"
              disabled={!retail.enabled}
            />
          </FieldRow>
          <FieldRow label="Expense Recovery %">
            <PercentInput
              value={retail.tenant_expense_recovery}
              onChange={(v) => setField('tenant_expense_recovery', v ?? 0)}
              disabled={!retail.enabled}
            />
          </FieldRow>
          <FieldRow label="TI / SF">
            <CurrencyInput
              value={retail.tenant_improvement_per_sf || null}
              onChange={(v) => setField('tenant_improvement_per_sf', v ?? 0)}
              suffix="/sf"
              disabled={!retail.enabled}
            />
          </FieldRow>
          <FieldRow label="Leasing Commission %">
            <PercentInput
              value={retail.leasing_commission_percent}
              onChange={(v) => setField('leasing_commission_percent', v ?? 0)}
              disabled={!retail.enabled}
            />
          </FieldRow>
          <FieldRow label="Capex Recovery %">
            <PercentInput
              value={retail.tenant_capex_recovery}
              onChange={(v) => setField('tenant_capex_recovery', v ?? 0)}
              disabled={!retail.enabled}
            />
          </FieldRow>
          <FieldRow label="Rental Inflation %">
            <PercentInput
              value={retail.rental_inflation}
              onChange={(v) => setField('rental_inflation', v ?? 0)}
              disabled={!retail.enabled}
            />
          </FieldRow>
          <FieldRow label="Structural Vacancy %">
            <PercentInput
              value={retail.structural_vacancy_loss}
              onChange={(v) => setField('structural_vacancy_loss', v ?? 0)}
              disabled={!retail.enabled}
            />
          </FieldRow>
          <FieldRow label="Credit Loss %">
            <PercentInput
              value={retail.credit_loss}
              onChange={(v) => setField('credit_loss', v ?? 0)}
              disabled={!retail.enabled}
            />
          </FieldRow>
          <FieldRow label="Expense Inflation %">
            <PercentInput
              value={retail.expense_inflation}
              onChange={(v) => setField('expense_inflation', v ?? 0)}
              disabled={!retail.enabled}
            />
          </FieldRow>
          <FieldRow label="Transaction Cost %">
            <PercentInput
              value={retail.transaction_cost_percent}
              onChange={(v) => setField('transaction_cost_percent', v ?? 0)}
              disabled={!retail.enabled}
            />
          </FieldRow>
        </div>

        {/* Scenario assumptions */}
        <div className="pt-3 border-t border-white/10">
          <h4 className="text-xs uppercase tracking-wider text-muted-foreground/70 mb-2">
            Scenarios
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <ScenarioCard
              title="Premium"
              discountRate={retail.premium.discount_rate}
              exitCap={retail.premium.exit_cap}
              disabled={!retail.enabled}
              onChange={(patch) => setScenario('premium', patch)}
            />
            <ScenarioCard
              title="Market"
              discountRate={retail.market.discount_rate}
              exitCap={retail.market.exit_cap}
              disabled={!retail.enabled}
              onChange={(patch) => setScenario('market', patch)}
            />
          </div>
        </div>

        {/* Tenant table */}
        <div className="pt-3 border-t border-white/10">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs uppercase tracking-wider text-muted-foreground/70">
              Tenants
            </h4>
            <button
              type="button"
              onClick={addTenant}
              disabled={!retail.enabled}
              className={cn(
                'inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border transition-colors',
                retail.enabled
                  ? 'border-white/20 text-white hover:bg-white/[0.04]'
                  : 'border-white/[0.04] text-muted-foreground cursor-not-allowed',
              )}
            >
              <Plus className="w-3 h-3" /> Add Tenant
            </button>
          </div>

          {tenants.length === 0 ? (
            <p className="text-xs text-muted-foreground italic py-2">
              No tenants added yet. Click "Add Tenant" to begin the rent roll.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-muted-foreground font-normal">
                    <th className="text-left py-2 pr-2 font-normal">Unit #</th>
                    <th className="text-left py-2 pr-2 font-normal">Tenant</th>
                    <th className="text-right py-2 pr-2 font-normal">SF</th>
                    <th className="text-right py-2 pr-2 font-normal">$/SF/yr</th>
                    <th className="text-left py-2 pr-2 font-normal">Lease Start</th>
                    <th className="text-left py-2 pr-2 font-normal">Lease Exp.</th>
                    <th className="text-left py-2 pr-2 font-normal">Type</th>
                    <th className="text-right py-2 pr-2 font-normal">Absorp. mo</th>
                    <th className="py-2 w-6" />
                  </tr>
                </thead>
                <tbody>
                  {tenants.map((t, idx) => (
                    <tr key={idx} className="border-b border-white/[0.04]">
                      <td className="py-1.5 pr-2">
                        <NumericInput
                          value={t.unit_number}
                          onChange={(v) =>
                            dispatch({
                              type: 'SET_RETAIL_TENANT',
                              index: idx,
                              patch: { unit_number: v ?? 0 },
                            })
                          }
                          integer
                          className="w-16"
                          disabled={!retail.enabled}
                        />
                      </td>
                      <td className="py-1.5 pr-2">
                        <Input
                          type="text"
                          value={t.tenant_name ?? ''}
                          onChange={(e) =>
                            dispatch({
                              type: 'SET_RETAIL_TENANT',
                              index: idx,
                              patch: { tenant_name: e.target.value || null },
                            })
                          }
                          placeholder="Tenant / Vacant"
                          disabled={!retail.enabled}
                          className="h-8 text-xs w-32"
                        />
                      </td>
                      <td className="py-1.5 pr-2">
                        <NumericInput
                          value={t.square_feet || null}
                          onChange={(v) =>
                            dispatch({
                              type: 'SET_RETAIL_TENANT',
                              index: idx,
                              patch: { square_feet: v ?? 0 },
                            })
                          }
                          integer
                          className="w-20"
                          disabled={!retail.enabled}
                        />
                      </td>
                      <td className="py-1.5 pr-2">
                        <CurrencyInput
                          value={t.annual_rent_per_sf || null}
                          onChange={(v) =>
                            dispatch({
                              type: 'SET_RETAIL_TENANT',
                              index: idx,
                              patch: { annual_rent_per_sf: v ?? 0 },
                            })
                          }
                          className="w-20"
                          disabled={!retail.enabled}
                        />
                      </td>
                      <td className="py-1.5 pr-2">
                        <Input
                          type="date"
                          value={t.lease_start_date ?? ''}
                          onChange={(e) =>
                            dispatch({
                              type: 'SET_RETAIL_TENANT',
                              index: idx,
                              patch: { lease_start_date: e.target.value || null },
                            })
                          }
                          disabled={!retail.enabled}
                          className="h-8 text-xs w-32"
                        />
                      </td>
                      <td className="py-1.5 pr-2">
                        <Input
                          type="date"
                          value={t.lease_expiration_date ?? ''}
                          onChange={(e) =>
                            dispatch({
                              type: 'SET_RETAIL_TENANT',
                              index: idx,
                              patch: { lease_expiration_date: e.target.value || null },
                            })
                          }
                          disabled={!retail.enabled}
                          className="h-8 text-xs w-32"
                        />
                      </td>
                      <td className="py-1.5 pr-2">
                        <select
                          value={t.lease_type ?? ''}
                          onChange={(e) =>
                            dispatch({
                              type: 'SET_RETAIL_TENANT',
                              index: idx,
                              patch: { lease_type: (e.target.value || null) as RetailLeaseType | null },
                            })
                          }
                          disabled={!retail.enabled}
                          aria-label={`Lease type for tenant ${idx + 1}`}
                          className="h-8 px-2 rounded-md border border-white/10 bg-white/[0.03] text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-white/20 disabled:opacity-50"
                        >
                          <option value="">—</option>
                          {RETAIL_LEASE_TYPES.map((lt) => (
                            <option key={lt} value={lt}>
                              {lt}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-1.5 pr-2">
                        <NumericInput
                          value={t.absorption_months || null}
                          onChange={(v) =>
                            dispatch({
                              type: 'SET_RETAIL_TENANT',
                              index: idx,
                              patch: { absorption_months: v ?? 0 },
                            })
                          }
                          integer
                          className="w-16"
                          disabled={!retail.enabled}
                        />
                      </td>
                      <td className="py-1.5">
                        <button
                          type="button"
                          onClick={() => removeTenant(idx)}
                          disabled={!retail.enabled}
                          aria-label={`Remove tenant ${idx + 1}`}
                          className={cn(
                            'p-1 rounded-md transition-colors',
                            retail.enabled
                              ? 'text-muted-foreground hover:text-foreground hover:bg-white/[0.04]'
                              : 'text-muted-foreground/40 cursor-not-allowed',
                          )}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="flex gap-6 pt-3 border-t border-white/10">
          <PreviewStat
            label="Total SF"
            value={totalSf > 0 ? formatNumber(totalSf) : EM_DASH}
          />
          <PreviewStat
            label="Wtd. Avg Rent / SF"
            value={wtdAvgRent > 0 ? `${formatCurrency(wtdAvgRent)}/sf` : EM_DASH}
          />
          <PreviewStat
            label="Tenant Count"
            value={tenants.length > 0 ? String(tenants.length) : EM_DASH}
          />
        </div>
      </div>
    </V2CollapsibleSection>
  );
}

function ScenarioCard({
  title,
  discountRate,
  exitCap,
  disabled,
  onChange,
}: {
  title: string;
  discountRate: number;
  exitCap: number;
  disabled: boolean;
  onChange: (patch: { discount_rate?: number; exit_cap?: number }) => void;
}) {
  return (
    <div className="glass rounded-lg p-3 space-y-1">
      <p className="text-xs font-semibold text-foreground mb-1">{title}</p>
      <FieldRow label="Discount Rate %">
        <PercentInput
          value={discountRate}
          onChange={(v) => onChange({ discount_rate: v ?? 0 })}
          disabled={disabled}
        />
      </FieldRow>
      <FieldRow label="Exit Cap %">
        <PercentInput
          value={exitCap}
          onChange={(v) => onChange({ exit_cap: v ?? 0 })}
          disabled={disabled}
        />
      </FieldRow>
    </div>
  );
}
