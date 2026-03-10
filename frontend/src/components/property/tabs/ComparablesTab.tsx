/**
 * ComparablesTab — Rent comps, comp summary stats, map, sales comps.
 */

import { useMemo } from 'react';
import { TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PropertyDetail, RentCompItem, SalesCompItem } from '@/types/property';
import {
  fmtCurrency,
  SECTION_LABEL,
  STAT_BOX,
} from './tabUtils';
import { CompMap } from '@/components/property/CompMap';

interface ComparablesTabProps {
  property: PropertyDetail;
  rentCompTab: string;
  setRentCompTab: (t: string) => void;
}

// Mocked sales comps if API has none
const MOCK_SALES_COMPS: SalesCompItem[] = [
  { id: -1, property_name: 'Avana Perimeter', location: 'Sandy Springs, GA', year_built: 2016, units: 325, avg_rent: null, sale_date: 'Nov 2025', sale_price: 82_000_000, price_per_unit: 252_308, cap_rate: 0.0485, cap_rate_qualifier: null, buyer: null, seller: null },
  { id: -2, property_name: 'Cortland at Phipps', location: 'Buckhead, GA', year_built: 2018, units: 420, avg_rent: null, sale_date: 'Sep 2025', sale_price: 125_000_000, price_per_unit: 297_619, cap_rate: 0.046, cap_rate_qualifier: null, buyer: null, seller: null },
  { id: -3, property_name: 'Modera Sandy Springs', location: 'Sandy Springs, GA', year_built: 2019, units: 246, avg_rent: null, sale_date: 'Jul 2025', sale_price: 68_500_000, price_per_unit: 278_455, cap_rate: 0.051, cap_rate_qualifier: null, buyer: null, seller: null },
  { id: -4, property_name: 'The Edison Perimeter', location: 'Dunwoody, GA', year_built: 2015, units: 349, avg_rent: null, sale_date: 'May 2025', sale_price: 94_200_000, price_per_unit: 269_914, cap_rate: 0.049, cap_rate_qualifier: null, buyer: null, seller: null },
];

