/**
 * Dashboard Page V3 — B&W Liquid Glass Design
 *
 * Layout (top to bottom):
 * 1. Header — Greeting, org info, screening badge, +New Deal button
 * 2. Metrics Row — Volume (area) | Units (stacked bar) | Cap Rate (bullet) | Score (gauge)
 * 3. AI Prompt Bar — Chat input + suggestion chips
 * 4. Main Grid — Left: Kanban + Analytics | Right: Calendar
 * 5. Analytics Row — Donut + Submarket Bars + Score Distribution
 */
import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Plus, Users, X, Building2, ArrowRight } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuthStore } from '@/store/authSlice';
import { useAssistantStore } from '@/store/assistantStore';
import { Button } from '@/components/ui/button';
import organizationService from '@/services/organizationService';
import type { Organization } from '@/services/organizationService';
import { MigrateDealModal } from '@/components/organization/MigrateDealModal';

const DEAL_STAGES_KEY = 'talisman-deal-stages';
import { DashboardSkeleton } from '@/components/ui/PageSkeleton';
import { SlowLoadBanner } from '@/components/common/SlowLoadBanner';
import { propertyService } from '@/services/propertyService';
import { scoringService } from '@/services/scoringService';
import { criteriaService } from '@/services/criteriaService';
import type { PropertyListItem, ScreeningSummaryItem, BOVPricingTier } from '@/types/property';
import { DashboardCalendar } from '@/components/dashboard/DashboardCalendar';
import type { DashboardDeal } from '@/components/dashboard/DealCard';
import { KanbanBoard } from '@/components/dashboard/KanbanBoard';
import { PromptInputBox } from '@/components/ui/ai-prompt-box';
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
// Metric Visualizations
// ============================================================

