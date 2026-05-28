/**
 * UWPartnershipReturnsPage — read-only Partnership / Returns summary.
 * Surfaces the per-scenario equity waterfall (LP/GP IRR, LP equity multiple,
 * total promote, and the per-tier distribution schedule) computed on the
 * backend. View-only: the scenario toggle switches which scenario is shown but
 * never mutates inputs.
 */

import { useState } from 'react';
import { GLASS_CARD, STAT_BOX, SECTION_LABEL } from '../tabUtils';
import { cn } from '@/lib/utils';
import { formatCurrency, formatPct, formatMultiple } from './uwFormatters';
import type { UWSubPageProps } from './types';

const TIER_LABELS: Record<string, string> = {
  return_of_capital: 'Return of Capital',
  preferred_return: 'Preferred Return',
  gp_catch_up: 'GP Catch-Up',
  tier_1_split: 'Tier 1 Split',
  tier_2_split: 'Tier 2 Split',
};

function tierLabel(tier: string): string {
  return (
    TIER_LABELS[tier] ??
    tier
      .split('_')
      .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
      .join(' ')
  );
}

/** Treat non-finite IRRs (backend may emit -Infinity when undefined) as missing. */
function finiteOrNull(v: number | null | undefined): number | null {
  return v != null && Number.isFinite(v) ? v : null;
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className={cn(STAT_BOX, 'space-y-1')}>
      <span className={SECTION_LABEL}>{label}</span>
      <p className="font-display text-2xl font-bold text-foreground">{value}</p>
    </div>
  );
}

export function UWPartnershipReturnsPage({ outputs, isComputing }: UWSubPageProps) {
  const [scenario, setScenario] = useState<'premium' | 'market'>('premium');
  const wf = outputs?.scenarios?.[scenario]?.waterfall ?? null;
  const tiers = wf?.tier_schedule ?? [];

  return (
    <div className="space-y-6">
      {/* Computing indicator */}
      {isComputing && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
          Computing...
        </div>
      )}

      {/* Scenario selector (view-only) */}
      <div className="flex items-center gap-2">
        <span className={cn(SECTION_LABEL, 'mr-2')}>Scenario</span>
        <div className="flex items-center rounded-lg p-1 bg-white/[0.04]">
          {(['premium', 'market'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setScenario(s)}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                scenario === s
                  ? 'bg-white/[0.08] text-white'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {s === 'premium' ? 'Premium' : 'Market'}
            </button>
          ))}
        </div>
      </div>

      <div className={cn(GLASS_CARD, 'space-y-6')}>
        <h3 className="font-display text-base font-bold text-foreground">
          Partnership / Returns
        </h3>

        {/* KPI stat boxes */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatBox label="LP IRR" value={formatPct(finiteOrNull(wf?.lp_irr))} />
          <StatBox
            label="LP Equity Multiple"
            value={formatMultiple(wf?.lp_equity_multiple)}
          />
          <StatBox label="GP IRR" value={formatPct(finiteOrNull(wf?.gp_irr))} />
          <StatBox
            label="Total Promote"
            value={formatCurrency(wf?.total_promote)}
          />
        </div>

        {/* Per-tier distribution schedule */}
        <div className="space-y-2">
          <h4 className={SECTION_LABEL}>Distribution Schedule</h4>
          <div className="overflow-x-auto border-t border-white/10">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Year</th>
                  <th className="py-2 pr-4 font-medium">Tier</th>
                  <th className="py-2 pr-4 font-medium text-right">Cash In</th>
                  <th className="py-2 pr-4 font-medium text-right">LP $</th>
                  <th className="py-2 pr-4 font-medium text-right">GP $</th>
                  <th className="py-2 font-medium text-right">Cash Out</th>
                </tr>
              </thead>
              <tbody>
                {tiers.length === 0 ? (
                  <tr className="border-t border-white/5">
                    <td
                      colSpan={6}
                      className="py-6 text-center text-muted-foreground"
                    >
                      —
                    </td>
                  </tr>
                ) : (
                  tiers.map((t, i) => (
                    <tr
                      key={`${t.year}-${t.tier}-${i}`}
                      className="border-t border-white/5"
                    >
                      <td className="py-1.5 pr-4 font-mono text-foreground">
                        {t.year}
                      </td>
                      <td className="py-1.5 pr-4 text-foreground">
                        {tierLabel(t.tier)}
                      </td>
                      <td className="py-1.5 pr-4 font-mono text-right text-foreground">
                        {formatCurrency(t.cash_in)}
                      </td>
                      <td className="py-1.5 pr-4 font-mono text-right text-foreground">
                        {formatCurrency(t.lp_amount)}
                      </td>
                      <td className="py-1.5 pr-4 font-mono text-right text-foreground">
                        {formatCurrency(t.gp_amount)}
                      </td>
                      <td className="py-1.5 font-mono text-right text-foreground">
                        {formatCurrency(t.cash_out)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* LPA disclaimer */}
        <p className="text-[10px] text-muted-foreground/70">
          Modeling tool only — actual distributions are governed by the
          partnership agreement (LPA).
        </p>
      </div>
    </div>
  );
}