export function ComparablesTab({ property, rentCompTab, setRentCompTab }: ComparablesTabProps) {
  const rentComps: RentCompItem[] = property.rent_comps ?? [];
  const salesComps: SalesCompItem[] = (property.sales_comps?.length ?? 0) > 0
    ? property.sales_comps!
    : MOCK_SALES_COMPS;

  // Rent comp tab types
  const rentCompTabs = useMemo(() => {
    const types = new Set<string>();
    for (const c of rentComps) {
      if (c.bedroom_type) types.add(c.bedroom_type);
    }
    return Array.from(types).sort((a, b) => {
      const order = ['All', 'Studio', '1BR', '2BR', '3BR'];
      return order.indexOf(a) - order.indexOf(b);
    });
  }, [rentComps]);

  const filteredRentComps = useMemo(() => {
    if (rentCompTabs.length <= 1) return rentComps;
    const filtered = rentComps.filter((c) => c.bedroom_type === rentCompTab);
    const locationMap = new Map<string, string>();
    for (const c of rentComps) {
      if (c.location && c.bedroom_type === 'All' && c.comp_name) {
        locationMap.set(c.comp_name, c.location);
      }
    }
    return filtered.map((c) => ({
      ...c,
      location: c.location ?? (c.comp_name ? locationMap.get(c.comp_name) : null) ?? null,
    }));
  }, [rentComps, rentCompTab, rentCompTabs]);

  // Comp summary stats (NEW)
  const compStats = useMemo(() => {
    const comps = rentComps.filter((c) => c.bedroom_type === 'All' || rentCompTabs.length <= 1);
    if (comps.length === 0) return null;
    let totalRent = 0, rentCount = 0, totalPSF = 0, psfCount = 0, totalUnits = 0, unitCount = 0, totalSF = 0, sfCount = 0;
    for (const c of comps) {
      if (c.in_place_rent != null) { totalRent += c.in_place_rent; rentCount++; }
      if (c.in_place_rent_psf != null) { totalPSF += c.in_place_rent_psf; psfCount++; }
      if (c.num_units != null) { totalUnits += c.num_units; unitCount++; }
      if (c.avg_unit_sf != null) { totalSF += c.avg_unit_sf; sfCount++; }
    }
    return {
      avgRent: rentCount > 0 ? Math.round(totalRent / rentCount) : null,
      avgPSF: psfCount > 0 ? (totalPSF / psfCount).toFixed(2) : null,
      avgUnits: unitCount > 0 ? Math.round(totalUnits / unitCount) : null,
      avgSF: sfCount > 0 ? Math.round(totalSF / sfCount) : null,
    };
  }, [rentComps, rentCompTabs]);

  // Subject property rent for comparison
  const subjectRent = property.average_inplace_rent ?? property.rr_avg_in_place_rent;

  return (
    <div className="space-y-6">
      {/* ─── Rent Comparables ─── */}
      <h2 className="font-display text-lg font-bold text-foreground">Rent Comparables</h2>
      {rentComps.length > 0 ? (
        <div className="border border-border/60 rounded-2xl bg-card/50 backdrop-blur-xl overflow-hidden">
          {rentCompTabs.length > 1 && (
            <div className="px-4 pt-4">
              <div className="flex items-center rounded-xl p-1 bg-muted w-fit">
                {rentCompTabs.map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setRentCompTab(tab)}
                    className={cn(
                      'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                      rentCompTab === tab ? 'bg-accent text-primary' : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Property</th>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Location</th>
                  <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Units</th>
                  <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Avg SF</th>
                  <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Rent</th>
                  <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Rent/SF</th>
                </tr>
              </thead>
              <tbody>
                {/* Subject property row */}
                <tr className="border-b border-primary/30 bg-primary/5">
                  <td className="px-4 py-3 font-medium text-foreground">
                    {property.deal_name}
                    <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-primary/20 text-primary">SUBJECT</span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{property.property_address ?? '\u2014'}</td>
                  <td className="px-4 py-3 text-right font-mono text-foreground">{property.total_units ?? '\u2014'}</td>
                  <td className="px-4 py-3 text-right font-mono text-foreground">{property.rr_avg_sqft != null ? Math.round(property.rr_avg_sqft).toLocaleString() : '\u2014'}</td>
                  <td className="px-4 py-3 text-right font-mono text-primary font-semibold">{subjectRent != null ? fmtCurrency(subjectRent) : '\u2014'}</td>
                  <td className="px-4 py-3 text-right font-mono text-foreground">\u2014</td>
                </tr>
                {filteredRentComps.map((c, idx) => (
                  <tr key={c.id ?? idx} className="border-b border-border last:border-0 hover:bg-accent/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">
                      {c.comp_name || 'Unknown'}
                      {c.is_new_construction && (
                        <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">New</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{c.location ?? '\u2014'}</td>
                    <td className="px-4 py-3 text-right font-mono text-foreground">{c.num_units ?? '\u2014'}</td>
                    <td className="px-4 py-3 text-right font-mono text-foreground">{c.avg_unit_sf != null ? c.avg_unit_sf.toLocaleString() : '\u2014'}</td>
                    <td className="px-4 py-3 text-right font-mono text-foreground">{c.in_place_rent != null ? fmtCurrency(c.in_place_rent) : '\u2014'}</td>
                    <td className="px-4 py-3 text-right font-mono text-foreground">{c.in_place_rent_psf != null ? `$${c.in_place_rent_psf.toFixed(2)}` : '\u2014'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-card/30 border-border/40 border-dashed rounded-2xl p-8 text-center border">
          <TrendingUp className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">Rent comparables will appear after document analysis</p>
        </div>
      )}

      {/* ─── Comp Summary Stats (NEW) ─── */}
      {compStats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className={STAT_BOX}>
            <p className={SECTION_LABEL}>COMP AVG RENT</p>
            <p className="font-display text-lg font-semibold text-foreground mt-1">
              {compStats.avgRent != null ? fmtCurrency(compStats.avgRent) : '\u2014'}
            </p>
            {compStats.avgRent != null && subjectRent != null && (
              <p className={cn('text-xs mt-1 font-mono',
                subjectRent >= compStats.avgRent ? 'text-emerald-500' : 'text-amber-500'
              )}>
                Subject: {subjectRent >= compStats.avgRent ? '+' : ''}{fmtCurrency(subjectRent - compStats.avgRent)}
              </p>
            )}
          </div>
          <div className={STAT_BOX}>
            <p className={SECTION_LABEL}>COMP AVG $/SF</p>
            <p className="font-display text-lg font-semibold text-foreground mt-1">
              {compStats.avgPSF != null ? `$${compStats.avgPSF}` : '\u2014'}
            </p>
          </div>
          <div className={STAT_BOX}>
            <p className={SECTION_LABEL}>COMP AVG UNITS</p>
            <p className="font-display text-lg font-semibold text-foreground mt-1">
              {compStats.avgUnits ?? '\u2014'}
            </p>
          </div>
          <div className={STAT_BOX}>
            <p className={SECTION_LABEL}>COMP AVG SF</p>
            <p className="font-display text-lg font-semibold text-foreground mt-1">
              {compStats.avgSF != null ? compStats.avgSF.toLocaleString() : '\u2014'}
            </p>
          </div>
        </div>
      )}

      {/* ─── Location & Comparables Map ─── */}
      {property.property_address && (
        <>
          <h2 className="font-display text-lg font-bold text-foreground">Location &amp; Comparables</h2>
          {(property.submarket || property.metro) && (
            <div className="flex items-center gap-4 text-sm mb-2">
              {property.submarket && (
                <span className="text-muted-foreground">Submarket: <span className="font-semibold text-foreground">{property.submarket}</span></span>
              )}
              {property.metro && (
                <span className="text-muted-foreground">Metro: <span className="font-semibold text-foreground">{property.metro}</span></span>
              )}
            </div>
          )}
          <CompMap
            address={property.property_address || ''}
            propertyName={property.deal_name || ''}
            totalUnits={property.total_units ?? undefined}
            rentComps={rentComps || []}
            salesComps={property.bov_pricing_tiers || []}
          />
        </>
      )}

      {/* ─── Sales Comparables ─── */}
      <h2 className="font-display text-lg font-bold text-foreground">Sales Comparables</h2>
      <div className="border border-border/60 rounded-2xl bg-card/50 backdrop-blur-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Property</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Location</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Sale Date</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Price</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">$/Unit</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Cap Rate</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Units</th>
              </tr>
            </thead>
            <tbody>
              {salesComps.map((sc) => (
                <tr key={sc.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">{sc.property_name ?? '\u2014'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{sc.location ?? '\u2014'}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">{sc.sale_date ?? '\u2014'}</td>
                  <td className="px-4 py-3 text-right font-mono">{sc.sale_price != null ? fmtCurrency(sc.sale_price, true) : '\u2014'}</td>
                  <td className="px-4 py-3 text-right font-mono">{sc.price_per_unit != null ? `$${Math.round(sc.price_per_unit).toLocaleString()}` : '\u2014'}</td>
                  <td className="px-4 py-3 text-right font-mono">
                    {sc.cap_rate != null ? `${(sc.cap_rate * 100).toFixed(2)}%` : '\u2014'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{sc.units?.toLocaleString() ?? '\u2014'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
