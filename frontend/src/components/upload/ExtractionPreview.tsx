import { useState } from 'react';
import { SaveToFolderModal } from '../library/SaveToFolderModal';
import { PricingAnalysis } from '../property/PricingAnalysis';
import type { UploadResponse, FinancialPeriod, CalculatedMetrics } from '../../types/property';

interface ExtractionPreviewProps {
  result: UploadResponse;
  filename: string;
  pdfPath: string;
  onUploadAnother: () => void;
}

// ==================== FORMATTING UTILITIES ====================

const formatCurrency = (value?: number | null): string => {
  if (value == null) return 'N/A';
  return `$${Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

const formatNumber = (value?: number | null): string => {
  if (value == null) return 'N/A';
  return value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
};

const formatYear = (value?: number | null): string => {
  if (value == null) return 'N/A';
  // Years should be plain 4-digit numbers without commas
  return value.toString();
};

const formatPercentage = (value?: number | null): string => {
  if (value == null) return 'N/A';
  return `${value.toFixed(2)}%`;
};

// ==================== METRIC CARD COMPONENT ====================

const MetricCard = ({
  label,
  value,
  format = 'number',
  isDeduction = false,
  isBold = false,
  sourceNote,
}: {
  label: string;
  value?: number | null;
  format?: 'number' | 'currency' | 'percentage' | 'year';
  isDeduction?: boolean;
  isBold?: boolean;
  sourceNote?: string;
}) => {
  const formattedValue =
    format === 'currency' ? formatCurrency(value) :
    format === 'percentage' ? formatPercentage(value) :
    format === 'year' ? formatYear(value) :
    formatNumber(value);

  const displayValue = value != null && isDeduction && value > 0
    ? `(${formattedValue})`
    : formattedValue;

  return (
    <div className="border-b border-gray-200 pb-2">
      <label className="text-sm font-medium text-gray-600">
        {label}
        {sourceNote && <span className="text-xs text-gray-400 ml-1">({sourceNote})</span>}
      </label>
      {value != null ? (
        <p
          className={`text-lg ${isBold ? 'font-bold text-gray-900' : ''} ${
            isDeduction ? 'text-red-600' : 'text-gray-900'
          }`}
        >
          {displayValue}
        </p>
      ) : (
        <p className="text-sm italic text-gray-400">Not found</p>
      )}
    </div>
  );
};

// ==================== FINANCIAL PERIOD SECTION ====================

const FinancialPeriodSection = ({
  periodKey,
  data,
  calculatedMetrics,
}: {
  periodKey: string;
  data: FinancialPeriod;
  calculatedMetrics?: CalculatedMetrics;
}) => {
  return (
    <div className="bg-white shadow rounded-lg p-6">
      <h3 className="text-xl font-semibold mb-4 text-gray-900">
        Financials - {data.period_label || periodKey.toUpperCase()}
      </h3>

      {/* Revenue Section */}
      <div className="mb-4">
        <h4 className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">Revenue</h4>
        <div className="grid grid-cols-3 gap-4">
          <MetricCard label="Gross Scheduled Rent" value={data.gsr} format="currency" />
        </div>
      </div>

      {/* Deductions Section - RED */}
      <div className="mb-4">
        <h4 className="text-sm font-semibold text-red-700 mb-2 uppercase tracking-wide">Less: Deductions</h4>
        <div className="grid grid-cols-4 gap-4">
          <MetricCard label="Vacancy" value={data.vacancy} format="currency" isDeduction />
          <MetricCard label="Concessions" value={data.concessions} format="currency" isDeduction />
          <MetricCard label="Bad Debt" value={data.bad_debt} format="currency" isDeduction />
          <MetricCard label="Non-Revenue Units" value={data.non_revenue_units} format="currency" isDeduction />
        </div>
      </div>

      {/* Operating Expenses & NOI */}
      <div className="mb-4">
        <h4 className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">Operating</h4>
        <div className="grid grid-cols-3 gap-4">
          <MetricCard label="Total Operating Expenses" value={data.total_opex} format="currency" />
          <MetricCard label="Net Operating Income" value={data.noi} format="currency" isBold />
        </div>

        {/* OpEx Components Breakdown */}
        {data.opex_components && (
          data.opex_components.controllable_expenses ||
          data.opex_components.management_fee ||
          data.opex_components.insurance ||
          data.opex_components.property_taxes
        ) && (
          <div className="mt-3 p-3 bg-gray-50 rounded border border-gray-200">
            <p className="text-xs font-semibold text-gray-600 mb-2">OpEx Components:</p>
            <div className="grid grid-cols-4 gap-2 text-xs">
              {data.opex_components.controllable_expenses != null && (
                <div>
                  <span className="text-gray-600">Controllable: </span>
                  <span className="font-medium">{formatCurrency(data.opex_components.controllable_expenses)}</span>
                </div>
              )}
              {data.opex_components.management_fee != null && (
                <div>
                  <span className="text-gray-600">Management: </span>
                  <span className="font-medium">{formatCurrency(data.opex_components.management_fee)}</span>
                </div>
              )}
              {data.opex_components.insurance != null && (
                <div>
                  <span className="text-gray-600">Insurance: </span>
                  <span className="font-medium">{formatCurrency(data.opex_components.insurance)}</span>
                </div>
              )}
              {data.opex_components.property_taxes != null && (
                <div>
                  <span className="text-gray-600">Taxes: </span>
                  <span className="font-medium">{formatCurrency(data.opex_components.property_taxes)}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Calculated Metrics */}
      {calculatedMetrics && (
        <div className="pt-6 border-t border-gray-200">
          <h4 className="font-semibold text-gray-700 mb-3">Calculated Metrics</h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <div className="text-sm font-medium text-green-800">Economic Occupancy</div>
              <div className="text-3xl font-bold text-green-900 mt-1">
                {formatPercentage(calculatedMetrics.economic_occupancy)}
              </div>
              <div className="text-xs text-green-600 mt-2 font-mono">
                Formula: {calculatedMetrics.formula_econ_occ}
              </div>
            </div>
            <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-200">
              <div className="text-sm font-medium text-emerald-800">OpEx Ratio</div>
              <div className="text-3xl font-bold text-emerald-900 mt-1">
                {formatPercentage(calculatedMetrics.opex_ratio)}
              </div>
              <div className="text-xs text-emerald-600 mt-2 font-mono">
                Formula: {calculatedMetrics.formula_opex}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ==================== MAIN COMPONENT ====================

export const ExtractionPreview = ({ result, filename, pdfPath, onUploadAnother }: ExtractionPreviewProps) => {
  const { extraction_result } = result;
  const {
    document_type,
    confidence,
    property_info,
    average_rents,
    financials_by_period,
    calculated_metrics,
    source_notes,
    missing_fields
  } = extraction_result;

  // State for Save to Folder modal
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Determine property-specific label for SF
  const sfLabel = property_info.property_type?.toLowerCase().includes('multifamily')
    ? 'Total Residential SF'
    : 'Total SF';

  return (
    <div className="space-y-6">
      {/* Document Type Header */}
      <div className="bg-emerald-50 border-l-4 border-emerald-500 p-4 rounded">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-emerald-900 text-lg">
              Document Type: {document_type}
            </h3>
            <p className="text-sm text-emerald-700">
              Confidence: <span className="font-medium">{confidence.toUpperCase()}</span>
            </p>
          </div>
          <div className="text-sm text-gray-600">
            <strong>File:</strong> {filename}
          </div>
        </div>
      </div>

      {/* Property Information */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-xl font-semibold mb-4 text-gray-900">
          Property Information
          {source_notes?.property_info_source && (
            <span className="text-sm text-gray-500 font-normal ml-2">
              ({source_notes.property_info_source})
            </span>
          )}
        </h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="border-b border-gray-200 pb-2">
            <label className="text-sm font-medium text-gray-600">Deal Name</label>
            <p className="text-lg text-gray-900">{property_info.deal_name || <span className="italic text-gray-400">Not found</span>}</p>
          </div>
          <div className="border-b border-gray-200 pb-2">
            <label className="text-sm font-medium text-gray-600">Property Address</label>
            <p className="text-lg text-gray-900">{property_info.property_address || <span className="italic text-gray-400">Not found</span>}</p>
          </div>
          <div className="border-b border-gray-200 pb-2">
            <label className="text-sm font-medium text-gray-600">Property Type</label>
            <p className="text-lg text-gray-900">{property_info.property_type || <span className="italic text-gray-400">Not found</span>}</p>
          </div>
          <div className="border-b border-gray-200 pb-2">
            <label className="text-sm font-medium text-gray-600">Submarket</label>
            <p className="text-lg text-gray-900">{property_info.submarket || <span className="italic text-gray-400">Not found</span>}</p>
          </div>
          <MetricCard label="Year Built" value={property_info.year_built} format="year" />
          <MetricCard label="Total Units" value={property_info.total_units} />
          <MetricCard label={sfLabel} value={property_info.total_sf} />
        </div>
      </div>

      {/* Average Rents (for Multifamily) */}
      {average_rents && (average_rents.market_rent || average_rents.in_place_rent) && (
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-xl font-semibold mb-4 text-gray-900">Average Rents</h3>
          <div className="grid grid-cols-2 gap-4">
            {average_rents.market_rent && (
              <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                <div className="text-sm font-medium text-purple-800">Market Rent</div>
                <div className="text-2xl font-bold text-purple-900 mt-1">
                  {formatCurrency(average_rents.market_rent)}/unit/month
                </div>
                <div className="text-xs text-purple-600 mt-1">What units COULD rent for</div>
              </div>
            )}
            {average_rents.in_place_rent && (
              <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-200">
                <div className="text-sm font-medium text-indigo-800">In-Place Rent</div>
                <div className="text-2xl font-bold text-indigo-900 mt-1">
                  {formatCurrency(average_rents.in_place_rent)}/unit/month
                </div>
                <div className="text-xs text-indigo-600 mt-1">What tenants CURRENTLY pay</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pricing Analysis */}
      <PricingAnalysis financials_by_period={financials_by_period} />

      {/* Financial Periods */}
      {source_notes?.financials_source && (
        <div className="bg-gray-50 border border-gray-200 p-3 rounded">
          <p className="text-sm text-gray-600">
            <strong>Financial Data Source:</strong> {source_notes.financials_source}
          </p>
        </div>
      )}

      {/* Warning if only one period found */}
      {(() => {
        const hasHistorical = !!(financials_by_period.t12 || financials_by_period.t3);
        const hasProforma = !!financials_by_period.y1;
        const onlyOneFound = (hasHistorical && !hasProforma) || (!hasHistorical && hasProforma);

        if (onlyOneFound) {
          return (
            <div className="bg-orange-50 border-l-4 border-orange-400 p-4 rounded">
              <div className="flex items-start">
                <svg className="h-6 w-6 text-orange-500 mr-3 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <h4 className="font-semibold text-orange-900 mb-1">⚠️ Incomplete Financial Data</h4>
                  <p className="text-sm text-orange-800">
                    Only {hasHistorical ? 'historical/trailing' : 'proforma'} financials were extracted.
                    Most OMs contain BOTH historical and proforma data.
                    The {hasHistorical ? 'Y1/Proforma' : 'historical'} financials may be missing from the document or not detected.
                  </p>
                </div>
              </div>
            </div>
          );
        }
        return null;
      })()}

      {financials_by_period.t12 && (
        <FinancialPeriodSection
          periodKey="t12"
          data={financials_by_period.t12}
          calculatedMetrics={calculated_metrics.t12}
        />
      )}

      {financials_by_period.t3 && (
        <FinancialPeriodSection
          periodKey="t3"
          data={financials_by_period.t3}
          calculatedMetrics={calculated_metrics.t3}
        />
      )}

      {financials_by_period.y1 && (
        <FinancialPeriodSection
          periodKey="y1"
          data={financials_by_period.y1}
          calculatedMetrics={calculated_metrics.y1}
        />
      )}

      {/* BOV Pricing Tiers */}
      {document_type === 'BOV' && extraction_result.bov_pricing_tiers && extraction_result.bov_pricing_tiers.length > 0 && (
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-xl font-semibold mb-4 text-gray-900">BOV Pricing Tiers</h3>
          <div className="grid grid-cols-2 gap-4">
            {extraction_result.bov_pricing_tiers.map((tier, i) => (
              <div key={i} className="border rounded-lg p-4">
                <h4 className="font-semibold text-gray-800 mb-2">{tier.tier_label || `Tier ${i + 1}`}</h4>
                <MetricCard label="Pricing" value={tier.pricing} format="currency" isBold />
                <MetricCard label="Price per Unit" value={tier.price_per_unit} format="currency" />
                <MetricCard label="Price per SF" value={tier.price_per_sf} format="currency" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Missing Fields Warning */}
      {missing_fields.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
          <div className="flex items-start">
            <svg
              className="h-5 w-5 text-yellow-600 mt-0.5 mr-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <div>
              <h4 className="font-semibold text-yellow-900 mb-1">Missing Data</h4>
              <p className="text-sm text-yellow-800">
                The following fields could not be extracted: {missing_fields.join(', ')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex space-x-4">
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex-1 py-3 px-4 rounded-lg font-semibold transition-all duration-200 bg-emerald-500 text-white hover:bg-emerald-600 shadow-md shadow-emerald-500/25"
        >
          Save to Folder
        </button>
        <button
          onClick={onUploadAnother}
          className="flex-1 py-3 px-4 rounded-lg font-medium transition-colors border-2 border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
        >
          Upload Another
        </button>
      </div>

      {/* Save to Folder Modal */}
      <SaveToFolderModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        extractionResult={result}
        filename={filename}
        pdfPath={pdfPath}
      />
    </div>
  );
};
