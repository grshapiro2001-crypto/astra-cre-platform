/**
 * Dashboard Page - Configurable Deal Command Center
 *
 * Features:
 * - Welcome header with time-of-day greeting
 * - Key metrics cards (customizable selection)
 * - Pipeline kanban board with customizable stages
 * - Tag-based filtering across all dashboard data
 * - Status donut chart, geographic bars, score dot plot
 * - AI pipeline summary simulation panel
 * - Widget visibility toggling
 */
import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Sparkles,
  Plus,
  Settings,
  Pencil,
  DollarSign,
  Building2,
  Folder,
  Zap,
  Trophy,
  Percent,
  Tag,
  Scale,
  CheckCircle2,
  ArrowUp,
  ArrowDown,
  ArrowRight,
  X,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/authSlice';
import { Button } from '@/components/ui/button';

// ============================================================
// TYPES
// ============================================================

type IconComponent = typeof DollarSign;

interface DashboardDeal {
  id: number;
  name: string;
  city: string;
  submarket: string;
  state: string;
  units: number;
  totalPrice: number;
  pricePerUnit: number;
  capRateT12: number | null;
  capRateY1: number | null;
  score: number;
  stage: string;
  tags: string[];
  thumbnail: string;
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
  scoreColored?: boolean;
}

interface MetricsData {
  totalValue: number;
  totalUnits: number;
  dealCount: number;
  activeDeals: number;
  avgScore: number;
  avgCapRate: string | null;
  avgCapRateY1: string | null;
  avgPricePerUnit: number;
  avgDealSize: number;
  closedDeals: number;
  highestScore: number;
  lowestScore: number;
}

type MetricId = keyof MetricsData;

interface StatusChartDatum extends PipelineStage {
  count: number;
  value: number;
}

