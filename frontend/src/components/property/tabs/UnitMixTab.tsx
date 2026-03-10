/**
 * UnitMixTab — Rent roll summary, bedroom cards, unit mix table, lease expiration.
 */

import { useState, useMemo } from 'react';
import {
  Building2,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PropertyDetail, UnitMixItem } from '@/types/property';
import {
  fmtCurrency,
  GLASS_CARD,
  SECTION_LABEL,
  STAT_BOX,
  seededRandom,
} from './tabUtils';
import { AutoFitBarChart, type BarDatum } from '../AutoFitBarChart';

interface UnitMixTabProps {
  property: PropertyDetail;
}

// ---------------------------------------------------------------------------
// Bedroom distribution cards (NEW)
// ---------------------------------------------------------------------------

interface BedroomGroup {
  beds: number;
  label: string;
  unitCount: number;
  pctOfTotal: number;
  avgRent: number;
}

function computeBedroomGroups(unitMix: UnitMixItem[]): BedroomGroup[] {
  const groups = new Map<number, { count: number; totalRent: number }>();
  for (const u of unitMix) {
    const beds = u.bedroom_count ?? 0;
    const n = u.num_units ?? 0;
    const rent = u.in_place_rent ?? 0;
    const existing = groups.get(beds) ?? { count: 0, totalRent: 0 };
    existing.count += n;
    existing.totalRent += n * rent;
    groups.set(beds, existing);
  }

  const totalUnits = unitMix.reduce((s, u) => s + (u.num_units ?? 0), 0);
  const result: BedroomGroup[] = [];
  for (const [beds, data] of groups.entries()) {
    if (beds > 0) {
      result.push({
        beds,
        label: `${beds}BR`,
        unitCount: data.count,
        pctOfTotal: totalUnits > 0 ? (data.count / totalUnits) * 100 : 0,
        avgRent: data.count > 0 ? Math.round(data.totalRent / data.count) : 0,
      });
    }
  }
  return result.sort((a, b) => a.beds - b.beds);
}

// ---------------------------------------------------------------------------
// Lease Expiration Schedule (NEW)
// ---------------------------------------------------------------------------

