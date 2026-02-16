import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useLoadScript } from '@react-google-maps/api';
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  Sparkles,
  RefreshCw,
  MoreVertical,
  X,
  Database,
  Pencil,
  Building2,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Loader2,
  StickyNote,
  Trash2,
  FileText,
  Receipt,
  BarChart3,
  Upload,
  FileDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { propertyService } from '@/services/propertyService';
import { scoringService } from '@/services/scoringService';
import { fmtPercent, fmtCapRate, normalizePercent } from '@/utils/formatUtils';
import type { DealScoreResult } from '@/services/scoringService';
import { DealScoreBadge } from '@/components/scoring/DealScoreBadge';
import { DealScoreModal } from '@/components/scoring/DealScoreModal';
import { ScreeningBadge } from '@/components/screening/ScreeningBadge';
import { ScreeningModal } from '@/components/screening/ScreeningModal';
import { useUIStore } from '@/store/uiStore';
import type {
  PropertyDetail as PropertyDetailType,
  FinancialPeriod,
  BOVPricingTier,
  UnitMixItem,
  RentCompItem,
} from '@/types/property';
import { AnimatePresence, motion } from 'framer-motion';
import { PropertyDetailSkeleton } from '@/components/ui/PageSkeleton';
import { SensitivityAnalysis } from '@/components/property/SensitivityAnalysis';
import { CompMap } from '@/components/property/CompMap';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FinancialPeriodKey = 't3' | 't12' | 'y1';
type FinancialViewMode = 'total' | 'perUnit';

interface FinancialRowProps {
  label: string;
  value: number | null | undefined;
  isDeduction?: boolean;
  isTotal?: boolean;
  isHighlight?: boolean;
  percent?: number | null;
  totalUnits: number;
  viewMode: FinancialViewMode;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const fmtCurrency = (
  value: number | null | undefined,
  abbreviated = false,
): string => {
  if (value == null) return '---';
  if (abbreviated) {
    if (Math.abs(value) >= 1_000_000)
      return `$${(value / 1_000_000).toFixed(1)}M`;
    if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
};

const fmtPerUnit = (
  value: number | null | undefined,
  units: number,
): string => {
  if (value == null || units === 0) return '---';
  return fmtCurrency(Math.round(value / units));
};

const fmtDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const fmtNumber = (value: number | null | undefined): string => {
  if (value == null) return 'N/A';
  return value.toLocaleString('en-US');
};

const periodLabel = (key: FinancialPeriodKey): string => {
  switch (key) {
    case 't3':
      return 'T3';
    case 't12':
      return 'T12';
    case 'y1':
      return 'Y1 Pro Forma';
  }
};

const periodDescription = (key: FinancialPeriodKey): string => {
  switch (key) {
    case 't3':
      return 'Trailing 3 Month (Annualized)';
    case 't12':
      return 'Trailing 12 Month';
    case 'y1':
      return 'Year 1 Pro Forma';
  }
};

const docBadgeClass = (docType: string): string => {
  const d = docType.toUpperCase();
  if (d === 'BOV')
    return 'bg-blue-500/10 text-blue-600 dark:text-blue-400';
  if (d === 'OM')
    return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400';
  return 'bg-muted text-muted-foreground';
};

const ecoOccTextClass = (pct: number): string => {
  if (pct >= 90) return 'text-emerald-600 dark:text-emerald-400';
  if (pct >= 85) return 'text-amber-600 dark:text-amber-400';
  return 'text-rose-600 dark:text-rose-400';
};

const ecoOccBgClass = (pct: number): string => {
  if (pct >= 90)
    return 'bg-emerald-500/10 border-emerald-500/20';
  if (pct >= 85)
    return 'bg-amber-500/10 border-amber-500/20';
  return 'bg-rose-500/10 border-rose-500/20';
};

// ---------------------------------------------------------------------------
// FinancialRow
// ---------------------------------------------------------------------------

const FinancialRow = ({
  label,
  value,
  isDeduction = false,
  isTotal = false,
  isHighlight = false,
  percent = null,
  totalUnits,
  viewMode,
}: FinancialRowProps) => {
  if (value == null) return null;

  const display =
    viewMode === 'perUnit' && totalUnits > 0
      ? fmtPerUnit(value, totalUnits)
      : fmtCurrency(value);
  const sign = isDeduction && value > 0 ? '-' : '';

  return (
    <div
      className={cn(
        'flex items-center justify-between py-3',
        isTotal && 'border-t-2 border-primary mt-2',
        !isTotal && 'border-b border-border',
        isHighlight && 'bg-accent px-3 -mx-3 rounded-lg',
      )}
    >
      <span
        className={cn(
          isTotal || isHighlight
            ? 'font-semibold text-foreground'
            : 'text-muted-foreground',
          isDeduction && !isTotal && 'pl-4',
        )}
      >
        {label}
      </span>
      <div className="flex items-center gap-3">
        {percent != null && (
          <span className="text-sm font-mono text-muted-foreground">
            {percent.toFixed(1)}%
          </span>
        )}
        <span
          className={cn(
            'font-mono',
            (isTotal || isHighlight) && 'font-bold text-lg',
            isDeduction && !isTotal && value !== 0 && 'text-destructive',
            isDeduction && !isTotal && value === 0 && 'text-muted-foreground',
            !isDeduction && !isHighlight && !isTotal && 'text-foreground',
            isHighlight && 'text-foreground',
          )}
        >
          {sign}
          {display}
        </span>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export const PropertyDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // --- API state ---
  const [property, setProperty] = useState<PropertyDetailType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- UI state ---
  const [financialPeriod, setFinancialPeriod] =
    useState<FinancialPeriodKey>('t12');
  const [financialView, setFinancialView] =
    useState<FinancialViewMode>('total');
  const [selectedTierIdx, setSelectedTierIdx] = useState(0);
  const [capRateSlider, setCapRateSlider] = useState(5.0);
  const [pricingGuidance, setPricingGuidance] = useState(0);
  const [isSavingGuidance, setIsSavingGuidance] = useState(false);
  const [guidanceSaved, setGuidanceSaved] = useState(false);
  const [savedGuidanceValue, setSavedGuidanceValue] = useState(0);
  const [showSourcesPanel, setShowSourcesPanel] = useState(false);
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [propertyPhotoUrl, setPropertyPhotoUrl] = useState<string | null>(null);
  const [photoLoadFailed, setPhotoLoadFailed] = useState(false);

  // --- Scoring state ---
  const [dealScore, setDealScore] = useState<DealScoreResult | null>(null);
  const [showScoreModal, setShowScoreModal] = useState(false);

  // --- Screening state ---
  const [showScreeningModal, setShowScreeningModal] = useState(false);

  // --- Dialog state ---
  const [showReanalyzeDialog, setShowReanalyzeDialog] = useState(false);
  const [isReanalyzing, setIsReanalyzing] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // --- Comparison state from uiStore ---
  const comparisonPropertyIds = useUIStore((state) => state.comparisonPropertyIds);
  const togglePropertyComparison = useUIStore((state) => state.togglePropertyComparison);

  // --- Google Maps API ---
  const { isLoaded: mapsLoaded } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
    libraries: ['places'],
  });

  // -----------------------------------------------------------------------
  // Data fetching
  // -----------------------------------------------------------------------

  useEffect(() => {
    const fetchProperty = async () => {
      if (!id) return;
      setIsLoading(true);
      setError(null);
      try {
        const data = await propertyService.getProperty(parseInt(id));
        setProperty(data);

        // Initialise pricing guidance from persisted value
        if (data.user_guidance_price != null && data.user_guidance_price > 0) {
          setPricingGuidance(data.user_guidance_price);
          setSavedGuidanceValue(data.user_guidance_price);
        }

        // Initialise cap rate from first BOV tier if available
        if (data.bov_pricing_tiers?.length) {
          const firstCap =
            data.bov_pricing_tiers[0].cap_rates?.[0]?.cap_rate_value;
          if (firstCap) setCapRateSlider(normalizePercent(firstCap));
        }
      } catch (err: unknown) {
        const e = err as { response?: { data?: { detail?: string } } };
        setError(
          e.response?.data?.detail || 'Failed to load property.',
        );
      } finally {
        setIsLoading(false);
      }
    };
    fetchProperty();

    // Fetch deal score (non-blocking — score load doesn't block page)
    const fetchScore = async () => {
      if (!id) return;
      try {
        const score = await scoringService.getScore(parseInt(id));
        setDealScore(score);
      } catch {
        // Score fetch failure is non-critical — badge will show "—"
      }
    };
    fetchScore();
  }, [id]);

  // Fetch Google Places photo when property loads and Maps API is ready
  useEffect(() => {
    if (!property || !mapsLoaded || !property.property_address) return;
    if (!import.meta.env.VITE_GOOGLE_MAPS_API_KEY) return;

    // Reset states for new property
    setPropertyPhotoUrl(null);
    setPhotoLoadFailed(false);

    // Create a PlacesService instance
    const service = new google.maps.places.PlacesService(document.createElement('div'));
    const query = `${property.deal_name} ${property.property_address}`;

    service.findPlaceFromQuery(
      {
        query: query,
        fields: ['photos', 'name'],
      },
      (results, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && results?.[0]?.photos?.length) {
          try {
            // Get the URL of the first (best) photo
            const photoUrl = results[0].photos[0].getUrl({ maxWidth: 800, maxHeight: 600 });
            setPropertyPhotoUrl(photoUrl);
          } catch (error) {
            console.error('Error getting photo URL:', error);
            setPhotoLoadFailed(true);
          }
        } else {
          // No photos found or API error
          setPhotoLoadFailed(true);
        }
      }
    );
  }, [property, mapsLoaded]);

