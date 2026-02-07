import { useState } from 'react';
import { AlertTriangle, AlertCircle } from 'lucide-react';
import { SaveToFolderModal } from '../library/SaveToFolderModal';
import { PricingAnalysis } from '../property/PricingAnalysis';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
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
    <div className="border-b border-border pb-2">
      <label className="text-sm font-medium text-muted-foreground">
        {label}
        {sourceNote && <span className="text-xs text-muted-foreground/60 ml-1">({sourceNote})</span>}
      </label>
      {value != null ? (
        <p
          className={cn(
            'text-lg',
            isBold && 'font-bold text-foreground',
            isDeduction ? 'text-destructive' : 'text-foreground'
          )}
        >
          {displayValue}
        </p>
      ) : (
        <p className="text-sm italic text-muted-foreground/60">Not found</p>
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
    <div className="bg-card shadow rounded-lg p-6 border border-border">
      <h3 className="text-xl font-semibold mb-4 text-foreground">
        Financials - {data.period_label || periodKey.toUpperCase()}
      </h3>

      {/* Revenue Section */}
      <div className="mb-4">
        <h4 className="text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Revenue</h4>
        <div className="grid grid-cols-3 gap-4">
          <MetricCard label="Gross Scheduled Rent" value={data.gsr} format="currency" />
        </div>
      </div>

      {/* Deductions Section - RED */}
      <div className="mb-4">
        <h4 className="text-sm font-semibold text-destructive mb-2 uppercase tracking-wide">Less: Deductions</h4>
        <div className="grid grid-cols-4 gap-4">
          <MetricCard label="Vacancy" value={data.vacancy} format="currency" isDeduction />
          <MetricCard label="Concessions" value={data.concessions} format="currency" isDeduction />
          <MetricCard label="Bad Debt" value={data.bad_debt} format="currency" isDeduction />
          <MetricCard label="Non-Revenue Units" value={data.non_revenue_units} format="currency" isDeduction />
        </div>
      </div>

      {/* Operating Expenses & NOI */}
      <div className="mb-4">
        <h4 className="text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Operating</h4>
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
          <div className="mt-3 p-3 bg-muted/50 rounded border border-border">
            <p className="text-xs font-semibold text-muted-foreground mb-2">OpEx Components:</p>
            <div className="grid grid-cols-4 gap-2 text-xs">
              {data.opex_components.controllable_expenses != null && (
                <div>
                  <span className="text-muted-foreground">Controllable: </span>
                  <span className="font-medium text-foreground">{formatCurrency(data.opex_components.controllable_expenses)}</span>
                </div>
              )}
              {data.opex_components.management_fee != null && (
                <div>
                  <span className="text-muted-foreground">Management: </span>
                  <span className="font-medium text-foreground">{formatCurrency(data.opex_components.management_fee)}</span>
                </div>
              )}
              {data.opex_components.insurance != null && (
                <div>
                  <span className="text-muted-foreground">Insurance: </span>
                  <span className="font-medium text-foreground">{formatCurrency(data.opex_components.insurance)}</span>
                </div>
              )}
              {data.opex_components.property_taxes != null && (
                <div>
                  <span className="text-muted-foreground">Taxes: </span>
                  <span className="font-medium text-foreground">{formatCurrency(data.opex_components.property_taxes)}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Calculated Metrics */}
      {calculatedMetrics && (
        <div className="pt-6 border-t border-border">
          <h4 className="font-semibold text-foreground mb-3">Calculated Metrics</h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-primary/5 p-4 rounded-lg border border-primary/20">
              <div className="text-sm font-medium text-primary">Economic Occupancy</div>
              <div className="text-3xl font-bold text-foreground mt-1">
                {formatPercentage(calculatedMetrics.economic_occupancy)}
              </div>
              <div className="text-xs text-muted-foreground mt-2 font-mono">
                Formula: {calculatedMetrics.formula_econ_occ}
              </div>
            </div>
            <div className="bg-primary/5 p-4 rounded-lg border border-primary/20">
              <div className="text-sm font-medium text-primary">OpEx Ratio</div>
              <div className="text-3xl font-bold text-foreground mt-1">
                {formatPercentage(calculatedMetrics.opex_ratio)}
              </div>
              <div className="text-xs text-muted-foreground mt-2 font-mono">
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
      <div className="bg-primary/5 border-l-4 border-primary p-4 rounded">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-foreground text-lg">
              Document Type: {document_type}
            </h3>
            <p className="text-sm text-muted-foreground">
              Confidence: <span className="font-medium">{confidence.toUpperCase()}</span>
            </p>
          </div>
          <div className="text-sm text-muted-foreground">
            <strong className="text-foreground">File:</strong> {filename}
          </div>
        </div>
      </div>

      {/* Property Information */}
      <div className="bg-card shadow rounded-lg p-6 border border-border">
        <h3 className="text-xl font-semibold mb-4 text-foreground">
          Property Information
          {source_notes?.property_info_source && (
            <span className="text-sm text-muted-foreground font-normal ml-2">
              ({source_notes.property_info_source})
            </span>
          )}
        </h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="border-b border-border pb-2">
            <label className="text-sm font-medium text-muted-foreground">Deal Name</label>
            <p className="text-lg text-foreground">{property_info.deal_name || <span className="italic text-muted-foreground/60">Not found</span>}</p>
          </div>
          <div className="border-b border-border pb-2">
            <label className="text-sm font-medium text-muted-foreground">Property Address</label>
            <p className="text-lg text-foreground">{property_info.property_address || <span className="italic text-muted-foreground/60">Not found</span>}</p>
          </div>
          <div className="border-b border-border pb-2">
            <label className="text-sm font-medium text-muted-foreground">Property Type</label>
            <p className="text-lg text-foreground">{property_info.property_type || <span className="italic text-muted-foreground/60">Not found</span>}</p>
          </div>
          <div className="border-b border-border pb-2">
            <label className="text-sm font-medium text-muted-foreground">Submarket</label>
            <p className="text-lg text-foreground">{property_info.submarket || <span className="italic text-muted-foreground/60">Not found</span>}</p>
          </div>
          <MetricCard label="Year Built" value={property_info.year_built} format="year" />
          <MetricCard label="Total Units" value={property_info.total_units} />
          <MetricCard label={sfLabel} value={property_info.total_sf} />
        </div>
      </div>

      {/* Average Rents (for Multifamily) */}
      {average_rents && (average_rents.market_rent || average_rents.in_place_rent) && (
        <div className="bg-card shadow rounded-lg p-6 border border-border">
          <h3 className="text-xl font-semibold mb-4 text-foreground">Average Rents</h3>
          <div className="grid grid-cols-2 gap-4">
            {average_rents.market_rent && (
              <div className="bg-primary/5 p-4 rounded-lg border border-primary/20">
                <div className="text-sm font-medium text-primary">Market Rent</div>
                <div className="text-2xl font-bold text-foreground mt-1">
                  {formatCurrency(average_rents.market_rent)}/unit/month
                </div>
                <div className="text-xs text-muted-foreground mt-1">What units COULD rent for</div>
              </div>
            )}
            {average_rents.in_place_rent && (
              <div className="bg-primary/5 p-4 rounded-lg border border-primary/20">
                <div className="text-sm font-medium text-primary">In-Place Rent</div>
                <div className="text-2xl font-bold text-foreground mt-1">
                  {formatCurrency(average_rents.in_place_rent)}/unit/month
                </div>
                <div className="text-xs text-muted-foreground mt-1">What tenants CURRENTLY pay</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pricing Analysis */}
      <PricingAnalysis financials_by_period={financials_by_period} />

      {/* Financial Periods */}
      {source_notes?.financials_source && (
        <div className="bg-muted/50 border border-border p-3 rounded">
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">Financial Data Source:</strong> {source_notes.financials_source}
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
            <div className="bg-orange-500/10 border-l-4 border-orange-500 p-4 rounded dark:bg-orange-500/5">
              <div className="flex items-start">
                <AlertTriangle className="h-6 w-6 text-orange-500 mr-3 mt-0.5 shrink-0" />
                <div>
                  <h4 className="font-semibold text-foreground mb-1">Incomplete Financial Data</h4>
                  <p className="text-sm text-muted-foreground">
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
        <div className="bg-card shadow rounded-lg p-6 border border-border">
          <h3 className="text-xl font-semibold mb-4 text-foreground">BOV Pricing Tiers</h3>
          <div className="grid grid-cols-2 gap-4">
            {extraction_result.bov_pricing_tiers.map((tier, i) => (
              <div key={i} className="border border-border rounded-lg p-4">
                <h4 className="font-semibold text-foreground mb-2">{tier.tier_label || `Tier ${i + 1}`}</h4>
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
        <div className="bg-yellow-500/10 border border-yellow-500/30 p-4 rounded-lg dark:bg-yellow-500/5">
          <div className="flex items-start">
            <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 mt-0.5 mr-3 shrink-0" />
            <div>
              <h4 className="font-semibold text-foreground mb-1">Missing Data</h4>
              <p className="text-sm text-muted-foreground">
                The following fields could not be extracted: {missing_fields.join(', ')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex space-x-4">
        <Button
          onClick={() => setIsModalOpen(true)}
          className="flex-1 py-3 font-semibold shadow-md shadow-primary/25"
          size="lg"
        >
          Save to Folder
        </Button>
        <Button
          onClick={onUploadAnother}
          variant="outline"
          className="flex-1 py-3 font-medium"
          size="lg"
        >
          Upload Another
        </Button>
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
