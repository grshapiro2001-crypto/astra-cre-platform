/**
 * UnderwritingTab — Pricing analysis, quick underwriting, renovation assumptions.
 */

import { useMemo } from 'react';
import {
  Receipt,
  TrendingUp,
  CheckCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PropertyDetail } from '@/types/property';
import type { BOVPricingTier } from '@/types/property';
import {
  fmtCurrency,
  getFinancials,
  GLASS_CARD,
  type FinancialPeriodKey,
} from './tabUtils';
import { fmtPercent, fmtCapRate } from '@/utils/formatUtils';
import { SensitivityAnalysis } from '@/components/property/SensitivityAnalysis';

interface UnderwritingTabProps {
  property: PropertyDetail;
  financialPeriod: FinancialPeriodKey;
  selectedTierIdx: number;
  setSelectedTierIdx: (i: number) => void;
  capRateSlider: number;
  setCapRateSlider: (v: number) => void;
  pricingGuidance: number;
  setPricingGuidance: (v: number) => void;
  isSavingGuidance: boolean;
  guidanceSaved: boolean;
  savedGuidanceValue: number;
  onSaveGuidance: () => void;
}

export function UnderwritingTab({
  property,
  financialPeriod,
  selectedTierIdx,
  setSelectedTierIdx,
  capRateSlider,
  setCapRateSlider,
  pricingGuidance,
  setPricingGuidance,
  isSavingGuidance,
  guidanceSaved,
  savedGuidanceValue,
  onSaveGuidance,
}: UnderwritingTabProps) {
  const totalUnits = property.total_units ?? 0;
  const totalSF = property.total_residential_sf ?? 0;

  const bovTiers: BOVPricingTier[] = property.bov_pricing_tiers ?? [];
  const hasBOV = bovTiers.length > 0;
  const selectedTier: BOVPricingTier | null = hasBOV
    ? bovTiers[selectedTierIdx] ?? bovTiers[0]
    : null;

  const currentFinancials = getFinancials(property, financialPeriod);

  // Pricing metrics (OM guidance path)
  const pricingMetrics = useMemo(() => {
    if (pricingGuidance <= 0 || !property) return null;
    const t3Income = property.t3_financials?.gsr
      ? (property.t3_financials.gsr
        - Math.abs(property.t3_financials.vacancy ?? 0)
        - Math.abs(property.t3_financials.concessions ?? 0)
        - Math.abs(property.t3_financials.loss_to_lease ?? 0)
        - Math.abs(property.t3_financials.bad_debt ?? 0)
        - Math.abs(property.t3_financials.non_revenue_units ?? 0)
        + (property.t3_financials.utility_reimbursements ?? 0)
        + (property.t3_financials.parking_storage_income ?? 0)
        + (property.t3_financials.other_income ?? 0))
      : null;
    const t12Expenses = property.t12_financials?.total_opex ?? null;
    let goingInNoi: number | null = null;
    let goingInLabel = 'Going-In Cap (T3)';
    if (t3Income != null && t12Expenses != null) {
      goingInNoi = t3Income - Math.abs(t12Expenses);
    } else {
      goingInNoi = property.t3_financials?.noi ?? property.t3_noi ?? null;
    }
    const y1Noi = property.y1_financials?.noi ?? property.y1_noi;
    return {
      goingInCap: goingInNoi != null ? ((goingInNoi / pricingGuidance) * 100).toFixed(2) : '---',
      goingInLabel,
      goingInNoi,
      y1Cap: y1Noi != null ? ((y1Noi / pricingGuidance) * 100).toFixed(2) : '---',
      pricePerUnit: totalUnits > 0 ? Math.round(pricingGuidance / totalUnits) : 0,
      pricePerSF: totalSF > 0 ? Math.round(pricingGuidance / totalSF) : 0,
    };
  }, [pricingGuidance, property, totalUnits, totalSF]);

  const derivedPrice = useMemo(() => {
    const noi = pricingMetrics?.goingInNoi ?? currentFinancials?.noi;
    if (noi == null || capRateSlider === 0) return 0;
    return Math.round(noi / (capRateSlider / 100));
  }, [currentFinancials, capRateSlider, pricingMetrics]);

  const hasRenovation = (
    property.renovation_cost_per_unit != null ||
    property.renovation_total_cost != null ||
    property.renovation_rent_premium != null ||
    property.renovation_roi_pct != null
  );

  const showPricing = hasBOV || currentFinancials?.noi != null;

  return (
    <div className="space-y-6">
      {/* ─── Pricing Analysis ─── */}
      {showPricing && (
        <>
          <div className="flex items-center justify-between mb-0">
            <h2 className="font-display text-lg font-bold text-foreground">Pricing Analysis</h2>
            {hasBOV && bovTiers.length > 1 && (
              <div className="flex items-center rounded-xl p-1 bg-muted">
                {bovTiers.map((tier, idx) => (
                  <button
                    key={tier.pricing_tier_id}
                    onClick={() => setSelectedTierIdx(idx)}
                    className={cn(
                      'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                      selectedTierIdx === idx ? 'bg-accent text-primary' : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {tier.tier_label || `Tier ${idx + 1}`}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className={GLASS_CARD}>
            {hasBOV && selectedTier ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* BOV metrics */}
                <div>
                  {selectedTier.pricing != null && (
                    <div className="flex items-baseline gap-2 mb-6">
                      <span className="font-mono text-4xl font-bold text-foreground">{fmtCurrency(selectedTier.pricing, true)}</span>
                      <span className="text-sm text-muted-foreground">{selectedTier.tier_label || 'Pricing'}</span>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    {selectedTier.cap_rates.map((cr, idx) => (
                      <div key={idx} className="p-3 rounded-xl bg-accent">
                        <p className="text-xs text-muted-foreground">{cr.cap_rate_type === 'Unknown' ? 'Cap Rate' : cr.cap_rate_type}</p>
                        <p className="font-mono text-lg font-semibold text-primary">{fmtCapRate(cr.cap_rate_value)}</p>
                      </div>
                    ))}
                    {selectedTier.price_per_unit != null && (
                      <div className="p-3 rounded-xl bg-muted">
                        <p className="text-xs text-muted-foreground">$/Unit</p>
                        <p className="font-mono text-lg font-semibold text-foreground">{fmtCurrency(selectedTier.price_per_unit, true)}</p>
                      </div>
                    )}
                    {selectedTier.price_per_sf != null && (
                      <div className="p-3 rounded-xl bg-muted">
                        <p className="text-xs text-muted-foreground">$/SF</p>
                        <p className="font-mono text-lg font-semibold text-foreground">${selectedTier.price_per_sf.toFixed(0)}</p>
                      </div>
                    )}
                    {selectedTier.return_metrics?.avg_cash_on_cash != null && (
                      <div className="p-3 rounded-xl bg-muted">
                        <p className="text-xs text-muted-foreground">Cash-on-Cash</p>
                        <p className="font-mono text-lg font-semibold text-foreground">{fmtPercent(selectedTier.return_metrics.avg_cash_on_cash)}</p>
                      </div>
                    )}
                    {selectedTier.return_metrics?.levered_irr != null && (
                      <div className="p-3 rounded-xl bg-accent">
                        <p className="text-xs text-muted-foreground">Levered IRR</p>
                        <p className="font-mono text-lg font-semibold text-primary">{fmtPercent(selectedTier.return_metrics.levered_irr)}</p>
                      </div>
                    )}
                    {selectedTier.return_metrics?.unlevered_irr != null && (
                      <div className="p-3 rounded-xl bg-muted">
                        <p className="text-xs text-muted-foreground">Unlevered IRR</p>
                        <p className="font-mono text-lg font-semibold text-foreground">{fmtPercent(selectedTier.return_metrics.unlevered_irr)}</p>
                      </div>
                    )}
                    {selectedTier.return_metrics?.equity_multiple != null && (
                      <div className="p-3 rounded-xl bg-muted">
                        <p className="text-xs text-muted-foreground">Equity Multiple</p>
                        <p className="font-mono text-lg font-semibold text-foreground">{selectedTier.return_metrics.equity_multiple}x</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Sensitivity slider */}
                <div className="p-5 rounded-xl bg-muted">
                  <h4 className="font-semibold mb-4 text-foreground">Cap Rate Sensitivity</h4>
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground">Adjust Cap Rate</span>
                      <span className="font-mono text-lg font-bold text-primary">{capRateSlider.toFixed(2)}%</span>
                    </div>
                    <input type="range" min="3.5" max="7" step="0.05" value={capRateSlider} onChange={(e) => setCapRateSlider(parseFloat(e.target.value))} className="w-full accent-primary cursor-pointer" />
                    <div className="flex justify-between text-xs mt-1 text-muted-foreground"><span>3.50%</span><span>7.00%</span></div>
                  </div>
                  <div className="p-4 rounded-xl bg-card border border-border">
                    <p className="text-xs mb-1 text-muted-foreground">Implied Price at {capRateSlider.toFixed(2)}% Cap</p>
                    {derivedPrice > 0 ? (
                      <>
                        <p className="font-mono text-2xl font-bold text-foreground">{fmtCurrency(derivedPrice, true)}</p>
                        {selectedTier.pricing != null && (
                          <p className="text-sm mt-2">
                            {derivedPrice > selectedTier.pricing ? (
                              <span className="text-emerald-600 dark:text-emerald-400">+{fmtCurrency(derivedPrice - selectedTier.pricing, true)} above {selectedTier.tier_label || 'asking'}</span>
                            ) : (
                              <span className="text-rose-600 dark:text-rose-400">{fmtCurrency(derivedPrice - selectedTier.pricing, true)} below {selectedTier.tier_label || 'asking'}</span>
                            )}
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground mt-1">N/A — NOI is negative for this period. Try switching to Y1 Pro Forma.</p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* OM manual pricing guidance */
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div>
                  <label className="text-sm font-medium mb-2 block text-muted-foreground">Pricing Guidance (User Input)</label>
                  <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg text-muted-foreground">$</span>
                      <input
                        type="text"
                        value={pricingGuidance > 0 ? pricingGuidance.toLocaleString() : ''}
                        placeholder="Enter asking price..."
                        onChange={(e) => setPricingGuidance(parseInt(e.target.value.replace(/,/g, '')) || 0)}
                        className="w-full pl-8 pr-4 py-4 rounded-xl text-2xl font-mono font-bold bg-muted border border-border text-foreground placeholder:text-muted-foreground/50 placeholder:font-normal placeholder:text-lg outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                    {pricingGuidance !== savedGuidanceValue && (
                      <button
                        disabled={isSavingGuidance}
                        onClick={onSaveGuidance}
                        className="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity whitespace-nowrap self-center"
                      >
                        {isSavingGuidance ? 'Saving...' : 'Save'}
                      </button>
                    )}
                    {guidanceSaved && pricingGuidance === savedGuidanceValue && (
                      <span className="flex items-center gap-1 text-sm text-primary whitespace-nowrap animate-fade-in">
                        <CheckCircle className="h-4 w-4" /> Saved!
                      </span>
                    )}
                  </div>
                  {pricingMetrics && (
                    <div className="grid grid-cols-2 gap-4 mt-6">
                      {([
                        { label: pricingMetrics.goingInLabel, value: `${pricingMetrics.goingInCap}%`, hl: true },
                        { label: 'Y1 Cap Rate', value: `${pricingMetrics.y1Cap}%`, hl: true },
                        { label: '$/Unit', value: fmtCurrency(pricingMetrics.pricePerUnit, true), hl: false },
                        { label: '$/SF', value: `$${pricingMetrics.pricePerSF}`, hl: false },
                      ]).map((m) => (
                        <div key={m.label} className={cn('p-3 rounded-xl', m.hl ? 'bg-accent' : 'bg-muted')}>
                          <p className="text-xs text-muted-foreground">{m.label}</p>
                          <p className={cn('font-mono text-lg font-semibold', m.hl ? 'text-primary' : 'text-foreground')}>{m.value}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {/* OM sensitivity slider */}
                <div className="p-5 rounded-xl bg-muted">
                  <h4 className="font-semibold mb-4 text-foreground">What Cap Rate Gets Me There?</h4>
                  <p className="text-xs text-muted-foreground mt-1 mb-2">Based on T3 NOI</p>
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground">Target Cap Rate</span>
                      <span className="font-mono text-lg font-bold text-primary">{capRateSlider.toFixed(2)}%</span>
                    </div>
                    <input type="range" min="3.5" max="7" step="0.05" value={capRateSlider} onChange={(e) => setCapRateSlider(parseFloat(e.target.value))} className="w-full accent-primary cursor-pointer" />
                  </div>
                  <div className="p-4 rounded-xl bg-card border border-border">
                    <p className="text-xs mb-1 text-muted-foreground">Max Price at {capRateSlider.toFixed(2)}% Cap</p>
                    <p className="font-mono text-2xl font-bold text-foreground">{fmtCurrency(derivedPrice, true)}</p>
                    {pricingGuidance > 0 && (
                      <p className={cn('text-sm mt-2', derivedPrice >= pricingGuidance ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
                        {derivedPrice >= pricingGuidance
                          ? `Within guidance (+${fmtCurrency(derivedPrice - pricingGuidance, true)})`
                          : `Below guidance (${fmtCurrency(derivedPrice - pricingGuidance, true)})`}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ─── Quick Underwriting (SensitivityAnalysis) ─── */}
      <SensitivityAnalysis property={property} />

      {/* ─── Special Considerations ─── */}
      {hasBOV && selectedTier && (selectedTier.loan_assumptions || selectedTier.terminal_assumptions) && (
        <>
          <h2 className="font-display text-lg font-bold text-foreground">Special Considerations</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {selectedTier.loan_assumptions && (
              <div className={GLASS_CARD}>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-blue-500/10">
                    <Receipt className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground">Loan Assumptions</h4>
                    <div className="text-sm space-y-1 mt-2 text-muted-foreground">
                      {selectedTier.loan_assumptions.leverage != null && <p>LTV: <span className="font-mono font-semibold text-foreground">{fmtPercent(selectedTier.loan_assumptions.leverage)}</span></p>}
                      {selectedTier.loan_assumptions.loan_amount != null && <p>Loan Amount: <span className="font-mono font-semibold text-foreground">{fmtCurrency(selectedTier.loan_assumptions.loan_amount, true)}</span></p>}
                      {selectedTier.loan_assumptions.interest_rate != null && <p>Rate: <span className="font-mono font-semibold text-foreground">{fmtPercent(selectedTier.loan_assumptions.interest_rate)}</span></p>}
                      {selectedTier.loan_assumptions.io_period_months != null && <p>I/O Period: <span className="font-mono font-semibold text-foreground">{selectedTier.loan_assumptions.io_period_months} months</span></p>}
                      {selectedTier.loan_assumptions.amortization_years != null && <p>Amortization: <span className="font-mono font-semibold text-foreground">{selectedTier.loan_assumptions.amortization_years} years</span></p>}
                    </div>
                  </div>
                </div>
              </div>
            )}
            {selectedTier.terminal_assumptions && (
              <div className={GLASS_CARD}>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-amber-500/10">
                    <TrendingUp className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground">Terminal Assumptions</h4>
                    <div className="text-sm space-y-1 mt-2 text-muted-foreground">
                      {selectedTier.terminal_assumptions.terminal_cap_rate != null && <p>Terminal Cap: <span className="font-mono font-semibold text-foreground">{fmtCapRate(selectedTier.terminal_assumptions.terminal_cap_rate)}</span></p>}
                      {selectedTier.terminal_assumptions.hold_period_years != null && <p>Hold Period: <span className="font-mono font-semibold text-foreground">{selectedTier.terminal_assumptions.hold_period_years} years</span></p>}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ─── Renovation Assumptions ─── */}
      {hasRenovation && (
        <>
          <h2 className="font-display text-lg font-bold text-foreground">Renovation Assumptions</h2>
          <div className={GLASS_CARD}>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {property.renovation_cost_per_unit != null && (
                <div className="p-3 rounded-xl bg-accent">
                  <p className="text-xs text-muted-foreground">Cost/Unit</p>
                  <p className="font-mono text-lg font-semibold text-foreground">{fmtCurrency(property.renovation_cost_per_unit)}</p>
                </div>
              )}
              {property.renovation_total_cost != null && (
                <div className="p-3 rounded-xl bg-muted">
                  <p className="text-xs text-muted-foreground">Total Cost</p>
                  <p className="font-mono text-lg font-semibold text-foreground">{fmtCurrency(property.renovation_total_cost, true)}</p>
                </div>
              )}
              {property.renovation_rent_premium != null && (
                <div className="p-3 rounded-xl bg-muted">
                  <p className="text-xs text-muted-foreground">Avg Rent Premium</p>
                  <p className="font-mono text-lg font-semibold text-foreground">{fmtCurrency(property.renovation_rent_premium)}/unit</p>
                </div>
              )}
              {property.renovation_roi_pct != null && (
                <div className="p-3 rounded-xl bg-accent">
                  <p className="text-xs text-muted-foreground">Return on Cost</p>
                  <p className="font-mono text-lg font-semibold text-primary">{fmtPercent(property.renovation_roi_pct, 1)}</p>
                </div>
              )}
              {property.renovation_duration_years != null && (
                <div className="p-3 rounded-xl bg-muted">
                  <p className="text-xs text-muted-foreground">Duration</p>
                  <p className="font-mono text-lg font-semibold text-foreground">{property.renovation_duration_years} years</p>
                </div>
              )}
              {property.renovation_stabilized_revenue != null && (
                <div className="p-3 rounded-xl bg-muted">
                  <p className="text-xs text-muted-foreground">Stabilized Revenue</p>
                  <p className="font-mono text-lg font-semibold text-foreground">{fmtCurrency(property.renovation_stabilized_revenue, true)}</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
