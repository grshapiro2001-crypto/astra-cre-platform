/**
 * StackingFilterSidebar — Filter buttons + dynamic legend for 3D stacking viewer.
 * VISUALIZATION section: single-select radio buttons for color modes.
 * FLOOR PLAN FILTER section: multi-select checklist that dims unchecked floor plans.
 */
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import type { StackingFilterType, FilterLegend } from '@/types/property';

interface StackingFilterSidebarProps {
  activeFilter: StackingFilterType;
  onFilterChange: (filter: StackingFilterType) => void;
  legend: FilterLegend;
  asOfDate?: string | null;
  floorPlanCounts: Map<string, number>;
  checkedFloorPlans: Set<string>;
  onFloorPlanToggle: (type: string) => void;
  onFloorPlanSelectAll: () => void;
  onFloorPlanClearAll: () => void;
  isolatedFloor?: number | null;
  onFloorIsolate?: (floor: number | null) => void;
  maxFloors?: number;
}

const FILTER_OPTIONS: { id: StackingFilterType; label: string }[] = [
  { id: 'occupancy', label: 'Occupancy' },
  { id: 'floor_level', label: 'Floor Level' },
  { id: 'expirations', label: 'Expirations' },
  { id: 'loss_to_lease', label: 'Loss-to-Lease' },
  { id: 'market_rents', label: 'Market Rents' },
  { id: 'contract_rents', label: 'Contract Rents' },
];

export function StackingFilterSidebar({
  activeFilter,
  onFilterChange,
  legend,
  asOfDate,
  floorPlanCounts,
  checkedFloorPlans,
  onFloorPlanToggle,
  onFloorPlanSelectAll,
  onFloorPlanClearAll,
  isolatedFloor,
  onFloorIsolate,
  maxFloors,
}: StackingFilterSidebarProps) {
  const sortedFloorPlans = [...floorPlanCounts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const allChecked = floorPlanCounts.size > 0 && checkedFloorPlans.size === floorPlanCounts.size;

  return (
    <div className="w-64 shrink-0 bg-card/30 border-l border-border flex flex-col rounded-r-2xl overflow-hidden"
         style={{ height: 540 }}>
      {/* Visualization header */}
      <div className="px-4 pt-4 pb-2">
        <h3 className="text-[10px] font-semibold tracking-widest text-muted-foreground/70 uppercase">
          Visualization
        </h3>
      </div>

      {/* Visualization filter buttons */}
      <div className="px-3 space-y-1">
        {FILTER_OPTIONS.map((opt) => (
          <Button
            key={opt.id}
            variant="ghost"
            size="sm"
            className={cn(
              'w-full justify-start text-xs h-8',
              activeFilter === opt.id
                ? 'bg-primary/20 border border-primary/40 text-primary-foreground'
                : 'hover:bg-muted text-muted-foreground',
            )}
            onClick={() => onFilterChange(opt.id)}
          >
            {activeFilter === opt.id && (
              <span className="w-1.5 h-1.5 rounded-full bg-primary mr-2 shrink-0" />
            )}
            {opt.label}
          </Button>
        ))}
      </div>

      {/* Floor Plan Filter */}
      {sortedFloorPlans.length > 0 && (
        <div className="border-t border-border/60 px-4 py-3 flex flex-col min-h-0" style={{ maxHeight: '55%' }}>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[10px] font-semibold tracking-widest text-muted-foreground/70 uppercase">
              Floor Plan Filter
            </h3>
            <button
              type="button"
              className="text-[10px] text-primary hover:underline"
              onClick={allChecked ? onFloorPlanClearAll : onFloorPlanSelectAll}
            >
              {allChecked ? 'Clear All' : 'Select All'}
            </button>
          </div>
          <div className="overflow-y-auto space-y-1 flex-1 min-h-0">
            {sortedFloorPlans.map(([type, count]) => (
              <label key={type} className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer py-0.5">
                <Checkbox
                  checked={checkedFloorPlans.has(type)}
                  onCheckedChange={() => onFloorPlanToggle(type)}
                  className="h-3.5 w-3.5"
                />
                <span className="flex-1 truncate">{type}</span>
                <span className="text-[10px] text-muted-foreground/50 shrink-0">{count} units</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Floor Isolation */}
      {maxFloors && maxFloors > 1 && onFloorIsolate && (
        <div className="border-t border-border/60 px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[10px] font-semibold tracking-widest text-muted-foreground/70 uppercase">
              Floor Isolation
            </h3>
            {isolatedFloor !== null && isolatedFloor !== undefined && (
              <button className="text-[10px] text-primary hover:underline" onClick={() => onFloorIsolate(null)}>
                Show All
              </button>
            )}
          </div>
          <div className="flex gap-1">
            {Array.from({ length: maxFloors }, (_, i) => i + 1).map(floor => (
              <button
                key={floor}
                onClick={() => onFloorIsolate(isolatedFloor === floor ? null : floor)}
                className={cn(
                  "flex-1 py-1.5 text-xs font-mono rounded-md transition-colors",
                  isolatedFloor === floor
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                )}
              >
                F{floor}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="border-t border-border/60 px-4 py-3 mt-auto">
        <h4 className="text-[10px] font-semibold tracking-widest text-muted-foreground/70 uppercase mb-2">
          Legend
        </h4>

        {activeFilter === 'expirations' && (
          <p className="text-xs text-muted-foreground mb-2">
            {asOfDate
              ? `Relative to ${new Date(asOfDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
              : 'As of today'}
          </p>
        )}

        {legend.type === 'categorical' && (
          <div className="space-y-1.5">
            {legend.items.map((item) => (
              <div key={item.label} className="flex items-center gap-2 text-xs text-muted-foreground">
                <span
                  className="w-3 h-3 rounded-sm shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                {item.label}
              </div>
            ))}
          </div>
        )}

        {legend.type === 'gradient' && (
          <div className="space-y-1.5">
            <div
              className="h-3 w-full rounded-sm"
              style={{
                background: `linear-gradient(to right, ${legend.minColor}, ${legend.maxColor})`,
              }}
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>{legend.minLabel}</span>
              <span>{legend.maxLabel}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
