import { useState } from 'react';
import type { BOVPricingTier } from '../../types/property';
import { fmtPercent, fmtCapRate } from '../../utils/formatUtils';

interface BOVPricingTiersProps {
  tiers: BOVPricingTier[];
}

export const BOVPricingTiers = ({ tiers }: BOVPricingTiersProps) => {
  const [selectedTier, setSelectedTier] = useState(0);

  if (!tiers || tiers.length === 0) return null;

  const tier = tiers[selectedTier];
  const rm = tier.return_metrics;
  const la = tier.loan_assumptions;
  const ta = tier.terminal_assumptions;

  return (
    <div className="bg-card shadow rounded-lg p-6">
      <h2 className="text-2xl font-bold text-foreground mb-4">Pricing Scenarios</h2>

      {/* Tier Tabs */}
      <div className="flex space-x-2 mb-6 border-b border-border">
        {tiers.map((t, idx) => (
          <button
            key={idx}
            onClick={() => setSelectedTier(idx)}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              selectedTier === idx
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.tier_label || `Tier ${idx + 1}`}
          </button>
        ))}
      </div>

      {/* Tier Content */}
      <div className="space-y-6">
        {/* Pricing Summary */}
        {(tier.pricing || tier.price_per_unit || tier.price_per_sf) && (
          <div className="bg-secondary border border-border rounded-lg p-4">
            <h3 className="font-semibold text-foreground mb-3">Pricing Summary</h3>
            <div className="grid grid-cols-3 gap-4">
              {tier.pricing && <div><span className="text-sm text-muted-foreground">Valuation:</span><div className="font-bold text-lg">${(tier.pricing / 1000000).toFixed(2)}M</div></div>}
              {tier.price_per_unit && <div><span className="text-sm text-muted-foreground">Price/Unit:</span><div className="font-bold text-lg">${tier.price_per_unit.toLocaleString()}</div></div>}
              {tier.price_per_sf && <div><span className="text-sm text-muted-foreground">Price/SF:</span><div className="font-bold text-lg">${tier.price_per_sf.toFixed(2)}</div></div>}
            </div>
          </div>
        )}

        {/* Cap Rates */}
        {tier.cap_rates && tier.cap_rates.length > 0 && (
          <div>
            <h3 className="font-semibold text-foreground mb-3">Cap Rate Analysis</h3>
            <div className="grid grid-cols-2 gap-3">
              {tier.cap_rates.map((cr, idx) => (
                <div key={idx} className="bg-secondary border border-border rounded p-3">
                  <div className="text-sm font-medium text-muted-foreground">{cr.cap_rate_type === 'Unknown' ? 'Cap Rate' : cr.cap_rate_type}</div>
                  <div className="text-xl font-bold text-foreground">{fmtCapRate(cr.cap_rate_value)}</div>
                  {cr.noi_basis && <div className="text-xs text-muted-foreground">NOI: ${(cr.noi_basis / 1000000).toFixed(2)}M</div>}
                  {cr.qualifier && <div className="text-xs text-muted-foreground">{cr.qualifier}</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Return Metrics */}
        {rm && (rm.unlevered_irr || rm.levered_irr || rm.equity_multiple || rm.avg_cash_on_cash) && (
          <div>
            <h3 className="font-semibold text-foreground mb-3">Return Metrics</h3>
            <div className="grid grid-cols-4 gap-3">
              {rm.unlevered_irr && <div className="text-center bg-secondary p-3 rounded"><div className="text-sm text-muted-foreground">Unlevered IRR</div><div className="text-xl font-bold text-foreground">{fmtPercent(rm.unlevered_irr)}</div></div>}
              {rm.levered_irr && <div className="text-center bg-secondary p-3 rounded"><div className="text-sm text-muted-foreground">Levered IRR</div><div className="text-xl font-bold text-foreground">{fmtPercent(rm.levered_irr)}</div></div>}
              {rm.equity_multiple && <div className="text-center bg-secondary p-3 rounded"><div className="text-sm text-muted-foreground">Equity Multiple</div><div className="text-xl font-bold text-foreground">{rm.equity_multiple}x</div></div>}
              {rm.avg_cash_on_cash && <div className="text-center bg-secondary p-3 rounded"><div className="text-sm text-muted-foreground">Avg CoC</div><div className="text-xl font-bold text-foreground">{fmtPercent(rm.avg_cash_on_cash)}</div></div>}
            </div>
          </div>
        )}

        {/* Loan & Terminal Assumptions */}
        {(la || ta) && (
          <div>
            <h3 className="font-semibold text-foreground mb-3">Loan & Terminal Assumptions</h3>
            <div className="grid grid-cols-3 gap-4 text-sm">
              {la?.leverage && <div><span className="text-muted-foreground">LTV:</span> <span className="font-semibold">{fmtPercent(la.leverage)}</span></div>}
              {la?.loan_amount && <div><span className="text-muted-foreground">Loan Amount:</span> <span className="font-semibold">${(la.loan_amount / 1000000).toFixed(2)}M</span></div>}
              {la?.interest_rate && <div><span className="text-muted-foreground">Rate:</span> <span className="font-semibold">{fmtPercent(la.interest_rate)}</span></div>}
              {la?.io_period_months && <div><span className="text-muted-foreground">I/O Period:</span> <span className="font-semibold">{la.io_period_months} months</span></div>}
              {la?.amortization_years && <div><span className="text-muted-foreground">Amortization:</span> <span className="font-semibold">{la.amortization_years} years</span></div>}
              {ta?.terminal_cap_rate && <div><span className="text-muted-foreground">Terminal Cap:</span> <span className="font-semibold">{fmtCapRate(ta.terminal_cap_rate)}</span></div>}
              {ta?.hold_period_years && <div><span className="text-muted-foreground">Hold Period:</span> <span className="font-semibold">{ta.hold_period_years} years</span></div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
