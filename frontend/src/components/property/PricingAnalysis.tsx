import { useState } from 'react';
import type { FinancialPeriodData } from '../../types/property';

interface PricingAnalysisProps {
  financials_by_period: {
    t12?: FinancialPeriodData | null;
    t3?: FinancialPeriodData | null;
    y1?: FinancialPeriodData | null;
  };
  initialPricingGuidance?: number;
}

// ==================== FORMATTING UTILITIES ====================

const formatCurrency = (value?: number | null): string => {
  if (value == null) return 'N/A';
  return `$${Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

const formatCurrencyInput = (value: string): string => {
  // Remove all non-numeric characters
  const numericValue = value.replace(/[^0-9]/g, '');
  if (!numericValue) return '';

  // Convert to number and format with commas
  const num = parseInt(numericValue, 10);
  return `$${num.toLocaleString('en-US')}`;
};

const parseCurrencyInput = (value: string): number | null => {
  const numericValue = value.replace(/[^0-9]/g, '');
  return numericValue ? parseInt(numericValue, 10) : null;
};

// ==================== PRICING ANALYSIS COMPONENT ====================

export const PricingAnalysis = ({ financials_by_period, initialPricingGuidance }: PricingAnalysisProps) => {
  const [pricingGuidance, setPricingGuidance] = useState<string>(
    initialPricingGuidance ? initialPricingGuidance.toString() : ''
  );
  const [displayValue, setDisplayValue] = useState<string>(
    initialPricingGuidance ? formatCurrencyInput(initialPricingGuidance.toString()) : ''
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCurrencyInput(e.target.value);
    setDisplayValue(formatted);
    setPricingGuidance(e.target.value);
  };

  const pricingNumber = parseCurrencyInput(pricingGuidance);

  // Determine which trailing period to use (T12 > T3 > T1)
  const trailingPeriod = financials_by_period.t12 || financials_by_period.t3;
  const trailingNOI = trailingPeriod?.noi;
  const trailingLabel = trailingPeriod?.period_label || 'Trailing';

  // Y1/Proforma NOI
  const proformaNOI = financials_by_period.y1?.noi;
  const proformaLabel = financials_by_period.y1?.period_label || 'Y1';

  // Calculate cap rates
  const trailingCapRate = pricingNumber && trailingNOI
    ? (trailingNOI / pricingNumber) * 100
    : null;

  const proformaCapRate = pricingNumber && proformaNOI
    ? (proformaNOI / pricingNumber) * 100
    : null;

  return (
    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 shadow-lg rounded-lg p-6 border-2 border-indigo-200">
      <div className="flex items-center mb-4">
        <svg className="h-6 w-6 text-indigo-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
        <h3 className="text-2xl font-bold text-indigo-900">PRICING ANALYSIS</h3>
      </div>

      {/* Input Field */}
      <div className="mb-6">
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Pricing Guidance (User Input)
        </label>
        <input
          type="text"
          value={displayValue}
          onChange={handleInputChange}
          placeholder="Enter pricing guidance (e.g., $30,000,000)"
          className="w-full px-4 py-3 text-2xl font-bold border-2 border-indigo-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
      </div>

      {/* Auto-Calculated Cap Rates */}
      {pricingNumber && (
        <div className="space-y-4">
          <h4 className="text-lg font-semibold text-gray-800 mb-3">Auto-Calculated Cap Rates:</h4>

          {/* Proforma/Y1 Cap Rate */}
          <div className="bg-white p-4 rounded-lg border border-indigo-200">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-semibold text-indigo-800">{proformaLabel} Cap Rate</span>
              <span className="text-3xl font-bold text-indigo-900">
                {proformaCapRate != null ? `${proformaCapRate.toFixed(2)}%` : 'N/A'}
              </span>
            </div>
            {proformaCapRate != null ? (
              <>
                <div className="text-xs text-gray-600 mb-1">
                  <strong>Formula:</strong> {proformaLabel} NOI / Pricing Guidance
                </div>
                <div className="text-xs font-mono text-gray-700 bg-gray-50 p-2 rounded">
                  {formatCurrency(proformaNOI)} / {formatCurrency(pricingNumber)} = {proformaCapRate.toFixed(2)}%
                </div>
              </>
            ) : (
              <p className="text-xs text-gray-500 italic">No {proformaLabel} NOI data available</p>
            )}
          </div>

          {/* Trailing Cap Rate */}
          <div className="bg-white p-4 rounded-lg border border-indigo-200">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-semibold text-indigo-800">{trailingLabel} Cap Rate</span>
              <span className="text-3xl font-bold text-indigo-900">
                {trailingCapRate != null ? `${trailingCapRate.toFixed(2)}%` : 'N/A'}
              </span>
            </div>
            {trailingCapRate != null ? (
              <>
                <div className="text-xs text-gray-600 mb-1">
                  <strong>Formula:</strong> {trailingLabel} NOI / Pricing Guidance
                </div>
                <div className="text-xs font-mono text-gray-700 bg-gray-50 p-2 rounded">
                  {formatCurrency(trailingNOI)} / {formatCurrency(pricingNumber)} = {trailingCapRate.toFixed(2)}%
                </div>
              </>
            ) : (
              <p className="text-xs text-gray-500 italic">No trailing NOI data available</p>
            )}
          </div>
        </div>
      )}

      {!pricingNumber && (
        <div className="text-center text-gray-500 italic py-4">
          Enter a pricing guidance above to see auto-calculated cap rates
        </div>
      )}
    </div>
  );
};
