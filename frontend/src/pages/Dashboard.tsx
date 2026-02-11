/**
 * Dashboard Page - Configurable Deal Command Center
 *
 * Features:
 * - Welcome header with time-of-day greeting
 * - Key metrics cards (customizable selection)
 * - Pipeline kanban board with customizable stages
 * - Tag-based filtering across all dashboard data
 * - Status donut chart, geographic bars, NOI distribution plot
 * - AI pipeline summary simulation panel
 * - Widget visibility toggling
 *
 * Data is fetched from /api/v1/properties and /api/v1/deal-folders.
 */
import { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Sparkles,
  Plus,
  Settings,
  Pencil,
  DollarSign,
  Building2,
  Folder,
  Zap,
  CheckCircle2,
  ArrowUp,
  ArrowDown,
  ArrowRight,
  X,
  Check,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/authSlice';
import { Button } from '@/components/ui/button';
import { DashboardSkeleton } from '@/components/ui/PageSkeleton';
import { propertyService } from '@/services/propertyService';
import { dealFolderService, type DealFolder } from '@/services/dealFolderService';
import { criteriaService } from '@/services/criteriaService';
import type { PropertyListItem, ScreeningSummaryItem } from '@/types/property';
import { Shield, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

// ============================================================
// TYPES
// ============================================================

type IconComponent = typeof DollarSign;

/** Extended property type including financial fields the backend returns */
interface PropertyWithFinancials extends PropertyListItem {
  t12_noi?: number | null;
  y1_noi?: number | null;
  t3_noi?: number | null;
  total_sf?: number | null;
  status?: string;
}

interface DashboardDeal {
  id: number;
  name: string;
  address: string;
  submarket: string;
  units: number;
  noiT12: number | null;
  noiY1: number | null;
  propertyType: string | null;
  documentType: string;
  stage: string;
  tags: string[];
}

interface PipelineStage {
  id: string;
  label: string;
  color: string;
}

interface StageTemplate {
  label: string;
  stages: PipelineStage[];
}

interface Widget {
  id: string;
  label: string;
  visible: boolean;
}

interface MetricDefinition {
  label: string;
  format: (value: number | string | null) => string;
  icon: IconComponent;
}

interface MetricsData {
  totalNOI: number;
  totalUnits: number;
  dealCount: number;
  activeDeals: number;
  avgNOI: number;
  totalNOIY1: number;
  avgNOIY1: number;
  closedDeals: number;
  highestNOI: number;
  lowestNOI: number;
}

type MetricId = keyof MetricsData;

interface StatusChartDatum extends PipelineStage {
  count: number;
  value: number;
}

interface GeoChartDatum {
  submarket: string;
  count: number;
  value: number;
}

interface AIResponse {
  summary: string;
  insights: string[];
  topDeal: DashboardDeal | null;
  recommendation: string;
}

// ============================================================
// CONSTANTS
// ============================================================

const STAGE_TEMPLATES: Record<string, StageTemplate> = {
  acquisitions: {
    label: 'Acquisitions Pipeline',
    stages: [
      { id: 'new', label: 'New', color: '#60A5FA' },
      { id: 'active', label: 'Active', color: '#A78BFA' },
      { id: 'review', label: 'In Review', color: '#FBBF24' },
      { id: 'passed', label: 'Passed', color: '#94A3B8' },
      { id: 'closed', label: 'Closed', color: '#10B981' },
    ],
  },
  dispositions: {
    label: 'Disposition Tracker',
    stages: [
      { id: 'prep', label: 'Prep', color: '#60A5FA' },
      { id: 'listed', label: 'Listed', color: '#A78BFA' },
      { id: 'offers', label: 'Offers', color: '#FBBF24' },
      { id: 'underContract', label: 'Under Contract', color: '#34D399' },
      { id: 'sold', label: 'Sold', color: '#10B981' },
    ],
  },
  broker: {
    label: 'Broker Pipeline',
    stages: [
      { id: 'lead', label: 'Lead', color: '#60A5FA' },
      { id: 'pitch', label: 'Pitch', color: '#A78BFA' },
      { id: 'listing', label: 'Listing', color: '#FBBF24' },
      { id: 'marketing', label: 'Marketing', color: '#F97316' },
      { id: 'offers', label: 'Offers', color: '#34D399' },
      { id: 'closed', label: 'Closed', color: '#10B981' },
    ],
  },
};

const AI_QUICK_PROMPTS = [
  'Summarize my pipeline',
  'Top NOI performers',
  'Deals in review',
  'Pipeline breakdown by submarket',
];

// ============================================================
// HELPERS
// ============================================================

const formatPrice = (num: number | null): string => {
  if (!num) return '\u2014';
  if (num >= 1_000_000_000) return `$${(num / 1_000_000_000).toFixed(2)}B`;
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `$${(num / 1_000).toFixed(0)}K`;
  return `$${num}`;
};

/** Returns a hex color for NOI relative to the max NOI (for SVG/inline styles) */
const getNOIColor = (noi: number, maxNOI: number): string => {
  if (maxNOI === 0) return '#94a3b8';
  const ratio = noi / maxNOI;
  if (ratio >= 0.75) return '#10b981';
  if (ratio >= 0.5) return '#8b5cf6';
  if (ratio >= 0.25) return '#f59e0b';
  return '#f43f5e';
};

const getGreeting = (): string => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

const METRICS_LIBRARY: Record<MetricId, MetricDefinition> = {
  totalNOI: {
    label: 'Total NOI (T12)',
    format: (v) => formatPrice(v as number),
    icon: DollarSign,
  },
  totalUnits: {
    label: 'Total Units',
    format: (v) => (v as number).toLocaleString(),
    icon: Building2,
  },
  dealCount: {
    label: 'Total Deals',
    format: (v) => String(v),
    icon: Folder,
  },
  activeDeals: {
    label: 'Active Deals',
    format: (v) => String(v),
    icon: Zap,
  },
  avgNOI: {
    label: 'Avg NOI (T12)',
    format: (v) => formatPrice(v as number),
    icon: DollarSign,
  },
  totalNOIY1: {
    label: 'Total NOI (Y1)',
    format: (v) => formatPrice(v as number),
    icon: DollarSign,
  },
  avgNOIY1: {
    label: 'Avg NOI (Y1)',
    format: (v) => formatPrice(v as number),
    icon: DollarSign,
  },
  closedDeals: {
    label: 'Closed Deals',
    format: (v) => String(v),
    icon: CheckCircle2,
  },
  highestNOI: {
    label: 'Highest NOI',
    format: (v) => formatPrice(v as number),
    icon: ArrowUp,
  },
  lowestNOI: {
    label: 'Lowest NOI',
    format: (v) => formatPrice(v as number),
    icon: ArrowDown,
  },
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
  const [folders, setFolders] = useState<DealFolder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [screeningSummary, setScreeningSummary] = useState<ScreeningSummaryItem[]>([]);

  // --- UI State ---
  const [mounted, setMounted] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [aiQuery, setAiQuery] = useState('');
  const [aiResponse, setAiResponse] = useState<AIResponse | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [showMetricsEditor, setShowMetricsEditor] = useState(false);
  const [showStageEditor, setShowStageEditor] = useState(false);
  const [draggedDeal, setDraggedDeal] = useState<number | null>(null);

  // Widget visibility
  const [widgets] = useState<Widget[]>([
    { id: 'metrics', label: 'Key Metrics', visible: true },
    { id: 'kanban', label: 'Pipeline Board', visible: true },
    { id: 'charts', label: 'Analytics', visible: true },
  ]);

  // Selected metrics (user customizable)
  const [selectedMetrics, setSelectedMetrics] = useState<MetricId[]>([
    'totalNOI',
    'totalUnits',
    'activeDeals',
    'dealCount',
    'avgNOI',
    'closedDeals',
  ]);

  // Kanban stages
  const [pipelineTemplate, setPipelineTemplate] = useState('acquisitions');
  const [stages, setStages] = useState<PipelineStage[]>(
    STAGE_TEMPLATES.acquisitions.stages,
  );

  // --- Data Fetching ---
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [propertiesResult, foldersResult] = await Promise.all([
        propertyService.listProperties({}),
        dealFolderService.listFolders('active'),
      ]);
      setProperties(
        propertiesResult.properties as PropertyWithFinancials[],
      );
      setFolders(foldersResult);

      // Non-blocking fetch of screening summary
      criteriaService.getScreeningSummary().then(setScreeningSummary).catch(() => {});
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

  // Mount animation trigger (after loading completes)
  useEffect(() => {
    if (!isLoading) {
      const timer = setTimeout(() => setMounted(true), 50);
      return () => clearTimeout(timer);
    }
    setMounted(false);
  }, [isLoading]);

  // --- Folder status map ---
  const folderStatusMap = useMemo(() => {
    const map = new Map<number, string>();
    folders.forEach((f) => map.set(f.id, f.status || 'active'));
    return map;
  }, [folders]);

  // --- Transform API data to DashboardDeal ---
  const deals = useMemo((): DashboardDeal[] => {
    return properties.map((p) => {
      const stage =
        p.status ||
        (p.deal_folder_id
          ? folderStatusMap.get(p.deal_folder_id) || 'active'
          : 'active');

      const tags: string[] = [];
      if (p.property_type) tags.push(p.property_type);
      if (p.submarket) tags.push(p.submarket);
      if (p.document_type) tags.push(p.document_type);
      if ((p.total_units || 0) >= 200) tags.push('200+ Units');

      return {
        id: p.id,
        name: p.property_name || p.deal_name,
        address: p.property_address || '',
        submarket: p.submarket || '',
        units: p.total_units || 0,
        noiT12: p.t12_noi ?? null,
        noiY1: p.y1_noi ?? null,
        propertyType: p.property_type || null,
        documentType: p.document_type,
        stage,
        tags,
      };
    });
  }, [properties, folderStatusMap]);

  // --- Derive tags dynamically from real data ---
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    deals.forEach((d) => d.tags.forEach((t) => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }, [deals]);

  // --- Filtered Data ---
  const filteredDeals = useMemo(() => {
    if (selectedTags.length === 0) return deals;
    return deals.filter((deal) =>
      selectedTags.every((tag) => deal.tags.includes(tag)),
    );
  }, [deals, selectedTags]);

  // --- Metrics ---
  const metrics = useMemo((): MetricsData => {
    const active = filteredDeals.filter(
      (d) => d.stage !== 'closed' && d.stage !== 'passed',
    );
    const dealsWithNOI = filteredDeals.filter(
      (d) => d.noiT12 !== null && d.noiT12 > 0,
    );
    const dealsWithNOIY1 = filteredDeals.filter(
      (d) => d.noiY1 !== null && d.noiY1 > 0,
    );

    return {
      totalNOI: dealsWithNOI.reduce((sum, d) => sum + (d.noiT12 || 0), 0),
      totalUnits: filteredDeals.reduce((sum, d) => sum + d.units, 0),
      dealCount: filteredDeals.length,
      activeDeals: active.length,
      avgNOI:
        dealsWithNOI.length > 0
          ? Math.round(
              dealsWithNOI.reduce((sum, d) => sum + (d.noiT12 || 0), 0) /
                dealsWithNOI.length,
            )
          : 0,
      totalNOIY1: dealsWithNOIY1.reduce(
        (sum, d) => sum + (d.noiY1 || 0),
        0,
      ),
      avgNOIY1:
        dealsWithNOIY1.length > 0
          ? Math.round(
              dealsWithNOIY1.reduce((sum, d) => sum + (d.noiY1 || 0), 0) /
                dealsWithNOIY1.length,
            )
          : 0,
      closedDeals: filteredDeals.filter((d) => d.stage === 'closed').length,
      highestNOI:
        dealsWithNOI.length > 0
          ? Math.max(...dealsWithNOI.map((d) => d.noiT12 || 0))
          : 0,
      lowestNOI:
        dealsWithNOI.length > 0
          ? Math.min(...dealsWithNOI.map((d) => d.noiT12 || 0))
          : 0,
    };
  }, [filteredDeals]);

  // --- Chart Data ---
  const statusChartData = useMemo((): StatusChartDatum[] => {
    return stages.map((stage) => ({
      ...stage,
      count: filteredDeals.filter((d) => d.stage === stage.id).length,
      value: filteredDeals
        .filter((d) => d.stage === stage.id)
        .reduce((sum, d) => sum + (d.noiT12 || 0), 0),
    }));
  }, [filteredDeals, stages]);

  const geoChartData = useMemo((): GeoChartDatum[] => {
    const bySubmarket: Record<string, { count: number; value: number }> = {};
    filteredDeals.forEach((deal) => {
      const key = deal.submarket || 'Other';
      if (!bySubmarket[key]) bySubmarket[key] = { count: 0, value: 0 };
      bySubmarket[key].count++;
      bySubmarket[key].value += deal.noiT12 || 0;
    });
    return Object.entries(bySubmarket)
      .map(([submarket, data]) => ({ submarket, ...data }))
      .sort((a, b) => b.value - a.value);
  }, [filteredDeals]);

  // Deals with NOI data for the distribution chart
  const dealsWithNOIData = useMemo(
    () => filteredDeals.filter((d) => d.noiT12 !== null && d.noiT12 > 0),
    [filteredDeals],
  );
  const maxNOI = useMemo(
    () =>
      dealsWithNOIData.length > 0
        ? Math.max(...dealsWithNOIData.map((d) => d.noiT12 || 0))
        : 0,
    [dealsWithNOIData],
  );

  // --- Handlers ---
  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const toggleMetric = (metricId: MetricId) => {
    setSelectedMetrics((prev) =>
      prev.includes(metricId)
        ? prev.filter((m) => m !== metricId)
        : [...prev, metricId],
    );
  };

  const applyTemplate = (templateId: string) => {
    setPipelineTemplate(templateId);
    setStages(STAGE_TEMPLATES[templateId].stages);
    setShowStageEditor(false);
  };

  const moveDeal = (_dealId: number, _newStage: string) => {
    toast.info('Coming soon', {
      description: 'Deal stage updates will be persisted in a future update.'
    });
    setDraggedDeal(null);
  };

  const generateAISummary = useCallback(
    async (query: string) => {
      setAiLoading(true);

      // Simulate AI processing delay
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const tagContext =
        selectedTags.length > 0
          ? `for ${selectedTags.join(' + ')} deals`
          : 'across your entire pipeline';

      const noiDeals = filteredDeals.filter(
        (d) => d.noiT12 !== null && d.noiT12 > 0,
      );

      const response: AIResponse = {
        summary: `Your pipeline ${tagContext} contains ${filteredDeals.length} deals totaling ${formatPrice(metrics.totalNOI)} in T12 NOI across ${metrics.totalUnits.toLocaleString()} units.`,
        insights: [
          metrics.avgNOI > 0
            ? `Average T12 NOI is ${formatPrice(metrics.avgNOI)} across ${noiDeals.length} deals with financial data.`
            : 'Financial data is still being populated for your pipeline deals.',
          `${filteredDeals.filter((d) => d.stage === 'review').length} deal(s) are currently in review.`,
          `Your pipeline includes ${metrics.totalUnits.toLocaleString()} total units across ${filteredDeals.length} properties.`,
        ],
        topDeal:
          noiDeals.length > 0
            ? noiDeals.reduce((best, deal) =>
                (deal.noiT12 || 0) > (best.noiT12 || 0) ? deal : best,
              )
            : null,
        recommendation:
          filteredDeals.length > 0
            ? query.toLowerCase().includes('noi')
              ? `Your top NOI performer is ${noiDeals.length > 0 ? noiDeals.reduce((best, d) => ((d.noiT12 || 0) > (best.noiT12 || 0) ? d : best)).name : 'N/A'} with ${formatPrice(metrics.highestNOI)} T12 NOI.`
              : query.toLowerCase().includes('review')
                ? `You have ${filteredDeals.filter((d) => d.stage === 'review').length} deal(s) in review. Advancing these will strengthen your pipeline velocity.`
                : `Focus on the ${filteredDeals.filter((d) => d.stage === 'active' || d.stage === 'review').length} deals in active/review stages to advance your pipeline.`
            : 'Upload new deal documents to get started with your pipeline analysis.',
      };

      setAiResponse(response);
      setAiLoading(false);
    },
    [filteredDeals, metrics, selectedTags],
  );

  // --- Render Helpers ---
  const isWidgetVisible = (widgetId: string): boolean =>
    widgets.find((w) => w.id === widgetId)?.visible ?? false;

  return (
    <AnimatePresence mode="wait">
      {isLoading ? (
        <motion.div key="skeleton" initial={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
          <DashboardSkeleton />
        </motion.div>
      ) : (
        <motion.div key="content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
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
          mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2',
        )}
      >
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            {getGreeting()}, {firstName}
          </h1>
          <p className="text-sm mt-1 text-muted-foreground">
            {selectedTags.length > 0
              ? `Filtered: ${selectedTags.join(' + ')}`
              : 'Your deal pipeline at a glance'}
          </p>
        </div>

        <div
          className={cn(
            'flex items-center gap-3 transition-all duration-500',
            mounted ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-5',
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

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowMetricsEditor(true)}
            className="text-muted-foreground hover:text-foreground"
          >
            <Settings className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Tag Pills Filter */}
      <div
        className={cn(
          'flex items-center gap-2 overflow-x-auto pb-2 transition-all duration-500 delay-100',
          mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2',
        )}
      >
        <span className="text-xs font-medium shrink-0 text-muted-foreground">
          Filter:
        </span>
        {allTags.map((tag) => (
          <button
            key={tag}
            onClick={() => toggleTag(tag)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 border',
              selectedTags.includes(tag)
                ? 'bg-primary/10 text-primary border-primary'
                : 'bg-muted text-muted-foreground border-transparent hover:border-border hover:text-foreground',
            )}
          >
            {tag}
          </button>
        ))}
        {selectedTags.length > 0 && (
          <button
            onClick={() => setSelectedTags([])}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 text-destructive hover:text-destructive/80"
          >
            Clear All
          </button>
        )}
      </div>

      {/* ============== MAIN CONTENT ============== */}
      <div className="space-y-6">
        {/* ============== METRICS GRID ============== */}
        {isWidgetVisible('metrics') && (
          <section
            className={cn(
              'transition-all duration-500 delay-200',
              mounted
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 translate-y-5',
            )}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-bold text-foreground">
                Key Metrics
              </h2>
              <button
                onClick={() => setShowMetricsEditor(true)}
                className="text-xs font-medium flex items-center gap-1 text-primary hover:text-primary/80 transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" />
                Customize
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {selectedMetrics.map((metricId, index) => {
                const metricDef = METRICS_LIBRARY[metricId];
                if (!metricDef) return null;
                const value = metrics[metricId];
                const IconComp = metricDef.icon;

                return (
                  <div
                    key={metricId}
                    className={cn(
                      'border border-border rounded-2xl bg-card p-4 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-primary/5',
                      mounted
                        ? 'opacity-100 translate-y-0'
                        : 'opacity-0 translate-y-4',
                    )}
                    style={{ transitionDelay: `${200 + index * 60}ms` }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <IconComp className="w-4 h-4 text-primary" />
                      <span className="text-2xs uppercase tracking-wider font-semibold text-muted-foreground">
                        {metricDef.label}
                      </span>
                    </div>
                    <p className="font-mono text-2xl font-bold text-foreground">
                      {metricDef.format(value)}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ============== SCREENING RESULTS ============== */}
        {screeningSummary.length > 0 && (
          <section
            className={cn(
              'transition-all duration-500 delay-250',
              mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5',
            )}
          >
            <div className="border border-border rounded-2xl bg-card p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-primary/10">
                  <Shield className="w-4.5 h-4.5 text-primary" />
                </div>
                <div>
                  <h3 className="font-display font-semibold text-foreground text-sm">
                    Screening Results
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {screeningSummary.filter((s) => s.verdict === 'PASS').length} of{' '}
                    {screeningSummary.length} properties pass your criteria
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 mb-3">
                <div className="flex items-center gap-1.5 text-xs">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="font-mono font-semibold text-foreground">
                    {screeningSummary.filter((s) => s.verdict === 'PASS').length}
                  </span>
                  <span className="text-muted-foreground">Pass</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                  <span className="font-mono font-semibold text-foreground">
                    {screeningSummary.filter((s) => s.verdict === 'REVIEW').length}
                  </span>
                  <span className="text-muted-foreground">Review</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                  <XCircle className="w-3.5 h-3.5 text-rose-500" />
                  <span className="font-mono font-semibold text-foreground">
                    {screeningSummary.filter((s) => s.verdict === 'FAIL').length}
                  </span>
                  <span className="text-muted-foreground">Fail</span>
                </div>
              </div>
              <button
                onClick={() => navigate('/library?screening=PASS')}
                className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
              >
                View passing properties &rarr;
              </button>
            </div>
          </section>
        )}

        {/* ============== KANBAN PIPELINE ============== */}
        {isWidgetVisible('kanban') && (
          <section
            className={cn(
              'transition-all duration-500 delay-300',
              mounted
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 translate-y-5',
            )}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-bold text-foreground">
                Pipeline Board
              </h2>
              <button
                onClick={() => setShowStageEditor(true)}
                className="text-xs font-medium flex items-center gap-1 text-primary hover:text-primary/80 transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" />
                Edit Stages
              </button>
            </div>

            <div
              className="flex gap-4 overflow-x-auto pb-4"
              style={{ minHeight: 400 }}
            >
              {stages.map((stage, stageIndex) => {
                const stageDeals = filteredDeals.filter(
                  (d) => d.stage === stage.id,
                );
                const stageNOI = stageDeals.reduce(
                  (sum, d) => sum + (d.noiT12 || 0),
                  0,
                );

                return (
                  <div
                    key={stage.id}
                    className={cn(
                      'flex-shrink-0 w-72 border border-border rounded-2xl bg-card overflow-hidden transition-all duration-500',
                      mounted
                        ? 'opacity-100 translate-x-0'
                        : 'opacity-0 translate-x-5',
                    )}
                    style={{
                      transitionDelay: `${300 + stageIndex * 100}ms`,
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() =>
                      draggedDeal !== null && moveDeal(draggedDeal, stage.id)
                    }
                  >
                    {/* Stage Header */}
                    <div
                      className="px-4 py-3 flex items-center justify-between"
                      style={{ borderBottom: `2px solid ${stage.color}` }}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: stage.color }}
                        />
                        <span className="font-semibold text-sm text-foreground">
                          {stage.label}
                        </span>
                        <span className="text-xs px-1.5 py-0.5 rounded-full font-mono bg-muted text-muted-foreground">
                          {stageDeals.length}
                        </span>
                      </div>
                      <span className="text-xs font-mono text-muted-foreground">
                        {formatPrice(stageNOI)}
                      </span>
                    </div>

                    {/* Stage Cards */}
                    <div className="p-3 space-y-3 min-h-[300px]">
                      {stageDeals.map((deal) => (
                        <div
                          key={deal.id}
                          draggable
                          onDragStart={() => setDraggedDeal(deal.id)}
                          onDragEnd={() => setDraggedDeal(null)}
                          onClick={() => navigate(`/library/${deal.id}`)}
                          className={cn(
                            'rounded-xl p-3 cursor-grab active:cursor-grabbing transition-all duration-200 hover:scale-[1.02] hover:shadow-md border border-border bg-muted',
                            draggedDeal === deal.id && 'opacity-50',
                          )}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="min-w-0">
                              <p className="font-semibold text-sm text-foreground truncate">
                                {deal.name}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                {deal.submarket || deal.address || '\u2014'}
                              </p>
                            </div>
                            {deal.documentType && (
                              <span className="text-[10px] font-mono font-bold px-2 py-1 rounded-lg bg-primary/10 text-primary shrink-0 ml-2">
                                {deal.documentType}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">
                              {deal.units > 0 ? `${deal.units} units` : '\u2014'}
                            </span>
                            <span className={cn(
                              "font-mono font-semibold",
                              (deal.noiT12 || deal.noiY1) ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
                            )}>
                              {deal.noiT12 ? formatPrice(deal.noiT12) : deal.noiY1 ? formatPrice(deal.noiY1) : 'No Pricing'}
                            </span>
                          </div>
                        </div>
                      ))}

                      {stageDeals.length === 0 && (
                        <div className="h-32 rounded-xl border-2 border-dashed border-border flex items-center justify-center">
                          <span className="text-xs text-muted-foreground">
                            Drop deals here
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ============== CHARTS ROW ============== */}
        {isWidgetVisible('charts') && (
          <section
            className={cn(
              'grid grid-cols-1 lg:grid-cols-3 gap-6 transition-all duration-500 delay-[400ms]',
              mounted
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 translate-y-5',
            )}
          >
            {/* --- Status Donut --- */}
            <div className="border border-border rounded-2xl bg-card p-6">
              <h3 className="font-display text-base font-bold text-foreground mb-4">
                Pipeline by Status
              </h3>

              <div className="flex items-center justify-center">
                <div className="relative w-40 h-40">
                  <svg viewBox="0 0 100 100" className="transform -rotate-90">
                    {(() => {
                      let offset = 0;
                      const total =
                        statusChartData.reduce((sum, s) => sum + s.count, 0) ||
                        1;
                      const circumference = Math.PI * 36;

                      return statusChartData.map((stage) => {
                        const percentage = (stage.count / total) * 100;
                        const strokeDasharray = `${(percentage / 100) * circumference} ${circumference}`;
                        const strokeDashoffset =
                          -(offset / 100) * circumference;
                        offset += percentage;

                        return (
                          <circle
                            key={stage.id}
                            cx="50"
                            cy="50"
                            r="36"
                            fill="none"
                            stroke={stage.color}
                            strokeWidth="8"
                            strokeDasharray={strokeDasharray}
                            strokeDashoffset={strokeDashoffset}
                            className="transition-all duration-500"
                          />
                        );
                      });
                    })()}
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="font-mono text-2xl font-bold text-foreground">
                      {filteredDeals.length}
                    </span>
                    <span className="text-xs text-muted-foreground">Deals</span>
                  </div>
                </div>
              </div>

              {/* Legend */}
              <div className="mt-4 space-y-2">
                {statusChartData.map((stage) => (
                  <div
                    key={stage.id}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: stage.color }}
                      />
                      <span className="text-xs text-muted-foreground">
                        {stage.label}
                      </span>
                    </div>
                    <span className="font-mono text-xs text-foreground">
                      {stage.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* --- Submarket Bar Chart --- */}
            <div className="border border-border rounded-2xl bg-card p-6">
              <h3 className="font-display text-base font-bold text-foreground mb-4">
                By Submarket
              </h3>

              {geoChartData.length > 0 ? (
                <div className="space-y-3">
                  {geoChartData.map((geo, index) => {
                    const maxValue = Math.max(
                      ...geoChartData.map((g) => g.value),
                    );
                    const barWidth = maxValue > 0 ? (geo.value / maxValue) * 100 : 0;

                    return (
                      <div key={geo.submarket}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-foreground truncate">
                            {geo.submarket}
                          </span>
                          <span className="text-xs font-mono text-muted-foreground shrink-0 ml-2">
                            {geo.count} {geo.count === 1 ? 'deal' : 'deals'}
                          </span>
                        </div>
                        <div className="h-6 rounded-lg overflow-hidden bg-muted relative">
                          <div
                            className="h-full rounded-lg bg-primary transition-all duration-700 ease-out"
                            style={{
                              width: mounted ? `${barWidth}%` : '0%',
                              transitionDelay: `${500 + index * 100}ms`,
                            }}
                          />
                          <span className={cn(
                            "absolute top-0 h-full flex items-center text-xs font-mono font-semibold px-2",
                            barWidth > 25 ? "right-0 text-primary-foreground" : "text-muted-foreground"
                          )} style={barWidth <= 25 ? { left: `${barWidth}%` } : undefined}>
                            {formatPrice(geo.value)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
                  No submarket data available
                </div>
              )}
            </div>

            {/* --- NOI Distribution Plot --- */}
            <div className="border border-border rounded-2xl bg-card p-6">
              <h3 className="font-display text-base font-bold text-foreground mb-4">
                NOI Distribution (T12)
              </h3>

              {dealsWithNOIData.length > 0 ? (
                <>
                  <div className="relative h-48 mt-6">
                    {/* Y-axis labels */}
                    <div className="absolute left-0 top-0 bottom-8 w-12 flex flex-col justify-between text-xs text-muted-foreground">
                      <span>{formatPrice(maxNOI)}</span>
                      <span>{formatPrice(maxNOI * 0.5)}</span>
                      <span>$0</span>
                    </div>

                    {/* Chart area */}
                    <div className="ml-14 h-full relative border-l border-b border-border">
                      {/* Grid lines */}
                      {[50].map((line) => (
                        <div
                          key={line}
                          className="absolute w-full border-t border-dashed border-border"
                          style={{ top: `${100 - line}%` }}
                        />
                      ))}

                      {/* Dots */}
                      {dealsWithNOIData.map((deal, index) => {
                        const x =
                          (index / (dealsWithNOIData.length - 1 || 1)) * 90 + 5;
                        const normalizedNOI =
                          maxNOI > 0
                            ? ((deal.noiT12 || 0) / maxNOI) * 100
                            : 50;
                        const y = 100 - normalizedNOI;

                        return (
                          <div
                            key={deal.id}
                            className={cn(
                              'absolute w-4 h-4 rounded-full cursor-pointer transition-all duration-300 hover:scale-150 group -translate-x-1/2 -translate-y-1/2',
                              mounted
                                ? 'scale-100 opacity-100'
                                : 'scale-0 opacity-0',
                            )}
                            style={{
                              left: `${x}%`,
                              top: `${y}%`,
                              backgroundColor: getNOIColor(
                                deal.noiT12 || 0,
                                maxNOI,
                              ),
                              boxShadow: `0 2px 8px ${getNOIColor(deal.noiT12 || 0, maxNOI)}40`,
                              transitionDelay: `${600 + index * 60}ms`,
                            }}
                          >
                            {/* Tooltip */}
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 rounded-lg text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none bg-card border border-border text-foreground shadow-lg z-10">
                              {deal.name}: {formatPrice(deal.noiT12)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Summary */}
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">Low</p>
                      <p className="font-mono font-bold text-destructive">
                        {formatPrice(metrics.lowestNOI)}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">Average</p>
                      <p className="font-mono font-bold text-primary">
                        {formatPrice(metrics.avgNOI)}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">High</p>
                      <p className="font-mono font-bold text-success">
                        {formatPrice(metrics.highestNOI)}
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
                  No NOI data available yet
                </div>
              )}
            </div>
          </section>
        )}
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
                <p className="text-xs text-muted-foreground">
                  {selectedTags.length > 0
                    ? selectedTags.join(' + ')
                    : 'All Deals'}
                </p>
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
            <div className="mb-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Quick Prompts
              </p>
              <div className="flex flex-wrap gap-2">
                {AI_QUICK_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => {
                      setAiQuery(prompt);
                      generateAISummary(prompt);
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all bg-muted text-muted-foreground border border-border hover:border-primary hover:text-primary"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>

            {/* Input */}
            <div className="mb-6">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Ask about your pipeline..."
                  value={aiQuery}
                  onChange={(e) => setAiQuery(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === 'Enter' && aiQuery && generateAISummary(aiQuery)
                  }
                  className="w-full px-4 py-3 pr-12 rounded-xl text-sm outline-none bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                />
                <button
                  onClick={() => aiQuery && generateAISummary(aiQuery)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-primary text-primary-foreground hover:brightness-110 transition-all"
                >
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Loading */}
            {aiLoading && (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-2 rounded-full border-border border-t-primary animate-spin" />
              </div>
            )}

            {/* Response */}
            {aiResponse && !aiLoading && (
              <div className="space-y-4 animate-fade-in">
                {/* Summary */}
                <div className="p-4 rounded-xl bg-primary/10 border border-primary/20">
                  <p className="text-sm leading-relaxed text-foreground">
                    {aiResponse.summary}
                  </p>
                </div>

                {/* Insights */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    Key Insights
                  </p>
                  <div className="space-y-2">
                    {aiResponse.insights.map((insight, i) => (
                      <div
                        key={i}
                        className="flex gap-2 text-sm text-muted-foreground"
                      >
                        <span className="text-primary shrink-0">
                          &#8226;
                        </span>
                        <span>{insight}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Top Deal */}
                {aiResponse.topDeal && (
                  <div className="p-4 rounded-xl bg-muted">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                      Top NOI Performer
                    </p>
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center shrink-0">
                        <Building2 className="w-5 h-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground truncate">
                          {aiResponse.topDeal.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {aiResponse.topDeal.submarket || aiResponse.topDeal.address || '\u2014'}
                        </p>
                      </div>
                      <div className="ml-auto text-right shrink-0">
                        <p className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {formatPrice(aiResponse.topDeal.noiT12)}
                        </p>
                        <p className="text-xs text-muted-foreground">T12 NOI</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Recommendation */}
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-2">
                    Recommendation
                  </p>
                  <p className="text-sm text-foreground">
                    {aiResponse.recommendation}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ============== METRICS EDITOR MODAL ============== */}
      <div
        className={cn(
          'fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-300',
          showMetricsEditor
            ? 'opacity-100 pointer-events-auto'
            : 'opacity-0 pointer-events-none',
        )}
      >
        <div
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={() => setShowMetricsEditor(false)}
        />
        <div
          className={cn(
            'relative w-full max-w-lg rounded-2xl bg-card border border-border overflow-hidden transition-all duration-300',
            showMetricsEditor ? 'scale-100' : 'scale-95',
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-6 py-4 border-b border-border">
            <h3 className="font-display text-lg font-bold text-foreground">
              Customize Metrics
            </h3>
            <p className="text-sm mt-1 text-muted-foreground">
              Select which metrics to display on your dashboard
            </p>
          </div>

          <div className="p-6 max-h-96 overflow-y-auto">
            <div className="grid grid-cols-2 gap-3">
              {(
                Object.entries(METRICS_LIBRARY) as [
                  MetricId,
                  MetricDefinition,
                ][]
              ).map(([id, metric]) => {
                const isSelected = selectedMetrics.includes(id);
                return (
                  <button
                    key={id}
                    onClick={() => toggleMetric(id)}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-xl text-left transition-all border',
                      isSelected
                        ? 'bg-primary/10 border-primary'
                        : 'bg-muted border-border hover:border-primary/30',
                    )}
                  >
                    <div
                      className={cn(
                        'w-5 h-5 rounded-md flex items-center justify-center border transition-colors',
                        isSelected
                          ? 'bg-primary border-primary'
                          : 'border-border',
                      )}
                    >
                      {isSelected && (
                        <Check className="w-3 h-3 text-primary-foreground" />
                      )}
                    </div>
                    <span
                      className={cn(
                        'text-sm',
                        isSelected ? 'text-primary' : 'text-muted-foreground',
                      )}
                    >
                      {metric.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="px-6 py-4 flex justify-end gap-3 border-t border-border">
            <Button
              variant="secondary"
              onClick={() => setShowMetricsEditor(false)}
            >
              Done
            </Button>
          </div>
        </div>
      </div>

      {/* ============== STAGE EDITOR MODAL ============== */}
      <div
        className={cn(
          'fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-300',
          showStageEditor
            ? 'opacity-100 pointer-events-auto'
            : 'opacity-0 pointer-events-none',
        )}
      >
        <div
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={() => setShowStageEditor(false)}
        />
        <div
          className={cn(
            'relative w-full max-w-md rounded-2xl bg-card border border-border overflow-hidden transition-all duration-300',
            showStageEditor ? 'scale-100' : 'scale-95',
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-6 py-4 border-b border-border">
            <h3 className="font-display text-lg font-bold text-foreground">
              Pipeline Stages
            </h3>
            <p className="text-sm mt-1 text-muted-foreground">
              Choose a template or customize your stages
            </p>
          </div>

          <div className="p-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Templates
            </p>
            <div className="space-y-2">
              {Object.entries(STAGE_TEMPLATES).map(([id, template]) => {
                const isActive = pipelineTemplate === id;
                return (
                  <button
                    key={id}
                    onClick={() => applyTemplate(id)}
                    className={cn(
                      'w-full p-4 rounded-xl text-left transition-all border',
                      isActive
                        ? 'bg-primary/10 border-primary'
                        : 'bg-muted border-border hover:border-primary/30',
                    )}
                  >
                    <p
                      className={cn(
                        'font-semibold',
                        isActive ? 'text-primary' : 'text-foreground',
                      )}
                    >
                      {template.label}
                    </p>
                    <div className="flex gap-1 mt-2">
                      {template.stages.map((stage) => (
                        <div
                          key={stage.id}
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: stage.color }}
                        />
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="px-6 py-4 flex justify-end gap-3 border-t border-border">
            <Button
              variant="secondary"
              onClick={() => setShowStageEditor(false)}
            >
              Done
            </Button>
          </div>
        </div>
      </div>
    </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
