/**
 * StackingSection — Container component for the 3D Stacking Model feature.
 * Manages state transitions: empty → editing → viewing.
 */
import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Building2, Pencil, RotateCcw } from 'lucide-react';
import { LayoutEditor } from './LayoutEditor';
import { StackingViewer3D } from './StackingViewer3D';
import { UnitDetailModal } from './UnitDetailModal';
import { stackingService } from '@/services/stackingService';
import type { PropertyDetail, StackingLayout, RentRollUnit } from '@/types/property';
import type { UnitMeshData } from './StackingViewer3D';

type SectionMode = 'empty' | 'editing' | 'viewing';

interface StackingSectionProps {
  property: PropertyDetail;
}

export function StackingSection({ property }: StackingSectionProps) {
  const [mode, setMode] = useState<SectionMode>('empty');
  const [layout, setLayout] = useState<StackingLayout | null>(null);
  const [rentRollUnits, setRentRollUnits] = useState<RentRollUnit[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<UnitMeshData | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Parse existing layout from property
  useEffect(() => {
    if (property.stacking_layout_json) {
      try {
        const parsed = JSON.parse(property.stacking_layout_json) as StackingLayout;
        setLayout(parsed);
        setMode('viewing');
      } catch {
        setMode('empty');
      }
    } else {
      setMode('empty');
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

  const handleGenerate = useCallback(async (newLayout: StackingLayout) => {
    setIsSaving(true);
    try {
      await stackingService.saveLayout(property.id, newLayout);
      setLayout(newLayout);
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
      setMode('empty');
    } catch (err) {
      console.error('Failed to reset stacking layout:', err);
    } finally {
      setIsSaving(false);
    }
  }, [property.id]);

  const handleUnitClick = useCallback((data: UnitMeshData) => {
    setSelectedUnit(data);
    setModalOpen(true);
  }, []);

  // Match quality
  const matchedCount = rentRollUnits.length;
  const totalModelUnits = layout?.total_units ?? 0;
  const matched = Math.min(matchedCount, totalModelUnits);
  const unlinked = totalModelUnits - matched;

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

      {mode === 'empty' && (
        <div className="bg-card/30 border-border/40 border-dashed rounded-2xl p-8 text-center border">
          <Building2 className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm mb-4">
            Define your building layout to generate an interactive 3D model
          </p>
          <Button
            onClick={() => setMode('editing')}
            className="gap-2"
          >
            <Building2 className="w-4 h-4" />
            Create Layout
          </Button>
        </div>
      )}

      {mode === 'editing' && (
        <div className="bg-card/50 border border-border/60 rounded-2xl p-6">
          <LayoutEditor
            initialLayout={layout}
            onGenerate={handleGenerate}
            isSaving={isSaving}
          />
        </div>
      )}

      {mode === 'viewing' && layout && layout.buildings.length > 0 && (
        <StackingViewer3D
          layout={layout}
          rentRollUnits={rentRollUnits}
          onUnitClick={handleUnitClick}
        />
      )}

      <UnitDetailModal
        data={selectedUnit}
        open={modalOpen}
        onOpenChange={setModalOpen}
      />
    </div>
  );
}
