import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ArrowLeft,
  ArrowRight,
  Sparkles,
  RefreshCw,
  MoreVertical,
  X,
  Building2,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Trash2,
  BarChart3,
  FileDown,
  MapPin,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAssistantStore } from '@/store/assistantStore';
import { propertyService } from '@/services/propertyService';
import { streamPropertyChat } from '@/services/chatService';
import { scoringService } from '@/services/scoringService';
import { normalizePercent } from '@/utils/formatUtils';
import type { DealScoreResult } from '@/services/scoringService';
import { DealScoreBadge } from '@/components/scoring/DealScoreBadge';
import { DealScoreModal } from '@/components/scoring/DealScoreModal';
import { ScreeningModal } from '@/components/screening/ScreeningModal';
import { useUIStore } from '@/store/uiStore';
import type {
  PropertyDetail as PropertyDetailType,
  FinancialPeriod,
  BOVPricingTier,
} from '@/types/property';
import { AnimatePresence, motion } from 'framer-motion';
import { PropertyDetailSkeleton } from '@/components/ui/PageSkeleton';
import { fmtShortDate } from '@/components/property/tabs/tabUtils';
import { PropertyDetailTabs } from '@/components/property/PropertyDetailTabs';
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

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export const PropertyDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // --- Assistant scope ---
  const setScopedProperty = useAssistantStore((s) => s.setScopedProperty);
  useEffect(() => {
    if (id) setScopedProperty(Number(id));
    return () => setScopedProperty(null);
  }, [id, setScopedProperty]);

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
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [followUpQuestion, setFollowUpQuestion] = useState('');
  const [followUpLoading, setFollowUpLoading] = useState(false);
  const [followUpResponses, setFollowUpResponses] = useState<Array<{ question: string; answer: string; isStreaming?: boolean; isError?: boolean }>>([]);

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

  // --- Document upload state ---
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<{ text: string; isError: boolean } | null>(null);

  // --- Comparison state from uiStore ---
  const comparisonPropertyIds = useUIStore((state) => state.comparisonPropertyIds);
  const togglePropertyComparison = useUIStore((state) => state.togglePropertyComparison);

  // --- Follow-up chat handler ---
  const handleFollowUpSend = () => {
    if (!followUpQuestion.trim() || followUpLoading || !property) return;
    const question = followUpQuestion.trim();
    setFollowUpLoading(true);
    setFollowUpQuestion('');

    // Append user question with empty streaming answer
    setFollowUpResponses((prev) => [...prev, { question, answer: '', isStreaming: true }]);

    // Build conversation history from prior exchanges
    const conversationHistory = followUpResponses.flatMap((item) => [
      { role: 'user', content: item.question },
      { role: 'assistant', content: item.answer },
    ]);

    const message = `Regarding the property "${property.deal_name}" at ${property.property_address || 'unknown address'}: ${question}`;

    let accumulated = '';

    streamPropertyChat(
      {
        message,
        conversation_history: conversationHistory,
        property_id: property.id,
      },
      (chunk) => {
        accumulated += chunk;
        const text = accumulated;
        setFollowUpResponses((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { ...updated[updated.length - 1], answer: text };
          return updated;
        });
      },
      () => {
        setFollowUpResponses((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { ...updated[updated.length - 1], isStreaming: false };
          return updated;
        });
        setFollowUpLoading(false);
      },
      (error) => {
        setFollowUpResponses((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            answer: error,
            isStreaming: false,
            isError: true,
          };
          return updated;
        });
        setFollowUpLoading(false);
      },
    );
  };

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

  // -----------------------------------------------------------------------
  // Actions
  // -----------------------------------------------------------------------

  const handleReanalyze = async () => {
    if (!id) return;
    setIsReanalyzing(true);
    setShowReanalyzeDialog(false);
    try {
      // POST returns 202 immediately — extraction runs in a background task
      await propertyService.reanalyzeProperty(parseInt(id));

      // Update local state to show processing indicator
      setProperty((prev) => prev ? { ...prev, analysis_status: 'processing' } : prev);

      // Poll analysis-status until extraction completes or fails
      const poll = async () => {
        const MAX_POLLS = 60; // up to ~5 minutes (60 × 5 s)
        let attempts = 0;
        const interval = window.setInterval(async () => {
          attempts++;
          try {
            const status = await propertyService.getAnalysisStatus(parseInt(id));
            if (status.analysis_status === 'completed' || status.analysis_status === 'failed') {
              window.clearInterval(interval);
              setIsReanalyzing(false);
              if (status.analysis_status === 'completed') {
                // Fetch full property now that extraction is done
                const updated = await propertyService.getProperty(parseInt(id));
                setProperty(updated);
              } else {
                setProperty((prev) => prev ? { ...prev, analysis_status: 'failed' } : prev);
                alert('Re-analysis failed. Check Render logs for details.');
              }
            }
          } catch {
            // Polling errors are transient — keep trying until MAX_POLLS
          }
          if (attempts >= MAX_POLLS) {
            window.clearInterval(interval);
            setIsReanalyzing(false);
            setProperty((prev) => prev ? { ...prev, analysis_status: 'failed' } : prev);
            alert('Re-analysis timed out. The extraction may still be running — refresh the page in a moment.');
          }
        }, 5000); // poll every 5 seconds
      };
      poll();
    } catch (err: unknown) {
      // Surface the most specific error message available.
      const e = err as {
        response?: { status?: number; data?: { detail?: string } };
        message?: string;
      };
      const detail = e.response?.data?.detail;
      const httpStatus = e.response?.status;
      const networkMsg = e.message;

      let errorMsg: string;
      if (detail) {
        errorMsg = detail;
      } else if (httpStatus) {
        errorMsg = `Server error (HTTP ${httpStatus}). Check Render logs for details.`;
      } else if (networkMsg) {
        errorMsg = `Network error: ${networkMsg}.`;
      } else {
        errorMsg = 'Unknown error. Check the browser console and Render logs.';
      }

      alert(`Re-analysis failed: ${errorMsg}`);
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

  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !property?.id) return;

    setIsUploadingDoc(true);
    setUploadMessage(null);

    try {
      const result = await propertyService.uploadPropertyDocument(property.id, file);
      setUploadMessage({
        text: result.extraction_summary || `${file.name} uploaded and extracted successfully`,
        isError: false,
      });
      // Re-fetch property data to show updated fields
      const updated = await propertyService.getProperty(property.id);
      setProperty(updated);
    } catch (err: any) {
      setUploadMessage({
        text: `Upload failed: ${err?.response?.data?.detail || err?.message || 'Unknown error'}`,
        isError: true,
      });
    } finally {
      setIsUploadingDoc(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // -----------------------------------------------------------------------
  // Derived / computed values
  // -----------------------------------------------------------------------

  const getFinancials = (
    key: FinancialPeriodKey,
  ): FinancialPeriod | null | undefined => {
    if (!property) return null;
    const nested = key === 't3' ? property.t3_financials
      : key === 't12' ? property.t12_financials
      : property.y1_financials;
    if (nested) return nested;

    // Fall back to flat NOI fields for OM properties
    const noi = key === 't3' ? property.t3_noi
      : key === 't12' ? property.t12_noi
      : property.y1_noi;
    if (noi == null) return null;

    return { period_label: key, noi };
  };

  const currentFinancials = getFinancials(financialPeriod);

  const availablePeriods = useMemo((): FinancialPeriodKey[] => {
    if (!property) return [];
    const out: FinancialPeriodKey[] = [];
    // Preferred order: T12 > T3 > Y1
    if (property.t12_financials?.noi != null || property.t12_noi != null) out.push('t12');
    if (property.t3_financials?.noi != null || property.t3_noi != null) out.push('t3');
    if (property.y1_financials?.noi != null || property.y1_noi != null) out.push('y1');
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
    // GPR = GSR - Loss to Lease
    const gpr = currentFinancials.gsr - Math.abs(currentFinancials.loss_to_lease ?? 0);
    // Net Rental Income = GPR - Vacancy - Concessions - Non-Revenue Units - Bad Debt
    const nri = gpr
      - Math.abs(currentFinancials.vacancy ?? 0)
      - Math.abs(currentFinancials.concessions ?? 0)
      - Math.abs(currentFinancials.non_revenue_units ?? 0)
      - Math.abs(currentFinancials.bad_debt ?? 0);
    // Economic Occupancy = NRI / GPR
    return {
      percent: gpr > 0 ? (nri / gpr) * 100 : 0,
      amount: nri,
    };
  }, [property, financialPeriod, currentFinancials]);

  const lossToLease = useMemo(() => {
    const mkt = property?.average_market_rent;
    const inp = property?.average_inplace_rent;
    if (mkt == null || inp == null || mkt === 0) return null;
    const diff = mkt - inp;
    return { amount: diff, percent: (diff / mkt) * 100 };
  }, [property]);

  const [rentCompTab, setRentCompTab] = useState<string>('All');

  const bovTiers: BOVPricingTier[] = property?.bov_pricing_tiers ?? [];
  const hasBOV = bovTiers.length > 0;
  const selectedTier: BOVPricingTier | null = hasBOV
    ? bovTiers[selectedTierIdx] ?? bovTiers[0]
    : null;

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
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-white text-black hover:bg-white/90 transition-colors"
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
      {/* HEADER                                                              */}
      {/* ================================================================= */}
      <div className="sticky top-16 z-20 bg-background/90 backdrop-blur-xl border-b border-white/[0.04]">
        <div className="max-w-6xl mx-auto px-6 lg:px-8 py-3">
          {/* Row 1 — Property Identity + Actions */}
          <div className="flex items-center justify-between mb-3">
            {/* Left: back + name + score + badges */}
            <div className="flex items-center gap-3.5">
              <button
                onClick={() => navigate(-1)}
                className="w-9 h-9 flex items-center justify-center rounded-lg glass border border-white/[0.04] hover:border-white/10 transition-colors"
              >
                <ArrowLeft className="w-4 h-4 text-muted-foreground" />
              </button>

              <h1 className="font-display text-[28px] leading-tight font-bold text-foreground">
                {property.deal_name}
              </h1>

              <DealScoreBadge
                score={dealScore?.total_score ?? null}
                size="sm"
                onClick={() => dealScore && setShowScoreModal(true)}
              />

              {property.document_type && (
                <span className="bg-white/10 text-zinc-300 text-[9px] px-2 py-0.5 rounded tracking-wide uppercase font-semibold">
                  {property.document_type === 'EXCEL'
                    ? property.t12_noi != null && property.rr_total_units
                      ? 'T12 + RR'
                      : property.t12_noi != null
                        ? 'T12'
                        : property.rr_total_units
                          ? 'Rent Roll'
                          : 'Excel'
                    : property.document_type}
                </span>
              )}

              <button
                onClick={() => setShowScreeningModal(true)}
                className={cn(
                  'flex items-center gap-1 text-[9px] px-2 py-0.5 rounded tracking-wide uppercase font-semibold',
                  property.screening_verdict?.toUpperCase() === 'PASS'
                    ? 'bg-emerald-500/10 text-emerald-500'
                    : property.screening_verdict?.toUpperCase() === 'FAIL'
                      ? 'bg-red-500/10 text-red-500'
                      : 'bg-yellow-500/10 text-yellow-500',
                )}
              >
                <AlertTriangle className="w-2.5 h-2.5" />
                {property.screening_verdict ?? 'REVIEW'}
              </button>
            </div>

            {/* Right: actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowAIPanel(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[11px] font-semibold bg-white text-black hover:bg-white/90 transition-colors shadow-[0_0_12px_rgba(255,255,255,0.06)]"
              >
                <Sparkles className="w-3.5 h-3.5" />
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
                  "flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[11px] font-medium border transition-colors",
                  property && comparisonPropertyIds.includes(property.id)
                    ? "bg-white/10 text-white border-white/20 hover:bg-white/15"
                    : "glass text-foreground border border-white/[0.04] hover:border-white/10"
                )}
              >
                <BarChart3 className="w-3.5 h-3.5" />
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
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[11px] font-medium glass text-foreground border border-white/[0.04] hover:border-white/10 transition-colors disabled:opacity-50"
              >
                {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
                Export Summary
              </button>

              <button
                onClick={() => !isReanalyzing && setShowReanalyzeDialog(true)}
                disabled={isReanalyzing}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[11px] font-medium glass text-foreground border border-white/[0.04] hover:border-white/10 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isReanalyzing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                {isReanalyzing ? 'Analyzing…' : 'Re-analyze'}
              </button>

              {/* More menu */}
              <div className="relative">
                <button
                  onClick={() => setShowMoreMenu(!showMoreMenu)}
                  className="w-9 h-9 flex items-center justify-center rounded-lg glass border border-white/[0.04] text-muted-foreground hover:border-white/10 transition-colors"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
                {showMoreMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowMoreMenu(false)}
                    />
                    <div className="absolute right-0 top-full mt-2 w-44 rounded-xl glass border border-white/[0.04] shadow-lg z-50 overflow-hidden animate-fade-in">
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

          {/* Row 2 — Address + Data Freshness */}
          <div className="flex items-center justify-between mb-0">
            {/* Left: address */}
            <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
              <MapPin className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
              <span>{property.property_address ?? 'No address'}</span>
            </div>

            {/* Right: data freshness */}
            <div className="flex items-center gap-4 font-sans text-[11px]">
              {(() => {
                const rrDate = property.rr_as_of_date
                  ?? property.documents?.find(d => d.document_category === 'rent_roll')?.document_date
                  ?? property.documents?.find(d => d.document_category === 'rent_roll')?.uploaded_at;
                return rrDate ? (
                  <span className="flex items-center gap-1">
                    <FileText className="w-3 h-3 text-muted-foreground/60" />
                    <span className="text-muted-foreground/60">Rent Roll:</span>
                    <span className="text-muted-foreground">{fmtShortDate(rrDate)}</span>
                  </span>
                ) : null;
              })()}
              {(() => {
                const t12Doc = property.documents?.find(d => d.document_category === 't12');
                const t12Date = t12Doc?.document_date ?? t12Doc?.uploaded_at ?? property.financial_data_updated_at;
                return t12Date ? (
                  <span className="flex items-center gap-1">
                    <FileText className="w-3 h-3 text-muted-foreground/60" />
                    <span className="text-muted-foreground/60">T12:</span>
                    <span className="text-muted-foreground">{fmtShortDate(t12Date)}</span>
                  </span>
                ) : null;
              })()}
              {(() => {
                const omDoc = property.documents?.find(d => d.document_category === 'om');
                const omDate = omDoc?.uploaded_at ?? property.upload_date;
                return omDate ? (
                  <span className="flex items-center gap-1">
                    <FileText className="w-3 h-3 text-muted-foreground/60" />
                    <span className="text-muted-foreground/60">OM:</span>
                    <span className="text-muted-foreground">{fmtShortDate(omDate)}</span>
                  </span>
                ) : null;
              })()}
            </div>
          </div>
        </div>
      </div>

      <PropertyDetailTabs
        property={property}
        dealScore={dealScore}
        financialPeriod={financialPeriod}
        setFinancialPeriod={setFinancialPeriod}
        financialView={financialView}
        setFinancialView={setFinancialView}
        selectedTierIdx={selectedTierIdx}
        setSelectedTierIdx={setSelectedTierIdx}
        capRateSlider={capRateSlider}
        setCapRateSlider={setCapRateSlider}
        pricingGuidance={pricingGuidance}
        setPricingGuidance={(v: number) => { setPricingGuidance(v); setGuidanceSaved(false); }}
        isSavingGuidance={isSavingGuidance}
        guidanceSaved={guidanceSaved}
        savedGuidanceValue={savedGuidanceValue}
        onSaveGuidance={async () => {
          if (!property) return;
          setIsSavingGuidance(true);
          try {
            const updated = await propertyService.updateGuidancePrice(property.id, pricingGuidance > 0 ? pricingGuidance : null);
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
        rentCompTab={rentCompTab}
        setRentCompTab={setRentCompTab}
        newNote={newNote}
        setNewNote={setNewNote}
        isSavingNote={isSavingNote}
        onAddNote={async () => {
          if (!newNote.trim() || !property || isSavingNote) return;
          setIsSavingNote(true);
          try {
            const timestamp = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
            const existingNotes = property.pipeline_notes || '';
            const updatedNotes = existingNotes
              ? `${existingNotes}\n\n[${timestamp}]\n${newNote.trim()}`
              : `[${timestamp}]\n${newNote.trim()}`;

            const encodedLength = encodeURIComponent(updatedNotes).length;
            if (encodedLength > 7500) {
              toast.error('Notes storage limit reached. Please remove old notes before adding new ones.');
              return;
            }

            const updated = await propertyService.updateNotes(property.id, updatedNotes);
            setProperty(updated);
            setNewNote('');
            toast.success('Note saved');
          } catch {
            toast.error('Failed to save note');
          } finally {
            setIsSavingNote(false);
          }
        }}
        fileInputRef={fileInputRef}
        isUploadingDoc={isUploadingDoc}
        uploadMessage={uploadMessage}
        onDocumentUpload={handleDocumentUpload}
        onOpenAIPanel={() => setShowAIPanel(true)}
        navigate={navigate}
        setProperty={setProperty}
      />

      {/* NOTE: All section content has been moved to tab components. Dead code removed. */}
      {false && <div />}

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
            className="relative h-full w-full max-w-lg overflow-y-auto bg-[#0c0c0f] border-l border-white/[0.04] animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Panel header */}
            <div className="sticky top-0 px-6 py-4 flex items-center justify-between bg-[#0c0c0f] border-b border-white/[0.04] z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white">
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
              <div className="p-4 rounded-xl glass border border-white/[0.04]">
                <h4 className="font-semibold mb-2 text-white">
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
                        <AlertTriangle className="w-5 h-5 text-zinc-400 shrink-0 mt-0.5" />
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
                    value={followUpQuestion}
                    onChange={(e) => setFollowUpQuestion(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleFollowUpSend();
                      }
                    }}
                    disabled={followUpLoading}
                    placeholder="E.g., What's the rent growth assumption in the Y1 proforma?"
                    className="w-full px-4 py-3 pr-12 rounded-xl text-sm glass border border-white/[0.04] text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-white/20 disabled:opacity-50"
                  />
                  <button
                    onClick={handleFollowUpSend}
                    disabled={followUpLoading || !followUpQuestion.trim()}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-white text-black hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {followUpLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ArrowRight className="w-4 h-4" />
                    )}
                  </button>
                </div>
                {/* Follow-up responses */}
                {followUpResponses.length > 0 && (
                  <div className="mt-4 space-y-3">
                    {followUpResponses.map((item, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          'p-3 rounded-xl border',
                          item.isError
                            ? 'bg-destructive/10 border-destructive/40'
                            : 'glass border-white/[0.04]',
                        )}
                      >
                        <p className="text-xs font-semibold text-white mb-1">Q: {item.question}</p>
                        {item.isStreaming && !item.answer ? (
                          <div className="flex items-center gap-1 py-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:0ms]" />
                            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:150ms]" />
                            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:300ms]" />
                          </div>
                        ) : (
                          <p className={cn(
                            'text-sm whitespace-pre-wrap',
                            item.isError ? 'text-destructive' : 'text-foreground',
                          )}>
                            {item.answer}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
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
              This will re-run the AI analysis on the original PDF file. The
              job runs in the background — the page will update automatically
              when extraction is complete.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              onClick={() => setShowReanalyzeDialog(false)}
              className="px-4 py-2 rounded-lg text-sm font-medium border border-white/10 text-foreground hover:bg-white/[0.04] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleReanalyze}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-white text-black hover:bg-white/90 transition-colors flex items-center gap-2"
            >
              Re-analyze
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
