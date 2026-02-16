/**
 * Dashboard Page — Portfolio Command Center
 *
 * Features:
 * - Time-aware greeting (Good Morning / Afternoon / Evening)
 * - Key metrics: Total Volume, Total Units, Active Deals, Avg Price/Unit
 * - Compact screening results badge row
 * - Two-column layout: scrollable Deal Cards + Portfolio Map
 * - Card ↔ Map pin interaction (click sync, scroll-into-view)
 * - AI Summary side panel
 *
 * Data is fetched from /api/v1/properties.
 */
import { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  Plus,
  DollarSign,
  Building2,
  Zap,
  Calculator,
  ArrowRight,
  X,
  CheckCircle,
  AlertTriangle,
  XCircle,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/authSlice';
import { Button } from '@/components/ui/button';
import { DashboardSkeleton } from '@/components/ui/PageSkeleton';
import { propertyService } from '@/services/propertyService';
import { scoringService } from '@/services/scoringService';
import { criteriaService } from '@/services/criteriaService';
import { api } from '@/services/api';
import type { PropertyListItem, ScreeningSummaryItem, BOVPricingTier } from '@/types/property';
import { DashboardMap } from '@/components/dashboard/DashboardMap';
import { DealCard } from '@/components/dashboard/DealCard';
import type { DashboardDeal } from '@/components/dashboard/DealCard';

// ============================================================
// TYPES
// ============================================================

interface PropertyWithFinancials extends PropertyListItem {
  t12_noi?: number | null;
  y1_noi?: number | null;
  t3_noi?: number | null;
  total_sf?: number | null;
  status?: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

// ============================================================
// CONSTANTS
// ============================================================

const AI_QUICK_PROMPTS = [
  'Which deals pass my screening criteria?',
  'Compare my top 3 deals by NOI',
  'What are the risks in my pipeline?',
  'Summarize my portfolio',
];

// ============================================================
// HELPERS
// ============================================================

const getGreeting = (): string => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Good Morning';
  if (hour >= 12 && hour < 17) return 'Good Afternoon';
  return 'Good Evening';
};

const formatDollarCompact = (num: number): string => {
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `$${(num / 1_000).toFixed(0)}K`;
  return `$${num}`;
};

const formatDollarFull = (num: number): string => {
  return `$${num.toLocaleString()}`;
};

/**
 * Determine deal value for a property.
 * Priority: user_guidance_price → BOV premium pricing tier → null (skip).
 */
const getDealValue = (
  property: PropertyWithFinancials,
  bovPricingMap: Map<number, BOVPricingTier[]>,
): number | null => {
  if (property.user_guidance_price && property.user_guidance_price > 0) {
    return property.user_guidance_price;
  }

  const bovTiers = bovPricingMap.get(property.id);
  if (bovTiers && bovTiers.length > 0) {
    // Use the highest-priced ("premium") tier
    let best: BOVPricingTier | null = null;
    for (const tier of bovTiers) {
      if (tier.pricing && tier.pricing > 0) {
        if (!best || !best.pricing || tier.pricing > best.pricing) {
          best = tier;
        }
      }
    }
    if (best?.pricing && best.pricing > 0) return best.pricing;
  }

  return null;
};

// ============================================================
// COMPONENT
// ============================================================

export const Dashboard = () => {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const firstName =
    user?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'there';

  // --- Data State ---
  const [properties, setProperties] = useState<PropertyWithFinancials[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [screeningSummary, setScreeningSummary] = useState<ScreeningSummaryItem[]>([]);
  const [bovPricingMap, setBovPricingMap] = useState<Map<number, BOVPricingTier[]>>(
    new Map(),
  );
  const [selectedDealId, setSelectedDealId] = useState<number | null>(null);
  const [scoresMap, setScoresMap] = useState<Record<number, number | null>>({});

  // --- UI State ---
  const [mounted, setMounted] = useState(false);
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [aiQuery, setAiQuery] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);

  // --- Data Fetching ---
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const propertiesResult = await propertyService.listProperties({});
      const props = propertiesResult.properties as PropertyWithFinancials[];
      setProperties(props);

      // Non-blocking: screening summary
      criteriaService
        .getScreeningSummary()
        .then(setScreeningSummary)
        .catch(() => {});

      // Non-blocking: deal scores
      if (props.length > 0) {
        scoringService
          .getScores(props.map((p) => p.id))
          .then((scores) => {
            const map: Record<number, number | null> = {};
            Object.entries(scores).forEach(([id, result]) => {
              map[Number(id)] = result?.total_score ?? null;
            });
            setScoresMap(map);
          })
          .catch(() => {});
      }

      // Non-blocking: property details for BOV pricing tiers
      if (props.length > 0) {
        Promise.allSettled(
          props.map(async (p) => {
            try {
              const detail = await propertyService.getProperty(p.id);
              return { id: p.id, bovTiers: detail.bov_pricing_tiers || [] };
            } catch {
              return { id: p.id, bovTiers: [] as BOVPricingTier[] };
            }
          }),
        ).then((results) => {
          const map = new Map<number, BOVPricingTier[]>();
          results.forEach((r) => {
            if (r.status === 'fulfilled') {
              map.set(r.value.id, r.value.bovTiers);
            }
          });
          setBovPricingMap(map);
        });
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Failed to load dashboard data. Please try again.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Mount animation trigger
  useEffect(() => {
    if (!isLoading) {
      const timer = setTimeout(() => setMounted(true), 50);
      return () => clearTimeout(timer);
    }
    setMounted(false);
  }, [isLoading]);

  // --- Transform to DashboardDeal (sorted by deal score desc) ---
  const deals = useMemo((): DashboardDeal[] => {
    return properties
      .map((p) => ({
        id: p.id,
        name: p.property_name || p.deal_name,
        address: p.property_address || '',
        submarket: p.submarket || '',
        units: p.total_units || 0,
        dealValue: getDealValue(p, bovPricingMap),
        dealScore: scoresMap[p.id] ?? null,
        documentType: p.document_type,
        propertyType: p.property_type || null,
      }))
      .sort((a, b) => (b.dealScore ?? -1) - (a.dealScore ?? -1));
  }, [properties, bovPricingMap, scoresMap]);

  // --- Metrics ---
  const totalVolume = useMemo(
    () => deals.reduce((sum, d) => sum + (d.dealValue || 0), 0),
    [deals],
  );
  const totalUnits = useMemo(
    () => deals.reduce((sum, d) => sum + d.units, 0),
    [deals],
  );
  const activeDeals = deals.length;
  const avgPricePerUnit =
    totalVolume > 0 && totalUnits > 0 ? Math.round(totalVolume / totalUnits) : null;

  // --- Card / Map interaction ---
  const handleCardClick = useCallback((dealId: number) => {
    setSelectedDealId((prev) => (prev === dealId ? null : dealId));
  }, []);

  const handleCardDoubleClick = useCallback(
    (dealId: number) => {
      navigate(`/library/${dealId}`);
    },
    [navigate],
  );

  const handlePinClick = useCallback((dealId: number) => {
    setSelectedDealId(dealId);
  }, []);

  // Scroll selected card into view when selectedDealId changes (e.g. from map pin click)
  useEffect(() => {
    if (selectedDealId != null) {
      const el = document.getElementById(`deal-card-${selectedDealId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [selectedDealId]);

  // --- Chat ---
  const sendChatMessage = useCallback(async (message: string) => {
    if (!message.trim()) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: message.trim(),
      timestamp: new Date(),
    };
    setChatMessages((prev) => [...prev, userMessage].slice(-10));
    setAiQuery('');
    setIsTyping(true);

    try {
      const response = await api.post('/chat', { message: message.trim() });
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: response.data.response,
        timestamp: new Date(),
      };
      setChatMessages((prev) => [...prev, assistantMessage].slice(-10));
    } catch (err: unknown) {
      const detail =
        err != null &&
        typeof err === 'object' &&
        'response' in err &&
        (err as { response?: { data?: { detail?: string } } }).response?.data?.detail;
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content:
          detail ||
          'Sorry, I encountered an error. Please make sure the ANTHROPIC_API_KEY is configured in your backend .env file.',
        timestamp: new Date(),
      };
      setChatMessages((prev) => [...prev, errorMessage].slice(-10));
    } finally {
      setIsTyping(false);
    }
  }, []);

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <AnimatePresence mode="wait">
      {isLoading ? (
        <motion.div
          key="skeleton"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <DashboardSkeleton />
        </motion.div>
      ) : (
        <motion.div
          key="content"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
        >
          <div className="space-y-6">
            {/* ============== ERROR BANNER ============== */}
            {error && (
              <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                {error}
              </div>
            )}

            {/* ============== PAGE HEADER ============== */}
            <div
              className={cn(
                'flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 transition-all duration-500',
                mounted
                  ? 'opacity-100 translate-y-0'
                  : 'opacity-0 translate-y-2',
              )}
            >
              <div>
                <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                  {getGreeting()}, {firstName}
                </h1>
                <p className="text-sm mt-1 text-muted-foreground">
                  Your deal pipeline at a glance
                </p>
              </div>

              <div
                className={cn(
                  'flex items-center gap-3 transition-all duration-500',
                  mounted
                    ? 'opacity-100 translate-x-0'
                    : 'opacity-0 translate-x-5',
                )}
              >
                <Button
                  onClick={() => setShowAIPanel(true)}
                  className="bg-gradient-to-br from-primary to-primary/70 text-white shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:brightness-110"
                >
                  <Sparkles className="w-4 h-4" />
                  AI Summary
                </Button>

                <Button
                  variant="outline"
                  className="border-border text-muted-foreground hover:text-foreground"
                  onClick={() => navigate('/upload')}
                >
                  <Plus className="w-4 h-4" />
                  New Deal
                </Button>
              </div>
            </div>

            {/* ============== KEY METRICS — 4 cards ============== */}
            <section
              className={cn(
                'transition-all duration-500 delay-200',
                mounted
                  ? 'opacity-100 translate-y-0'
                  : 'opacity-0 translate-y-5',
              )}
            >
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Total Volume */}
                <div
                  className={cn(
                    'border border-border rounded-2xl bg-card p-4 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-primary/5',
                    mounted
                      ? 'opacity-100 translate-y-0'
                      : 'opacity-0 translate-y-4',
                  )}
                  style={{ transitionDelay: '200ms' }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="w-4 h-4 text-primary" />
                    <span className="text-2xs uppercase tracking-wider font-semibold text-muted-foreground">
                      Total Volume
                    </span>
                  </div>
                  <p className="font-mono text-2xl font-bold text-foreground">
                    {totalVolume > 0 ? formatDollarCompact(totalVolume) : '\u2014'}
                  </p>
                </div>

                {/* Total Units */}
                <div
                  className={cn(
                    'border border-border rounded-2xl bg-card p-4 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-primary/5',
                    mounted
                      ? 'opacity-100 translate-y-0'
                      : 'opacity-0 translate-y-4',
                  )}
                  style={{ transitionDelay: '260ms' }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Building2 className="w-4 h-4 text-primary" />
                    <span className="text-2xs uppercase tracking-wider font-semibold text-muted-foreground">
                      Total Units
                    </span>
                  </div>
                  <p className="font-mono text-2xl font-bold text-foreground">
                    {totalUnits.toLocaleString()}
                  </p>
                </div>

                {/* Active Deals */}
                <div
                  className={cn(
                    'border border-border rounded-2xl bg-card p-4 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-primary/5',
                    mounted
                      ? 'opacity-100 translate-y-0'
                      : 'opacity-0 translate-y-4',
                  )}
                  style={{ transitionDelay: '320ms' }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="w-4 h-4 text-primary" />
                    <span className="text-2xs uppercase tracking-wider font-semibold text-muted-foreground">
                      Active Deals
                    </span>
                  </div>
                  <p className="font-mono text-2xl font-bold text-foreground">
                    {activeDeals}
                  </p>
                </div>

                {/* Avg Price / Unit */}
                <div
                  className={cn(
                    'border border-border rounded-2xl bg-card p-4 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-primary/5',
                    mounted
                      ? 'opacity-100 translate-y-0'
                      : 'opacity-0 translate-y-4',
                  )}
                  style={{ transitionDelay: '380ms' }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Calculator className="w-4 h-4 text-primary" />
                    <span className="text-2xs uppercase tracking-wider font-semibold text-muted-foreground">
                      Avg Price / Unit
                    </span>
                  </div>
                  <p className="font-mono text-2xl font-bold text-foreground">
                    {avgPricePerUnit != null
                      ? formatDollarFull(avgPricePerUnit)
                      : '\u2014'}
                  </p>
                </div>
              </div>
            </section>

            {/* ============== SCREENING BADGE ROW ============== */}
            {screeningSummary.length > 0 && (
              <div
                className={cn(
                  'flex items-center gap-4 text-sm transition-all duration-500 delay-200',
                  mounted
                    ? 'opacity-100 translate-y-0'
                    : 'opacity-0 translate-y-2',
                )}
              >
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Screening:
                </span>
                <div className="flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="font-mono text-xs font-semibold text-foreground">
                    {screeningSummary.filter((s) => s.verdict === 'PASS').length}
                  </span>
                  <span className="text-xs text-muted-foreground">Pass</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                  <span className="font-mono text-xs font-semibold text-foreground">
                    {screeningSummary.filter((s) => s.verdict === 'REVIEW').length}
                  </span>
                  <span className="text-xs text-muted-foreground">Review</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <XCircle className="w-3.5 h-3.5 text-rose-500" />
                  <span className="font-mono text-xs font-semibold text-foreground">
                    {screeningSummary.filter((s) => s.verdict === 'FAIL').length}
                  </span>
                  <span className="text-xs text-muted-foreground">Fail</span>
                </div>
              </div>
            )}

            {/* ============== MAIN CONTENT — Deal Cards + Map ============== */}
            <section
              className={cn(
                'transition-all duration-500 delay-300',
                mounted
                  ? 'opacity-100 translate-y-0'
                  : 'opacity-0 translate-y-5',
              )}
            >
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* Left Column — Deal Cards (2/5 ≈ 40%) */}
                <div className="lg:col-span-2">
                  <h2 className="font-display text-lg font-bold text-foreground mb-4">
                    Deal Cards
                  </h2>
                  <div
                    className="space-y-3 overflow-y-auto pr-1"
                    style={{ maxHeight: '450px' }}
                  >
                    {deals.length > 0 ? (
                      deals.map((deal) => (
                        <DealCard
                          key={deal.id}
                          deal={deal}
                          isSelected={selectedDealId === deal.id}
                          onClick={() => handleCardClick(deal.id)}
                          onDoubleClick={() => handleCardDoubleClick(deal.id)}
                        />
                      ))
                    ) : (
                      <div className="border border-dashed border-border rounded-2xl p-8 text-center">
                        <p className="text-sm text-muted-foreground">
                          No deals in your pipeline yet
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-3"
                          onClick={() => navigate('/upload')}
                        >
                          <Plus className="w-3.5 h-3.5 mr-1" />
                          Upload Deal
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Column — Portfolio Map (3/5 = 60%) */}
                <div className="lg:col-span-3">
                  <h2 className="font-display text-lg font-bold text-foreground mb-4">
                    Portfolio Map
                  </h2>
                  <DashboardMap
                    deals={deals}
                    selectedDealId={selectedDealId}
                    onPinClick={handlePinClick}
                  />
                </div>
              </div>
            </section>
          </div>

          {/* ============== AI SUMMARY PANEL ============== */}
          <div
            className={cn(
              'fixed inset-0 z-50 transition-opacity duration-300',
              showAIPanel
                ? 'opacity-100 pointer-events-auto'
                : 'opacity-0 pointer-events-none',
            )}
          >
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setShowAIPanel(false)}
            />

            {/* Panel */}
            <div
              className={cn(
                'absolute right-0 top-0 h-full w-full max-w-lg bg-card border-l border-border overflow-y-auto transition-transform duration-300 ease-out',
                showAIPanel ? 'translate-x-0' : 'translate-x-full',
              )}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="sticky top-0 px-6 py-4 flex items-center justify-between bg-card border-b border-border z-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-primary to-primary/70">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-foreground">
                      AI Pipeline Analyst
                    </h3>
                    <p className="text-xs text-muted-foreground">All Deals</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAIPanel(false)}
                  className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6">
                {/* Quick Prompts */}
                {chatMessages.length === 0 && (
                  <div className="mb-6">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                      Quick Prompts
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {AI_QUICK_PROMPTS.map((prompt) => (
                        <button
                          key={prompt}
                          onClick={() => sendChatMessage(prompt)}
                          disabled={isTyping}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all bg-muted text-muted-foreground border border-border hover:border-primary hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Chat Messages */}
                {chatMessages.length > 0 && (
                  <div className="mb-6 space-y-4 max-h-[400px] overflow-y-auto">
                    {chatMessages.map((msg, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          'flex',
                          msg.role === 'user' ? 'justify-end' : 'justify-start',
                        )}
                      >
                        <div
                          className={cn(
                            'max-w-[85%] px-4 py-3 rounded-2xl',
                            msg.role === 'user'
                              ? 'bg-primary text-primary-foreground rounded-br-sm'
                              : 'bg-card border border-border rounded-bl-sm',
                          )}
                        >
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">
                            {msg.content}
                          </p>
                        </div>
                      </div>
                    ))}

                    {/* Typing Indicator */}
                    {isTyping && (
                      <div className="flex justify-start">
                        <div className="bg-card border border-border px-4 py-3 rounded-2xl rounded-bl-sm">
                          <div className="flex gap-1.5">
                            <div
                              className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce"
                              style={{ animationDelay: '0ms' }}
                            />
                            <div
                              className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce"
                              style={{ animationDelay: '150ms' }}
                            />
                            <div
                              className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce"
                              style={{ animationDelay: '300ms' }}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Input */}
                <div className="mb-6">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Ask about your portfolio..."
                      value={aiQuery}
                      onChange={(e) => setAiQuery(e.target.value)}
                      onKeyDown={(e) =>
                        e.key === 'Enter' &&
                        aiQuery &&
                        !isTyping &&
                        sendChatMessage(aiQuery)
                      }
                      disabled={isTyping}
                      className="w-full px-4 py-3 pr-12 rounded-xl text-sm outline-none bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary transition-all disabled:opacity-50"
                    />
                    <button
                      onClick={() => aiQuery && sendChatMessage(aiQuery)}
                      disabled={isTyping || !aiQuery}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-primary text-primary-foreground hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
