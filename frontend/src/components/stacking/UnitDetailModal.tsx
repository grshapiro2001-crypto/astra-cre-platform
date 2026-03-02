/**
 * UnitDetailModal — Shows rent roll data for a single unit clicked in the 3D viewer.
 */
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { fmtCurrency } from '@/utils/formatUtils';
import type { UnitMeshData } from './StackingViewer3D';

interface UnitDetailModalProps {
  data: UnitMeshData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '---';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '---';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function calcLossToLease(market: number | null | undefined, inPlace: number | null | undefined): string {
  if (market == null || inPlace == null || market === 0) return '---';
  const pct = ((market - inPlace) / market) * 100;
  return `${pct.toFixed(1)}%`;
}

export function UnitDetailModal({ data, open, onOpenChange }: UnitDetailModalProps) {
  if (!data) return null;

  const rr = data.rentRollUnit;

  const statusLabel = data.status === 'occupied' ? 'Occupied' : data.status === 'vacant' ? 'Vacant' : 'Unknown';
  const statusColor =
    data.status === 'occupied'
      ? 'bg-primary/20 text-primary'
      : data.status === 'vacant'
        ? 'bg-rose-500/20 text-rose-400'
        : 'bg-muted text-muted-foreground';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span className="text-foreground">
              Unit {rr?.unit_number || `${data.building_id}-${data.floor}${String(data.position).padStart(2, '0')}`}
            </span>
            <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', statusColor)}>
              {statusLabel}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 pt-2">
          <MetricRow label="Building" value={data.building_label} />
          <MetricRow label="Floor" value={String(data.floor)} />
          <MetricRow label="Market Rent" value={fmtCurrency(rr?.market_rent)} />
          <MetricRow label="In-Place Rent" value={fmtCurrency(rr?.in_place_rent)} />
          <MetricRow label="Loss-to-Lease" value={calcLossToLease(rr?.market_rent, rr?.in_place_rent)} />
          <MetricRow label="Sqft" value={rr?.sqft != null ? rr.sqft.toLocaleString() : '---'} />
          <MetricRow label="Lease Start" value={formatDate(rr?.lease_start)} />
          <MetricRow label="Lease End" value={formatDate(rr?.lease_end)} />
          {rr?.unit_type && <MetricRow label="Unit Type" value={rr.unit_type} />}
          {rr?.status && <MetricRow label="Status Detail" value={rr.status} />}
        </div>

        {!rr && (
          <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border/60">
            No rent roll data linked to this unit position.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-sm font-mono font-semibold text-foreground">{value}</p>
    </div>
  );
}
