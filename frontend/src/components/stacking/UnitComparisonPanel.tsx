/**
 * UnitComparisonPanel — Floating comparison table for multi-selected units.
 * Appears at the bottom-center when 2+ units are selected via Ctrl+Click.
 */
import { cn } from '@/lib/utils';
import type { UnitMeshData } from './StackingViewer3D';

interface UnitComparisonPanelProps {
  selectedUnits: UnitMeshData[];
  onClear: () => void;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function calcLTL(rr?: { market_rent?: number | null; in_place_rent?: number | null }): string {
  if (!rr?.market_rent || !rr?.in_place_rent || rr.market_rent === 0) return '—';
  const pct = ((rr.market_rent - rr.in_place_rent) / rr.market_rent) * 100;
  return `${pct.toFixed(1)}%`;
}

export function UnitComparisonPanel({ selectedUnits, onClear }: UnitComparisonPanelProps) {
  if (selectedUnits.length < 2) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-card/95 backdrop-blur-md border border-border rounded-2xl shadow-2xl p-4 max-w-3xl">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">Comparing {selectedUnits.length} Units</h3>
        <button
          onClick={onClear}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Clear
        </button>
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-muted-foreground border-b border-border/60">
            <th className="text-left py-1.5 font-medium">Unit</th>
            <th className="text-left py-1.5 font-medium">Type</th>
            <th className="text-right py-1.5 font-medium">SQFT</th>
            <th className="text-right py-1.5 font-medium">Market</th>
            <th className="text-right py-1.5 font-medium">In-Place</th>
            <th className="text-right py-1.5 font-medium">LTL</th>
            <th className="text-right py-1.5 font-medium">Lease End</th>
            <th className="text-center py-1.5 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {selectedUnits.map((u, i) => {
            const rr = u.rentRollUnit;
            return (
              <tr key={rr?.id ?? i} className="border-b border-border/30 last:border-0">
                <td className="py-1.5 font-mono font-semibold">{rr?.unit_number || '—'}</td>
                <td className="py-1.5">{rr?.unit_type || '—'}</td>
                <td className="py-1.5 text-right font-mono">{rr?.sqft?.toLocaleString() || '—'}</td>
                <td className="py-1.5 text-right font-mono">
                  {rr?.market_rent ? `$${rr.market_rent.toLocaleString()}` : '—'}
                </td>
                <td className="py-1.5 text-right font-mono">
                  {rr?.in_place_rent ? `$${rr.in_place_rent.toLocaleString()}` : '—'}
                </td>
                <td className="py-1.5 text-right font-mono text-amber-400">{calcLTL(rr)}</td>
                <td className="py-1.5 text-right font-mono">{rr?.lease_end ? formatDate(rr.lease_end) : '—'}</td>
                <td className="py-1.5 text-center">
                  <span
                    className={cn(
                      'text-[10px] px-1.5 py-0.5 rounded-full',
                      u.status === 'occupied' ? 'bg-primary/20 text-primary' : 'bg-rose-500/20 text-rose-400',
                    )}
                  >
                    {u.status === 'occupied' ? 'Occ' : 'Vac'}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
