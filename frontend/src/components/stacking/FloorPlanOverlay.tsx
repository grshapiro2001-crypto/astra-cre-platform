/**
 * FloorPlanOverlay — 2D floor plan image viewer with unit marker overlays.
 * Shows the uploaded floor plan image for a selected floor with colored
 * clickable unit markers positioned by wing quadrants.
 */
import { useState, useMemo, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Loader2, ImageOff } from 'lucide-react';
import { stackingService } from '@/services/stackingService';
import { getUnitColorHex, computeRentStatsFromUnits } from './unitColorUtils';
import type { UnitMeshData } from './StackingViewer3D';
import type {
  UnitPositionMap,
  FloorPlanImageEntry,
  RentRollUnit,
  StackingFilterType,
  FloorPlanWing,
} from '@/types/property';

interface FloorPlanOverlayProps {
  propertyId: number;
  unitPositionMap: UnitPositionMap;
  rentRollUnits: RentRollUnit[];
  activeFilter: StackingFilterType;
  asOfDate?: string | null;
  floorPlanImages: FloorPlanImageEntry[];
  onUnitClick?: (data: UnitMeshData, event?: React.MouseEvent) => void;
  selectedUnits?: UnitMeshData[];
}

// Wing direction → CSS quadrant positioning
function getWingRegion(
  direction: string,
  wingIndex: number,
  totalWings: number,
): { top: string; left: string; width: string; height: string } {
  const dir = direction.toLowerCase();

  if (totalWings === 1) {
    return { top: '5%', left: '5%', width: '90%', height: '90%' };
  }

  if (totalWings === 2) {
    // Split horizontally for north/south or vertically for east/west
    if (dir === 'north' || dir === 'top') {
      return { top: '5%', left: '5%', width: '90%', height: '42%' };
    }
    if (dir === 'south' || dir === 'bottom') {
      return { top: '53%', left: '5%', width: '90%', height: '42%' };
    }
    if (dir === 'east' || dir === 'right') {
      return { top: '5%', left: '53%', width: '42%', height: '90%' };
    }
    if (dir === 'west' || dir === 'left') {
      return { top: '5%', left: '5%', width: '42%', height: '90%' };
    }
    // Fallback: stack top/bottom
    return wingIndex === 0
      ? { top: '5%', left: '5%', width: '90%', height: '42%' }
      : { top: '53%', left: '5%', width: '90%', height: '42%' };
  }

  // 3-4 wings: quadrant layout
  if (dir === 'north' || dir === 'top') {
    return { top: '5%', left: '25%', width: '50%', height: '22%' };
  }
  if (dir === 'south' || dir === 'bottom') {
    return { top: '73%', left: '25%', width: '50%', height: '22%' };
  }
  if (dir === 'east' || dir === 'right') {
    return { top: '30%', left: '73%', width: '22%', height: '40%' };
  }
  if (dir === 'west' || dir === 'left') {
    return { top: '30%', left: '5%', width: '22%', height: '40%' };
  }

  // Unknown direction: grid fallback
  const row = Math.floor(wingIndex / 2);
  const col = wingIndex % 2;
  return {
    top: `${5 + row * 48}%`,
    left: `${5 + col * 48}%`,
    width: '42%',
    height: '42%',
  };
}

