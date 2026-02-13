/**
 * ComparisonTable - Side-by-side property comparison table
 * Phase 3B + Investment Criteria Cell-Level Gradient Highlighting
 */
import { Link } from 'react-router-dom';
import type { ComparisonResponse } from '../../services/comparisonService';
import type { Criterion, PropertyRanking, MetricKey } from '../../utils/criteriaEvaluation';
import { getGradientColor } from '../../utils/criteriaEvaluation';
import { fmtPercent } from '../../utils/formatUtils';

interface ComparisonTableProps {
  data: ComparisonResponse;
  criteria: Criterion[]; // Active criteria - determines which rows get highlighted
  rankings?: Map<number, PropertyRanking>; // Per-metric rankings for gradient colors
}

export const ComparisonTable = ({ data, criteria, rankings }: ComparisonTableProps) => {
  const { properties } = data;

  /**
   * Get gradient color for a specific cell based on metric and property
   * Returns gradient color if this metric is in active criteria, empty string otherwise
   */
  const getCellGradient = (propertyId: number, metricKey?: MetricKey): string => {
    // No gradient if no criteria active
    if (!criteria || criteria.length === 0 || !rankings || rankings.size === 0) {
      return '';
    }

    // No gradient if this isn't a tracked metric
    if (!metricKey) {
      return '';
    }

    // Check if this metric is in active criteria
    const activeCriterion = criteria.find(c => c.metric === metricKey);
    if (!activeCriterion) {
      return ''; // This metric not active - no gradient
    }

    // Get ranking for this property
    const ranking = rankings.get(propertyId);
    if (!ranking) return '';

    // Get rank for THIS SPECIFIC METRIC (not average rank)
    const metricRank = ranking.ranksByMetric.get(metricKey);
    if (!metricRank) return '';

    // Apply gradient based on this metric's rank
    return getGradientColor(metricRank, data.properties.length);
  };

  const fmt = {
    currency: (val?: number) => val ? `$${val.toLocaleString()}` : 'N/A',
    percent: (val?: number) => val != null ? fmtPercent(val) : 'N/A',
    number: (val?: number) => val ? val.toLocaleString() : 'N/A',
    decimal: (val?: number) => val ? val.toFixed(2) : 'N/A',
  };

  const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <tr className="border-b border-gray-200 hover:bg-gray-50">
      <td className="px-4 py-3 text-sm font-medium text-gray-700 sticky left-0 bg-white">{label}</td>
      {children}
    </tr>
  );

  const Cell = ({
    children,
    propertyId,
    metricKey
  }: {
    children: React.ReactNode;
    propertyId: number;
    metricKey?: MetricKey; // Identifies which metric this cell displays
  }) => {
    // Get gradient ONLY if this metric is active
    const gradientClass = getCellGradient(propertyId, metricKey);

    return (
      <td className={`px-4 py-3 text-sm border-l border-gray-200 transition-colors ${gradientClass}`}>
        {children}
      </td>
    );
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full bg-white border border-gray-200">
        <thead>
          <tr className="bg-gray-100">
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 border-b sticky left-0 bg-gray-100">
              Metric
            </th>
            {properties.map(prop => (
              <th
                key={prop.id}
                className="px-4 py-3 text-left text-sm font-semibold text-gray-900 border-b border-l"
              >
                <Link to={`/library/${prop.id}`} className="hover:underline">
                  {prop.property_name}
                </Link>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {/* Property Info */}
          <tr className="bg-gray-50">
            <td colSpan={properties.length + 1} className="px-4 py-2 text-xs font-semibold text-gray-700 uppercase">
              Property Information
            </td>
          </tr>
          <Row label="Property Type">
            {properties.map(p => <Cell key={p.id} propertyId={p.id}>{p.property_type || 'N/A'}</Cell>)}
          </Row>
          <Row label="Location">
            {properties.map(p => <Cell key={p.id} propertyId={p.id}>{p.property_address || 'N/A'}</Cell>)}
          </Row>
          <Row label="Submarket">
            {properties.map(p => <Cell key={p.id} propertyId={p.id}>{p.submarket || 'N/A'}</Cell>)}
          </Row>
          <Row label="Units">
            {properties.map(p => <Cell key={p.id} propertyId={p.id}>{fmt.number(p.total_units)}</Cell>)}
          </Row>
          <Row label="Total SF">
            {properties.map(p => <Cell key={p.id} propertyId={p.id}>{fmt.number(p.total_sf)}</Cell>)}
          </Row>
          <Row label="Year Built">
            {properties.map(p => <Cell key={p.id} propertyId={p.id}>{p.year_built || 'N/A'}</Cell>)}
          </Row>

          {/* Pricing */}
          <tr className="bg-gray-50">
            <td colSpan={properties.length + 1} className="px-4 py-2 text-xs font-semibold text-gray-700 uppercase">
              Pricing
            </td>
          </tr>
          <Row label="Total Price">
            {properties.map(p => <Cell key={p.id} propertyId={p.id}>{fmt.currency(p.pricing.price)}</Cell>)}
          </Row>
          <Row label="Price/Unit">
            {properties.map(p => (
              <Cell key={p.id} propertyId={p.id} metricKey="price_per_unit">
                {fmt.currency(p.pricing.price_per_unit)}
              </Cell>
            ))}
          </Row>
          <Row label="Price/SF">
            {properties.map(p => (
              <Cell key={p.id} propertyId={p.id} metricKey="price_per_sf">
                {p.pricing.price_per_sf ? `$${p.pricing.price_per_sf.toFixed(2)}` : 'N/A'}
              </Cell>
            ))}
          </Row>

          {/* Cap Rates */}
          <tr className="bg-gray-50">
            <td colSpan={properties.length + 1} className="px-4 py-2 text-xs font-semibold text-gray-700 uppercase">
              Cap Rates
            </td>
          </tr>
          <Row label="Going-In Cap">
            {properties.map(p => (
              <Cell key={p.id} propertyId={p.id} metricKey="going_in_cap">
                {fmt.percent(p.cap_rates.going_in)}
              </Cell>
            ))}
          </Row>
          <Row label="Stabilized Cap">
            {properties.map(p => (
              <Cell key={p.id} propertyId={p.id} metricKey="stabilized_cap">
                {fmt.percent(p.cap_rates.stabilized)}
              </Cell>
            ))}
          </Row>

          {/* BOV Returns (if any) */}
          {properties.some(p => p.bov_returns) && (
            <>
              <tr className="bg-gray-50">
                <td colSpan={properties.length + 1} className="px-4 py-2 text-xs font-semibold text-gray-700 uppercase">
                  BOV Returns
                </td>
              </tr>
              <Row label="BOV Tier">
                {properties.map(p => <Cell key={p.id} propertyId={p.id}>{p.bov_returns?.tier_name || 'N/A'}</Cell>)}
              </Row>
              <Row label="Levered IRR">
                {properties.map(p => (
                  <Cell key={p.id} propertyId={p.id} metricKey="levered_irr">
                    {fmt.percent(p.bov_returns?.levered_irr)}
                  </Cell>
                ))}
              </Row>
              <Row label="Unlevered IRR">
                {properties.map(p => (
                  <Cell key={p.id} propertyId={p.id} metricKey="unlevered_irr">
                    {fmt.percent(p.bov_returns?.unlevered_irr)}
                  </Cell>
                ))}
              </Row>
              <Row label="Equity Multiple">
                {properties.map(p => (
                  <Cell key={p.id} propertyId={p.id}>
                    {p.bov_returns?.equity_multiple ? `${p.bov_returns.equity_multiple}x` : 'N/A'}
                  </Cell>
                ))}
              </Row>
            </>
          )}

          {/* Financials */}
          <tr className="bg-gray-50">
            <td colSpan={properties.length + 1} className="px-4 py-2 text-xs font-semibold text-gray-700 uppercase">
              Financials
            </td>
          </tr>
          <Row label="T12 NOI">
            {properties.map(p => <Cell key={p.id} propertyId={p.id}>{fmt.currency(p.financials.t12_noi)}</Cell>)}
          </Row>
          <Row label="Y1 NOI">
            {properties.map(p => <Cell key={p.id} propertyId={p.id}>{fmt.currency(p.financials.y1_noi)}</Cell>)}
          </Row>
          <Row label="NOI Growth">
            {properties.map(p => (
              <Cell key={p.id} propertyId={p.id} metricKey="noi_growth">
                {fmt.percent(p.financials.noi_growth_pct)}
              </Cell>
            ))}
          </Row>

          {/* Operations */}
          <tr className="bg-gray-50">
            <td colSpan={properties.length + 1} className="px-4 py-2 text-xs font-semibold text-gray-700 uppercase">
              Operations
            </td>
          </tr>
          <Row label="OpEx Ratio">
            {properties.map(p => (
              <Cell key={p.id} propertyId={p.id}>
                {fmt.percent(p.operations.opex_ratio)}
              </Cell>
            ))}
          </Row>
          <Row label="OpEx/Unit">
            {properties.map(p => (
              <Cell key={p.id} propertyId={p.id}>
                {fmt.currency(p.operations.opex_per_unit)}
              </Cell>
            ))}
          </Row>
        </tbody>
      </table>
    </div>
  );
};
