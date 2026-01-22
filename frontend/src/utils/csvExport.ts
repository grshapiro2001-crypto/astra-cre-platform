/**
 * CSV Export Utility for Property Comparison
 * Phase 3B
 */
import type { ComparisonResponse } from '../services/comparisonService';

export function exportComparisonToCSV(data: ComparisonResponse): void {
  // Build CSV rows
  const rows: string[][] = [];

  // Header row
  const headers = ['Metric', ...data.properties.map(p => p.property_name)];
  rows.push(headers);

  // Property Info Section
  rows.push(['Property Type', ...data.properties.map(p => p.property_type || 'N/A')]);
  rows.push(['Location', ...data.properties.map(p => p.property_address || 'N/A')]);
  rows.push(['Submarket', ...data.properties.map(p => p.submarket || 'N/A')]);
  rows.push(['Units', ...data.properties.map(p => p.total_units?.toString() || 'N/A')]);
  rows.push(['Total SF', ...data.properties.map(p => p.total_sf?.toLocaleString() || 'N/A')]);
  rows.push(['Year Built', ...data.properties.map(p => p.year_built?.toString() || 'N/A')]);

  // Pricing Section
  rows.push(['']);  // Empty row for spacing
  rows.push(['PRICING', ...data.properties.map(() => '')]);
  rows.push(['Total Price', ...data.properties.map(p =>
    p.pricing.price ? `$${p.pricing.price.toLocaleString()}` : 'N/A'
  )]);
  rows.push(['Price/Unit', ...data.properties.map(p =>
    p.pricing.price_per_unit ? `$${p.pricing.price_per_unit.toLocaleString()}` : 'N/A'
  )]);
  rows.push(['Price/SF', ...data.properties.map(p =>
    p.pricing.price_per_sf ? `$${p.pricing.price_per_sf.toFixed(2)}` : 'N/A'
  )]);

  // Cap Rates Section
  rows.push(['']);
  rows.push(['CAP RATES', ...data.properties.map(() => '')]);
  rows.push(['Going-In Cap', ...data.properties.map(p =>
    p.cap_rates.going_in ? `${p.cap_rates.going_in}%` : 'N/A'
  )]);
  rows.push(['Stabilized Cap', ...data.properties.map(p =>
    p.cap_rates.stabilized ? `${p.cap_rates.stabilized}%` : 'N/A'
  )]);

  // BOV Returns (if any BOVs)
  if (data.properties.some(p => p.bov_returns)) {
    rows.push(['']);
    rows.push(['BOV RETURNS', ...data.properties.map(() => '')]);
    rows.push(['BOV Tier', ...data.properties.map(p => p.bov_returns?.tier_name || 'N/A')]);
    rows.push(['Levered IRR', ...data.properties.map(p =>
      p.bov_returns?.levered_irr ? `${p.bov_returns.levered_irr}%` : 'N/A'
    )]);
    rows.push(['Unlevered IRR', ...data.properties.map(p =>
      p.bov_returns?.unlevered_irr ? `${p.bov_returns.unlevered_irr}%` : 'N/A'
    )]);
    rows.push(['Equity Multiple', ...data.properties.map(p =>
      p.bov_returns?.equity_multiple ? `${p.bov_returns.equity_multiple}x` : 'N/A'
    )]);
  }

  // Financials Section
  rows.push(['']);
  rows.push(['FINANCIALS', ...data.properties.map(() => '')]);
  rows.push(['T12 NOI', ...data.properties.map(p =>
    p.financials.t12_noi ? `$${p.financials.t12_noi.toLocaleString()}` : 'N/A'
  )]);
  rows.push(['Y1 NOI', ...data.properties.map(p =>
    p.financials.y1_noi ? `$${p.financials.y1_noi.toLocaleString()}` : 'N/A'
  )]);
  rows.push(['NOI Growth', ...data.properties.map(p =>
    p.financials.noi_growth_pct ? `${p.financials.noi_growth_pct}%` : 'N/A'
  )]);

  // Operations Section
  rows.push(['']);
  rows.push(['OPERATIONS', ...data.properties.map(() => '')]);
  rows.push(['OpEx Ratio', ...data.properties.map(p =>
    p.operations.opex_ratio ? `${p.operations.opex_ratio}%` : 'N/A'
  )]);
  rows.push(['OpEx/Unit', ...data.properties.map(p =>
    p.operations.opex_per_unit ? `$${p.operations.opex_per_unit.toLocaleString()}` : 'N/A'
  )]);

  // Convert to CSV string
  const csvContent = rows.map(row =>
    row.map(cell => `"${cell}"`).join(',')
  ).join('\n');

  // Trigger download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  const date = new Date().toISOString().split('T')[0];
  link.setAttribute('href', url);
  link.setAttribute('download', `property_comparison_${date}.csv`);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
