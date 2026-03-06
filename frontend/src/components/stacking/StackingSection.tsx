/**
 * StackingSection — Container component for the 3D Stacking Model feature.
 * Manages state transitions: choosing → extracting → extracted → editing → viewing.
 * Phase 2 adds satellite auto-generation flow alongside manual entry.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Building2, Pencil, RotateCcw, Globe, Loader2, AlertCircle, Layers } from 'lucide-react';
import { LayoutEditor } from './LayoutEditor';
import { StackingViewer3D } from './StackingViewer3D';
import type { UnitMeshData } from './StackingViewer3D';
import { StackingFilterSidebar } from './StackingFilterSidebar';
import { UnitDetailModal } from './UnitDetailModal';
import { stackingService } from '@/services/stackingService';
import type { PropertyDetail, StackingLayout, RentRollUnit, StackingFilterType, FilterLegend } from '@/types/property';

type SectionMode = 'choosing' | 'extracting' | 'extracted' | 'editing' | 'viewing';

interface StackingSectionProps {
  property: PropertyDetail;
}

interface ConfidenceInfo {
  level: 'high' | 'medium' | 'low';
  reason: string;
}

const CONFIDENCE_STYLES: Record<ConfidenceInfo['level'], string> = {
  high: 'bg-primary/10 text-primary',
  medium: 'bg-amber-500/10 text-amber-400',
  low: 'bg-rose-500/10 text-rose-400',
};

export function StackingSection({ property }: StackingSectionProps) {
  const [mode, setMode] = useState<SectionMode>('choosing');
  const [layout, setLayout] = useState<StackingLayout | null>(null);
  const [rentRollUnits, setRentRollUnits] = useState<RentRollUnit[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Unit detail modal state
  const [selectedUnit, setSelectedUnit] = useState<UnitMeshData | null>(null);
  const [unitModalOpen, setUnitModalOpen] = useState(false);

  // Filter state
  const [activeFilter, setActiveFilter] = useState<StackingFilterType>('occupancy');
  const [checkedFloorPlans, setCheckedFloorPlans] = useState<Set<string>>(new Set());

  // Exploded view state
  const [explodedView, setExplodedView] = useState(false);

  // Phase 2: Satellite extraction state
  const [extractedLayout, setExtractedLayout] = useState<StackingLayout | null>(null);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<ConfidenceInfo | null>(null);

  const handleUnitClick = useCallback((data: UnitMeshData) => {
    setSelectedUnit(data);
    setUnitModalOpen(true);
  }, []);

  // Parse existing layout from property
  useEffect(() => {
    if (property.stacking_layout_json) {
      try {
        const parsed = JSON.parse(property.stacking_layout_json) as StackingLayout;
        setLayout(parsed);
        setMode('viewing');
      } catch {
        setMode('choosing');
      }
    } else {
      setMode('choosing');
    }
  }, [property.stacking_layout_json]);

  // Fetch rent roll units
  useEffect(() => {
    let cancelled = false;
    stackingService.getRentRollUnits(property.id).then((units) => {
      if (!cancelled) setRentRollUnits(units);
    }).catch(() => {
      // Rent roll units may not exist — that's fine
    });
    return () => { cancelled = true; };
  }, [property.id]);

  const handleExtractFromSatellite = useCallback(async () => {
    setMode('extracting');
    setExtractionError(null);

    try {
      const result = await stackingService.extractFromSatellite(property.id);

      const extracted: StackingLayout = {
        buildings: result.layout.buildings,
        amenities: result.layout.amenities,
        total_units: result.layout.total_units,
        source: 'satellite',
        confirmed_at: new Date().toISOString(),
      };

      setExtractedLayout(extracted);
      setConfidence({
        level: result.confidence,
        reason: result.confidence_reason,
      });
      setMode('extracted');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      // Try to extract detail from Axios error response
      const axiosDetail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setExtractionError(axiosDetail || message);
      setMode('choosing');
    }
  }, [property.id]);

  const handleGenerate = useCallback(async (newLayout: StackingLayout) => {
    setIsSaving(true);
    try {
      await stackingService.saveLayout(property.id, newLayout);
      setLayout(newLayout);
      setExtractedLayout(null);
      setConfidence(null);
      setMode('viewing');
    } catch (err) {
      console.error('Failed to save stacking layout:', err);
    } finally {
      setIsSaving(false);
    }
  }, [property.id]);

  const handleReset = useCallback(async () => {
    setIsSaving(true);
    try {
      // Save empty layout
      const emptyLayout: StackingLayout = {
        buildings: [],
        amenities: [],
        total_units: 0,
        source: 'manual',
        confirmed_at: new Date().toISOString(),
      };
      await stackingService.saveLayout(property.id, emptyLayout);
      setLayout(null);
      setExtractedLayout(null);
      setConfidence(null);
      setMode('choosing');
    } catch (err) {
      console.error('Failed to reset stacking layout:', err);
    } finally {
      setIsSaving(false);
    }
  }, [property.id]);

  // Floor plan filter: init all checked when rent roll loads
  useEffect(() => {
    if (rentRollUnits.length > 0) {
      setCheckedFloorPlans(new Set(rentRollUnits.map((u) => u.unit_type || 'Unknown')));
    }
  }, [rentRollUnits]);

  const floorPlanCounts = useMemo((): Map<string, number> => {
    const counts = new Map<string, number>();
    rentRollUnits.forEach((u) => {
      const t = u.unit_type || 'Unknown';
      counts.set(t, (counts.get(t) || 0) + 1);
    });
    return counts;
  }, [rentRollUnits]);

  const handleFloorPlanToggle = useCallback((type: string) => {
    setCheckedFloorPlans((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }, []);

  const handleFloorPlanSelectAll = useCallback(() => {
    setCheckedFloorPlans(new Set(floorPlanCounts.keys()));
  }, [floorPlanCounts]);

  const handleFloorPlanClearAll = useCallback(() => {
    setCheckedFloorPlans(new Set());
  }, []);

  // Match quality
  const matchedCount = rentRollUnits.length;
  const totalModelUnits = layout?.total_units ?? 0;
  const matched = Math.min(matchedCount, totalModelUnits);
  const unlinked = totalModelUnits - matched;

  // Compute filter legend based on active filter and rent roll data
  const legend = useMemo((): FilterLegend => {
    switch (activeFilter) {
      case 'occupancy':
        return { type: 'categorical', items: [
          { color: '#7C3AED', label: 'Occupied' },
          { color: '#F43F5E', label: 'Vacant' },
          { color: '#3F3F5A', label: 'No Data' },
        ] };
      case 'floor_level': {
        const maxFloor = layout?.buildings.reduce((m, b) => Math.max(m, b.num_floors), 1) ?? 1;
        return { type: 'gradient', minColor: '#1E3A5F', maxColor: '#38BDF8', minLabel: 'Floor 1', maxLabel: `Floor ${maxFloor}` };
      }
      case 'expirations':
        return { type: 'categorical', items: [
          { color: '#EF4444', label: 'Expired / ≤30 days' },
          { color: '#F97316', label: '31–90 days' },
          { color: '#EAB308', label: '91–180 days' },
          { color: '#22C55E', label: '181–365 days' },
          { color: '#3B82F6', label: '365+ days' },
          { color: '#6B7280', label: 'No data' },
        ] };
      case 'loss_to_lease':
        return { type: 'categorical', items: [
          { color: '#3B82F6', label: '≤0% (at/above market)' },
          { color: '#22C55E', label: '1–5%' },
          { color: '#EAB308', label: '5–10%' },
          { color: '#F97316', label: '10–20%' },
          { color: '#EF4444', label: '20%+' },
          { color: '#6B7280', label: 'No data' },
        ] };
      case 'market_rents': {
        let min = Infinity, max = -Infinity;
        for (const u of rentRollUnits) {
          if (u.market_rent != null) { min = Math.min(min, u.market_rent); max = Math.max(max, u.market_rent); }
        }
        if (min === Infinity) { min = 0; max = 0; }
        return { type: 'gradient', minColor: '#1E3A5F', maxColor: '#F59E0B', minLabel: `$${min.toLocaleString()}`, maxLabel: `$${max.toLocaleString()}` };
      }
      case 'contract_rents': {
        let min = Infinity, max = -Infinity;
        for (const u of rentRollUnits) {
          if (u.in_place_rent != null) { min = Math.min(min, u.in_place_rent); max = Math.max(max, u.in_place_rent); }
        }
        if (min === Infinity) { min = 0; max = 0; }
        return { type: 'gradient', minColor: '#1E3A5F', maxColor: '#8B5CF6', minLabel: `$${min.toLocaleString()}`, maxLabel: `$${max.toLocaleString()}` };
      }
      default:
        return { type: 'categorical', items: [
          { color: '#7C3AED', label: 'Occupied' },
          { color: '#F43F5E', label: 'Vacant' },
          { color: '#3F3F5A', label: 'No Data' },
        ] };
    }
  }, [activeFilter, rentRollUnits, layout]);

  const hasAddress = Boolean(property.property_address?.trim());

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="font-display text-lg font-bold text-foreground">3D Stacking Model</h2>
          {mode === 'viewing' && totalModelUnits > 0 && (
            <span className={cn(
              'text-xs px-2 py-0.5 rounded-full font-medium',
              unlinked === 0
                ? 'bg-primary/20 text-primary'
                : 'bg-amber-500/20 text-amber-400',
            )}>
              {matched}/{totalModelUnits} units matched
              {unlinked > 0 && ` — ${unlinked} unlinked`}
            </span>
          )}
        </div>
        {mode === 'viewing' && (
          <div className="flex items-center gap-2">
            {hasAddress && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleExtractFromSatellite}
                className="gap-1.5"
              >
                <Globe className="w-3.5 h-3.5" />
                Re-generate from Satellite
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMode('editing')}
              className="gap-1.5"
            >
              <Pencil className="w-3.5 h-3.5" />
              Edit Layout
            </Button>
            <Button
              variant={explodedView ? "default" : "outline"}
              size="sm"
              onClick={() => setExplodedView(v => !v)}
              className="gap-1.5"
            >
              <Layers className="w-3.5 h-3.5" />
              {explodedView ? 'Collapse' : 'Explode'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              disabled={isSaving}
              className="text-muted-foreground hover:text-red-400 gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </Button>
          </div>
        )}
      </div>

      {/* Choosing — initial choice screen (no existing layout) */}
      {mode === 'choosing' && (
        <div className="bg-card/30 border-border/40 border-dashed rounded-2xl p-8 text-center border">
          <Building2 className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm mb-6">
            Define your building layout to generate an interactive 3D model
          </p>

          {/* Extraction error message */}
          {extractionError && (
            <div className="mb-6 mx-auto max-w-md bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 text-left">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm text-rose-400 font-medium">Satellite extraction failed</p>
                  <p className="text-xs text-rose-400/80 mt-1">{extractionError}</p>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              onClick={handleExtractFromSatellite}
              disabled={!hasAddress}
              className="gap-2"
            >
              <Globe className="w-4 h-4" />
              Auto-Generate from Satellite
            </Button>
            <Button
              variant="outline"
              onClick={() => setMode('editing')}
              className="gap-2"
            >
              <Pencil className="w-4 h-4" />
              Manual Entry
            </Button>
          </div>

          {!hasAddress && (
            <p className="text-xs text-muted-foreground/60 mt-3">
              Auto-generate requires a property address
            </p>
          )}

          <p className="text-xs text-muted-foreground/60 mt-4 max-w-sm mx-auto">
            Auto-generate uses satellite imagery to detect building layout. You can review and edit before confirming.
          </p>
        </div>
      )}

      {/* Extracting — loading state */}
      {mode === 'extracting' && (
        <div className="bg-card/30 border-border/40 border-dashed rounded-2xl p-8 text-center border">
          <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto mb-3" />
          <p className="text-foreground font-medium text-sm mb-1">
            Analyzing satellite imagery...
          </p>
          <p className="text-muted-foreground text-xs">
            This may take up to 30 seconds
          </p>
        </div>
      )}

      {/* Extracted — show confidence badge + pre-filled editor */}
      {mode === 'extracted' && extractedLayout && (
        <div className="bg-card/50 border border-border/60 rounded-2xl p-6">
          {/* Confidence badge */}
          {confidence && (
            <div className={cn(
              'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium mb-4',
              CONFIDENCE_STYLES[confidence.level],
            )}>
              <span className="capitalize">{confidence.level} confidence</span>
              {confidence.reason && (
                <span className="opacity-80">— {confidence.reason}</span>
              )}
            </div>
          )}

          <LayoutEditor
            initialLayout={extractedLayout}
            onGenerate={handleGenerate}
            isSaving={isSaving}
          />
        </div>
      )}

      {/* Editing — manual entry (existing Phase 1 flow) */}
      {mode === 'editing' && (
        <div className="bg-card/50 border border-border/60 rounded-2xl p-6">
          <LayoutEditor
            initialLayout={layout}
            onGenerate={handleGenerate}
            isSaving={isSaving}
          />
        </div>
      )}

      {/* Viewing — 3D model + filter sidebar */}
      {mode === 'viewing' && layout && layout.buildings.length > 0 && (
        <div className="flex gap-0">
          <div className="flex-1 min-w-0">
            <StackingViewer3D
              layout={layout}
              rentRollUnits={rentRollUnits}
              onUnitClick={handleUnitClick}
              activeFilter={activeFilter}
              asOfDate={property.rr_as_of_date}
              checkedFloorPlans={checkedFloorPlans}
              explodedView={explodedView}
            />
          </div>
          <StackingFilterSidebar
            activeFilter={activeFilter}
            onFilterChange={setActiveFilter}
            legend={legend}
            asOfDate={property.rr_as_of_date}
            floorPlanCounts={floorPlanCounts}
            checkedFloorPlans={checkedFloorPlans}
            onFloorPlanToggle={handleFloorPlanToggle}
            onFloorPlanSelectAll={handleFloorPlanSelectAll}
            onFloorPlanClearAll={handleFloorPlanClearAll}
          />
        </div>
      )}

      <UnitDetailModal
        data={selectedUnit}
        open={unitModalOpen}
        onOpenChange={setUnitModalOpen}
      />
    </div>
  );
}
