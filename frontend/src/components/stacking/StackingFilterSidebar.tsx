/**
 * StackingFilterSidebar — Filter buttons + dynamic legend for 3D stacking viewer.
 * Allows users to switch between data visualization modes that recolor unit meshes.
 */
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { StackingFilterType, FilterLegend } from '@/types/property';

interface StackingFilterSidebarProps {
  activeFilter: StackingFilterType;
  onFilterChange: (filter: StackingFilterType) => void;
  legend: FilterLegend;
}

const FILTER_OPTIONS: { id: StackingFilterType; label: string }[] = [
  { id: 'occupancy', label: 'Occupancy' },
  { id: 'floor_level', label: 'Floor Level' },
  { id: 'floor_plan', label: 'Floor Plan' },
  { id: 'expirations', label: 'Expirations' },
  { id: 'loss_to_lease', label: 'Loss-to-Lease' },
  { id: 'market_rents', label: 'Market Rents' },
  { id: 'contract_rents', label: 'Contract Rents' },
];

export function StackingFilterSidebar({ activeFilter, onFilterChange, legend }: StackingFilterSidebarProps) {
  return (
    <div className="w-64 shrink-0 bg-card/30 border-l border-border flex flex-col rounded-r-2xl overflow-hidden"
         style={{ height: 480 }}>
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <h3 className="text-[10px] font-semibold tracking-widest text-muted-foreground/70 uppercase">
          Visualization
        </h3>
      </div>

      {/* Filter buttons */}
      <div className="flex-1 overflow-y-auto px-3 space-y-1">
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

      {/* Legend */}
      <div className="border-t border-border/60 px-4 py-3">
        <h4 className="text-[10px] font-semibold tracking-widest text-muted-foreground/70 uppercase mb-2">
          Legend
        </h4>

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
