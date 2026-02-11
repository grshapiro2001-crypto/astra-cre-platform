/**
 * Investment Criteria Form — Settings tab for configuring screening criteria
 */
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { X, Save, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { criteriaService } from '@/services/criteriaService';
import type { InvestmentCriteria } from '@/types/property';

const PROPERTY_TYPE_OPTIONS = [
  'Multifamily',
  'Mixed-Use',
  'Office',
  'Retail',
  'Industrial',
];

export const InvestmentCriteriaForm = () => {
  const [criteria, setCriteria] = useState<InvestmentCriteria | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [minUnits, setMinUnits] = useState<string>('');
  const [maxUnits, setMaxUnits] = useState<string>('');
  const [propertyTypes, setPropertyTypes] = useState<string[]>([]);
  const [targetMarkets, setTargetMarkets] = useState<string>('');
  const [minYearBuilt, setMinYearBuilt] = useState<string>('');
  const [minCapRate, setMinCapRate] = useState<string>('');
  const [maxCapRate, setMaxCapRate] = useState<string>('');
  const [minOccupancy, setMinOccupancy] = useState<string>('');
  const [maxOpexRatio, setMaxOpexRatio] = useState<string>('');
  const [minNoi, setMinNoi] = useState<string>('');
  const [maxPricePerUnit, setMaxPricePerUnit] = useState<string>('');
  const [minDealScore, setMinDealScore] = useState<number>(0);

  useEffect(() => {
    const fetchCriteria = async () => {
      setIsLoading(true);
      try {
        const data = await criteriaService.getCriteria();
        setCriteria(data);
        // Populate form
        setMinUnits(data.min_units?.toString() ?? '');
        setMaxUnits(data.max_units?.toString() ?? '');
        setPropertyTypes(
          data.property_types
            ? data.property_types.split(',').map((t) => t.trim())
            : []
        );
        setTargetMarkets(data.target_markets ?? '');
        setMinYearBuilt(data.min_year_built?.toString() ?? '');
        setMinCapRate(data.min_cap_rate?.toString() ?? '');
        setMaxCapRate(data.max_cap_rate?.toString() ?? '');
        setMinOccupancy(data.min_economic_occupancy?.toString() ?? '');
        setMaxOpexRatio(data.max_opex_ratio?.toString() ?? '');
        setMinNoi(data.min_noi?.toString() ?? '');
        setMaxPricePerUnit(data.max_price_per_unit?.toString() ?? '');
        setMinDealScore(data.min_deal_score ?? 0);
      } catch {
        // Silently fail — criteria will be empty
      } finally {
        setIsLoading(false);
      }
    };
    fetchCriteria();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload = {
        criteria_name: criteria?.criteria_name ?? 'Default Criteria',
        min_units: minUnits ? parseInt(minUnits) : null,
        max_units: maxUnits ? parseInt(maxUnits) : null,
        property_types: propertyTypes.length > 0 ? propertyTypes.join(',') : null,
        target_markets: targetMarkets.trim() || null,
        min_year_built: minYearBuilt ? parseInt(minYearBuilt) : null,
        min_cap_rate: minCapRate ? parseFloat(minCapRate) : null,
        max_cap_rate: maxCapRate ? parseFloat(maxCapRate) : null,
        min_economic_occupancy: minOccupancy ? parseFloat(minOccupancy) : null,
        max_opex_ratio: maxOpexRatio ? parseFloat(maxOpexRatio) : null,
        min_noi: minNoi ? parseFloat(minNoi) : null,
        max_price_per_unit: maxPricePerUnit ? parseFloat(maxPricePerUnit) : null,
        min_deal_score: minDealScore > 0 ? minDealScore : null,
      };

      const updated = await criteriaService.updateCriteria(payload);
      setCriteria(updated);
      toast.success('Investment criteria saved', {
        description: 'All properties have been re-screened.',
      });
    } catch {
      toast.error('Failed to save criteria');
    } finally {
      setIsSaving(false);
    }
  };

  const togglePropertyType = (type: string) => {
    setPropertyTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Property Filters */}
      <div>
        <h4 className="text-sm font-semibold text-foreground mb-3">
          Property Filters
        </h4>
        <div className="grid grid-cols-2 gap-4">
          <ClearableField
            label="Min Units"
            value={minUnits}
            onChange={setMinUnits}
            type="number"
            placeholder="e.g. 100"
          />
          <ClearableField
            label="Max Units"
            value={maxUnits}
            onChange={setMaxUnits}
            type="number"
            placeholder="e.g. 500"
          />
        </div>

        <div className="mt-3">
          <Label className="text-muted-foreground text-xs uppercase tracking-wider">
            Property Types
          </Label>
          <div className="flex flex-wrap gap-2 mt-1.5">
            {PROPERTY_TYPE_OPTIONS.map((type) => (
              <button
                key={type}
                onClick={() => togglePropertyType(type)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-all border',
                  propertyTypes.includes(type)
                    ? 'bg-primary/10 text-primary border-primary'
                    : 'bg-muted text-muted-foreground border-transparent hover:border-border'
                )}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3">
          <ClearableField
            label="Target Markets (comma-separated)"
            value={targetMarkets}
            onChange={setTargetMarkets}
            placeholder="e.g. Atlanta, Dallas, Charlotte"
          />
        </div>

        <div className="mt-3">
          <ClearableField
            label="Min Year Built"
            value={minYearBuilt}
            onChange={setMinYearBuilt}
            type="number"
            placeholder="e.g. 1990"
          />
        </div>
      </div>

      {/* Financial Thresholds */}
      <div>
        <h4 className="text-sm font-semibold text-foreground mb-3">
          Financial Thresholds
        </h4>
        <div className="grid grid-cols-2 gap-4">
          <ClearableField
            label="Min Cap Rate (%)"
            value={minCapRate}
            onChange={setMinCapRate}
            type="number"
            placeholder="e.g. 5.0"
            step="0.1"
          />
          <ClearableField
            label="Max Cap Rate (%)"
            value={maxCapRate}
            onChange={setMaxCapRate}
            type="number"
            placeholder="e.g. 8.0"
            step="0.1"
          />
          <ClearableField
            label="Min Occupancy (%)"
            value={minOccupancy}
            onChange={setMinOccupancy}
            type="number"
            placeholder="e.g. 88"
            step="0.1"
          />
          <ClearableField
            label="Max OpEx Ratio (%)"
            value={maxOpexRatio}
            onChange={setMaxOpexRatio}
            type="number"
            placeholder="e.g. 55"
            step="0.1"
          />
          <ClearableField
            label="Min NOI ($)"
            value={minNoi}
            onChange={setMinNoi}
            type="number"
            placeholder="e.g. 1000000"
          />
          <ClearableField
            label="Max Price/Unit ($)"
            value={maxPricePerUnit}
            onChange={setMaxPricePerUnit}
            type="number"
            placeholder="e.g. 150000"
          />
        </div>
      </div>

      {/* Deal Score */}
      <div>
        <h4 className="text-sm font-semibold text-foreground mb-3">
          Deal Score
        </h4>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-muted-foreground text-xs uppercase tracking-wider">
              Min Deal Score
            </Label>
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono text-foreground">
                {minDealScore > 0 ? minDealScore : 'Off'}
              </span>
              {minDealScore > 0 && (
                <button
                  onClick={() => setMinDealScore(0)}
                  className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={minDealScore}
            onChange={(e) => setMinDealScore(parseInt(e.target.value))}
            className="w-full accent-primary"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>Off</span>
            <span>50</span>
            <span>100</span>
          </div>
        </div>
      </div>

      {/* Save */}
      <Button onClick={handleSave} disabled={isSaving} className="w-full">
        {isSaving ? (
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
        ) : (
          <Save className="w-4 h-4 mr-2" />
        )}
        Save Criteria
      </Button>
    </div>
  );
};

/** Input field with a clear (X) button */
const ClearableField = ({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  step,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  step?: string;
}) => (
  <div className="space-y-1.5">
    <Label className="text-muted-foreground text-xs uppercase tracking-wider">
      {label}
    </Label>
    <div className="relative">
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        step={step}
        className="bg-muted/50 border-border pr-8"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  </div>
);
