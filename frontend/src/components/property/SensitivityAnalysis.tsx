import { useState, useMemo } from 'react';
import type { PropertyDetail } from '../../types/property';
import { BarChart3 } from 'lucide-react';
import { normalizePercent } from '../../utils/formatUtils';

interface SensitivityAnalysisProps {
  property: PropertyDetail;
}

// ==================== FORMATTING UTILITIES ====================

const fmtCurrency = (value: number | null | undefined, abbreviated = false): string => {
  if (value == null) return '---';
  if (abbreviated) {
    if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
    if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
};

const fmtPercent = (value: number | null | undefined, decimals = 2): string => {
  if (value == null) return '---';
  return `${value.toFixed(decimals)}%`;
};

// ==================== IRR CALCULATION ====================

// Newton's method to solve for IRR
const calculateIRR = (cashFlows: number[], guess = 0.1): number | null => {
  const maxIterations = 100;
  const tolerance = 0.0001;

  let rate = guess;

  for (let i = 0; i < maxIterations; i++) {
    let npv = 0;
    let dnpv = 0;

    for (let t = 0; t < cashFlows.length; t++) {
      npv += cashFlows[t] / Math.pow(1 + rate, t);
      dnpv += (-t * cashFlows[t]) / Math.pow(1 + rate, t + 1);
    }

    const newRate = rate - npv / dnpv;

    if (Math.abs(newRate - rate) < tolerance) {
      return newRate * 100; // Return as percentage
    }

    rate = newRate;
  }

  return null; // Failed to converge
};

// ==================== SENSITIVITY ANALYSIS COMPONENT ====================

export const SensitivityAnalysis = ({ property }: SensitivityAnalysisProps) => {
  const y1NOI = property.y1_financials?.noi;
  const y1GSR = property.y1_financials?.gsr;
  const y1OpEx = property.y1_financials?.total_opex;

  // Check if we have the necessary data
  const hasFinancials = y1NOI != null && y1GSR != null && y1OpEx != null;

  // Get default pricing guidance from property or calculate from Y1 NOI
  const defaultPricing = useMemo(() => {
    if (property.bov_pricing_tiers && property.bov_pricing_tiers.length > 0) {
      const firstTier = property.bov_pricing_tiers[0];
      if (firstTier.pricing) return firstTier.pricing;
    }
    // Fallback: Y1 NOI / 5.5% cap
    if (y1NOI) return y1NOI / 0.055;
    return 30_000_000; // Ultimate fallback
  }, [property.bov_pricing_tiers, y1NOI]);

  // Get default terminal cap rate (normalise: API may return 0.055 or 5.5)
  const defaultTerminalCap = useMemo(() => {
    if (property.bov_pricing_tiers && property.bov_pricing_tiers.length > 0) {
      const firstTier = property.bov_pricing_tiers[0];
      if (firstTier.terminal_assumptions?.terminal_cap_rate) {
        return normalizePercent(firstTier.terminal_assumptions.terminal_cap_rate);
      }
    }
    return 5.5; // Default 5.5%
  }, [property.bov_pricing_tiers]);

  // State for all input sliders
  const [purchasePrice, setPurchasePrice] = useState(defaultPricing);
  const [rentGrowth, setRentGrowth] = useState(3.0);
  const [expenseGrowth, setExpenseGrowth] = useState(2.5);
  const [exitCap, setExitCap] = useState(defaultTerminalCap);
  const [holdPeriod, setHoldPeriod] = useState(5);
  const [ltv, setLtv] = useState(65);
  const [interestRate, setInterestRate] = useState(6.5);

  // Calculate all metrics
  const calculations = useMemo(() => {
    if (!hasFinancials || !y1NOI || !y1GSR || !y1OpEx) {
      return null;
    }

    // Derived values
    const ltvDecimal = ltv / 100;
    const loanAmount = purchasePrice * ltvDecimal;
    const equity = purchasePrice - loanAmount;
    const goingInCap = (y1NOI / purchasePrice) * 100;

    // Monthly interest rate and number of payments (30-year amortization)
    const monthlyRate = interestRate / 100 / 12;
    const numPayments = 30 * 12;

    // Calculate annual debt service (monthly payment * 12)
    let annualDebtService = 0;
    if (loanAmount > 0 && monthlyRate > 0) {
      const monthlyPayment = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
                            (Math.pow(1 + monthlyRate, numPayments) - 1);
      annualDebtService = monthlyPayment * 12;
    }

    // Year-by-year projections
    const years: Array<{
      year: number;
      revenue: number;
      expenses: number;
      noi: number;
      debtService: number;
      cashFlow: number;
      cashOnCash: number;
    }> = [];

    for (let year = 1; year <= holdPeriod; year++) {
      const revenue = y1GSR * Math.pow(1 + rentGrowth / 100, year - 1);
      const expenses = y1OpEx * Math.pow(1 + expenseGrowth / 100, year - 1);
      const noi = revenue - expenses;
      const cashFlow = noi - annualDebtService;
      const cashOnCash = equity > 0 ? (cashFlow / equity) * 100 : 0;

      years.push({
        year,
        revenue,
        expenses,
        noi,
        debtService: annualDebtService,
        cashFlow,
        cashOnCash,
      });
    }

    // Calculate terminal value and sale proceeds
    const finalYearNOI = years[years.length - 1].noi;
    const nextYearNOI = finalYearNOI * (1 + rentGrowth / 100);
    const terminalValue = nextYearNOI / (exitCap / 100);
    const saleProceeds = terminalValue - loanAmount; // Simplified - no loan paydown

    // IRR Calculations
    // Unlevered: [-purchasePrice, noi1, noi2, ..., noiN + terminalValue]
    const unleveredCashFlows = [-purchasePrice, ...years.map(y => y.noi)];
    unleveredCashFlows[unleveredCashFlows.length - 1] += terminalValue;

    // Levered: [-equity, cashFlow1, cashFlow2, ..., cashFlowN + saleProceeds]
    const leveredCashFlows = [-equity, ...years.map(y => y.cashFlow)];
    leveredCashFlows[leveredCashFlows.length - 1] += saleProceeds;

    const unleveredIRR = calculateIRR(unleveredCashFlows);
    const leveredIRR = calculateIRR(leveredCashFlows);

    // Equity Multiple
    const totalCashFlows = years.reduce((sum, y) => sum + y.cashFlow, 0);
    const equityMultiple = equity > 0 ? (totalCashFlows + saleProceeds) / equity : 0;

    // Average Cash-on-Cash
    const avgCashOnCash = years.reduce((sum, y) => sum + y.cashOnCash, 0) / years.length;

    return {
      goingInCap,
      loanAmount,
      equity,
      annualDebtService,
      years,
      terminalValue,
      saleProceeds,
      unleveredIRR,
      leveredIRR,
      equityMultiple,
      avgCashOnCash,
      year1CashOnCash: years[0]?.cashOnCash || 0,
    };
  }, [hasFinancials, y1NOI, y1GSR, y1OpEx, purchasePrice, rentGrowth, expenseGrowth, exitCap, holdPeriod, ltv, interestRate]);

  // If no financials, show empty state
  if (!hasFinancials) {
    return (
      <section className="animate-fade-in" style={{ animationDelay: '240ms' }}>
        <h2 className="font-display text-lg font-bold mb-4 text-foreground">
          Quick Underwriting
        </h2>
        <div className="bg-card/30 border-border/40 border-dashed rounded-2xl p-8 text-center border">
          <BarChart3 className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            Upload an OM with financial data to use the underwriting calculator
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="animate-fade-in" style={{ animationDelay: '240ms' }}>
      <h2 className="font-display text-lg font-bold mb-4 text-foreground">
        Quick Underwriting
      </h2>

      <div className="bg-card/50 border-border/60 rounded-2xl p-6 border">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* LEFT COLUMN - Input Sliders */}
          <div className="space-y-6">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
              Assumptions
            </h3>

            {/* Purchase Price */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground">Purchase Price</label>
                <input
                  type="text"
                  value={fmtCurrency(purchasePrice)}
                  onChange={(e) => {
                    const numericValue = e.target.value.replace(/[^0-9]/g, '');
                    setPurchasePrice(numericValue ? parseInt(numericValue, 10) : 0);
                  }}
                  className="w-32 px-2 py-1 text-sm text-right border border-border rounded bg-background"
                />
              </div>
              <input
                type="range"
                min={defaultPricing * 0.5}
                max={defaultPricing * 1.5}
                step={100000}
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(Number(e.target.value))}
                className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-purple-600"
              />
            </div>

            {/* Going-In Cap Rate - Display Only */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-muted-foreground">Going-In Cap Rate</label>
                <span className="text-sm font-mono text-muted-foreground">
                  {fmtPercent(calculations?.goingInCap)}
                </span>
              </div>
              <div className="h-2 bg-muted/50 rounded-lg flex items-center justify-center">
                <span className="text-xs text-muted-foreground/60">Auto-calculated</span>
              </div>
            </div>

            {/* Annual Rent Growth */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground">Annual Rent Growth</label>
                <input
                  type="text"
                  value={`${rentGrowth}%`}
                  onFocus={(e) => { e.target.value = String(rentGrowth); e.target.select(); }}
                  onBlur={(e) => { 
                    const v = e.target.value.replace(/[^0-9.]/g, '');
                    setRentGrowth(v === '' ? 0 : Number(v));
                    e.target.value = `${rentGrowth}%`;
                  }}
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^0-9.]/g, '');
                    if (v === '' || !isNaN(Number(v))) setRentGrowth(v === '' ? 0 : Number(v));
                  }}
                  step={0.25}
                  min={0}
                  max={8}
                  className="w-20 px-2 py-1 text-sm text-right border border-border rounded bg-background"
                />
              </div>
              <input
                type="range"
                min={0}
                max={8}
                step={0.25}
                value={rentGrowth}
                onChange={(e) => setRentGrowth(Number(e.target.value))}
                className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-purple-600"
              />
            </div>

            {/* Annual Expense Growth */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground">Annual Expense Growth</label>
                <input
                  type="text"
                  value={`${expenseGrowth}%`}
                  onFocus={(e) => { e.target.value = String(expenseGrowth); e.target.select(); }}
                  onBlur={(e) => { 
                    const v = e.target.value.replace(/[^0-9.]/g, '');
                    setExpenseGrowth(v === '' ? 0 : Number(v));
                    e.target.value = `${expenseGrowth}%`;
                  }}
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^0-9.]/g, '');
                    if (v === '' || !isNaN(Number(v))) setExpenseGrowth(v === '' ? 0 : Number(v));
                  }}
                  step={0.25}
                  min={0}
                  max={6}
                  className="w-20 px-2 py-1 text-sm text-right border border-border rounded bg-background"
                />
              </div>
              <input
                type="range"
                min={0}
                max={6}
                step={0.25}
                value={expenseGrowth}
                onChange={(e) => setExpenseGrowth(Number(e.target.value))}
                className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-purple-600"
              />
            </div>

            {/* Exit Cap Rate */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground">Exit Cap Rate</label>
                <input
                  type="text"
                  value={`${exitCap}%`}
                  onFocus={(e) => { e.target.value = String(exitCap); e.target.select(); }}
                  onBlur={(e) => { 
                    const v = e.target.value.replace(/[^0-9.]/g, '');
                    setExitCap(v === '' ? 0 : Number(v));
                    e.target.value = `${exitCap}%`;
                  }}
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^0-9.]/g, '');
                    if (v === '' || !isNaN(Number(v))) setExitCap(v === '' ? 0 : Number(v));
                  }}
                  step={0.25}
                  min={4}
                  max={8}
                  className="w-20 px-2 py-1 text-sm text-right border border-border rounded bg-background"
                />
              </div>
              <input
                type="range"
                min={4}
                max={8}
                step={0.25}
                value={exitCap}
                onChange={(e) => setExitCap(Number(e.target.value))}
                className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-purple-600"
              />
            </div>

            {/* Hold Period */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground">Hold Period (Years)</label>
                <input
                  type="number"
                  value={holdPeriod}
                  onChange={(e) => setHoldPeriod(Number(e.target.value))}
                  step={1}
                  min={3}
                  max={10}
                  className="w-20 px-2 py-1 text-sm text-right border border-border rounded bg-background"
                />
              </div>
              <input
                type="range"
                min={3}
                max={10}
                step={1}
                value={holdPeriod}
                onChange={(e) => setHoldPeriod(Number(e.target.value))}
                className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-purple-600"
              />
            </div>

            {/* LTV */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground">LTV</label>
                <input
                  type="text"
                  value={`${ltv}%`}
                  onFocus={(e) => { e.target.value = String(ltv); e.target.select(); }}
                  onBlur={(e) => { 
                    const v = e.target.value.replace(/[^0-9.]/g, '');
                    setLtv(v === '' ? 0 : Number(v));
                    e.target.value = `${ltv}%`;
                  }}
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^0-9.]/g, '');
                    if (v === '' || !isNaN(Number(v))) setLtv(v === '' ? 0 : Number(v));
                  }}
                  step={5}
                  min={0}
                  max={80}
                  className="w-20 px-2 py-1 text-sm text-right border border-border rounded bg-background"
                />
              </div>
              <input
                type="range"
                min={0}
                max={80}
                step={5}
                value={ltv}
                onChange={(e) => setLtv(Number(e.target.value))}
                className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-purple-600"
              />
            </div>

            {/* Interest Rate */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground">Interest Rate</label>
                <input
                  type="text"
                  value={`${interestRate}%`}
                  onFocus={(e) => { e.target.value = String(interestRate); e.target.select(); }}
                  onBlur={(e) => { 
                    const v = e.target.value.replace(/[^0-9.]/g, '');
                    setInterestRate(v === '' ? 0 : Number(v));
                    e.target.value = `${interestRate}%`;
                  }}
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^0-9.]/g, '');
                    if (v === '' || !isNaN(Number(v))) setInterestRate(v === '' ? 0 : Number(v));
                  }}
                  step={0.25}
                  min={4}
                  max={9}
                  className="w-20 px-2 py-1 text-sm text-right border border-border rounded bg-background"
                />
              </div>
              <input
                type="range"
                min={4}
                max={9}
                step={0.25}
                value={interestRate}
                onChange={(e) => setInterestRate(Number(e.target.value))}
                className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-purple-600"
              />
            </div>
          </div>

          {/* RIGHT COLUMN - Calculated Returns */}
          <div className="space-y-6">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
              Projected Returns
            </h3>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 gap-4">
              {/* Unlevered IRR */}
              <div className="bg-background/60 border border-border/50 rounded-lg p-4">
                <div className="text-xs text-muted-foreground mb-1">Unlevered IRR</div>
                <div className="text-2xl font-mono font-bold text-foreground">
                  {calculations?.unleveredIRR != null ? fmtPercent(calculations.unleveredIRR) : '---'}
                </div>
              </div>

              {/* Levered IRR */}
              <div className="bg-background/60 border border-border/50 rounded-lg p-4">
                <div className="text-xs text-muted-foreground mb-1">Levered IRR</div>
                <div className="text-2xl font-mono font-bold text-foreground">
                  {calculations?.leveredIRR != null ? fmtPercent(calculations.leveredIRR) : '---'}
                </div>
              </div>

              {/* Equity Multiple */}
              <div className="bg-background/60 border border-border/50 rounded-lg p-4">
                <div className="text-xs text-muted-foreground mb-1">Equity Multiple</div>
                <div className="text-2xl font-mono font-bold text-foreground">
                  {calculations?.equityMultiple != null ? `${calculations.equityMultiple.toFixed(2)}x` : '---'}
                </div>
              </div>

              {/* Avg Cash-on-Cash */}
              <div className="bg-background/60 border border-border/50 rounded-lg p-4">
                <div className="text-xs text-muted-foreground mb-1">Avg Cash-on-Cash</div>
                <div className="text-2xl font-mono font-bold text-foreground">
                  {fmtPercent(calculations?.avgCashOnCash)}
                </div>
              </div>

              {/* Year 1 Cash-on-Cash */}
              <div className="bg-background/60 border border-border/50 rounded-lg p-4">
                <div className="text-xs text-muted-foreground mb-1">Year 1 Cash-on-Cash</div>
                <div className="text-2xl font-mono font-bold text-foreground">
                  {fmtPercent(calculations?.year1CashOnCash)}
                </div>
              </div>

              {/* Terminal Value */}
              <div className="bg-background/60 border border-border/50 rounded-lg p-4">
                <div className="text-xs text-muted-foreground mb-1">Terminal Value</div>
                <div className="text-2xl font-mono font-bold text-foreground">
                  {fmtCurrency(calculations?.terminalValue, true)}
                </div>
              </div>
            </div>

            {/* Year-by-Year Table */}
            <div className="mt-6">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Year-by-Year Projection
              </h4>
              <div className="border border-border rounded-lg overflow-hidden bg-background/30">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Year</th>
                        <th className="px-3 py-2 text-right font-semibold text-muted-foreground">NOI</th>
                        <th className="px-3 py-2 text-right font-semibold text-muted-foreground">Debt Service</th>
                        <th className="px-3 py-2 text-right font-semibold text-muted-foreground">Cash Flow</th>
                        <th className="px-3 py-2 text-right font-semibold text-muted-foreground">CoC</th>
                      </tr>
                    </thead>
                    <tbody>
                      {calculations?.years.map((year) => (
                        <tr key={year.year} className="border-b border-border/50 last:border-0">
                          <td className="px-3 py-2 font-medium">{year.year}</td>
                          <td className="px-3 py-2 text-right font-mono">{fmtCurrency(year.noi, true)}</td>
                          <td className="px-3 py-2 text-right font-mono">{fmtCurrency(year.debtService, true)}</td>
                          <td className="px-3 py-2 text-right font-mono">{fmtCurrency(year.cashFlow, true)}</td>
                          <td className="px-3 py-2 text-right font-mono">{fmtPercent(year.cashOnCash)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
