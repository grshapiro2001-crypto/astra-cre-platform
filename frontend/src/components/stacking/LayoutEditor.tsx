/**
 * LayoutEditor — Manual building layout entry form for the 3D stacking model.
 * Allows users to define buildings (shape, floors, units) and amenities.
 */
import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Plus, Trash2, Building2 } from 'lucide-react';
import type { StackingLayout, StackingBuilding, StackingAmenity } from '@/types/property';

const SHAPE_OPTIONS = [
  { value: 'linear', label: 'Linear' },
  { value: 'L', label: 'L-Shape' },
  { value: 'U', label: 'U-Shape' },
  { value: 'courtyard', label: 'Courtyard' },
  { value: 'tower', label: 'Tower' },
  { value: 'wrap', label: 'Wrap' },
] as const;

const AMENITY_OPTIONS = [
  { type: 'pool', label: 'Pool' },
  { type: 'clubhouse', label: 'Clubhouse' },
  { type: 'parking', label: 'Parking' },
  { type: 'gym', label: 'Gym' },
] as const;

interface BuildingDraft {
  id: string;
  label: string;
  shape: StackingBuilding['shape'];
  num_floors: number;
  units_per_floor: number;
}

interface LayoutEditorProps {
  initialLayout?: StackingLayout | null;
  onGenerate: (layout: StackingLayout) => void;
  isSaving?: boolean;
}

function generateBuildingId(index: number): string {
  return String.fromCharCode(65 + index); // A, B, C, ...
}

export function LayoutEditor({ initialLayout, onGenerate, isSaving }: LayoutEditorProps) {
  const [buildings, setBuildings] = useState<BuildingDraft[]>(() => {
    if (initialLayout?.buildings?.length) {
      return initialLayout.buildings.map((b) => ({
        id: b.id,
        label: b.label,
        shape: b.shape,
        num_floors: b.num_floors,
        units_per_floor: b.units_per_floor,
      }));
    }
    return [{ id: 'A', label: 'Building A', shape: 'linear' as const, num_floors: 3, units_per_floor: 8 }];
  });

  const [selectedAmenities, setSelectedAmenities] = useState<Set<string>>(() => {
    if (initialLayout?.amenities?.length) {
      return new Set(initialLayout.amenities.map((a) => a.type));
    }
    return new Set<string>();
  });

  const totalUnits = buildings.reduce((sum, b) => sum + b.num_floors * b.units_per_floor, 0);

  const addBuilding = useCallback(() => {
    setBuildings((prev) => {
      const nextId = generateBuildingId(prev.length);
      return [
        ...prev,
        { id: nextId, label: `Building ${nextId}`, shape: 'linear' as const, num_floors: 3, units_per_floor: 8 },
      ];
    });
  }, []);

  const removeBuilding = useCallback((index: number) => {
    setBuildings((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateBuilding = useCallback((index: number, updates: Partial<BuildingDraft>) => {
    setBuildings((prev) =>
      prev.map((b, i) => (i === index ? { ...b, ...updates } : b)),
    );
  }, []);

  const toggleAmenity = useCallback((type: string) => {
    setSelectedAmenities((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }, []);

  const handleGenerate = () => {
    const amenities: StackingAmenity[] = Array.from(selectedAmenities).map((type) => ({
      type,
      relative_position: 'ground level',
    }));

    const layout: StackingLayout = {
      buildings: buildings.map((b) => ({
        id: b.id,
        label: b.label,
        shape: b.shape,
        num_floors: b.num_floors,
        units_per_floor: b.units_per_floor,
        total_units_this_building: b.num_floors * b.units_per_floor,
      })),
      amenities,
      total_units: totalUnits,
      source: 'manual',
      confirmed_at: new Date().toISOString(),
    };

    onGenerate(layout);
  };

  return (
    <div className="space-y-6">
      {/* Buildings */}
      <div className="space-y-4">
        {buildings.map((building, index) => (
          <div
            key={building.id}
            className={cn(
              'bg-card/50 border border-border/60 rounded-2xl p-5',
              'hover:border-primary/40 transition-colors',
            )}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary" />
                <h4 className="text-sm font-semibold text-foreground">{building.label}</h4>
              </div>
              {buildings.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeBuilding(index)}
                  className="text-muted-foreground hover:text-red-400 h-8 w-8 p-0"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {/* Label */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Label</Label>
                <Input
                  value={building.label}
                  onChange={(e) => updateBuilding(index, { label: e.target.value })}
                  className="h-9 bg-background"
                />
              </div>

              {/* Shape */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Shape</Label>
                <Select
                  value={building.shape}
                  onValueChange={(v) => updateBuilding(index, { shape: v as StackingBuilding['shape'] })}
                >
                  <SelectTrigger className="h-9 bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SHAPE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Floors */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Floors</Label>
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={building.num_floors}
                  onChange={(e) => updateBuilding(index, { num_floors: Math.max(1, parseInt(e.target.value) || 1) })}
                  className="h-9 bg-background"
                />
              </div>

              {/* Units Per Floor */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Units / Floor</Label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={building.units_per_floor}
                  onChange={(e) => updateBuilding(index, { units_per_floor: Math.max(1, parseInt(e.target.value) || 1) })}
                  className="h-9 bg-background"
                />
              </div>
            </div>

            <p className="text-xs text-muted-foreground mt-3">
              {building.num_floors * building.units_per_floor} units in this building
            </p>
          </div>
        ))}

        <Button
          variant="outline"
          size="sm"
          onClick={addBuilding}
          className="border-dashed border-border/60 hover:border-primary/40"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Add Building
        </Button>
      </div>

      {/* Amenities */}
      <div>
        <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-3 block">
          Amenities
        </Label>
        <div className="flex flex-wrap gap-4">
          {AMENITY_OPTIONS.map((amenity) => (
            <label
              key={amenity.type}
              className="flex items-center gap-2 cursor-pointer"
            >
              <Checkbox
                checked={selectedAmenities.has(amenity.type)}
                onCheckedChange={() => toggleAmenity(amenity.type)}
              />
              <span className="text-sm text-foreground">{amenity.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Summary + Generate */}
      <div className="flex items-center justify-between pt-4 border-t border-border/60">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total Units</p>
          <p className="text-2xl font-bold font-mono text-foreground">{totalUnits}</p>
        </div>
        <Button
          onClick={handleGenerate}
          disabled={isSaving || totalUnits === 0}
          className="gap-2"
        >
          <Building2 className="w-4 h-4" />
          {isSaving ? 'Saving...' : 'Generate 3D Model'}
        </Button>
      </div>
    </div>
  );
}