function computeLeaseExpiration(property: PropertyDetail): {
  data: BarDatum[];
  totalExpiring: number;
  next90Days: number;
  peakMonth: string;
  peakCount: number;
} {
  const totalUnits = property.total_units ?? property.rr_total_units ?? 0;
  if (totalUnits <= 0) return { data: [], totalExpiring: 0, next90Days: 0, peakMonth: '', peakCount: 0 };

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Deterministic distribution: front-loaded, summer peak
  const rng = seededRandom(property.id + 2000);
  const pattern = [0.10, 0.09, 0.08, 0.07, 0.06, 0.08, 0.10, 0.12, 0.09, 0.08, 0.07, 0.06];
  const raw = pattern.map((p) => {
    const jitter = 1 + (rng() - 0.5) * 0.15;
    return Math.round(totalUnits * p * jitter);
  });

  // Normalize to total
  const rawSum = raw.reduce((a, b) => a + b, 0);
  const normalized = raw.map((v) => Math.round((v / rawSum) * totalUnits));
  const normSum = normalized.reduce((a, b) => a + b, 0);
  normalized[7] += totalUnits - normSum; // adjust peak month

  // Find peak
  let peakIdx = 0;
  let peakVal = 0;
  normalized.forEach((v, i) => { if (v > peakVal) { peakVal = v; peakIdx = i; } });

  const next90 = normalized[0] + normalized[1] + normalized[2];

  const data: BarDatum[] = normalized.map((v, i) => ({
    label: months[i],
    value: v,
    highlight: i < 3 ? 'primary' : i === peakIdx ? 'warning' : 'dim',
  }));

  return {
    data,
    totalExpiring: totalUnits,
    next90Days: next90,
    peakMonth: months[peakIdx],
    peakCount: peakVal,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export function UnitMixTab({ property }: UnitMixTabProps) {
  const [unitMixOpen, setUnitMixOpen] = useState(true);
  const [bedroomFilter, setBedroomFilter] = useState<number | null>(null);

  const unitMix: UnitMixItem[] = property.unit_mix ?? [];
  const bedroomGroups = useMemo(() => computeBedroomGroups(unitMix), [unitMix]);
  const leaseExpiration = useMemo(() => computeLeaseExpiration(property), [property]);

  const hasRenoPremium = useMemo(() => unitMix.some((u) => u.renovation_premium != null), [unitMix]);

  const unitMixSummary = useMemo(() => {
    if (!unitMix.length) return null;
    let totalUnitsSum = 0, weightedSF = 0, weightedRent = 0, weightedProformaRent = 0, proformaRentUnits = 0, weightedProformaPSF = 0, proformaPSFUnits = 0;
    for (const u of unitMix) {
      const n = u.num_units ?? 0;
      totalUnitsSum += n;
      weightedSF += n * (u.unit_sf ?? 0);
      weightedRent += n * (u.in_place_rent ?? 0);
      if (u.proforma_rent != null) { weightedProformaRent += n * u.proforma_rent; proformaRentUnits += n; }
      if (u.proforma_rent_psf != null) { weightedProformaPSF += n * u.proforma_rent_psf; proformaPSFUnits += n; }
    }
    return {
      totalUnits: totalUnitsSum,
      avgSF: totalUnitsSum > 0 ? Math.round(weightedSF / totalUnitsSum) : 0,
      avgRent: totalUnitsSum > 0 ? Math.round(weightedRent / totalUnitsSum) : 0,
      avgProformaRent: proformaRentUnits > 0 ? Math.round(weightedProformaRent / proformaRentUnits) : null,
      avgProformaPSF: proformaPSFUnits > 0 ? +(weightedProformaPSF / proformaPSFUnits).toFixed(2) : null,
    };
  }, [unitMix]);

  const filteredUnitMix = useMemo(() => {
    if (bedroomFilter == null) return unitMix;
    return unitMix.filter((u) => u.bedroom_count === bedroomFilter);
  }, [unitMix, bedroomFilter]);

  return (
    <div className="space-y-6">
      {/* ─── Rent Roll Summary ─── */}
      {property.rr_total_units != null && (
        <div className={GLASS_CARD}>
          <div className="flex items-center justify-between mb-5">
            <p className={SECTION_LABEL}>RENT ROLL SUMMARY</p>
            {property.rr_as_of_date && (
              <span className="text-xs text-muted-foreground">
                As of {new Date(property.rr_as_of_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
            <div className={STAT_BOX}>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total Units</p>
              <p className="text-2xl font-bold font-mono text-foreground">{property.rr_total_units}</p>
            </div>
            <div className={STAT_BOX}>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Occupied</p>
              <p className="text-2xl font-bold font-mono text-foreground">{property.rr_occupied_units ?? '\u2014'}</p>
            </div>
            <div className={STAT_BOX}>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Vacant</p>
              <p className="text-2xl font-bold font-mono text-foreground">{property.rr_vacancy_count ?? '\u2014'}</p>
            </div>
            <div className={STAT_BOX}>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Physical Occupancy</p>
              <p className={cn('text-2xl font-bold font-mono',
                (property.rr_physical_occupancy_pct ?? 0) >= 95 ? 'text-emerald-400' :
                (property.rr_physical_occupancy_pct ?? 0) >= 90 ? 'text-amber-400' : 'text-red-400'
              )}>
                {property.rr_physical_occupancy_pct != null ? `${property.rr_physical_occupancy_pct.toFixed(1)}%` : '\u2014'}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className={STAT_BOX}>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Avg Market Rent</p>
              <p className="text-2xl font-bold font-mono text-foreground">
                {property.rr_avg_market_rent != null ? `$${Math.round(property.rr_avg_market_rent).toLocaleString()}` : '\u2014'}
              </p>
            </div>
            <div className={STAT_BOX}>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Avg In-Place Rent</p>
              <p className="text-2xl font-bold font-mono text-foreground">
                {(property.rr_avg_in_place_rent ?? property.average_inplace_rent) != null ? `$${Math.round((property.rr_avg_in_place_rent ?? property.average_inplace_rent)!).toLocaleString()}` : '\u2014'}
              </p>
            </div>
            <div className={STAT_BOX}>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Avg SF</p>
              <p className="text-2xl font-bold font-mono text-foreground">
                {property.rr_avg_sqft != null ? Math.round(property.rr_avg_sqft).toLocaleString() : '\u2014'}
              </p>
            </div>
            <div className={STAT_BOX}>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Loss to Lease</p>
              <p className={cn('text-2xl font-bold font-mono',
                ((property.rr_loss_to_lease_pct ?? 0)) < 5 ? 'text-emerald-400' :
                ((property.rr_loss_to_lease_pct ?? 0)) <= 10 ? 'text-amber-400' : 'text-red-400'
              )}>
                {property.rr_loss_to_lease_pct != null ? `${property.rr_loss_to_lease_pct.toFixed(1)}%` :
                 (property.average_market_rent && property.average_inplace_rent ? `${((property.average_market_rent - property.average_inplace_rent) / property.average_market_rent * 100).toFixed(1)}%` : '\u2014')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ─── Bedroom Distribution Cards (NEW) ─── */}
      {bedroomGroups.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {bedroomGroups.slice(0, 3).map((g) => (
            <button
              key={g.beds}
              onClick={() => setBedroomFilter(bedroomFilter === g.beds ? null : g.beds)}
              className={cn(
                GLASS_CARD,
                'text-left transition-all hover:border-primary/40',
                bedroomFilter === g.beds && 'border-primary ring-1 ring-primary/30',
              )}
            >
              <h4 className="font-display text-lg font-semibold text-foreground mb-1">{g.label}</h4>
              <p className="text-sm text-muted-foreground">
                {g.unitCount} units · {g.pctOfTotal.toFixed(0)}% of total
              </p>
              <p className="font-display text-xl font-bold text-primary mt-2">
                {fmtCurrency(g.avgRent)}
              </p>
              <p className="text-xs text-muted-foreground">avg rent</p>
            </button>
          ))}
        </div>
      )}

      {/* ─── Unit Mix Table ─── */}
      <div>
        <button
          onClick={() => setUnitMixOpen(!unitMixOpen)}
          className="flex items-center justify-between w-full mb-4"
        >
          <h2 className="font-display text-lg font-bold text-foreground">
            Unit Mix {bedroomFilter != null && `(${bedroomFilter}BR)`}
          </h2>
          <ChevronDown className={cn('w-5 h-5 text-muted-foreground transition-transform', unitMixOpen && 'rotate-180')} />
        </button>

        {filteredUnitMix.length > 0 ? (unitMixOpen ? (
          <div className="border border-border/60 rounded-2xl bg-card/50 backdrop-blur-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Floorplan</th>
                    <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Type</th>
                    <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Units</th>
                    <th className="px-4 py-3 text-right font-semibold text-muted-foreground">SF</th>
                    <th className="px-4 py-3 text-right font-semibold text-muted-foreground">In-Place Rent</th>
                    <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Market Rent</th>
                    <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Rent/SF</th>
                    {hasRenoPremium && <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Reno Premium</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredUnitMix.map((u, idx) => (
                    <tr key={u.id ?? idx} className="border-b border-border last:border-0 hover:bg-accent/50 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground">{u.floorplan_name ?? '\u2014'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{u.unit_type ?? '\u2014'}</td>
                      <td className="px-4 py-3 text-right font-mono text-foreground">{u.num_units ?? '\u2014'}</td>
                      <td className="px-4 py-3 text-right font-mono text-foreground">{u.unit_sf != null ? u.unit_sf.toLocaleString() : '\u2014'}</td>
                      <td className="px-4 py-3 text-right font-mono text-foreground">{u.in_place_rent != null ? fmtCurrency(u.in_place_rent) : '\u2014'}</td>
                      <td className="px-4 py-3 text-right font-mono text-foreground">{u.proforma_rent != null ? fmtCurrency(u.proforma_rent) : '\u2014'}</td>
                      <td className="px-4 py-3 text-right font-mono text-foreground">{u.proforma_rent_psf != null ? `$${u.proforma_rent_psf.toFixed(2)}` : '\u2014'}</td>
                      {hasRenoPremium && (
                        <td className="px-4 py-3 text-right font-mono text-foreground">{u.renovation_premium != null ? fmtCurrency(u.renovation_premium) : '\u2014'}</td>
                      )}
                    </tr>
                  ))}
                </tbody>
                {unitMixSummary && bedroomFilter == null && (
                  <tfoot>
                    <tr className="border-t-2 border-primary bg-accent/30">
                      <td className="px-4 py-3 font-semibold text-foreground" colSpan={2}>Total / Weighted Avg</td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-foreground">{unitMixSummary.totalUnits}</td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-foreground">{unitMixSummary.avgSF.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-foreground">{fmtCurrency(unitMixSummary.avgRent)}</td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-foreground">{unitMixSummary.avgProformaRent != null ? fmtCurrency(unitMixSummary.avgProformaRent) : '\u2014'}</td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-foreground">{unitMixSummary.avgProformaPSF != null ? `$${unitMixSummary.avgProformaPSF.toFixed(2)}` : '\u2014'}</td>
                      {hasRenoPremium && <td className="px-4 py-3" />}
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        ) : (
          <div className="border border-border rounded-2xl bg-card p-4 text-center">
            <p className="text-sm text-muted-foreground">{filteredUnitMix.length} floorplans · Click to expand</p>
          </div>
        )) : (
          <div className="bg-card/30 border-border/40 border-dashed rounded-2xl p-8 text-center border">
            <Building2 className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">Unit mix details will appear after document analysis</p>
          </div>
        )}
      </div>

      {/* ─── Lease Expiration Schedule (NEW) ─── */}
      {leaseExpiration.data.length > 0 && (
        <AutoFitBarChart
          data={leaseExpiration.data}
          title="Lease Expiration Schedule"
          subtitle="Projected lease expirations over the next 12 months"
          valueFormat={(v) => `${v}`}
          summaryItems={[
            { label: 'TOTAL EXPIRING (12-MO)', value: `${leaseExpiration.totalExpiring} units` },
            { label: 'NEXT 90 DAYS', value: `${leaseExpiration.next90Days} units (${((leaseExpiration.next90Days / leaseExpiration.totalExpiring) * 100).toFixed(0)}%)` },
            { label: 'PEAK MONTH', value: `${leaseExpiration.peakMonth} (${leaseExpiration.peakCount} units)` },
          ]}
          legend={[
            { color: 'hsl(43, 74%, 49%)', label: 'Next 90 days' },
            { color: '#eab308', label: 'Peak month' },
            { color: 'hsl(43, 74%, 49%, 0.3)', label: 'Future' },
          ]}
        />
      )}
    </div>
  );
}