interface GeoChartDatum {
  state: string;
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
// MOCK DATA
// ============================================================

const ALL_TAGS: string[] = [
  'Georgia',
  'Texas',
  'Florida',
  'Value-Add',
  'Core-Plus',
  'Core',
  'Lease-Up',
  'Sunbelt',
  '200+ Units',
  'Under $50M',
];

const DEALS: DashboardDeal[] = [
  {
    id: 1,
    name: 'The Overlook',
    city: 'Lawrenceville, GA',
    submarket: 'Gwinnett County',
    state: 'Georgia',
    units: 410,
    totalPrice: 90_800_000,
    pricePerUnit: 221_500,
    capRateT12: 4.75,
    capRateY1: 5.15,
    score: 76,
    stage: 'dueDiligence',
    tags: ['Georgia', 'Value-Add', 'Sunbelt', '200+ Units'],
    thumbnail:
      'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=400&h=300&fit=crop',
  },
  {
    id: 2,
    name: 'Beacon Station',
    city: 'Augusta, GA',
    submarket: 'Central Savannah',
    state: 'Georgia',
    units: 221,
    totalPrice: 53_600_000,
    pricePerUnit: 242_500,
    capRateT12: 5.15,
    capRateY1: 5.42,
    score: 82,
    stage: 'closing',
    tags: ['Georgia', 'Core-Plus', 'Sunbelt', '200+ Units'],
    thumbnail:
      'https://images.unsplash.com/photo-1460317442991-0ec209397118?w=400&h=300&fit=crop',
  },
  {
    id: 3,
    name: 'Creekview Vista',
    city: 'LaGrange, GA',
    submarket: 'West Georgia',
    state: 'Georgia',
    units: 279,
    totalPrice: 55_100_000,
    pricePerUnit: 197_500,
    capRateT12: null,
    capRateY1: 5.42,
    score: 68,
    stage: 'screening',
    tags: ['Georgia', 'Lease-Up', 'Sunbelt', '200+ Units'],
    thumbnail:
      'https://images.unsplash.com/photo-1574362848149-11496d93a7c7?w=400&h=300&fit=crop',
  },
  {
    id: 4,
    name: 'Carmel Vista',
    city: 'McDonough, GA',
    submarket: 'Henry County',
    state: 'Georgia',
    units: 228,
    totalPrice: 45_700_000,
    pricePerUnit: 200_400,
    capRateT12: 4.12,
    capRateY1: 4.85,
    score: 71,
    stage: 'screening',
    tags: ['Georgia', 'Value-Add', 'Sunbelt', 'Under $50M'],
    thumbnail:
      'https://images.unsplash.com/photo-1567496898669-ee935f5f647a?w=400&h=300&fit=crop',
  },
  {
    id: 5,
    name: 'The Edison',
    city: 'Atlanta, GA',
    submarket: 'Midtown',
    state: 'Georgia',
    units: 185,
    totalPrice: 72_500_000,
    pricePerUnit: 391_892,
    capRateT12: 4.25,
    capRateY1: 4.65,
    score: 79,
    stage: 'sourced',
    tags: ['Georgia', 'Core-Plus', 'Sunbelt'],
    thumbnail:
      'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=400&h=300&fit=crop',
  },
  {
    id: 6,
    name: 'Palms at Riverside',
    city: 'Macon, GA',
    submarket: 'Central Georgia',
    state: 'Georgia',
    units: 312,
    totalPrice: 52_000_000,
    pricePerUnit: 166_667,
    capRateT12: 5.45,
    capRateY1: 5.85,
    score: 64,
    stage: 'closed',
    tags: ['Georgia', 'Core', 'Sunbelt', '200+ Units'],
    thumbnail:
      'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=400&h=300&fit=crop',
  },
  {
    id: 7,
    name: 'Lone Star Commons',
    city: 'Austin, TX',
    submarket: 'North Austin',
    state: 'Texas',
    units: 340,
    totalPrice: 78_000_000,
    pricePerUnit: 229_412,
    capRateT12: 4.95,
    capRateY1: 5.35,
    score: 77,
    stage: 'dueDiligence',
    tags: ['Texas', 'Value-Add', 'Sunbelt', '200+ Units'],
    thumbnail:
      'https://images.unsplash.com/photo-1460317442991-0ec209397118?w=400&h=300&fit=crop',
  },
  {
    id: 8,
    name: 'Riverside Flats',
    city: 'San Antonio, TX',
    submarket: 'Downtown',
    state: 'Texas',
    units: 198,
    totalPrice: 41_500_000,
    pricePerUnit: 209_596,
    capRateT12: 5.25,
    capRateY1: 5.65,
    score: 73,
    stage: 'sourced',
    tags: ['Texas', 'Core-Plus', 'Sunbelt', 'Under $50M'],
    thumbnail:
      'https://images.unsplash.com/photo-1574362848149-11496d93a7c7?w=400&h=300&fit=crop',
  },
];

const STAGE_TEMPLATES: Record<string, StageTemplate> = {
  acquisitions: {
    label: 'Acquisitions Pipeline',
    stages: [
      { id: 'sourced', label: 'Sourced', color: '#60A5FA' },
      { id: 'screening', label: 'Screening', color: '#A78BFA' },
      { id: 'dueDiligence', label: 'Due Diligence', color: '#FBBF24' },
      { id: 'closing', label: 'Closing', color: '#34D399' },
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
  'Best value-add opportunities',
  'Highest risk deals',
  'Compare Georgia vs Texas',
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

/** Returns a hex color string for a deal score (for use in inline SVG/styles) */
const getScoreColor = (score: number): string => {
  if (score >= 80) return '#10b981';
  if (score >= 70) return '#8b5cf6';
  if (score >= 60) return '#f59e0b';
  return '#f43f5e';
};

/** Returns a Tailwind text color class for a deal score */
const getScoreTextClass = (score: number): string => {
  if (score >= 80) return 'text-emerald-500';
  if (score >= 70) return 'text-primary';
  if (score >= 60) return 'text-amber-500';
  return 'text-rose-500';
};

/** Returns a Tailwind bg color class for a deal score badge */
const getScoreBgClass = (score: number): string => {
  if (score >= 80) return 'bg-emerald-500/20';
  if (score >= 70) return 'bg-violet-400/20';
  if (score >= 60) return 'bg-amber-500/20';
  return 'bg-rose-500/20';
};

const getGreeting = (): string => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

const METRICS_LIBRARY: Record<MetricId, MetricDefinition> = {
  totalValue: {
    label: 'Total Pipeline Value',
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
  avgScore: {
    label: 'Avg Deal Score',
    format: (v) => String(v),
    icon: Trophy,
    scoreColored: true,
  },
  avgCapRate: {
    label: 'Avg Cap (T12)',
    format: (v) => (v ? `${v}%` : '\u2014'),
    icon: Percent,
  },
  avgCapRateY1: {
    label: 'Avg Cap (Y1)',
    format: (v) => (v ? `${v}%` : '\u2014'),
    icon: Percent,
  },
  avgPricePerUnit: {
    label: 'Avg $/Unit',
    format: (v) => formatPrice(v as number),
    icon: Tag,
  },
  avgDealSize: {
    label: 'Avg Deal Size',
    format: (v) => formatPrice(v as number),
    icon: Scale,
  },
  closedDeals: {
    label: 'Closed Deals',
    format: (v) => String(v),
    icon: CheckCircle2,
  },
  highestScore: {
    label: 'Highest Score',
    format: (v) => String(v),
    icon: ArrowUp,
  },
  lowestScore: {
    label: 'Lowest Score',
    format: (v) => String(v),
    icon: ArrowDown,
  },
};

// ============================================================
// COMPONENT
// ============================================================

export const Dashboard = () => {
  const user = useAuthStore((state) => state.user);
  const firstName =
    user?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'there';

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
    'totalValue',
    'totalUnits',
    'activeDeals',
    'avgScore',
    'avgCapRate',
    'avgPricePerUnit',
    'avgDealSize',
    'dealCount',
  ]);

  // Kanban stages
  const [pipelineTemplate, setPipelineTemplate] = useState('acquisitions');
  const [stages, setStages] = useState<PipelineStage[]>(
    STAGE_TEMPLATES.acquisitions.stages,
  );

  // Mount animation trigger
  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(timer);
  }, []);

  // --- Filtered Data ---
  const filteredDeals = useMemo(() => {
    if (selectedTags.length === 0) return DEALS;
    return DEALS.filter((deal) =>
      selectedTags.every((tag) => deal.tags.includes(tag)),
    );
  }, [selectedTags]);

  // --- Metrics ---
  const metrics = useMemo((): MetricsData => {
    const active = filteredDeals.filter((d) => d.stage !== 'closed');
    const dealsWithCap = filteredDeals.filter((d) => d.capRateT12 !== null);
    const dealsWithCapY1 = filteredDeals.filter((d) => d.capRateY1 !== null);

    return {
      totalValue: filteredDeals.reduce((sum, d) => sum + d.totalPrice, 0),
      totalUnits: filteredDeals.reduce((sum, d) => sum + d.units, 0),
      dealCount: filteredDeals.length,
      activeDeals: active.length,
      avgScore:
        filteredDeals.length > 0
          ? Math.round(
              filteredDeals.reduce((sum, d) => sum + d.score, 0) /
                filteredDeals.length,
            )
          : 0,
      avgCapRate:
        dealsWithCap.length > 0
          ? (
              dealsWithCap.reduce((sum, d) => sum + (d.capRateT12 ?? 0), 0) /
              dealsWithCap.length
            ).toFixed(2)
          : null,
      avgCapRateY1:
        dealsWithCapY1.length > 0
          ? (
              dealsWithCapY1.reduce((sum, d) => sum + (d.capRateY1 ?? 0), 0) /
              dealsWithCapY1.length
            ).toFixed(2)
          : null,
      avgPricePerUnit:
        filteredDeals.length > 0
          ? Math.round(
              filteredDeals.reduce((sum, d) => sum + d.pricePerUnit, 0) /
                filteredDeals.length,
            )
          : 0,
      avgDealSize:
        filteredDeals.length > 0
          ? filteredDeals.reduce((sum, d) => sum + d.totalPrice, 0) /
            filteredDeals.length
          : 0,
      closedDeals: filteredDeals.filter((d) => d.stage === 'closed').length,
      highestScore:
        filteredDeals.length > 0
          ? Math.max(...filteredDeals.map((d) => d.score))
          : 0,
      lowestScore:
        filteredDeals.length > 0
          ? Math.min(...filteredDeals.map((d) => d.score))
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
        .reduce((sum, d) => sum + d.totalPrice, 0),
    }));
  }, [filteredDeals, stages]);

  const geoChartData = useMemo((): GeoChartDatum[] => {
    const byState: Record<string, { count: number; value: number }> = {};
    filteredDeals.forEach((deal) => {
      if (!byState[deal.state]) byState[deal.state] = { count: 0, value: 0 };
      byState[deal.state].count++;
      byState[deal.state].value += deal.totalPrice;
    });
    return Object.entries(byState)
      .map(([state, data]) => ({ state, ...data }))
      .sort((a, b) => b.value - a.value);
  }, [filteredDeals]);

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

  const moveDeal = (dealId: number, newStage: string) => {
    console.log(`Moving deal ${dealId} to ${newStage}`);
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

      const response: AIResponse = {
        summary: `Your pipeline ${tagContext} contains ${filteredDeals.length} deals totaling ${formatPrice(metrics.totalValue)} across ${metrics.totalUnits.toLocaleString()} units.`,
        insights: [
          `Average deal score is ${metrics.avgScore}/100, indicating ${metrics.avgScore >= 75 ? 'strong' : metrics.avgScore >= 65 ? 'moderate' : 'mixed'} overall quality.`,
          metrics.avgCapRate
            ? `T12 cap rates average ${metrics.avgCapRate}%, ${parseFloat(metrics.avgCapRate) >= 5 ? 'above' : 'below'} the typical 5% threshold for value-add.`
            : 'Several deals are in lease-up with no stabilized cap rate yet.',
          `${filteredDeals.filter((d) => d.stage === 'dueDiligence' || d.stage === 'closing').length} deals are in active pursuit (Due Diligence or Closing).`,
        ],
        topDeal: filteredDeals.reduce<DashboardDeal | null>(
          (best, deal) => (deal.score > (best?.score ?? 0) ? deal : best),
          null,
        ),
        recommendation: query.toLowerCase().includes('value-add')
          ? 'Focus on The Overlook and Carmel Vista for value-add opportunities with renovation upside.'
          : query.toLowerCase().includes('core')
            ? 'Beacon Station offers the strongest stabilized returns in your Core-Plus segment.'
            : 'Consider moving Creekview Vista forward - lease-up risk is offset by strong submarket fundamentals.',
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
    <div className="space-y-6">
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
        {ALL_TAGS.map((tag) => (
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

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
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
                    <p
                      className={cn(
                        'font-mono text-2xl font-bold',
                        metricDef.scoreColored
                          ? getScoreTextClass(value as number)
                          : 'text-foreground',
                      )}
                    >
                      {metricDef.format(value)}
                    </p>
                  </div>
                );
              })}
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
                const stageValue = stageDeals.reduce(
                  (sum, d) => sum + d.totalPrice,
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
                        {formatPrice(stageValue)}
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
                          className={cn(
                            'rounded-xl p-3 cursor-grab active:cursor-grabbing transition-all duration-200 hover:scale-[1.02] hover:shadow-md border border-border bg-muted',
                            draggedDeal === deal.id && 'opacity-50',
                          )}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <p className="font-semibold text-sm text-foreground">
                                {deal.name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {deal.city}
                              </p>
                            </div>
                            <div
                              className={cn(
                                'text-xs font-mono font-bold px-2 py-1 rounded-lg',
                                getScoreBgClass(deal.score),
                                getScoreTextClass(deal.score),
                              )}
                            >
                              {deal.score}
                            </div>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">
                              {deal.units} units
                            </span>
                            <span className="font-mono font-semibold text-foreground">
                              {formatPrice(deal.totalPrice)}
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

            {/* --- Geographic Bar Chart --- */}
            <div className="border border-border rounded-2xl bg-card p-6">
              <h3 className="font-display text-base font-bold text-foreground mb-4">
                By Geography
              </h3>

              <div className="space-y-3">
                {geoChartData.map((geo, index) => {
                  const maxValue = Math.max(
                    ...geoChartData.map((g) => g.value),
                  );
                  const barWidth = (geo.value / maxValue) * 100;

                  return (
                    <div key={geo.state}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-foreground">
                          {geo.state}
                        </span>
                        <span className="text-xs font-mono text-muted-foreground">
                          {geo.count} deals
                        </span>
                      </div>
                      <div className="h-6 rounded-lg overflow-hidden bg-muted">
                        <div
                          className="h-full rounded-lg flex items-center justify-end px-2 bg-primary transition-all duration-700 ease-out"
                          style={{
                            width: mounted ? `${barWidth}%` : '0%',
                            transitionDelay: `${500 + index * 100}ms`,
                          }}
                        >
                          <span className="text-xs font-mono text-primary-foreground font-semibold">
                            {formatPrice(geo.value)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* --- Deal Score Dot Plot --- */}
            <div className="border border-border rounded-2xl bg-card p-6">
              <h3 className="font-display text-base font-bold text-foreground mb-4">
                Deal Score Distribution
              </h3>

              <div className="relative h-48 mt-6">
                {/* Y-axis labels */}
                <div className="absolute left-0 top-0 bottom-8 w-8 flex flex-col justify-between text-xs text-muted-foreground">
                  <span>100</span>
                  <span>75</span>
                  <span>50</span>
                </div>

                {/* Chart area */}
                <div className="ml-10 h-full relative border-l border-b border-border">
                  {/* Grid lines */}
                  {[75, 50].map((line) => (
                    <div
                      key={line}
                      className="absolute w-full border-t border-dashed border-border"
                      style={{ top: `${100 - line}%` }}
                    />
                  ))}

                  {/* Dots */}
                  {filteredDeals.map((deal, index) => {
                    const x =
                      (index / (filteredDeals.length - 1 || 1)) * 90 + 5;
                    const y = 100 - deal.score;

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
                          backgroundColor: getScoreColor(deal.score),
                          boxShadow: `0 2px 8px ${getScoreColor(deal.score)}40`,
                          transitionDelay: `${600 + index * 60}ms`,
                        }}
                      >
                        {/* Tooltip */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 rounded-lg text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none bg-card border border-border text-foreground shadow-lg z-10">
                          {deal.name}: {deal.score}
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
                    {metrics.lowestScore}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Average</p>
                  <p className="font-mono font-bold text-primary">
                    {metrics.avgScore}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">High</p>
                  <p className="font-mono font-bold text-success">
                    {metrics.highestScore}
                  </p>
                </div>
              </div>
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
                      Top Opportunity
                    </p>
                    <div className="flex items-center gap-3">
                      <div
                        className="w-12 h-12 rounded-lg bg-cover bg-center shrink-0"
                        style={{
                          backgroundImage: `url(${aiResponse.topDeal.thumbnail})`,
                        }}
                      />
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground truncate">
                          {aiResponse.topDeal.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {aiResponse.topDeal.city}
                        </p>
                      </div>
                      <div className="ml-auto text-right shrink-0">
                        <p
                          className={cn(
                            'font-mono font-bold',
                            getScoreTextClass(aiResponse.topDeal.score),
                          )}
                        >
                          {aiResponse.topDeal.score}
                        </p>
                        <p className="text-xs text-muted-foreground">Score</p>
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
  );
};
