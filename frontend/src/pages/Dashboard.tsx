/**
 * Dashboard Page V2 — Kanban Pipeline + Chat Bar + Full-Height Map
 *
 * Layout (top to bottom):
 * 1. Header — Greeting, subtitle, screening badge, +New Deal button
 * 2. Metrics Row — Total Volume | Total Units | Chat Bar | (Map starts right column)
 * 3. Kanban Pipeline — Preset selector + draggable stage columns  | (Map continues)
 * 4. Analytics Row — Donut + Submarket Bars + Score Distribution
 */
import { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Users, X, Building2, ArrowRight } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuthStore } from '@/store/authSlice';
import { Button } from '@/components/ui/button';
import organizationService from '@/services/organizationService';
import type { Organization } from '@/services/organizationService';
import { MigrateDealModal } from '@/components/organization/MigrateDealModal';
import { PageTransition } from '@/components/layout/PageTransition';

const DEAL_STAGES_KEY = 'astra-deal-stages';
import { DashboardSkeleton } from '@/components/ui/PageSkeleton';
import { SlowLoadBanner } from '@/components/common/SlowLoadBanner';
import { propertyService } from '@/services/propertyService';
import { scoringService } from '@/services/scoringService';
import { criteriaService } from '@/services/criteriaService';
import type { PropertyListItem, ScreeningSummaryItem, BOVPricingTier } from '@/types/property';
import { DashboardMap } from '@/components/dashboard/DashboardMap';
import type { DashboardDeal } from '@/components/dashboard/DealCard';
import { KanbanBoard } from '@/components/dashboard/KanbanBoard';
import { ChatBar } from '@/components/dashboard/ChatBar';
import { PresetDropdown, PIPELINE_PRESETS, STORAGE_KEY } from '@/components/dashboard/PresetDropdown';
import { AnalyticsRow } from '@/components/dashboard/AnalyticsRow';

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
  if (num >= 1_000_000_000) return `$${(num / 1_000_000_000).toFixed(1)}B`;
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `$${(num / 1_000).toFixed(0)}K`;
  return `$${num}`;
};