export default function FloorPlanOverlay({
  propertyId,
  unitPositionMap,
  rentRollUnits,
  activeFilter,
  asOfDate,
  floorPlanImages,
  onUnitClick,
  selectedUnits = [],
}: FloorPlanOverlayProps) {
  // Available floors from position map
  const floors = unitPositionMap.floors;
  const floorImageMap = useMemo(() => {
    const map = new Map<number, FloorPlanImageEntry>();
    for (const img of floorPlanImages) {
      map.set(img.floor, img);
    }
    return map;
  }, [floorPlanImages]);

  // Default to first floor that has an image
  const firstFloorWithImage = floors.find(f => floorImageMap.has(f.floor))?.floor ?? floors[0]?.floor ?? 1;
  const [activeFloor, setActiveFloor] = useState(firstFloorWithImage);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Unit lookup map
  const unitMap = useMemo(() => {
    const map = new Map<string, RentRollUnit>();
    for (const u of rentRollUnits) {
      if (u.unit_number) map.set(u.unit_number, u);
    }
    return map;
  }, [rentRollUnits]);

  // Rent stats for color computation
  const maxFloor = Math.max(...floors.map(f => f.floor), 1);
  const rentStats = useMemo(
    () => computeRentStatsFromUnits(rentRollUnits, maxFloor),
    [rentRollUnits, maxFloor],
  );

  const refDate = useMemo(() => (asOfDate ? new Date(asOfDate) : new Date()), [asOfDate]);

  // Selected unit IDs for highlight
  const selectedUnitNumbers = useMemo(
    () => new Set(selectedUnits.map(u => u.rentRollUnit?.unit_number).filter(Boolean)),
    [selectedUnits],
  );

  // Active floor data
  const activeFloorData = floors.find(f => f.floor === activeFloor);
  const hasImageForFloor = floorImageMap.has(activeFloor);
  const imageUrl = hasImageForFloor
    ? stackingService.getFloorPlanImageUrl(propertyId, activeFloor)
    : null;

  // Handle floor tab change
  const handleFloorChange = useCallback((floor: number) => {
    setActiveFloor(floor);
    setImageLoaded(false);
    setImageError(false);
  }, []);

  // Handle unit marker click
  const handleUnitClick = useCallback(
    (unitNumber: string, floor: number, position: number, wing: FloorPlanWing, e: React.MouseEvent) => {
      if (!onUnitClick) return;
      const rentRollUnit = unitMap.get(unitNumber);
      const status: 'occupied' | 'vacant' | 'unknown' = rentRollUnit
        ? rentRollUnit.is_occupied === true
          ? 'occupied'
          : rentRollUnit.is_occupied === false
            ? 'vacant'
            : 'unknown'
        : 'unknown';

      const data: UnitMeshData = {
        building_id: 'A',
        building_label: 'Building A',
        floor,
        position,
        status,
        rentRollUnit,
        wingDirection: wing.direction as 'north' | 'south' | 'east' | 'west',
      };
      onUnitClick(data, e);
    },
    [onUnitClick, unitMap],
  );

  return (
    <div className="relative w-full bg-[#0f0f1a] rounded-xl overflow-hidden" style={{ minHeight: 500 }}>
      {/* Floor tabs */}
      <div className="flex items-center gap-1 px-4 pt-3 pb-2 bg-[#1a1a2e]/80 border-b border-white/5">
        <span className="text-xs text-muted-foreground mr-2">Floor:</span>
        {floors.map((f) => {
          const hasImage = floorImageMap.has(f.floor);
          return (
            <button
              key={f.floor}
              onClick={() => hasImage && handleFloorChange(f.floor)}
              disabled={!hasImage}
              className={cn(
                'px-3 py-1 text-xs rounded-md transition-colors',
                activeFloor === f.floor
                  ? 'bg-violet-600 text-white'
                  : hasImage
                    ? 'bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-white'
                    : 'bg-white/[0.02] text-muted-foreground/40 cursor-not-allowed',
              )}
              title={hasImage ? `Floor ${f.floor}` : `No image uploaded for floor ${f.floor}`}
            >
              F{f.floor}
              {!hasImage && <span className="ml-1 text-[10px]">(no image)</span>}
            </button>
          );
        })}
        <span className="ml-auto text-xs text-muted-foreground">
          {activeFloorData ? `${activeFloorData.total_units_on_floor} units` : ''}
        </span>
      </div>

      {/* Image container */}
      <div ref={containerRef} className="relative w-full" style={{ minHeight: 450 }}>
        {/* Loading state */}
        {imageUrl && !imageLoaded && !imageError && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
          </div>
        )}

        {/* Error / no image state */}
        {(imageError || !imageUrl) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground gap-3">
            <ImageOff className="w-12 h-12 opacity-40" />
            <p className="text-sm">
              {!imageUrl
                ? `No floor plan image for Floor ${activeFloor}`
                : 'Failed to load floor plan image. Try re-uploading.'}
            </p>
          </div>
        )}

        {/* Floor plan image */}
        {imageUrl && (
          <img
            src={imageUrl}
            alt={`Floor ${activeFloor} plan`}
            className={cn(
              'w-full h-auto max-h-[700px] object-contain transition-opacity duration-300',
              imageLoaded ? 'opacity-60' : 'opacity-0',
            )}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
            draggable={false}
          />
        )}

        {/* Unit marker overlays */}
        {imageLoaded && activeFloorData && (
          <div className="absolute inset-0">
            {activeFloorData.wings.map((wing, wingIdx) => {
              const region = getWingRegion(wing.direction, wingIdx, activeFloorData.wings.length);
              // Compute grid dimensions for markers in this wing
              const unitCount = wing.unit_numbers.length;
              const cols = Math.ceil(Math.sqrt(unitCount * 1.5)); // slightly wider than tall
              const rows = Math.ceil(unitCount / cols);

              return (
                <div
                  key={wing.name || wingIdx}
                  className="absolute"
                  style={{
                    top: region.top,
                    left: region.left,
                    width: region.width,
                    height: region.height,
                  }}
                >
                  {/* Wing label */}
                  <div className="text-[10px] text-white/30 font-medium mb-1 px-1 truncate">
                    {wing.name.replace(/_/g, ' ')}
                  </div>
                  {/* Unit markers grid */}
                  <div
                    className="w-full h-[calc(100%-16px)] grid gap-1"
                    style={{
                      gridTemplateColumns: `repeat(${cols}, 1fr)`,
                      gridTemplateRows: `repeat(${rows}, 1fr)`,
                    }}
                  >
                    {wing.unit_numbers.map((unitNum, unitIdx) => {
                      const unit = unitMap.get(unitNum);
                      const color = getUnitColorHex(unit, activeFloor, activeFilter, refDate, rentStats);
                      const isSelected = selectedUnitNumbers.has(unitNum);

                      return (
                        <button
                          key={unitNum}
                          onClick={(e) => handleUnitClick(unitNum, activeFloor, unitIdx, wing, e)}
                          className={cn(
                            'flex items-center justify-center rounded-md text-[10px] font-mono font-semibold',
                            'transition-all duration-150 hover:scale-110 hover:z-10',
                            'border border-white/10 hover:border-white/30',
                            'min-w-[36px] min-h-[24px]',
                            isSelected && 'ring-2 ring-white ring-offset-1 ring-offset-[#0f0f1a] scale-110 z-10',
                          )}
                          style={{
                            backgroundColor: color,
                            color: '#fff',
                            textShadow: '0 1px 2px rgba(0,0,0,0.6)',
                          }}
                          title={unit
                            ? `${unitNum} — ${unit.is_occupied ? 'Occupied' : 'Vacant'}${unit.market_rent ? ` — $${unit.market_rent.toLocaleString()}/mo` : ''}`
                            : unitNum}
                        >
                          {unitNum}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