  // -----------------------------------------------------------------------
  // Actions
  // -----------------------------------------------------------------------

  const handleReanalyze = async () => {
    if (!id) return;
    setIsReanalyzing(true);
    try {
      const updated = await propertyService.reanalyzeProperty(
        parseInt(id),
      );
      setProperty(updated);
      setShowReanalyzeDialog(false);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } };
      alert(
        `Re-analysis failed: ${e.response?.data?.detail || 'Unknown error'}`,
      );
    } finally {
      setIsReanalyzing(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    setIsDeleting(true);
    try {
      await propertyService.deleteProperty(parseInt(id));
      navigate('/library');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } };
      alert(
        `Delete failed: ${e.response?.data?.detail || 'Unknown error'}`,
      );
      setIsDeleting(false);
    }
  };

  // -----------------------------------------------------------------------
  // Derived / computed values
  // -----------------------------------------------------------------------

  const getFinancials = (
    key: FinancialPeriodKey,
  ): FinancialPeriod | null | undefined => {
    if (!property) return null;
    if (key === 't3') return property.t3_financials;
    if (key === 't12') return property.t12_financials;
    return property.y1_financials;
  };

  const currentFinancials = getFinancials(financialPeriod);

  const availablePeriods = useMemo((): FinancialPeriodKey[] => {
    if (!property) return [];
    const out: FinancialPeriodKey[] = [];
    if (property.t3_financials) out.push('t3');
    if (property.t12_financials) out.push('t12');
    if (property.y1_financials) out.push('y1');
    return out;
  }, [property]);

  // Switch to first available period when the current one has no data
  useEffect(() => {
    if (
      availablePeriods.length > 0 &&
      !availablePeriods.includes(financialPeriod)
    ) {
      setFinancialPeriod(availablePeriods[0]);
    }
  }, [availablePeriods, financialPeriod]);

  const totalUnits = property?.total_units ?? 0;
  const totalSF = property?.total_residential_sf ?? 0;

  const economicOccupancy = useMemo(() => {
    const metrics = property?.calculated_metrics?.[financialPeriod];
    if (metrics?.economic_occupancy != null) {
      // Compute dollar amount from gsr if available
      const gsr = currentFinancials?.gsr ?? 0;
      return {
        percent: metrics.economic_occupancy,
        amount: gsr > 0 ? gsr * (metrics.economic_occupancy / 100) : null,
      };
    }
    if (!currentFinancials?.gsr) return { percent: 0, amount: null };
    const gpr = currentFinancials.gsr;
    const deductions =
      (currentFinancials.vacancy ?? 0) +
      (currentFinancials.concessions ?? 0) +
      (currentFinancials.bad_debt ?? 0) +
      (currentFinancials.non_revenue_units ?? 0);
    const amt = gpr - deductions;
    return {
      percent: gpr > 0 ? (amt / gpr) * 100 : 0,
      amount: amt,
    };
  }, [property, financialPeriod, currentFinancials]);

  const opexPercent = useMemo(() => {
    const metrics = property?.calculated_metrics?.[financialPeriod];
    if (metrics?.opex_ratio != null) return metrics.opex_ratio;
    if (!currentFinancials?.gsr || !currentFinancials?.total_opex) return 0;
    return (currentFinancials.total_opex / currentFinancials.gsr) * 100;
  }, [property, financialPeriod, currentFinancials]);

  const lossToLease = useMemo(() => {
    const mkt = property?.average_market_rent;
    const inp = property?.average_inplace_rent;
    if (mkt == null || inp == null || mkt === 0) return null;
    const diff = mkt - inp;
    return { amount: diff, percent: (diff / mkt) * 100 };
  }, [property]);

  const derivedPrice = useMemo(() => {
    const noi = currentFinancials?.noi;
    if (noi == null || capRateSlider === 0) return 0;
    return Math.round(noi / (capRateSlider / 100));
  }, [currentFinancials, capRateSlider]);

  const [rentCompTab, setRentCompTab] = useState<string>('All');

  const unitMix: UnitMixItem[] = property?.unit_mix ?? [];
  const rentComps: RentCompItem[] = property?.rent_comps ?? [];

  const hasRenovation = property != null && (
    property.renovation_cost_per_unit != null ||
    property.renovation_total_cost != null ||
    property.renovation_rent_premium != null ||
    property.renovation_roi_pct != null
  );

  const hasFinancials = availablePeriods.length > 0;

  const hasRenoPremium = useMemo(() => {
    return unitMix.some(u => u.renovation_premium != null);
  }, [unitMix]);

  const unitMixSummary = useMemo(() => {
    if (!unitMix.length) return null;
    let totalUnitsSum = 0;
    let weightedSF = 0;
    let weightedRent = 0;
    let weightedProformaRent = 0;
    let proformaRentUnits = 0;
    let weightedProformaPSF = 0;
    let proformaPSFUnits = 0;
    for (const u of unitMix) {
      const n = u.num_units ?? 0;
      totalUnitsSum += n;
      weightedSF += n * (u.unit_sf ?? 0);
      weightedRent += n * (u.in_place_rent ?? 0);
      if (u.proforma_rent != null) {
        weightedProformaRent += n * u.proforma_rent;
        proformaRentUnits += n;
      }
      if (u.proforma_rent_psf != null) {
        weightedProformaPSF += n * u.proforma_rent_psf;
        proformaPSFUnits += n;
      }
    }
    return {
      totalUnits: totalUnitsSum,
      avgSF: totalUnitsSum > 0 ? Math.round(weightedSF / totalUnitsSum) : 0,
      avgRent: totalUnitsSum > 0 ? Math.round(weightedRent / totalUnitsSum) : 0,
      avgProformaRent: proformaRentUnits > 0 ? Math.round(weightedProformaRent / proformaRentUnits) : null,
      avgProformaPSF: proformaPSFUnits > 0 ? +(weightedProformaPSF / proformaPSFUnits).toFixed(2) : null,
    };
  }, [unitMix]);

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
    const filtered = rentComps.filter(c => c.bedroom_type === rentCompTab);
    // Build location lookup from "All" entries so filtered views don't lose location
    const locationMap = new Map<string, string>();
    for (const c of rentComps) {
      if (c.location && c.bedroom_type === 'All' && c.comp_name) {
        locationMap.set(c.comp_name, c.location);
      }
    }
    return filtered.map(c => ({
      ...c,
      location: c.location ?? (c.comp_name ? locationMap.get(c.comp_name) : null) ?? null,
    }));
  }, [rentComps, rentCompTab, rentCompTabs]);

  const bovTiers: BOVPricingTier[] = property?.bov_pricing_tiers ?? [];
  const hasBOV = bovTiers.length > 0;
  const selectedTier: BOVPricingTier | null = hasBOV
    ? bovTiers[selectedTierIdx] ?? bovTiers[0]
    : null;

  const pricingMetrics = useMemo(() => {
    if (pricingGuidance <= 0 || !property) return null;
    const t12Noi = property.t12_financials?.noi;
    const y1Noi = property.y1_financials?.noi;
    return {
      goingInCap:
        t12Noi != null
          ? ((t12Noi / pricingGuidance) * 100).toFixed(2)
          : '---',
      y1Cap:
        y1Noi != null
          ? ((y1Noi / pricingGuidance) * 100).toFixed(2)
          : '---',
      pricePerUnit:
        totalUnits > 0 ? Math.round(pricingGuidance / totalUnits) : 0,
      pricePerSF: totalSF > 0 ? Math.round(pricingGuidance / totalSF) : 0,
    };
  }, [pricingGuidance, property, totalUnits, totalSF]);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <AnimatePresence mode="wait">
      {isLoading ? (
        <motion.div key="skeleton" initial={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
          <PropertyDetailSkeleton />
        </motion.div>
      ) : error || !property ? (
        <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center space-y-4 max-w-md">
              <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-8 h-8 text-destructive" />
              </div>
              <h2 className="font-display text-xl font-bold text-foreground">
                Error Loading Property
              </h2>
              <p className="text-muted-foreground">
                {error || 'Property not found.'}
              </p>
              <button
                onClick={() => navigate('/library')}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Library
              </button>
            </div>
          </div>
        </motion.div>
      ) : (
        <motion.div key="content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
    <div className="min-h-full -m-4 lg:-m-6">
      {/* ================================================================= */}
      {/* STICKY TOOLBAR                                                     */}
      {/* ================================================================= */}
      <div className="sticky top-16 z-20 bg-background/90 backdrop-blur-xl border-b border-border">
        <div className="max-w-6xl mx-auto px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            {/* Left: back + title */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(-1)}
                className="p-2.5 rounded-xl bg-card border border-border hover:bg-accent transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-muted-foreground" />
              </button>

              <DealScoreBadge
                score={dealScore?.total_score ?? null}
                size="md"
                onClick={() => dealScore && setShowScoreModal(true)}
              />

              {property.screening_verdict ? (
                <ScreeningBadge
                  verdict={property.screening_verdict}
                  size="md"
                  onClick={() => setShowScreeningModal(true)}
                />
              ) : (
                <span className="text-xs text-muted-foreground italic">
                  No screening criteria
                </span>
              )}

              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="font-display text-xl font-bold text-foreground">
                    {property.deal_name}
                  </h1>
                  {property.document_type ? (
                    <span
                      className={cn(
                        'px-2.5 py-1 rounded-lg text-2xs font-bold uppercase tracking-wider',
                        docBadgeClass(property.document_type),
                      )}
                    >
                      {property.document_type}
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-lg text-2xs font-bold uppercase tracking-wider bg-muted text-muted-foreground">
                      No Document
                    </span>
                  )}
                  {property.document_subtype && property.document_subtype.toUpperCase() !== property.document_type?.toUpperCase() && (
                    <span className="px-2.5 py-1 rounded-lg text-2xs font-bold uppercase tracking-wider bg-muted text-muted-foreground">
                      {property.document_subtype}
                    </span>
                  )}
                </div>
                <p className="text-sm mt-0.5 text-muted-foreground">
                  {property.property_address
                    ? `${property.property_address} \u00B7 `
                    : ''}
                  Last analyzed: {fmtDate(property.last_analyzed_at)}
                </p>
              </div>
            </div>

            {/* Right: actions */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowAIPanel(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
              >
                <Sparkles className="w-4 h-4" />
                AI Analysis
              </button>

              <button
                onClick={() => {
                  if (!property) return;
                  togglePropertyComparison(property.id);
                  const isCurrentlySelected = comparisonPropertyIds.includes(property.id);
                  const newIds = isCurrentlySelected
                    ? comparisonPropertyIds.filter(pid => pid !== property.id)
                    : [...comparisonPropertyIds, property.id];
                  if (newIds.length >= 2) {
                    navigate(`/compare?ids=${newIds.join(',')}`);
                  } else {
                    toast.success(
                      isCurrentlySelected
                        ? 'Removed from comparison'
                        : 'Added to comparison. Select 1+ more properties to compare.',
                      { duration: 2000 }
                    );
                  }
                }}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-colors",
                  property && comparisonPropertyIds.includes(property.id)
                    ? "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20 hover:bg-violet-500/20"
                    : "bg-card text-muted-foreground border-border hover:bg-accent"
                )}
              >
                <BarChart3 className="w-4 h-4" />
                {property && comparisonPropertyIds.includes(property.id) ? 'In Comparison' : 'Add to Comparison'}
              </button>

              <button
                onClick={async () => {
                  if (!property || isExporting) return;
                  setIsExporting(true);
                  try {
                    await propertyService.downloadSummaryPdf(property.id);
                    toast.success('PDF summary downloaded', { duration: 2000 });
                  } catch {
                    toast.error('Failed to generate PDF summary');
                  } finally {
                    setIsExporting(false);
                  }
                }}
                disabled={isExporting}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-card text-muted-foreground border border-border hover:bg-accent transition-colors disabled:opacity-50"
              >
                {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                Export Summary
              </button>

              <button
                onClick={() => setShowReanalyzeDialog(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Re-analyze
              </button>

              {/* More menu */}
              <div className="relative">
                <button
                  onClick={() => setShowMoreMenu(!showMoreMenu)}
                  className="p-2.5 rounded-xl bg-card border border-border text-muted-foreground hover:bg-accent transition-colors"
                >
                  <MoreVertical className="w-5 h-5" />
                </button>
                {showMoreMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowMoreMenu(false)}
                    />
                    <div className="absolute right-0 top-full mt-2 w-44 rounded-xl bg-card border border-border shadow-lg z-50 overflow-hidden animate-fade-in">
                      <button
                        onClick={() => {
                          setShowMoreMenu(false);
                          setShowDeleteDialog(true);
                        }}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete Property
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ================================================================= */}
      {/* MAIN CONTENT                                                       */}
      {/* ================================================================= */}
      <div className="max-w-6xl mx-auto px-6 lg:px-8 py-8 space-y-8">
        {/* --------------------------------------------------------------- */}
        {/* PROPERTY SNAPSHOT                                                */}
        {/* --------------------------------------------------------------- */}
        <section className="animate-fade-in">
          <div className="border border-border rounded-2xl bg-card overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_0.55fr]">
              {/* Left side - Property Info */}
              <div className="p-6">
                {/* Row 1 - Address */}
                <div className="mb-6">
                  <h3 className="text-xs font-semibold uppercase tracking-wider mb-3 text-muted-foreground">
                    Property Address
                  </h3>
                  <p className="font-semibold text-foreground">
                    {property.property_address || 'Address not available'}
                  </p>
                  <div className="mt-3 flex items-center gap-2 flex-wrap">
                    {property.submarket && (
                      <span className="px-2 py-1 rounded-lg text-xs font-medium bg-accent text-primary">
                        {property.submarket}
                      </span>
                    )}
                    {property.metro && (
                      <span className="px-2 py-1 rounded-lg text-xs font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400">
                        {property.metro}
                      </span>
                    )}
                    {property.property_type && (
                      <span className="px-2 py-1 rounded-lg text-xs font-medium bg-muted text-muted-foreground">
                        {property.property_type}
                      </span>
                    )}
                  </div>
                </div>

                {/* Row 2 - Two columns side by side */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {/* Property Details */}
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider mb-3 text-muted-foreground">
                      Property Details
                    </h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Units</span>
                        <span className="font-mono font-semibold text-foreground">
                          {fmtNumber(property.total_units)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total SF</span>
                        <span className="font-mono font-semibold text-foreground">
                          {fmtNumber(property.total_residential_sf)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Year Built</span>
                        <span className="font-mono font-semibold text-foreground">
                          {property.year_built ?? 'N/A'}
                        </span>
                      </div>
                      {totalUnits > 0 && totalSF > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Avg Unit SF
                          </span>
                          <span className="font-mono font-semibold text-foreground">
                            {Math.round(totalSF / totalUnits).toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Rent Analysis */}
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider mb-3 text-muted-foreground">
                      Rent Analysis
                    </h3>
                    <div className="space-y-3">
                      {property.average_market_rent != null && (
                        <div className="p-3 rounded-xl bg-accent">
                          <p className="text-xs text-primary">Market Rent</p>
                          <p className="font-mono text-xl font-bold text-foreground">
                            ${property.average_market_rent.toLocaleString()}
                            <span className="text-sm font-normal">/unit</span>
                          </p>
                        </div>
                      )}
                      {property.average_inplace_rent != null && (
                        <div className="p-3 rounded-xl bg-muted">
                          <p className="text-xs text-muted-foreground">
                            In-Place Rent
                          </p>
                          <p className="font-mono text-xl font-bold text-foreground">
                            ${property.average_inplace_rent.toLocaleString()}
                            <span className="text-sm font-normal">/unit</span>
                          </p>
                        </div>
                      )}
                      {lossToLease && (
                        <div className="flex items-center justify-between px-1">
                          <span className="text-sm text-muted-foreground">
                            Loss to Lease
                          </span>
                          <span className="font-mono font-semibold text-amber-600 dark:text-amber-400">
                            {lossToLease.percent.toFixed(1)}%
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right side - Google Places Photo */}
              <div className="relative h-full min-h-[200px] md:min-h-[320px]">
                {import.meta.env.VITE_GOOGLE_MAPS_API_KEY ? (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(property.property_address || '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full h-full relative group"
                  >
                    {propertyPhotoUrl && !photoLoadFailed ? (
                      <>
                        <img
                          src={propertyPhotoUrl}
                          alt={`Photo of ${property.property_address}`}
                          loading="lazy"
                          className="w-full h-full object-cover md:rounded-r-2xl"
                          onError={() => {
                            setPhotoLoadFailed(true);
                          }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-card/80 via-transparent to-transparent md:rounded-r-2xl pointer-events-none" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors md:rounded-r-2xl" />
                      </>
                    ) : photoLoadFailed ? (
                      <div className="w-full h-full flex items-center justify-center bg-accent md:rounded-r-2xl">
                        <div className="text-center">
                          <Building2 className="w-12 h-12 mx-auto mb-2 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">No Photo Available</p>
                        </div>
                      </div>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-accent md:rounded-r-2xl">
                        <div className="text-center">
                          <Loader2 className="w-12 h-12 mx-auto mb-2 text-muted-foreground animate-spin" />
                          <p className="text-sm text-muted-foreground">Loading photo...</p>
                        </div>
                      </div>
                    )}
                  </a>
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-accent md:rounded-r-2xl">
                    <div className="text-center">
                      <Building2 className="w-12 h-12 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">No Photo Available</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Economic Occupancy banner - kept separate */}
            <div className="p-6 pt-0">
              {economicOccupancy.percent > 0 && (
                <div
                  className={cn(
                    'mt-6 p-4 rounded-xl flex items-center justify-between border',
                    ecoOccBgClass(economicOccupancy.percent),
                  )}
                >
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Economic Occupancy ({financialPeriod.toUpperCase()})
                    </p>
                    <p className="text-xs mt-0.5 text-muted-foreground">
                      GSR minus Vacancy, Concessions, Bad Debt, Non-Revenue
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className={cn(
                        'font-mono text-3xl font-bold',
                        ecoOccTextClass(economicOccupancy.percent),
                      )}
                    >
                      {economicOccupancy.percent.toFixed(1)}%
                    </p>
                    {economicOccupancy.amount != null && (
                      <p className="font-mono text-sm text-muted-foreground">
                        {fmtCurrency(economicOccupancy.amount, true)}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* --------------------------------------------------------------- */}
        {/* PRICING ANALYSIS                                                 */}
        {/* --------------------------------------------------------------- */}
        {(hasBOV || currentFinancials?.noi != null) && (
          <section
            className="animate-fade-in"
            style={{ animationDelay: '100ms' }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-bold text-foreground">
                Pricing Analysis
              </h2>
              {hasBOV && bovTiers.length > 1 && (
                <div className="flex items-center rounded-xl p-1 bg-muted">
                  {bovTiers.map((tier, idx) => (
                    <button
                      key={tier.pricing_tier_id}
                      onClick={() => setSelectedTierIdx(idx)}
                      className={cn(
                        'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                        selectedTierIdx === idx
                          ? 'bg-accent text-primary'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {tier.tier_label || `Tier ${idx + 1}`}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="border border-border rounded-2xl bg-card p-6">
              {hasBOV && selectedTier ? (
                /* --- BOV scenario pricing --- */
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Left: tier metrics */}
                  <div>
                    {selectedTier.pricing != null && (
                      <div className="flex items-baseline gap-2 mb-6">
                        <span className="font-mono text-4xl font-bold text-foreground">
                          {fmtCurrency(selectedTier.pricing, true)}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {selectedTier.tier_label || 'Pricing'}
                        </span>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      {selectedTier.cap_rates.map((cr, idx) => (
                        <div key={idx} className="p-3 rounded-xl bg-accent">
                          <p className="text-xs text-muted-foreground">
                            {cr.cap_rate_type === 'Unknown' ? 'Cap Rate' : cr.cap_rate_type}
                          </p>
                          <p className="font-mono text-lg font-semibold text-primary">
                            {fmtCapRate(cr.cap_rate_value)}
                          </p>
                        </div>
                      ))}

                      {selectedTier.price_per_unit != null && (
                        <div className="p-3 rounded-xl bg-muted">
                          <p className="text-xs text-muted-foreground">
                            $/Unit
                          </p>
                          <p className="font-mono text-lg font-semibold text-foreground">
                            {fmtCurrency(selectedTier.price_per_unit, true)}
                          </p>
                        </div>
                      )}

                      {selectedTier.price_per_sf != null && (
                        <div className="p-3 rounded-xl bg-muted">
                          <p className="text-xs text-muted-foreground">
                            $/SF
                          </p>
                          <p className="font-mono text-lg font-semibold text-foreground">
                            ${selectedTier.price_per_sf.toFixed(0)}
                          </p>
                        </div>
                      )}

                      {selectedTier.return_metrics?.avg_cash_on_cash !=
                        null && (
                        <div className="p-3 rounded-xl bg-muted">
                          <p className="text-xs text-muted-foreground">
                            Cash-on-Cash
                          </p>
                          <p className="font-mono text-lg font-semibold text-foreground">
                            {fmtPercent(selectedTier.return_metrics.avg_cash_on_cash)}
                          </p>
                        </div>
                      )}

                      {selectedTier.return_metrics?.levered_irr != null && (
                        <div className="p-3 rounded-xl bg-accent">
                          <p className="text-xs text-muted-foreground">
                            Levered IRR
                          </p>
                          <p className="font-mono text-lg font-semibold text-primary">
                            {fmtPercent(selectedTier.return_metrics.levered_irr)}
                          </p>
                        </div>
                      )}

                      {selectedTier.return_metrics?.unlevered_irr != null && (
                        <div className="p-3 rounded-xl bg-muted">
                          <p className="text-xs text-muted-foreground">
                            Unlevered IRR
                          </p>
                          <p className="font-mono text-lg font-semibold text-foreground">
                            {fmtPercent(selectedTier.return_metrics.unlevered_irr)}
                          </p>
                        </div>
                      )}

                      {selectedTier.return_metrics?.equity_multiple !=
                        null && (
                        <div className="p-3 rounded-xl bg-muted">
                          <p className="text-xs text-muted-foreground">
                            Equity Multiple
                          </p>
                          <p className="font-mono text-lg font-semibold text-foreground">
                            {selectedTier.return_metrics.equity_multiple}x
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: sensitivity slider */}
                  <div className="p-5 rounded-xl bg-muted">
                    <h4 className="font-semibold mb-4 text-foreground">
                      Cap Rate Sensitivity
                    </h4>
                    <div className="mb-6">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-muted-foreground">
                          Adjust Cap Rate
                        </span>
                        <span className="font-mono text-lg font-bold text-primary">
                          {capRateSlider.toFixed(2)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="3.5"
                        max="7"
                        step="0.05"
                        value={capRateSlider}
                        onChange={(e) =>
                          setCapRateSlider(parseFloat(e.target.value))
                        }
                        className="w-full accent-primary cursor-pointer"
                      />
                      <div className="flex justify-between text-xs mt-1 text-muted-foreground">
                        <span>3.50%</span>
                        <span>7.00%</span>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-card border border-border">
                      <p className="text-xs mb-1 text-muted-foreground">
                        Implied Price at {capRateSlider.toFixed(2)}% Cap
                      </p>
                      {derivedPrice > 0 ? (
                        <>
                          <p className="font-mono text-2xl font-bold text-foreground">
                            {fmtCurrency(derivedPrice, true)}
                          </p>
                          {selectedTier.pricing != null && (
                            <p className="text-sm mt-2">
                              {derivedPrice > selectedTier.pricing ? (
                                <span className="text-emerald-600 dark:text-emerald-400">
                                  +
                                  {fmtCurrency(
                                    derivedPrice - selectedTier.pricing,
                                    true,
                                  )}{' '}
                                  above {selectedTier.tier_label || 'asking'}
                                </span>
                              ) : (
                                <span className="text-rose-600 dark:text-rose-400">
                                  {fmtCurrency(
                                    derivedPrice - selectedTier.pricing,
                                    true,
                                  )}{' '}
                                  below {selectedTier.tier_label || 'asking'}
                                </span>
                              )}
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground mt-1">
                          N/A — NOI is negative for this period.
                          Try switching to Y1 Pro Forma.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                /* --- OM: manual pricing guidance --- */
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div>
                    <label className="text-sm font-medium mb-2 block text-muted-foreground">
                      Pricing Guidance (User Input)
                    </label>
                    <div className="flex items-center gap-3">
                      <div className="relative flex-1">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg text-muted-foreground">
                          $
                        </span>
                        <input
                          type="text"
                          value={pricingGuidance > 0 ? pricingGuidance.toLocaleString() : ''}
                          placeholder="Enter asking price..."
                          onChange={(e) => {
                            setPricingGuidance(
                              parseInt(e.target.value.replace(/,/g, '')) || 0,
                            );
                            setGuidanceSaved(false);
                          }}
                          className="w-full pl-8 pr-4 py-4 rounded-xl text-2xl font-mono font-bold bg-muted border border-border text-foreground placeholder:text-muted-foreground/50 placeholder:font-normal placeholder:text-lg outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>
                      {pricingGuidance !== savedGuidanceValue && (
                        <button
                          disabled={isSavingGuidance}
                          onClick={async () => {
                            if (!property) return;
                            setIsSavingGuidance(true);
                            try {
                              const updated = await propertyService.updateGuidancePrice(
                                property.id,
                                pricingGuidance > 0 ? pricingGuidance : null,
                              );
                              setProperty(updated);
                              setSavedGuidanceValue(pricingGuidance);
                              setGuidanceSaved(true);
                              setTimeout(() => setGuidanceSaved(false), 2000);
                            } catch {
                              toast.error('Failed to save pricing guidance');
                            } finally {
                              setIsSavingGuidance(false);
                            }
                          }}
                          className="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity whitespace-nowrap self-center"
                        >
                          {isSavingGuidance ? 'Saving...' : 'Save'}
                        </button>
                      )}
                      {guidanceSaved && pricingGuidance === savedGuidanceValue && (
                        <span className="flex items-center gap-1 text-sm text-emerald-600 dark:text-emerald-400 whitespace-nowrap animate-fade-in">
                          <CheckCircle className="h-4 w-4" /> Saved!
                        </span>
                      )}
                    </div>

                    {pricingMetrics && (
                      <div className="grid grid-cols-2 gap-4 mt-6">
                        {(
                          [
                            {
                              label: 'Going-In Cap (T12)',
                              value: `${pricingMetrics.goingInCap}%`,
                              hl: true,
                            },
                            {
                              label: 'Y1 Cap Rate',
                              value: `${pricingMetrics.y1Cap}%`,
                              hl: true,
                            },
                            {
                              label: '$/Unit',
                              value: fmtCurrency(
                                pricingMetrics.pricePerUnit,
                                true,
                              ),
                              hl: false,
                            },
                            {
                              label: '$/SF',
                              value: `$${pricingMetrics.pricePerSF}`,
                              hl: false,
                            },
                          ] as const
                        ).map((m) => (
                          <div
                            key={m.label}
                            className={cn(
                              'p-3 rounded-xl',
                              m.hl ? 'bg-accent' : 'bg-muted',
                            )}
                          >
                            <p className="text-xs text-muted-foreground">
                              {m.label}
                            </p>
                            <p
                              className={cn(
                                'font-mono text-lg font-semibold',
                                m.hl ? 'text-primary' : 'text-foreground',
                              )}
                            >
                              {m.value}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Sensitivity slider (OM) */}
                  <div className="p-5 rounded-xl bg-muted">
                    <h4 className="font-semibold mb-4 text-foreground">
                      What Cap Rate Gets Me There?
                    </h4>
                    <div className="mb-6">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-muted-foreground">
                          Target Cap Rate
                        </span>
                        <span className="font-mono text-lg font-bold text-primary">
                          {capRateSlider.toFixed(2)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="3.5"
                        max="7"
                        step="0.05"
                        value={capRateSlider}
                        onChange={(e) =>
                          setCapRateSlider(parseFloat(e.target.value))
                        }
                        className="w-full accent-primary cursor-pointer"
                      />
                    </div>

                    <div className="p-4 rounded-xl bg-card border border-border">
                      <p className="text-xs mb-1 text-muted-foreground">
                        Max Price at {capRateSlider.toFixed(2)}% Cap
                      </p>
                      <p className="font-mono text-2xl font-bold text-foreground">
                        {fmtCurrency(derivedPrice, true)}
                      </p>
                      {pricingGuidance > 0 && (
                        <p
                          className={cn(
                            'text-sm mt-2',
                            derivedPrice >= pricingGuidance
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-600 dark:text-rose-400',
                          )}
                        >
                          {derivedPrice >= pricingGuidance
                            ? `Within guidance (+${fmtCurrency(derivedPrice - pricingGuidance, true)})`
                            : `Below guidance (${fmtCurrency(derivedPrice - pricingGuidance, true)})`}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* --------------------------------------------------------------- */}
        {/* OPERATING FINANCIALS                                             */}
        {/* --------------------------------------------------------------- */}
        {!hasFinancials && (
          <section className="animate-fade-in" style={{ animationDelay: '200ms' }}>
            <h2 className="font-display text-lg font-bold mb-4 text-foreground">
              Operating Financials
            </h2>
            <div className="bg-card/30 border-border/40 border-dashed rounded-2xl p-8 text-center border">
              <BarChart3 className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">
                Financial data will populate when you upload an OM or BOV
              </p>
              <button
                onClick={() => navigate('/upload')}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border border-primary text-primary hover:bg-primary/10 transition-colors"
              >
                <Upload className="w-4 h-4" />
                Upload Document
              </button>
            </div>
          </section>
        )}
        {availablePeriods.length > 0 && currentFinancials && (
          <section
            className="animate-fade-in"
            style={{ animationDelay: '200ms' }}
          >
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <h2 className="font-display text-lg font-bold text-foreground">
                Operating Financials
              </h2>
              <div className="flex items-center gap-3">
                {/* Period toggle */}
                <div className="flex items-center rounded-xl p-1 bg-muted">
                  {availablePeriods.map((p) => (
                    <button
                      key={p}
                      onClick={() => setFinancialPeriod(p)}
                      className={cn(
                        'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                        financialPeriod === p
                          ? 'bg-accent text-primary'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {periodLabel(p)}
                    </button>
                  ))}
                </div>

                {/* View toggle */}
                {totalUnits > 0 && (
                  <div className="flex items-center rounded-xl p-1 bg-muted">
                    <button
                      onClick={() => setFinancialView('total')}
                      className={cn(
                        'px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                        financialView === 'total'
                          ? 'bg-accent text-primary'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      Total $
                    </button>
                    <button
                      onClick={() => setFinancialView('perUnit')}
                      className={cn(
                        'px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                        financialView === 'perUnit'
                          ? 'bg-accent text-primary'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      $/Unit
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="border border-border rounded-2xl bg-card p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Revenue column */}
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wider mb-4 text-muted-foreground">
                    Revenue
                  </h3>
                  <FinancialRow
                    label="Gross Scheduled Rent (GSR)"
                    value={currentFinancials.gsr}
                    totalUnits={totalUnits}
                    viewMode={financialView}
                  />
                  <FinancialRow
                    label="Vacancy"
                    value={currentFinancials.vacancy}
                    isDeduction
                    totalUnits={totalUnits}
                    viewMode={financialView}
                  />
                  <FinancialRow
                    label="Concessions"
                    value={currentFinancials.concessions}
                    isDeduction
                    totalUnits={totalUnits}
                    viewMode={financialView}
                  />
                  <FinancialRow
                    label="Bad Debt"
                    value={currentFinancials.bad_debt}
                    isDeduction
                    totalUnits={totalUnits}
                    viewMode={financialView}
                  />
                  <FinancialRow
                    label="Non-Revenue Units"
                    value={currentFinancials.non_revenue_units}
                    isDeduction
                    totalUnits={totalUnits}
                    viewMode={financialView}
                  />

                  {/* Economic occupancy highlight row */}
                  {economicOccupancy.percent > 0 &&
                    economicOccupancy.amount != null && (
                      <FinancialRow
                        label="Economic Occupancy"
                        value={economicOccupancy.amount}
                        percent={economicOccupancy.percent}
                        isHighlight
                        totalUnits={totalUnits}
                        viewMode={financialView}
                      />
                    )}
                </div>

                {/* Expenses & NOI column */}
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wider mb-4 text-muted-foreground">
                    Expenses &amp; NOI
                  </h3>
                  <FinancialRow
                    label="Total Operating Expenses"
                    value={currentFinancials.total_opex}
                    isDeduction
                    percent={opexPercent > 0 ? opexPercent : null}
                    totalUnits={totalUnits}
                    viewMode={financialView}
                  />
                  {currentFinancials.opex_components?.management_fee !=
                    null && (
                    <FinancialRow
                      label="Management Fee"
                      value={
                        currentFinancials.opex_components.management_fee
                      }
                      isDeduction
                      totalUnits={totalUnits}
                      viewMode={financialView}
                    />
                  )}
                  {currentFinancials.opex_components?.insurance != null && (
                    <FinancialRow
                      label="Insurance"
                      value={currentFinancials.opex_components.insurance}
                      isDeduction
                      totalUnits={totalUnits}
                      viewMode={financialView}
                    />
                  )}
                  {currentFinancials.opex_components?.property_taxes !=
                    null && (
                    <FinancialRow
                      label="Property Taxes"
                      value={
                        currentFinancials.opex_components.property_taxes
                      }
                      isDeduction
                      totalUnits={totalUnits}
                      viewMode={financialView}
                    />
                  )}

                  {/* NOI callout */}
                  <div className="mt-6 pt-4 border-t-2 border-primary">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-foreground">
                          Net Operating Income (NOI)
                        </p>
                        <p className="text-xs mt-0.5 text-muted-foreground">
                          {periodDescription(financialPeriod)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                          {financialView === 'perUnit'
                            ? fmtPerUnit(currentFinancials.noi, totalUnits)
                            : fmtCurrency(currentFinancials.noi)}
                        </p>
                        {financialView === 'total' && totalUnits > 0 && (
                          <p className="font-mono text-sm text-muted-foreground">
                            {fmtPerUnit(currentFinancials.noi, totalUnits)}
                            /unit
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* OpEx ratio callout */}
                  {opexPercent > 0 && (
                    <div className="mt-6 p-4 rounded-xl bg-muted flex items-center justify-between">
                      <span className="text-muted-foreground">
                        OpEx Ratio (% of GSR)
                      </span>
                      <span className="font-mono text-xl font-bold text-foreground">
                        {opexPercent.toFixed(1)}%
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* --------------------------------------------------------------- */}
        {/* SPECIAL CONSIDERATIONS (BOV loan / terminal assumptions)         */}
        {/* --------------------------------------------------------------- */}
        {hasBOV && selectedTier && (selectedTier.loan_assumptions || selectedTier.terminal_assumptions) && (
          <section
            className="animate-fade-in"
            style={{ animationDelay: '250ms' }}
          >
            <h2 className="font-display text-lg font-bold mb-4 text-foreground">
              Special Considerations
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {selectedTier.loan_assumptions && (
                <div className="border border-border rounded-2xl bg-card p-5">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-blue-500/10">
                      <Receipt className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground">
                        Loan Assumptions
                      </h4>
                      <div className="text-sm space-y-1 mt-2 text-muted-foreground">
                        {selectedTier.loan_assumptions.leverage != null && (
                          <p>
                            LTV:{' '}
                            <span className="font-mono font-semibold text-foreground">
                              {fmtPercent(selectedTier.loan_assumptions.leverage)}
                            </span>
                          </p>
                        )}
                        {selectedTier.loan_assumptions.loan_amount !=
                          null && (
                          <p>
                            Loan Amount:{' '}
                            <span className="font-mono font-semibold text-foreground">
                              {fmtCurrency(
                                selectedTier.loan_assumptions.loan_amount,
                                true,
                              )}
                            </span>
                          </p>
                        )}
                        {selectedTier.loan_assumptions.interest_rate !=
                          null && (
                          <p>
                            Rate:{' '}
                            <span className="font-mono font-semibold text-foreground">
                              {fmtPercent(selectedTier.loan_assumptions.interest_rate)}
                            </span>
                          </p>
                        )}
                        {selectedTier.loan_assumptions.io_period_months !=
                          null && (
                          <p>
                            I/O Period:{' '}
                            <span className="font-mono font-semibold text-foreground">
                              {selectedTier.loan_assumptions.io_period_months}{' '}
                              months
                            </span>
                          </p>
                        )}
                        {selectedTier.loan_assumptions.amortization_years !=
                          null && (
                          <p>
                            Amortization:{' '}
                            <span className="font-mono font-semibold text-foreground">
                              {selectedTier.loan_assumptions.amortization_years}{' '}
                              years
                            </span>
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {selectedTier.terminal_assumptions && (
                <div className="border border-border rounded-2xl bg-card p-5">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-amber-500/10">
                      <TrendingUp className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground">
                        Terminal Assumptions
                      </h4>
                      <div className="text-sm space-y-1 mt-2 text-muted-foreground">
                        {selectedTier.terminal_assumptions
                          .terminal_cap_rate != null && (
                          <p>
                            Terminal Cap:{' '}
                            <span className="font-mono font-semibold text-foreground">
                              {fmtCapRate(selectedTier.terminal_assumptions.terminal_cap_rate)}
                            </span>
                          </p>
                        )}
                        {selectedTier.terminal_assumptions
                          .hold_period_years != null && (
                          <p>
                            Hold Period:{' '}
                            <span className="font-mono font-semibold text-foreground">
                              {selectedTier.terminal_assumptions.hold_period_years}{' '}
                              years
                            </span>
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* --------------------------------------------------------------- */}
        {/* QUICK UNDERWRITING                                               */}
        {/* --------------------------------------------------------------- */}
        {property && <SensitivityAnalysis property={property} />}

        {/* --------------------------------------------------------------- */}
        {/* UNIT MIX                                                         */}
        {/* --------------------------------------------------------------- */}
        <section className="animate-fade-in" style={{ animationDelay: '270ms' }}>
          <h2 className="font-display text-lg font-bold mb-4 text-foreground">
            Unit Mix
          </h2>
          {unitMix.length > 0 ? (
            <div className="border border-border rounded-2xl bg-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Floorplan</th>
                      <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Type</th>
                      <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Units</th>
                      <th className="px-4 py-3 text-right font-semibold text-muted-foreground">SF</th>
                      <th className="px-4 py-3 text-right font-semibold text-muted-foreground">In-Place Rent</th>
                      <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Proforma Rent</th>
                      <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Rent/SF</th>
                      {hasRenoPremium && (
                        <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Reno Premium</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {unitMix.map((u, idx) => (
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
                  {unitMixSummary && (
                    <tfoot>
                      <tr className="border-t-2 border-primary bg-accent/30">
                        <td className="px-4 py-3 font-semibold text-foreground" colSpan={2}>Total / Weighted Avg</td>
                        <td className="px-4 py-3 text-right font-mono font-semibold text-foreground">{unitMixSummary.totalUnits}</td>
                        <td className="px-4 py-3 text-right font-mono font-semibold text-foreground">{unitMixSummary.avgSF.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right font-mono font-semibold text-foreground">{fmtCurrency(unitMixSummary.avgRent)}</td>
                        <td className="px-4 py-3 text-right font-mono font-semibold text-foreground">{unitMixSummary.avgProformaRent != null ? fmtCurrency(unitMixSummary.avgProformaRent) : '\u2014'}</td>
                        <td className="px-4 py-3 text-right font-mono font-semibold text-foreground">{unitMixSummary.avgProformaPSF != null ? `$${unitMixSummary.avgProformaPSF.toFixed(2)}` : '\u2014'}</td>
                        {hasRenoPremium && <td className="px-4 py-3"></td>}
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-card/30 border-border/40 border-dashed rounded-2xl p-8 text-center border">
              <Building2 className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">
                Unit mix details will appear after document analysis
              </p>
            </div>
          )}
        </section>

        {/* --------------------------------------------------------------- */}
        {/* RENOVATION ASSUMPTIONS (only show if data exists)                */}
        {/* --------------------------------------------------------------- */}
        {hasRenovation && (
          <section className="animate-fade-in" style={{ animationDelay: '280ms' }}>
            <h2 className="font-display text-lg font-bold mb-4 text-foreground">
              Renovation Assumptions
            </h2>
            <div className="border border-border/60 rounded-2xl bg-card/50 p-6">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {property.renovation_cost_per_unit != null && (
                  <div className="p-3 rounded-xl bg-accent">
                    <p className="text-xs text-muted-foreground">Cost/Unit</p>
                    <p className="font-mono text-lg font-semibold text-foreground">{fmtCurrency(property.renovation_cost_per_unit)}</p>
                  </div>
                )}
                {property.renovation_total_cost != null && (
                  <div className="p-3 rounded-xl bg-muted">
                    <p className="text-xs text-muted-foreground">Total Cost</p>
                    <p className="font-mono text-lg font-semibold text-foreground">{fmtCurrency(property.renovation_total_cost, true)}</p>
                  </div>
                )}
                {property.renovation_rent_premium != null && (
                  <div className="p-3 rounded-xl bg-muted">
                    <p className="text-xs text-muted-foreground">Avg Rent Premium</p>
                    <p className="font-mono text-lg font-semibold text-foreground">{fmtCurrency(property.renovation_rent_premium)}/unit</p>
                  </div>
                )}
                {property.renovation_roi_pct != null && (
                  <div className="p-3 rounded-xl bg-accent">
                    <p className="text-xs text-muted-foreground">Return on Cost</p>
                    <p className="font-mono text-lg font-semibold text-primary">{fmtPercent(property.renovation_roi_pct, 1)}</p>
                  </div>
                )}
                {property.renovation_duration_years != null && (
                  <div className="p-3 rounded-xl bg-muted">
                    <p className="text-xs text-muted-foreground">Duration</p>
                    <p className="font-mono text-lg font-semibold text-foreground">{property.renovation_duration_years} years</p>
                  </div>
                )}
                {property.renovation_stabilized_revenue != null && (
                  <div className="p-3 rounded-xl bg-muted">
                    <p className="text-xs text-muted-foreground">Stabilized Revenue</p>
                    <p className="font-mono text-lg font-semibold text-foreground">{fmtCurrency(property.renovation_stabilized_revenue, true)}</p>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* --------------------------------------------------------------- */}
        {/* RENT COMPS                                                       */}
        {/* --------------------------------------------------------------- */}
        <section className="animate-fade-in" style={{ animationDelay: '290ms' }}>
          <h2 className="font-display text-lg font-bold mb-4 text-foreground">
            Rent Comparables
          </h2>
          {rentComps.length > 0 ? (
            <div className="border border-border rounded-2xl bg-card overflow-hidden">
              {rentCompTabs.length > 1 && (
                <div className="px-4 pt-4">
                  <div className="flex items-center rounded-xl p-1 bg-muted w-fit">
                    {rentCompTabs.map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setRentCompTab(tab)}
                        className={cn(
                          'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                          rentCompTab === tab
                            ? 'bg-accent text-primary'
                            : 'text-muted-foreground hover:text-foreground',
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
                    {filteredRentComps.map((c, idx) => (
                      <tr key={c.id ?? idx} className="border-b border-border last:border-0 hover:bg-accent/50 transition-colors">
                        <td className="px-4 py-3 font-medium text-foreground">
                          {c.comp_name || 'Unknown'}
                          {c.is_new_construction && (
                            <span className="ml-2 px-1.5 py-0.5 rounded text-2xs font-bold uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                              New
                            </span>
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
              <p className="text-muted-foreground text-sm">
                Rent comparables will appear after document analysis
              </p>
            </div>
          )}
        </section>

        {/* --------------------------------------------------------------- */}
        {/* LOCATION / DEMOGRAPHICS                                          */}
        {/* --------------------------------------------------------------- */}
        {property.property_address && (
          <section className="animate-fade-in" style={{ animationDelay: '295ms' }}>
            <h2 className="font-display text-lg font-bold mb-4 text-foreground">
              Location &amp; Comparables
            </h2>

            {/* Submarket and Metro info */}
            {(property.submarket || property.metro) && (
              <div className="mb-4 flex items-center gap-4 text-sm">
                {property.submarket && (
                  <span className="text-muted-foreground">
                    Submarket: <span className="font-semibold text-foreground">{property.submarket}</span>
                  </span>
                )}
                {property.metro && (
                  <span className="text-muted-foreground">
                    Metro: <span className="font-semibold text-foreground">{property.metro}</span>
                  </span>
                )}
              </div>
            )}

            {/* Interactive map with property and comps */}
            <CompMap
              address={property.property_address || ''}
              propertyName={property.deal_name || ''}
              totalUnits={property.total_units ?? undefined}
              rentComps={rentComps || []}
              salesComps={property.bov_pricing_tiers || []}
            />
          </section>
        )}

        {/* --------------------------------------------------------------- */}
        {/* AI INSIGHTS (teaser)                                             */}
        {/* --------------------------------------------------------------- */}
        <section
          className="animate-fade-in"
          style={{ animationDelay: '300ms' }}
        >
          <div
            className="border border-border rounded-2xl bg-card p-6 cursor-pointer hover:border-primary/30 transition-colors"
            onClick={() => setShowAIPanel(true)}
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-primary shrink-0">
                <Sparkles className="w-6 h-6 text-primary-foreground" />
              </div>
              <div className="flex-1">
                <h3 className="font-display font-bold text-foreground">
                  AI Insights Available
                </h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Get a back-of-napkin summary, key observations, and
                  investment recommendations based on extracted data.
                </p>
              </div>
              <ArrowRight className="w-5 h-5 text-muted-foreground" />
            </div>
          </div>
        </section>

        {/* --------------------------------------------------------------- */}
        {/* DOCUMENTS                                                        */}
        {/* --------------------------------------------------------------- */}
        <section
          className="animate-fade-in"
          style={{ animationDelay: '350ms' }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-bold text-foreground">
              Documents
            </h2>
          </div>
          <div className="border border-border rounded-2xl bg-card p-5">
            {property.uploaded_filename ? (
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0 bg-blue-500/10">
                  <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate text-foreground">
                    {property.uploaded_filename}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={cn(
                        'px-2 py-0.5 rounded text-2xs font-bold uppercase',
                        docBadgeClass(property.document_type),
                      )}
                    >
                      {property.document_type}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Uploaded {fmtDate(property.upload_date)}
                    </span>
                  </div>
                  {property.analysis_count != null && (
                    <p className="text-xs mt-2 text-muted-foreground">
                      Analyzed {property.analysis_count} time
                      {property.analysis_count !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-6">
                <FileText className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  No documents available.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* --------------------------------------------------------------- */}
        {/* NOTES                                                            */}
        {/* --------------------------------------------------------------- */}
        <section
          className="animate-fade-in"
          style={{ animationDelay: '400ms' }}
        >
          <h2 className="font-display text-lg font-bold mb-4 text-foreground">
            Notes
          </h2>
          <div className="border border-border rounded-2xl bg-card p-5">
            <div className="mb-4">
              <textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Add a note about this property..."
                rows={3}
                className="w-full px-4 py-3 rounded-xl text-sm bg-muted border border-border text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-ring resize-none"
              />
              <div className="flex justify-end mt-2">
                <button
                  onClick={() => {
                    if (newNote.trim()) {
                      toast.info('Coming soon', {
                        description: 'Note persistence will be available in a future update.'
                      });
                      setNewNote('');
                    }
                  }}
                  disabled={!newNote.trim()}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add Note
                </button>
              </div>
            </div>
            <div className="text-center py-6">
              <StickyNote className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                No notes yet. Add a note above to get started.
              </p>
            </div>
          </div>
        </section>

        {/* --------------------------------------------------------------- */}
        {/* DATA SOURCES                                                     */}
        {/* --------------------------------------------------------------- */}
        {(property.source_notes || (property.missing_fields && property.missing_fields.length > 0)) && (
          <section
            className="animate-fade-in"
            style={{ animationDelay: '450ms' }}
          >
            <button
              onClick={() => setShowSourcesPanel(!showSourcesPanel)}
              className="flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
            >
              <Database className="w-4 h-4" />
              {showSourcesPanel ? 'Hide' : 'View'} Data Sources
              <ChevronDown
                className={cn(
                  'w-4 h-4 transition-transform duration-200',
                  showSourcesPanel && 'rotate-180',
                )}
              />
            </button>

            {showSourcesPanel && (
              <div className="mt-4 border border-border rounded-2xl bg-card overflow-hidden animate-fade-in">
                <div className="p-5">
                  <p className="text-sm mb-4 text-muted-foreground">
                    Source attribution for extracted data fields.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {property.source_notes?.property_info_source && (
                      <div className="flex items-center justify-between p-3 rounded-xl bg-muted">
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            Property Info
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {property.source_notes.property_info_source}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          <Pencil className="w-4 h-4 text-muted-foreground" />
                        </div>
                      </div>
                    )}
                    {property.source_notes?.financials_source && (
                      <div className="flex items-center justify-between p-3 rounded-xl bg-muted">
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            Financials
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {property.source_notes.financials_source}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          <Pencil className="w-4 h-4 text-muted-foreground" />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Missing fields */}
                  {property.missing_fields &&
                    property.missing_fields.length > 0 && (
                      <div className="mt-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                        <p className="text-sm font-medium text-amber-600 dark:text-amber-400 mb-2">
                          Missing Fields
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {property.missing_fields.map((field) => (
                            <span
                              key={field}
                              className="px-2 py-1 rounded text-xs bg-amber-500/10 text-amber-600 dark:text-amber-400"
                            >
                              {field}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                </div>
              </div>
            )}
          </section>
        )}
      </div>

      {/* =================================================================== */}
      {/* AI ANALYSIS SLIDE-OUT PANEL                                          */}
      {/* =================================================================== */}
      {showAIPanel && (
        <div
          className="fixed inset-0 z-50 flex items-stretch justify-end"
          onClick={() => setShowAIPanel(false)}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" />

          {/* Panel */}
          <div
            className="relative h-full w-full max-w-lg overflow-y-auto bg-card border-l border-border animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Panel header */}
            <div className="sticky top-0 px-6 py-4 flex items-center justify-between bg-card border-b border-border z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary">
                  <Sparkles className="w-5 h-5 text-primary-foreground" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-foreground">
                    AI Analysis
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {property.deal_name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAIPanel(false)}
                className="p-2 rounded-lg text-muted-foreground hover:bg-accent transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Panel content */}
            <div className="p-6 space-y-6">
              {/* Back-of-napkin summary */}
              <div className="p-4 rounded-xl bg-accent border border-primary/20">
                <h4 className="font-semibold mb-2 text-primary">
                  Back-of-Napkin Summary
                </h4>
                <p className="text-sm leading-relaxed text-foreground">
                  {property.total_units != null && (
                    <>This {property.total_units}-unit </>
                  )}
                  {property.year_built != null && (
                    <>{property.year_built} vintage </>
                  )}
                  asset
                  {property.submarket ? ` in ${property.submarket}` : ''}
                  {property.average_inplace_rent != null && (
                    <>
                      {' '}
                      shows in-place rents at{' '}
                      <strong>
                        ${property.average_inplace_rent.toLocaleString()}/unit
                      </strong>
                    </>
                  )}
                  {lossToLease && (
                    <>
                      {' '}
                      with{' '}
                      <strong>
                        {lossToLease.percent.toFixed(1)}% loss-to-lease
                      </strong>{' '}
                      upside to market
                    </>
                  )}
                  .
                  {property.t12_financials?.noi != null && (
                    <>
                      {' '}
                      T12 NOI of{' '}
                      <strong>
                        {fmtCurrency(property.t12_financials.noi, true)}
                      </strong>
                    </>
                  )}
                  {hasBOV && selectedTier?.pricing != null && property.t12_financials?.noi != null && (
                    <>
                      {' '}
                      implies a{' '}
                      <strong>
                        {(
                          (property.t12_financials.noi /
                            selectedTier.pricing) *
                          100
                        ).toFixed(2)}
                        % going-in cap
                      </strong>{' '}
                      at {selectedTier.tier_label || 'listed'} pricing
                    </>
                  )}
                  {(property.t12_financials?.noi != null || (hasBOV && selectedTier?.pricing != null)) && '.'}
                  {' '}Economic occupancy at{' '}
                  <strong>{economicOccupancy.percent.toFixed(1)}%</strong>{' '}
                  indicates
                  {economicOccupancy.percent >= 90
                    ? ' healthy operations'
                    : economicOccupancy.percent >= 85
                      ? ' room for operational improvement'
                      : ' operational challenges to address'}
                  .
                </p>
              </div>

              {/* Key insights */}
              <div>
                <h4 className="font-semibold mb-3 text-foreground">
                  Key Insights
                </h4>
                <div className="space-y-2">
                  {lossToLease && property.total_units != null && (
                    <div className="flex gap-3 p-3 rounded-xl bg-muted">
                      <TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                      <p className="text-sm text-muted-foreground">
                        Loss-to-lease of {lossToLease.percent.toFixed(1)}%
                        suggests{' '}
                        {fmtCurrency(
                          property.total_units * lossToLease.amount * 12,
                          true,
                        )}{' '}
                        annual upside if rents pushed to market.
                      </p>
                    </div>
                  )}

                  {property.t12_financials?.noi != null &&
                    hasBOV &&
                    selectedTier?.pricing != null && (
                      <div className="flex gap-3 p-3 rounded-xl bg-muted">
                        <Building2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                        <p className="text-sm text-muted-foreground">
                          At {selectedTier.tier_label || 'listed'} price of{' '}
                          {fmtCurrency(selectedTier.pricing, true)}, going-in
                          T12 cap rate is{' '}
                          {(
                            (property.t12_financials.noi /
                              selectedTier.pricing) *
                            100
                          ).toFixed(2)}
                          %.
                        </p>
                      </div>
                    )}

                  {selectedTier?.return_metrics?.levered_irr != null && (
                    <div className="flex gap-3 p-3 rounded-xl bg-muted">
                      <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                      <p className="text-sm text-muted-foreground">
                        Levered IRR projects to{' '}
                        {selectedTier.return_metrics.levered_irr}%
                        {selectedTier.return_metrics.equity_multiple != null &&
                          ` with ${selectedTier.return_metrics.equity_multiple}x equity multiple`}
                        .
                      </p>
                    </div>
                  )}

                  {economicOccupancy.percent > 0 &&
                    economicOccupancy.percent < 90 && (
                      <div className="flex gap-3 p-3 rounded-xl bg-muted">
                        <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                        <p className="text-sm text-muted-foreground">
                          Economic occupancy at{' '}
                          {economicOccupancy.percent.toFixed(1)}% is below the
                          90% threshold. Investigate vacancy and concession
                          trends.
                        </p>
                      </div>
                    )}
                </div>
              </div>

              {/* Recommendation */}
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <h4 className="font-semibold mb-2 text-emerald-600 dark:text-emerald-400">
                  Recommendation
                </h4>
                <p className="text-sm text-foreground">
                  Review the extracted data for accuracy. Focus verification
                  on: (1) rent roll alignment with T12 financials, (2)
                  concession burn-off timeline, and (3) operating expense
                  trend lines.
                  {property.submarket &&
                    ` Strong ${property.submarket} location supports basis at current pricing level.`}
                </p>
              </div>

              {/* Ask follow-up */}
              <div>
                <h4 className="font-semibold mb-3 text-foreground">
                  Ask a Follow-up
                </h4>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="E.g., What's the rent growth assumption in the Y1 proforma?"
                    className="w-full px-4 py-3 pr-12 rounded-xl text-sm bg-muted border border-border text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-ring"
                  />
                  <button
                    onClick={() => {
                      toast.info('Coming soon', {
                        description: 'AI follow-up questions will be available in a future update.'
                      });
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* RE-ANALYZE DIALOG                                                    */}
      {/* =================================================================== */}
      <Dialog
        open={showReanalyzeDialog}
        onOpenChange={setShowReanalyzeDialog}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Re-analyze Property?</DialogTitle>
            <DialogDescription>
              This will re-run the AI analysis on the original PDF file. This
              action will use AI credits and may take a few moments.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              onClick={() => setShowReanalyzeDialog(false)}
              disabled={isReanalyzing}
              className="px-4 py-2 rounded-lg text-sm font-medium border border-border text-foreground hover:bg-accent transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleReanalyze}
              disabled={isReanalyzing}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isReanalyzing && (
                <Loader2 className="w-4 h-4 animate-spin" />
              )}
              {isReanalyzing ? 'Re-analyzing...' : 'Re-analyze'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* =================================================================== */}
      {/* DELETE DIALOG                                                        */}
      {/* =================================================================== */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Property?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this property from your library.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete Forever'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>

      {/* Deal Score Modal */}
      <DealScoreModal
        open={showScoreModal}
        onClose={() => setShowScoreModal(false)}
        scoreData={dealScore}
        propertyName={property?.deal_name}
      />

      {/* Screening Modal */}
      <ScreeningModal
        open={showScreeningModal}
        onClose={() => setShowScreeningModal(false)}
        propertyId={property?.id ?? null}
        propertyName={property?.deal_name}
        existingData={
          property?.screening_details_json
            ? (() => {
                try {
                  const checks = JSON.parse(property.screening_details_json);
                  return {
                    verdict: property.screening_verdict ?? '',
                    score: property.screening_score ?? 0,
                    checks,
                    summary: '',
                  };
                } catch {
                  return null;
                }
              })()
            : null
        }
      />
        </motion.div>
      )}
    </AnimatePresence>
  );
};