const getDealValue = (
  property: PropertyWithFinancials,
  bovPricingMap: Map<number, BOVPricingTier[]>,
): number | null => {
  if (property.user_guidance_price && property.user_guidance_price > 0) {
    return property.user_guidance_price;
  }
  const bovTiers = bovPricingMap.get(property.id);
  if (bovTiers && bovTiers.length > 0) {
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

const getBestNoi = (p: PropertyWithFinancials): number | null => {
  return p.t12_noi ?? p.y1_noi ?? p.t3_noi ?? null;
};

const getCapRate = (noi: number | null, dealValue: number | null): number | null => {
  if (!noi || !dealValue || dealValue === 0) return null;
  return (noi / dealValue) * 100;
};

// ============================================================
// Sparkline SVG
// ============================================================

const Sparkline: React.FC<{ values: number[]; color?: string }> = ({ values, color = 'currentColor' }) => {
  if (values.length < 2) return null;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const w = 60;
  const h = 24;
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  });
  return (
    <svg width={w} height={h} className="shrink-0 opacity-40">
      <polyline points={points.join(' ')} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

// ============================================================
// COMPONENT
// ============================================================

export const Dashboard = () => {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const firstName = user?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'there';

  // --- Data State ---
  const [properties, setProperties] = useState<PropertyWithFinancials[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [screeningSummary, setScreeningSummary] = useState<ScreeningSummaryItem[]>([]);
  const [bovPricingMap, setBovPricingMap] = useState<Map<number, BOVPricingTier[]>>(new Map());
  const [selectedDealId, setSelectedDealId] = useState<number | null>(null);
  const [scoresMap, setScoresMap] = useState<Record<number, number | null>>({});

  // --- Pipeline State ---
  const [activePresetId, setActivePresetId] = useState<string>(() => {
    try { return localStorage.getItem(STORAGE_KEY) || 'acquisitions'; } catch { return 'acquisitions'; }
  });
  const [stageMap, setStageMap] = useState<Record<number, string>>({});

  // --- Org State ---
  const [userOrg, setUserOrg] = useState<Organization | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(() =>
    localStorage.getItem('astra_org_banner_dismissed') === 'true'
  );
  const [showMigrationModal, setShowMigrationModal] = useState(false);

  // --- UI State ---
  const [mounted, setMounted] = useState(false);

  const activePreset = useMemo(
    () => PIPELINE_PRESETS.find((p) => p.id === activePresetId) ?? PIPELINE_PRESETS[0],
    [activePresetId],
  );

  // --- Data Fetching ---
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const propertiesResult = await propertyService.listProperties({});
      const props = propertiesResult.properties as PropertyWithFinancials[];
      setProperties(props);

      const defaultStageId = PIPELINE_PRESETS.find((p) => p.id === activePresetId)?.stages[0]?.id || 'screening';
      const savedStages: Record<number, string> = (() => {
        try {
          const raw = localStorage.getItem(DEAL_STAGES_KEY);
          return raw ? JSON.parse(raw) : {};
        } catch { return {}; }
      })();
      const initialStageMap: Record<number, string> = {};
      props.forEach((p) => {
        initialStageMap[p.id] = savedStages[p.id] || p.pipeline_stage || defaultStageId;
      });
      setStageMap(initialStageMap);

      criteriaService.getScreeningSummary().then(setScreeningSummary).catch(() => {});

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
      const message = err instanceof Error ? err.message : 'Failed to load dashboard data. Please try again.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [activePresetId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Fetch org status & trigger migration modal
  useEffect(() => {
    organizationService.getMyOrg().then((org) => {
      setUserOrg(org);
      const migrationSeen = localStorage.getItem('astra_migration_seen');
      if (!migrationSeen && org.your_role === 'member') {
        setShowMigrationModal(true);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isLoading) {
      const timer = setTimeout(() => setMounted(true), 50);
      return () => clearTimeout(timer);
    }
    setMounted(false);
  }, [isLoading]);

  // --- Transform to DashboardDeal ---
  const deals = useMemo((): DashboardDeal[] => {
    return properties
      .map((p) => {
        const dealValue = getDealValue(p, bovPricingMap);
        const noi = getBestNoi(p);
        const capRate = getCapRate(noi, dealValue);
        return {
          id: p.id,
          name: p.property_name || p.deal_name,
          address: p.property_address || '',
          submarket: p.submarket || '',
          units: p.total_units || 0,
          dealValue,
          dealScore: scoresMap[p.id] ?? null,
          documentType: p.document_type,
          propertyType: p.property_type || null,
          latitude: p.latitude ?? null,
          longitude: p.longitude ?? null,
          noi,
          capRate,
          stage: stageMap[p.id],
        };
      })
      .sort((a, b) => (b.dealScore ?? -1) - (a.dealScore ?? -1));
  }, [properties, bovPricingMap, scoresMap, stageMap]);

  // --- Metrics ---
  const totalVolume = useMemo(() => deals.reduce((sum, d) => sum + (d.dealValue || 0), 0), [deals]);
  const totalUnits = useMemo(() => deals.reduce((sum, d) => sum + d.units, 0), [deals]);

  const screeningCounts = useMemo(() => {
    if (screeningSummary.length > 0) {
      return {
        pass: screeningSummary.filter((s) => s.verdict === 'PASS').length,
        review: screeningSummary.filter((s) => s.verdict === 'REVIEW').length,
        fail: screeningSummary.filter((s) => s.verdict === 'FAIL').length,
      };
    }
    const scored = deals.filter((d) => d.dealScore != null);
    return {
      pass: scored.filter((d) => (d.dealScore ?? 0) >= 80).length,
      review: scored.filter((d) => (d.dealScore ?? 0) >= 60 && (d.dealScore ?? 0) < 80).length,
      fail: scored.filter((d) => (d.dealScore ?? 0) < 60).length,
    };
  }, [screeningSummary, deals]);

  const volumeSparkline = useMemo(() => {
    const vals = deals.slice(0, 8).map((d) => d.dealValue ?? 0);
    return vals.length >= 2 ? vals : [0, 1];
  }, [deals]);

  const unitSparkline = useMemo(() => {
    const vals = deals.slice(0, 8).map((d) => d.units);
    return vals.length >= 2 ? vals : [0, 1];
  }, [deals]);

  // --- Interactions ---
  const handleCardClick = useCallback((dealId: number) => {
    setSelectedDealId(dealId);
  }, []);

  const handlePinClick = useCallback((dealId: number) => {
    setSelectedDealId(dealId);
    const el = document.getElementById(`deal-card-${dealId}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, []);

  const handleStageChange = useCallback((dealId: number, newStageId: string) => {
    setStageMap((prev) => {
      const next = { ...prev, [dealId]: newStageId };
      try { localStorage.setItem(DEAL_STAGES_KEY, JSON.stringify(next)); } catch { /* noop */ }
      return next;
    });
  }, []);

  const handlePresetChange = useCallback((presetId: string) => {
    setActivePresetId(presetId);
    try { localStorage.setItem(STORAGE_KEY, presetId); } catch { /* noop */ }
  }, []);

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <PageTransition>
      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.div key="skeleton" initial={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
            <DashboardSkeleton />
            <SlowLoadBanner />
          </motion.div>
        ) : (
          <motion.div key="content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
            <div className="space-y-5">
              {error && (
                <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                  {error}
                </div>
              )}

              {/* Org Onboarding Banner */}
              {!userOrg && !bannerDismissed && (
                <div className="mb-1 flex items-center justify-between bg-primary/10 border border-primary/20 rounded-xl px-5 py-4">
                  <div className="flex items-center gap-3">
                    <Users className="h-5 w-5 text-primary shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Set up your team workspace</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Create or join an organization to share deals with your colleagues.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <Button size="sm" onClick={() => navigate('/organization')}>Set Up Organization</Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        localStorage.setItem('astra_org_banner_dismissed', 'true');
                        setBannerDismissed(true);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Org Context Bar — shown when user IS in an org */}
              {userOrg && (
                <div className="mb-1 flex items-center justify-between bg-primary/5 border border-primary/10 rounded-xl px-5 py-3">
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <Building2 className="h-4 w-4 text-primary/60 shrink-0" />
                    <span className="font-medium text-foreground">{userOrg.name} workspace</span>
                    <span className="text-muted-foreground/60">&middot;</span>
                    <span>{properties.filter(p => p.organization_id != null).length} shared deals</span>
                    <span className="text-muted-foreground/60">&middot;</span>
                    <span>{userOrg.member_count} {userOrg.member_count === 1 ? 'member' : 'members'}</span>
                  </div>
                  <button
                    onClick={() => navigate('/organization')}
                    className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                  >
                    Manage
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Migration Modal */}
              {showMigrationModal && userOrg && (
                <MigrateDealModal org={userOrg} onClose={() => setShowMigrationModal(false)} />
              )}

              {/* ============== HEADER ============== */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0 }}
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div>
                    <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">
                      <span className="text-white">{getGreeting()}, </span>
                      <span className="text-primary">{firstName}</span>
                    </h1>
                    {userOrg && (
                      <a
                        href="/organization"
                        onClick={(e) => { e.preventDefault(); navigate('/organization'); }}
                        className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                      >
                        <Building2 className="w-3.5 h-3.5" />
                        <span>{userOrg.name}</span>
                        <span className="text-muted-foreground/60">&middot;</span>
                        <span>{userOrg.member_count} {userOrg.member_count === 1 ? 'member' : 'members'}</span>
                      </a>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    {(screeningCounts.pass + screeningCounts.review + screeningCounts.fail) > 0 && (
                      <div className="hidden sm:flex items-center gap-1 px-3 py-1.5 rounded-lg bg-card border border-border/60 text-xs">
                        <span className="text-muted-foreground font-medium mr-1">Screening:</span>
                        <span className="px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 font-mono font-bold">{screeningCounts.pass} Pass</span>
                        <span className="px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-400 font-mono font-bold">{screeningCounts.review} Review</span>
                        <span className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 font-mono font-bold">{screeningCounts.fail} Fail</span>
                      </div>
                    )}

                    <button
                      onClick={() => navigate('/upload')}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-primary text-primary-foreground shadow-sm hover:brightness-110 transition-all"
                    >
                      <Plus className="w-4 h-4" />
                      New Deal
                    </button>
                  </div>
                </div>
              </motion.div>

              {/* ============== MAIN GRID: Left + Right Map ============== */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* Left Column — 7/12 */}
                <div className="lg:col-span-7 space-y-5">
                  {/* Metrics + Chat Bar */}
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.1 }}
                  >
                    <div className="flex gap-3 items-start">
                      <div className="flex-shrink-0 w-[195px] border border-border/60 rounded-2xl bg-card/50 p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-mono text-2xs uppercase tracking-wider text-muted-foreground font-semibold">
                            Total Volume
                          </span>
                          <Sparkline values={volumeSparkline} color="hsl(var(--primary))" />
                        </div>
                        <p className="font-display text-xl font-bold text-foreground">
                          {totalVolume > 0 ? formatDollarCompact(totalVolume) : '\u2014'}
                        </p>
                      </div>

                      <div className="flex-shrink-0 w-[195px] border border-border/60 rounded-2xl bg-card/50 p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-mono text-2xs uppercase tracking-wider text-muted-foreground font-semibold">
                            Total Units
                          </span>
                          <Sparkline values={unitSparkline} color="#60A5FA" />
                        </div>
                        <p className="font-display text-xl font-bold text-blue-400">
                          {totalUnits.toLocaleString()}
                        </p>
                        <p className="font-mono text-2xs text-muted-foreground mt-0.5">
                          {deals.length} properties
                        </p>
                      </div>

                      <ChatBar deals={deals} />
                    </div>
                  </motion.div>

                  {/* Pipeline by Stage */}
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.2 }}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <h2 className="font-display text-lg font-bold text-foreground">Pipeline by Stage</h2>
                      <PresetDropdown
                        presets={PIPELINE_PRESETS}
                        activePresetId={activePresetId}
                        onPresetChange={handlePresetChange}
                      />
                    </div>
                    <KanbanBoard
                      deals={deals}
                      stages={activePreset.stages}
                      stageMap={stageMap}
                      onStageChange={handleStageChange}
                      onCardClick={handleCardClick}
                      selectedDealId={selectedDealId}
                      mounted={mounted}
                    />
                  </motion.div>
                </div>

                {/* Right Column — Map (5/12, full height) */}
                <motion.div
                  className="lg:col-span-5 self-stretch"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.15 }}
                  style={{ minHeight: '500px' }}
                >
                  <DashboardMap
                    deals={deals}
                    selectedDealId={selectedDealId}
                    onPinClick={handlePinClick}
                  />
                </motion.div>
              </div>

              {/* ============== ANALYTICS ROW ============== */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.3 }}
              >
                <AnalyticsRow deals={deals} stages={activePreset.stages} stageMap={stageMap} />
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </PageTransition>
  );
};
