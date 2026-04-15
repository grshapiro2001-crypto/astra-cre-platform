/**
 * SensitivityPanel — What-If cap rate analysis with slider and impact cards
 */
import { SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PropertyComparisonItem, SensitivityImpact } from './types';
import { formatPrice } from './constants';

interface SensitivityPanelProps {
  properties: PropertyComparisonItem[];
  sensitivityCapRate: number;
  onCapRateChange: (rate: number) => void;
  calculateSensitivity: (property: PropertyComparisonItem, capRate: number) => SensitivityImpact | null;
}

export function SensitivityPanel({
  properties,
  sensitivityCapRate,
  onCapRateChange,
  calculateSensitivity,
}: SensitivityPanelProps) {
  return (
    <div className="liquid-glass p-6">
      <div className="flex items-center gap-2 mb-4">
        <SlidersHorizontal className="w-5 h-5 text-ivory" />
        <h3 className="font-display text-lg font-bold text-white">What-If Analysis</h3>
      </div>

      <p className="text-sm mb-6 text-zinc-400">Adjust cap rate to see impact on pricing</p>

      {/* Cap Rate Slider */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-zinc-400">Target Cap Rate</span>
          <span className="font-display text-lg font-bold text-ivory">
            {sensitivityCapRate.toFixed(2)}%
          </span>
        </div>
        <input
          type="range"
          min="3"
          max="8"
          step="0.05"
          value={sensitivityCapRate}
          onChange={(e) => onCapRateChange(parseFloat(e.target.value))}
          className="w-full accent-white"
        />
        <div className="flex justify-between text-xs mt-1 text-zinc-500 font-display">
          <span>3.00%</span>
          <span>8.00%</span>
        </div>
      </div>

      {/* Impact Preview */}
      <div className="space-y-3">
        {properties.slice(0, 3).map((property) => {
          const impact = calculateSensitivity(property, sensitivityCapRate);
          if (!impact) return null;

          return (
            <div key={property.id} className="p-3 rounded-xl bg-white/[0.04]">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-sm text-white truncate mr-2">
                  {property.property_name}
                </span>
                <span
                  className={cn(
                    'text-xs font-display font-semibold whitespace-nowrap',
                    impact.priceChange < 0 ? 'text-emerald-500' : 'text-rose-500'
                  )}
                >
                  {impact.priceChange < 0 ? '-' : '+'}
                  {formatPrice(Math.abs(impact.priceChange))}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-zinc-500">New Price: </span>
                  <span className="font-display text-white">{formatPrice(impact.newPrice)}</span>
                </div>
                <div>
                  <span className="text-zinc-500">Change: </span>
                  <span
                    className={cn(
                      'font-display',
                      impact.priceChangePct < 0 ? 'text-emerald-500' : 'text-rose-500'
                    )}
                  >
                    {impact.priceChangePct > 0 ? '+' : ''}{impact.priceChangePct.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
