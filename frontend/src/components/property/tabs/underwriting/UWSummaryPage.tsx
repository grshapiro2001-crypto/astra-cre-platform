/**
 * UWSummaryPage — Valuation Summary ("answer page").
 * Shows pricing mode selector and side-by-side Premium / Market cards.
 */

import { useCallback } from 'react';
import { GLASS_CARD, STAT_BOX, SECTION_LABEL } from '../tabUtils';
import { cn } from '@/lib/utils';
import {
  formatCurrency,
  formatPct,
  formatMultiple,
  CurrencyInput,
  PercentInput,
} from './uwFormatters';
import type { UWSubPageProps } from './types';

// ---------------------------------------------------------------------------
// Metric display helpers
// ---------------------------------------------------------------------------

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-mono text-sm text-foreground">{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Scenario Card
// ---------------------------------------------------------------------------

function ScenarioCard({
  scenario,
  label,
  inputs,
  outputs,
  dispatch,
}: {
  scenario: 'premium' | 'market';
  label: string;
  inputs: UWSubPageProps['inputs'];
  outputs: UWSubPageProps['outputs'];
  dispatch: UWSubPageProps['dispatch'];
}) {
  const scenarioInputs = inputs[scenario];
  const scenarioResult = outputs?.scenarios?.[scenario];
  const vs = scenarioResult?.valuation_summary;
  const debt = scenarioResult?.debt;
  const returns = scenarioResult?.returns;
  const pricingMode = scenarioInputs.pricing_mode;

  const updateScenario = useCallback(
    (patch: Record<string, unknown>) => {
      dispatch({ type: 'SET_SCENARIO_INPUT', scenario, payload: patch });
    },
    [dispatch, scenario],
  );

  return (
    <div className={cn(GLASS_CARD, 'space-y-5')}>
      {/* Header */}
      <h3 className="font-display text-base font-bold text-foreground">{label}</h3>

      {/* Primary input based on pricing mode */}
      <div className="space-y-3">
        {pricingMode === 'target_irr' && (
          <div>
            <label className={SECTION_LABEL}>Target Unlevered IRR</label>
            <PercentInput
              value={scenarioInputs.target_unlevered_irr ?? null}
              onChange={(v) => updateScenario({ target_unlevered_irr: v })}
              className="mt-1"
            />
          </div>
        )}
        {pricingMode === 'direct_cap' && (
          <div>
            <label className={SECTION_LABEL}>Target Cap Rate</label>
            <PercentInput
              value={scenarioInputs.target_cap_rate ?? null}
              onChange={(v) => updateScenario({ target_cap_rate: v })}
              className="mt-1"
            />
          </div>
        )}
        {pricingMode === 'manual' && (
          <div>
            <label className={SECTION_LABEL}>Purchase Price</label>
            <CurrencyInput
              value={scenarioInputs.purchase_price || null}
              onChange={(v) => updateScenario({ purchase_price: v ?? 0 })}
              className="mt-1"
            />
          </div>
        )}

        <div>
          <label className={SECTION_LABEL}>Terminal Cap Rate</label>
          <PercentInput
            value={scenarioInputs.terminal_cap_rate}
            onChange={(v) => updateScenario({ terminal_cap_rate: v ?? 0 })}
            className="mt-1"
          />
        </div>
      </div>

      {/* Resolved Purchase Price */}
      <div className={cn(STAT_BOX, 'space-y-1')}>
        <span className={SECTION_LABEL}>Purchase Price</span>
        <p className="font-display text-2xl font-bold text-foreground">
          {formatCurrency(vs?.purchase_price)}
        </p>
        <div className="flex gap-4 text-xs text-muted-foreground font-mono">
          <span>{formatCurrency(vs?.price_per_unit)}/unit</span>
          <span>{vs?.price_per_sf != null ? `$${vs.price_per_sf.toFixed(0)}/SF` : '—'}</span>
        </div>
      </div>

      {/* Cap Rates */}
      <div className="space-y-1">
        <h4 className={SECTION_LABEL}>Cap Rates</h4>
        <div className="border-t border-border/40">
          <MetricRow label="Y1 Cap Rate" value={formatPct(vs?.cap_rates?.y1_cap_rate)} />
          <MetricRow label="Terminal Cap" value={formatPct(vs?.cap_rates?.terminal_cap_rate)} />
        </div>
      </div>

      {/* Return Metrics */}
      <div className="space-y-1">
        <h4 className={SECTION_LABEL}>Returns</h4>
        <div className="border-t border-border/40">
          <MetricRow label="Leveraged IRR" value={formatPct(returns?.levered_irr)} />
          <MetricRow label="Unlevered IRR" value={formatPct(returns?.unlevered_irr)} />
          <MetricRow label="Y1 Cash-on-Cash" value={formatPct(returns?.y1_cash_on_cash)} />
          <MetricRow label="Avg Cash-on-Cash" value={formatPct(returns?.avg_cash_on_cash)} />
          <MetricRow label="Equity Multiple" value={formatMultiple(returns?.equity_multiple)} />
        </div>
      </div>

      {/* Debt */}
      <div className="space-y-1">
        <h4 className={SECTION_LABEL}>Debt</h4>
        <div className="border-t border-border/40">
          <MetricRow label="LTV" value={formatPct(vs?.ltv)} />
          <MetricRow label="Loan Amount" value={formatCurrency(debt?.loan_amount)} />
          <MetricRow label="Equity" value={formatCurrency(debt?.equity)} />
          <MetricRow
            label="Y1 DSCR"
            value={
              debt?.loan_amount && debt?.annual_debt_service?.[0]
                ? formatMultiple(
                    (outputs?.scenarios?.[scenario]?.proforma?.noi ?? 0) /
                      debt.annual_debt_service[0],
                  )
                : '—'
            }
          />
        </div>
      </div>

      {/* Terminal Value */}
      <div className="space-y-1">
        <h4 className={SECTION_LABEL}>Reversion</h4>
        <div className="border-t border-border/40">
          <MetricRow
            label="Terminal Value"
            value={formatCurrency(returns?.reversion?.gross_selling_price)}
          />
          <MetricRow
            label="Terminal $/Unit"
            value={formatCurrency(vs?.terminal_value_per_unit)}
          />
        </div>
      </div>

      {/* CAGRs */}
      <div className="space-y-1">
        <h4 className={SECTION_LABEL}>Growth</h4>
        <div className="border-t border-border/40">
          <MetricRow label="Revenue CAGR" value={formatPct(vs?.revenue_cagr)} />
          <MetricRow label="NOI CAGR" value={formatPct(vs?.noi_cagr)} />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// UWSummaryPage
// ---------------------------------------------------------------------------

export function UWSummaryPage({ inputs, outputs, dispatch, isComputing }: UWSubPageProps) {
  // Both scenarios share the same pricing mode
  const pricingMode = inputs.premium.pricing_mode;

  const setPricingMode = useCallback(
    (mode: 'target_irr' | 'direct_cap' | 'manual') => {
      dispatch({ type: 'SET_SCENARIO_INPUT', scenario: 'premium', payload: { pricing_mode: mode } });
      dispatch({ type: 'SET_SCENARIO_INPUT', scenario: 'market', payload: { pricing_mode: mode } });
    },
    [dispatch],
  );

  return (
    <div className="space-y-6">
      {/* Computing indicator */}
      {isComputing && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          Computing...
        </div>
      )}

      {/* Pricing Mode Selector */}
      <div className="flex items-center gap-2">
        <span className={cn(SECTION_LABEL, 'mr-2')}>Pricing Mode</span>
        <div className="flex items-center rounded-lg p-1 bg-muted/50">
          {(['target_irr', 'direct_cap', 'manual'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setPricingMode(mode)}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                pricingMode === mode
                  ? 'bg-accent text-primary'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {mode === 'target_irr' ? 'Target IRR' : mode === 'direct_cap' ? 'Direct Cap' : 'Manual Price'}
            </button>
          ))}
        </div>
      </div>

      {/* Side-by-side scenario cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ScenarioCard
          scenario="premium"
          label="Premium"
          inputs={inputs}
          outputs={outputs}
          dispatch={dispatch}
        />
        <ScenarioCard
          scenario="market"
          label="Market"
          inputs={inputs}
          outputs={outputs}
          dispatch={dispatch}
        />
      </div>
    </div>
  );
}