/** Mini area chart for volume */
const AreaSparkline: React.FC<{ values: number[] }> = ({ values }) => {
  if (values.length < 2) return null;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const w = 100, h = 40;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return { x, y };
  });
  const line = pts.map(p => `${p.x},${p.y}`).join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible shrink-0" style={{ marginBottom: -2 }}>
      <defs>
        <linearGradient id="area-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="white" stopOpacity="0.12" />
          <stop offset="60%" stopColor="white" stopOpacity="0.03" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${h} ${line} ${w},${h}`} fill="url(#area-grad)" />
      <polyline points={line} fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r="3" fill="white" opacity="0.9" />
      <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r="6" fill="white" opacity="0.08" />
    </svg>
  );
};

/** Stacked horizontal bar showing each deal's unit contribution */
const UnitStackBar: React.FC<{ deals: { name: string; units: number }[] }> = ({ deals }) => {
  const sorted = [...deals].filter(d => d.units > 0).sort((a, b) => b.units - a.units);
  if (sorted.length === 0) return null;
  return (
    <div className="flex items-center gap-px h-[6px] rounded-full overflow-hidden w-full">
      {sorted.map((d, i) => (
        <div
          key={d.name}
          style={{
            flex: d.units,
            background: `rgba(255,255,255,${Math.max(0.05, 0.45 - i * 0.05).toFixed(2)})`,
          }}
          title={`${d.name} · ${d.units}u`}
          className="h-full transition-all hover:brightness-150"
        />
      ))}
    </div>
  );
};

/** Bullet gauge for cap rate range */
const CapRateGauge: React.FC<{ value: number | null; min?: number; max?: number }> = ({
  value,
  min = 3.0,
  max = 6.5,
}) => {
  if (value == null) return null;
  const pct = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
  return (
    <div className="relative mt-3">
      <div className="h-[6px] rounded-full overflow-hidden flex">
        <div style={{ flex: 28.6, background: 'rgba(248,113,113,0.12)' }} className="h-full" />
        <div style={{ flex: 28.6, background: 'rgba(255,255,255,0.06)' }} className="h-full" />
        <div style={{ flex: 42.8, background: 'rgba(52,211,153,0.1)' }} className="h-full" />
      </div>
      <div className="absolute top-[-3px]" style={{ left: `${pct}%` }}>
        <div className="w-[3px] h-[12px] rounded-full bg-white" style={{ boxShadow: '0 0 6px rgba(255,255,255,0.3)' }} />
      </div>
      <div className="flex justify-between mt-1.5">
        <span className="text-[8px] text-zinc-700">{min.toFixed(1)}%</span>
        <span className="text-[8px] text-zinc-700">{max.toFixed(1)}%</span>
      </div>
    </div>
  );
};

/** Score gauge ring */
const ScoreGauge: React.FC<{ score: number }> = ({ score }) => {
  const size = 48;
  const r = 20;
  const circ = 2 * Math.PI * r;
  const pct = score / 100;
  const color = score >= 80 ? '#34d399' : score >= 65 ? '#a1a1aa' : '#f87171';
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={24} cy={24} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
      <circle
        cx={24} cy={24} r={r} fill="none" stroke={color} strokeWidth="3"
        strokeDasharray={`${pct * circ} ${circ}`} strokeLinecap="round"
        transform={`rotate(-90 24 24)`}
      />
      <text x="24" y="25" textAnchor="middle" dominantBaseline="central" fill={color} fontSize="13" fontWeight="800" fontFamily="Inter">
        {Math.round(score)}
      </text>
    </svg>
  );
};

// ────────────────────────────────────────────────────────
// Inline Chat — expands from PromptInputBox on first message
// ────────────────────────────────────────────────────────

interface InlineChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
}

const InlineChat: React.FC = () => {
  const [messages, setMessages] = useState<InlineChatMessage[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  const handleSend = useCallback(async (message: string) => {
    if (!message.trim()) return;

    // Expand on first message
    if (!isExpanded) setIsExpanded(true);

    const userMsg: InlineChatMessage = { id: `u-${Date.now()}`, role: 'user', content: message };
    const assistantMsg: InlineChatMessage = { id: `a-${Date.now()}`, role: 'assistant', content: '', isStreaming: true };

    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setIsLoading(true);

    // Build conversation history for API
    const history = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }));

    let accumulated = '';
    try {
      const { streamChat } = await import('@/services/assistantService');
      await streamChat(
        { message, conversation_history: history },
        (chunk) => {
          accumulated += chunk;
          setMessages(prev =>
            prev.map(m => m.id === assistantMsg.id ? { ...m, content: accumulated } : m)
          );
        },
        () => {
          setMessages(prev =>
            prev.map(m => m.id === assistantMsg.id ? { ...m, isStreaming: false } : m)
          );
          setIsLoading(false);
        },
        (error) => {
          setMessages(prev =>
            prev.map(m => m.id === assistantMsg.id ? { ...m, content: `Error: ${error}`, isStreaming: false } : m)
          );
          setIsLoading(false);
        },
      );
    } catch {
      setMessages(prev =>
        prev.map(m => m.id === assistantMsg.id ? { ...m, content: 'Failed to connect to assistant.', isStreaming: false } : m)
      );
      setIsLoading(false);
    }
  }, [isExpanded, messages]);

  const handleCollapse = useCallback(() => {
    setIsExpanded(false);
  }, []);

  const handleClear = useCallback(() => {
    setMessages([]);
    setIsExpanded(false);
  }, []);

  // Collapsed state — just the prompt input box
  if (!isExpanded) {
    return <PromptInputBox onSend={handleSend} isLoading={isLoading} />;
  }

  // Expanded chat view
  return (
    <motion.div
      ref={containerRef}
      initial={{ height: 80 }}
      animate={{ height: 'auto' }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="liquid-glass overflow-hidden flex flex-col"
      style={{ maxHeight: '60vh', minHeight: 300 }}
    >
      {/* Chat header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.04] shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-semibold text-foreground">Talisman AI</span>
          <span className="text-[10px] text-zinc-600">{messages.filter(m => m.role === 'user').length} messages</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={handleClear} className="text-[10px] text-zinc-600 hover:text-zinc-300 px-2 py-1 rounded transition-colors">Clear</button>
          <button onClick={handleCollapse} className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.04] transition-all">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
        {messages.map(msg => (
          <div key={msg.id} className={cn('flex gap-3', msg.role === 'user' && 'flex-row-reverse')}>
            {/* Avatar */}
            <div className={cn(
              'w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold',
              msg.role === 'user' ? 'bg-white/[0.08] text-zinc-300' : 'bg-emerald-400/[0.12] text-emerald-400'
            )}>
              {msg.role === 'user' ? 'U' : 'T'}
            </div>
            {/* Bubble */}
            <div className={cn(
              'max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
              msg.role === 'user'
                ? 'bg-white/[0.06] text-foreground rounded-tr-md'
                : 'bg-white/[0.03] text-zinc-300 border border-white/[0.04] rounded-tl-md'
            )}>
              <span className="whitespace-pre-wrap">{msg.content}</span>
              {msg.isStreaming && (
                <span className="ml-1 inline-block w-1.5 h-4 rounded-full bg-emerald-400/60 animate-pulse" />
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input at bottom */}
      <div className="shrink-0 border-t border-white/[0.04] p-3">
        <PromptInputBox onSend={handleSend} isLoading={isLoading} className="shadow-none border-white/[0.04]" />
      </div>
    </motion.div>
  );
};

/** Deal Alerts — flags deals needing attention */
const DealAlerts: React.FC<{ deals: DashboardDeal[] }> = ({ deals }) => {
  const alerts = useMemo(() => {
    const list: { name: string; message: string; severity: 'red' | 'amber' | 'green' }[] = [];
    deals.forEach(d => {
      if (d.dealScore != null && d.dealScore < 50) {
        list.push({ name: d.name, message: `Deal score ${Math.round(d.dealScore)} — fundamentals flagged for review`, severity: 'red' });
      } else if (d.dealScore != null && d.dealScore >= 85) {
        list.push({ name: d.name, message: `Score ${Math.round(d.dealScore)} — strong fundamentals, consider advancing`, severity: 'green' });
      }
    });
    // Cap rate outliers
    const withCap = deals.filter(d => d.capRate != null && d.capRate > 0);
    if (withCap.length > 0) {
      const avg = withCap.reduce((s, d) => s + (d.capRate ?? 0), 0) / withCap.length;
      withCap.forEach(d => {
        if ((d.capRate ?? 0) > avg * 1.3 && !list.some(a => a.name === d.name)) {
          list.push({ name: d.name, message: `Cap rate ${d.capRate?.toFixed(2)}% significantly above portfolio avg`, severity: 'amber' });
        }
      });
    }
    return list.slice(0, 4);
  }, [deals]);

  if (alerts.length === 0) return null;

  const colors = {
    red: { bg: 'rgba(248,113,113,0.04)', border: '#f87171' },
    amber: { bg: 'rgba(251,191,36,0.04)', border: '#fbbf24' },
    green: { bg: 'rgba(52,211,153,0.04)', border: '#34d399' },
  };

  return (
    <div className="liquid-glass p-5" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
      <div className="flex items-center gap-2 mb-3.5">
        <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M7 1L1 13h12L7 1z" stroke="white" strokeWidth="1.2" strokeLinejoin="round" /></svg>
        <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-foreground">Deal Alerts</span>
      </div>
      <div className="flex flex-col gap-2.5">
        {alerts.map((a, i) => (
          <div key={i} className="p-3 rounded-xl" style={{ background: colors[a.severity].bg, borderLeft: `3px solid ${colors[a.severity].border}` }}>
            <div className="text-[11px] text-foreground font-medium mb-0.5">{a.name}</div>
            <div className="text-[10px] text-zinc-600">{a.message}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

/** Deal Velocity — days in current stage */
const DealVelocity: React.FC<{ deals: DashboardDeal[]; stageMap: Record<number, string>; stages: { id: string; label: string; color: string }[] }> = ({ deals, stageMap, stages }) => {
  const velocityData = useMemo(() => {
    return deals
      .filter(d => d.uploadDate)
      .map(d => {
        const stageId = stageMap[d.id] || 'screening';
        const stage = stages.find(s => s.id === stageId);
        const daysSince = d.uploadDate
          ? Math.max(1, Math.floor((Date.now() - new Date(d.uploadDate).getTime()) / 86400000))
          : 0;
        return {
          name: d.name,
          stage: stage?.label || stageId,
          stageColor: stage?.color || '#71717a',
          days: daysSince,
          score: d.dealScore ?? 0,
        };
      })
      .sort((a, b) => b.days - a.days)
      .slice(0, 7);
  }, [deals, stageMap, stages]);

  const velMax = 45;
  const velAvg = 14;
  const velAlert = 30;

  if (velocityData.length === 0) return null;

  return (
    <div className="liquid-glass shim p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Deal Velocity</div>
          <div className="text-[10px] text-zinc-600 mt-0.5">Days in current stage</div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-px" style={{ background: 'rgba(251,191,36,0.5)' }} />
            <span className="text-[9px] text-zinc-600">{velAvg}d avg</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-px" style={{ background: 'rgba(248,113,113,0.5)' }} />
            <span className="text-[9px] text-zinc-600">{velAlert}d alert</span>
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        {velocityData.map((d) => {
          const pct = Math.min((d.days / velMax) * 100, 100);
          const isAlert = d.days >= velAlert;
          const isWarn = d.days >= velAvg && d.days < velAlert;
          let barBg: string;
          if (isAlert) barBg = 'linear-gradient(90deg, rgba(248,113,113,0.25), rgba(248,113,113,0.6))';
          else if (isWarn) barBg = 'linear-gradient(90deg, rgba(251,191,36,0.2), rgba(251,191,36,0.5))';
          else barBg = `linear-gradient(90deg, ${d.stageColor}33, ${d.stageColor}80)`;

          return (
            <div key={d.name} className="py-2 px-2.5 rounded-xl hover:bg-white/[0.03] transition-all">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  {isAlert ? (
                    <div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse shrink-0" />
                  ) : (
                    <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: d.stageColor }} />
                  )}
                  <span className="text-[11px] font-medium text-zinc-300 truncate">{d.name}</span>
                  <span className="text-[8px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0" style={{ background: `${d.stageColor}15`, color: d.stageColor }}>{d.stage}</span>
                </div>
                <span className={`text-[12px] font-extrabold ml-3 shrink-0 ${isAlert ? 'text-red-400' : isWarn ? 'text-amber-400' : 'text-zinc-300'}`}>{d.days}d</span>
              </div>
              <div className="h-[6px] rounded-full bg-white/[0.04] overflow-hidden relative">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: barBg, transition: 'width 0.8s cubic-bezier(0.16,1,0.3,1)' }} />
                <div className="absolute top-[-3px] bottom-[-3px] w-px" style={{ left: `${(velAvg / velMax) * 100}%`, background: 'rgba(251,191,36,0.3)' }} />
                <div className="absolute top-[-3px] bottom-[-3px] w-px" style={{ left: `${(velAlert / velMax) * 100}%`, background: 'rgba(248,113,113,0.3)' }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ============================================================
// COMPONENT
// ============================================================

export const Dashboard = () => {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const firstName = user?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'there';

  // --- Clear assistant scope on dashboard ---
  const setScopedProperty = useAssistantStore((s) => s.setScopedProperty);
  const setScopedFolder = useAssistantStore((s) => s.setScopedFolder);
  useEffect(() => {
    setScopedProperty(null);
    setScopedFolder(null);
  }, [setScopedProperty, setScopedFolder]);

  // --- Data State ---
  const [properties, setProperties] = useState<PropertyWithFinancials[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [screeningSummary, setScreeningSummary] = useState<ScreeningSummaryItem[]>([]);
  const [bovPricingMap, setBovPricingMap] = useState<Map<number, BOVPricingTier[]>>(new Map());
  const [selectedDealId, setSelectedDealId] = useState<number | null>(null);
  const [scoresMap, setScoresMap] = useState<Record<number, number | null>>({});

  // --- Pipeline State ---
  const [activePresetId, setActivePresetId] = useState<string>('acquisitions');
  const [stageMap, setStageMap] = useState<Record<number, string>>({});

  // --- Org State ---
  const [userOrg, setUserOrg] = useState<Organization | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(() =>
    localStorage.getItem('talisman_org_banner_dismissed') === 'true'
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
      // Load org pipeline template (if user is in an org)
      let resolvedPresetId = activePresetId;
      try {
        const templateResult = await organizationService.getPipelineTemplate();
        if (templateResult.template && PIPELINE_PRESETS.some((p) => p.id === templateResult.template)) {
          resolvedPresetId = templateResult.template;
          setActivePresetId(resolvedPresetId);
          try { localStorage.setItem(STORAGE_KEY, resolvedPresetId); } catch { /* noop */ }
        }
      } catch {
        // Not in an org or endpoint unavailable — fall back to localStorage
        try {
          const stored = localStorage.getItem(STORAGE_KEY);
          if (stored && PIPELINE_PRESETS.some((p) => p.id === stored)) {
            resolvedPresetId = stored;
            setActivePresetId(resolvedPresetId);
          }
        } catch { /* noop */ }
      }

      const propertiesResult = await propertyService.listProperties({});
      const props = propertiesResult.properties as PropertyWithFinancials[];
      setProperties(props);

      // Build stageMap from API pipeline_stage (source of truth), falling back to localStorage then default
      const defaultStageId = PIPELINE_PRESETS.find((p) => p.id === resolvedPresetId)?.stages[0]?.id || 'screening';
      const savedStages: Record<number, string> = (() => {
        try {
          const raw = localStorage.getItem(DEAL_STAGES_KEY);
          return raw ? JSON.parse(raw) : {};
        } catch { return {}; }
      })();
      const initialStageMap: Record<number, string> = {};
      props.forEach((p) => {
        // API pipeline_stage is the source of truth; localStorage is fallback for non-org users
        initialStageMap[p.id] = p.pipeline_stage || savedStages[p.id] || defaultStageId;
      });
      setStageMap(initialStageMap);
      try { localStorage.setItem(DEAL_STAGES_KEY, JSON.stringify(initialStageMap)); } catch { /* noop */ }

      criteriaService.getScreeningSummary().then(setScreeningSummary).catch((err) => { console.error('Failed to load screening summary:', err); });

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
          .catch((err) => { console.error('Failed to load deal scores:', err); });
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Fetch org status & trigger migration modal
  useEffect(() => {
    organizationService.getMyOrg().then((org) => {
      setUserOrg(org);
      const migrationSeen = localStorage.getItem('talisman_migration_seen');
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
          uploadDate: p.upload_date,
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

  const avgCapRate = useMemo(() => {
    const withCap = deals.filter((d) => d.capRate != null && d.capRate > 0);
    if (withCap.length === 0) return null;
    return withCap.reduce((sum, d) => sum + (d.capRate ?? 0), 0) / withCap.length;
  }, [deals]);

  const avgDealScore = useMemo(() => {
    const withScore = deals.filter((d) => d.dealScore != null);
    if (withScore.length === 0) return null;
    return withScore.reduce((sum, d) => sum + (d.dealScore ?? 0), 0) / withScore.length;
  }, [deals]);

  const volumeSparkline = useMemo(() => {
    const vals = deals.slice(0, 8).map((d) => d.dealValue ?? 0).filter(v => v > 0);
    return vals.length >= 2 ? vals : [0, 1];
  }, [deals]);

  const unitDeals = useMemo(() => {
    return deals.map(d => ({ name: d.name, units: d.units }));
  }, [deals]);

  // --- Interactions ---
  const handleCardClick = useCallback((dealId: number) => {
    setSelectedDealId(dealId);
  }, []);


  const handleStageChange = useCallback((dealId: number, newStageId: string) => {
    // Optimistic UI update
    setStageMap((prev) => {
      const next = { ...prev, [dealId]: newStageId };
      try { localStorage.setItem(DEAL_STAGES_KEY, JSON.stringify(next)); } catch { /* noop */ }
      return next;
    });

    // Persist to backend
    propertyService.updateStage(dealId, newStageId).catch((err) => {
      console.error('Failed to persist stage change:', err);
      // Revert on error
      setStageMap((prev) => {
        const reverted = { ...prev };
        const prop = properties.find((p) => p.id === dealId);
        if (prop) {
          reverted[dealId] = prop.pipeline_stage || activePreset.stages[0]?.id || 'screening';
        }
        try { localStorage.setItem(DEAL_STAGES_KEY, JSON.stringify(reverted)); } catch { /* noop */ }
        return reverted;
      });
    });
  }, [properties, activePreset]);

  const handlePresetChange = useCallback((presetId: string) => {
    setActivePresetId(presetId);
    try { localStorage.setItem(STORAGE_KEY, presetId); } catch { /* noop */ }

    // Persist template choice to org (if in one)
    organizationService.updatePipelineTemplate(presetId).then(() => {
      // Re-fetch properties to get re-mapped stages from backend
      propertyService.listProperties({}).then((result) => {
        const props = result.properties as PropertyWithFinancials[];
        setProperties(props);
        const preset = PIPELINE_PRESETS.find((p) => p.id === presetId);
        const defaultStageId = preset?.stages[0]?.id || 'screening';
        const newMap: Record<number, string> = {};
        props.forEach((p) => {
          newMap[p.id] = p.pipeline_stage || defaultStageId;
        });
        setStageMap(newMap);
        try { localStorage.setItem(DEAL_STAGES_KEY, JSON.stringify(newMap)); } catch { /* noop */ }
      }).catch(() => {});
    }).catch(() => {
      // Not in an org or error — still works locally via localStorage
    });
  }, []);

  // ============================================================
  // RENDER
  // ============================================================

  return (
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
                        localStorage.setItem('talisman_org_banner_dismissed', 'true');
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
                    <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                      {getGreeting()}, {firstName}
                    </h1>
                    <p className="text-xs text-muted-foreground mt-1">
                      {userOrg ? (
                        <a
                          href="/organization"
                          onClick={(e) => { e.preventDefault(); navigate('/organization'); }}
                          className="hover:text-foreground transition-colors"
                        >
                          {userOrg.name}
                        </a>
                      ) : 'WDIS ATL'}
                      {' '}&middot; {deals.length} active deal{deals.length !== 1 ? 's' : ''} &middot; {totalUnits.toLocaleString()} units
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    {(screeningCounts.pass + screeningCounts.review + screeningCounts.fail) > 0 && (
                      <div className="hidden sm:flex items-center gap-3 px-4 py-2.5 rounded-xl glass text-xs">
                        <span className="text-muted-foreground">Screening:</span>
                        <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /><span className="text-emerald-400 font-semibold">{screeningCounts.pass} Pass</span></span>
                        <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-amber-400" /><span className="text-amber-400 font-semibold">{screeningCounts.review} Review</span></span>
                        <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-red-400" /><span className="text-red-400 font-semibold">{screeningCounts.fail} Fail</span></span>
                      </div>
                    )}

                    <button
                      onClick={() => navigate('/upload')}
                      className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-bold bg-white text-[#060608] hover:bg-zinc-200 transition-all"
                    >
                      <Plus className="w-4 h-4" />
                      New Deal
                    </button>
                  </div>
                </div>
              </motion.div>

              {/* ============== METRICS ROW (4 cards) ============== */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.08 }}
              >
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Pipeline Volume — Area Chart */}
                  <div className="liquid-glass shim p-5">
                    <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-2">Total Pipeline Volume</div>
                    <div className="flex justify-between items-end">
                      <div>
                        <span className="text-3xl font-extrabold text-foreground">{totalVolume > 0 ? formatDollarCompact(totalVolume) : '\u2014'}</span>
                      </div>
                      <AreaSparkline values={volumeSparkline} />
                    </div>
                    <div className="flex items-center gap-1.5 mt-2">
                      <span className="text-[10px] text-emerald-400">&#9650; 12.3%</span>
                      <span className="text-[10px] text-muted-foreground">vs last quarter</span>
                    </div>
                  </div>

                  {/* Total Units — Stacked Bar */}
                  <div className="liquid-glass shim p-5">
                    <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-2">Total Units</div>
                    <div className="flex items-end justify-between">
                      <div>
                        <span className="text-3xl font-extrabold text-white">{totalUnits.toLocaleString()}</span>
                        <span className="text-[11px] text-muted-foreground ml-2">across {deals.length}</span>
                      </div>
                    </div>
                    <div className="mt-3">
                      <UnitStackBar deals={unitDeals} />
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[10px] text-emerald-400">&#9650; 4.8%</span>
                      {deals.length > 0 && (
                        <span className="text-[9px] text-muted-foreground">
                          largest: {[...deals].sort((a, b) => b.units - a.units)[0]?.name?.split(' ').slice(0, 2).join(' ')} ({[...deals].sort((a, b) => b.units - a.units)[0]?.units})
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Avg Cap Rate — Bullet Gauge */}
                  <div className="liquid-glass shim p-5">
                    <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-2">Avg Cap Rate</div>
                    <span className="text-3xl font-extrabold text-zinc-300">{avgCapRate != null ? `${avgCapRate.toFixed(2)}%` : '\u2014'}</span>
                    <CapRateGauge value={avgCapRate} />
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-[10px] text-zinc-400">&#8594; Stable</span>
                      <span className="text-[10px] text-muted-foreground">weighted avg</span>
                    </div>
                  </div>

                  {/* Avg Deal Score — Gauge */}
                  <div className="liquid-glass shim p-5">
                    <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-2">Avg Deal Score</div>
                    <div className="flex justify-between items-end">
                      <span className="text-3xl font-extrabold text-white">{avgDealScore != null ? avgDealScore.toFixed(1) : '\u2014'}</span>
                      {avgDealScore != null && <ScoreGauge score={avgDealScore} />}
                    </div>
                    <div className="flex items-center gap-1.5 mt-2">
                      <span className="text-[10px] text-muted-foreground">
                        {screeningCounts.pass} Strong &middot; {screeningCounts.review} Review &middot; {screeningCounts.fail} Weak
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* ============== AI PROMPT BAR ============== */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.12 }}
              >
                <InlineChat />
              </motion.div>

              {/* ============== MAIN GRID: Left + Right Sidebar ============== */}
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
                {/* Left Column */}
                <div className="space-y-5">
                  {/* Pipeline by Stage */}
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.18 }}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <h2 className="text-lg font-extrabold tracking-tight text-foreground">Pipeline by Stage</h2>
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

                  {/* Analytics Row */}
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.25 }}
                  >
                    <AnalyticsRow deals={deals} stages={activePreset.stages} stageMap={stageMap} />
                  </motion.div>

                  {/* Deal Velocity */}
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.3 }}
                  >
                    <DealVelocity deals={deals} stageMap={stageMap} stages={activePreset.stages} />
                  </motion.div>
                </div>

                {/* Right Column — Calendar + Quick Actions */}
                <div className="space-y-5">
                  <motion.div
                    className="self-stretch"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.15 }}
                    style={{ minHeight: '400px' }}
                  >
                    <DashboardCalendar deals={deals} />
                  </motion.div>

                  {/* Quick Actions */}
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.22 }}
                  >
                    <div className="liquid-glass shim p-5">
                      <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-3.5">Quick Actions</div>
                      <div className="flex flex-col gap-1">
                        {[
                          { label: 'Upload New Document', desc: 'OM, BOV, Rent Roll, or T12', route: '/upload', icon: 'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12' },
                          { label: 'Run Comparisons', desc: 'Compare deals side-by-side', route: '/compare', icon: 'M18 20V10M12 20V4M6 20v-6' },
                          { label: 'View Data Bank', desc: 'Market research & reports', route: '/data-bank', icon: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z' },
                          { label: 'Command Center', desc: 'Bulk operations & admin', route: '/command-center', icon: 'M13 2L3 14h9l-1 8 10-12h-9l1-8' },
                        ].map((action) => (
                          <div
                            key={action.label}
                            onClick={() => navigate(action.route)}
                            className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer hover:bg-white/[0.04] transition-all group"
                          >
                            <div className="w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center group-hover:bg-white/[0.08] transition-all shrink-0">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a1a1aa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d={action.icon} />
                              </svg>
                            </div>
                            <div>
                              <div className="text-xs text-foreground font-medium">{action.label}</div>
                              <div className="text-[10px] text-muted-foreground">{action.desc}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>

                  {/* Deal Alerts */}
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.28 }}
                  >
                    <DealAlerts deals={deals} />
                  </motion.div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
  );
};
