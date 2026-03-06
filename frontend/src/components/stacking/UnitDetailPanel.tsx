/**
 * UnitDetailPanel — Slide-in side panel showing rich unit detail.
 * Replaces the center-screen Dialog modal so the 3D view remains visible.
 */
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fmtCurrency } from '@/utils/formatUtils';
import type { UnitMeshData } from './StackingViewer3D';
import type { RentRollUnit } from '@/types/property';

interface UnitDetailPanelProps {
  data: UnitMeshData | null;
  open: boolean;
  onClose: () => void;
  rentRollUnits: RentRollUnit[];
  isFullscreen?: boolean;
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

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-sm font-mono font-semibold text-foreground">{value}</p>
    </div>
  );
}

export function UnitDetailPanel({ data, open, onClose, rentRollUnits, isFullscreen }: UnitDetailPanelProps) {
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
    <div
      className={cn(
        'fixed top-0 h-full w-[380px] bg-card border-l border-border shadow-2xl',
        'transform transition-transform duration-300 ease-out overflow-y-auto',
        isFullscreen ? 'right-[256px] z-[52]' : 'right-0 z-50',
        open ? 'translate-x-0' : 'translate-x-full',
      )}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="p-6 pt-5">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <h2 className="text-lg font-semibold text-foreground">
            Unit {rr?.unit_number || `${data.building_id}-${data.floor}${String(data.position).padStart(2, '0')}`}
          </h2>
          <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', statusColor)}>
            {statusLabel}
          </span>
        </div>

        {/* Primary metrics grid */}
        <div className="grid grid-cols-2 gap-4">
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

        {/* Rent Comparison Bar */}
        {rr?.market_rent && rr?.in_place_rent && (
          <div className="mt-4 pt-4 border-t border-border/60">
            <h4 className="text-[10px] font-semibold tracking-widest text-muted-foreground/70 uppercase mb-3">
              Rent Comparison
            </h4>
            <div className="space-y-2">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Market</span>
                  <span className="font-mono font-semibold">${rr.market_rent.toLocaleString()}</span>
                </div>
                <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: '100%' }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">In-Place</span>
                  <span className="font-mono font-semibold">${rr.in_place_rent.toLocaleString()}</span>
                </div>
                <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full"
                    style={{ width: `${(rr.in_place_rent / rr.market_rent) * 100}%` }}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Loss-to-Lease:{' '}
                <span className="font-mono font-semibold text-amber-400">
                  {calcLossToLease(rr.market_rent, rr.in_place_rent)}
                </span>
              </p>
            </div>
          </div>
        )}

        {/* Lease Timeline */}
        {rr?.lease_start && rr?.lease_end && (() => {
          const start = new Date(rr.lease_start!).getTime();
          const end = new Date(rr.lease_end!).getTime();
          const now = Date.now();
          const total = end - start;
          if (total <= 0) return null;
          const elapsed = Math.max(0, Math.min(1, (now - start) / total));
          const remaining = Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)));
          return (
            <div className="mt-4 pt-4 border-t border-border/60">
              <h4 className="text-[10px] font-semibold tracking-widest text-muted-foreground/70 uppercase mb-3">
                Lease Timeline
              </h4>
              <div className="h-3 bg-muted/30 rounded-full overflow-hidden relative">
                <div className="h-full bg-primary/60 rounded-full" style={{ width: `${elapsed * 100}%` }} />
                <div
                  className="absolute top-0 h-full w-0.5 bg-foreground"
                  style={{ left: `${elapsed * 100}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                <span>{formatDate(rr.lease_start)}</span>
                <span className="font-mono font-semibold text-foreground">{remaining}d remaining</span>
                <span>{formatDate(rr.lease_end)}</span>
              </div>
            </div>
          );
        })()}

        {/* Similar Units */}
        {rr?.unit_type && (() => {
          const similar = rentRollUnits
            .filter(u => u.unit_type === rr.unit_type && u.id !== rr.id)
            .slice(0, 5);
          if (similar.length === 0) return null;
          return (
            <div className="mt-4 pt-4 border-t border-border/60">
              <h4 className="text-[10px] font-semibold tracking-widest text-muted-foreground/70 uppercase mb-3">
                Similar Units ({rr.unit_type})
              </h4>
              <div className="space-y-0">
                {similar.map(u => (
                  <div
                    key={u.id}
                    className="flex items-center justify-between text-xs py-1.5 border-b border-border/30 last:border-0"
                  >
                    <span className="font-mono text-muted-foreground">{u.unit_number}</span>
                    <div className="flex gap-3">
                      <span className="font-mono">
                        {u.market_rent ? `$${u.market_rent.toLocaleString()}` : '—'}
                      </span>
                      <span className="font-mono text-muted-foreground">
                        {u.in_place_rent ? `$${u.in_place_rent.toLocaleString()}` : '—'}
                      </span>
                      <span
                        className={cn(
                          'font-mono text-xs',
                          u.is_occupied ? 'text-primary' : 'text-rose-400',
                        )}
                      >
                        {u.is_occupied ? 'Occ' : 'Vac'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
