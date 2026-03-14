/**
 * OverviewTab — Score ring + timeline, stats strip, AI deal summary.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Building2,
  Calendar,
  DollarSign,
  Maximize2,
  TrendingUp,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  CheckCircle,
  Star,
  Layers,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PropertyDetail } from '@/types/property';
import type { DealScoreResult } from '@/services/scoringService';
import { streamPropertyChat } from '@/services/chatService';
import {
  fmtCurrency,
  fmtNumber,
  GLASS_CARD,
  SECTION_LABEL,
  STAT_BOX,
  type FinancialPeriodKey,
} from './tabUtils';

interface OverviewTabProps {
  property: PropertyDetail;
  dealScore: DealScoreResult | null;
  financialPeriod: FinancialPeriodKey; // reserved for future use
}

// ---------------------------------------------------------------------------
// Score ring SVG
// ---------------------------------------------------------------------------

function ScoreRing({ score }: { score: number }) {
  const r = 54;
  const c = 2 * Math.PI * r;
  const pct = Math.min(score, 100) / 100;
  const color = score >= 70 ? '#22c55e' : score >= 40 ? '#eab308' : '#ef4444';

  return (
    <div className="relative w-[140px] h-[140px] shrink-0">
      <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="currentColor" strokeWidth="8" className="text-border/40" />
        <circle
          cx="60" cy="60" r={r} fill="none"
          stroke={color}
          strokeWidth="8"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          strokeLinecap="round"
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-3xl font-bold text-foreground">{score}</span>
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Score</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Score component bars
// ---------------------------------------------------------------------------

function ScoreBar({ label, score }: { label: string; score: number }) {
  const color = score >= 70 ? 'bg-green-400' : score >= 40 ? 'bg-yellow-400' : 'bg-red-400';
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-xs font-mono font-semibold text-foreground">{Math.round(score)}</span>
      </div>
      <div className="h-1.5 rounded-full bg-border/40 overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', color)}
          style={{ width: `${Math.min(score, 100)}%` }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Deal Timeline
// ---------------------------------------------------------------------------

function DealTimeline({ property }: { property: PropertyDetail }) {
  const stages = [
    { label: 'Deal Created', done: true },
    { label: 'Documents Uploaded', done: (property.documents?.length ?? 0) > 0 },
    { label: 'Analysis Complete', done: property.analysis_status === 'completed' || property.last_analyzed_at != null },
    { label: 'Screening Done', done: property.screening_verdict != null },
    { label: 'Under Review', done: property.pipeline_stage === 'review' || property.pipeline_stage === 'loi' || property.pipeline_stage === 'closed' },
    { label: 'LOI / Closed', done: property.pipeline_stage === 'loi' || property.pipeline_stage === 'closed' },
  ];

  // Find first not-done index
  const activeIdx = stages.findIndex((s) => !s.done);

  return (
    <div className="space-y-3">
      {stages.map((stage, i) => {
        const isActive = i === activeIdx;
        const isDone = stage.done;
        return (
          <div key={i} className="flex items-center gap-3">
            <div className={cn(
              'w-3 h-3 rounded-full shrink-0 border-2',
              isDone ? 'bg-primary border-primary' :
              isActive ? 'bg-transparent border-primary animate-pulse' :
              'bg-transparent border-border',
            )} />
            {i < stages.length - 1 && (
              <div className="absolute ml-[5px] mt-6 w-0.5 h-4" style={{ background: isDone ? 'hsl(var(--primary))' : 'hsl(var(--border))' }} />
            )}
            <span className={cn(
              'text-sm',
              isDone ? 'text-foreground font-medium' :
              isActive ? 'text-primary font-medium' :
              'text-muted-foreground',
            )}>
              {stage.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AI Deal Summary
// ---------------------------------------------------------------------------

interface Observation {
  type: 'upside' | 'risk' | 'concern';
  text: string;
}

const AI_SUMMARY_PROMPT = `You are a senior CRE acquisitions analyst. Based on the property data in context, produce a concise deal screening summary.

Return ONLY valid JSON (no markdown fencing, no explanation) with this exact shape:
{
  "verdict": "<one of: STRONG PASS | CONDITIONAL PASS | WATCHLIST | DECLINE>",
  "summary": "<2-3 sentence investment thesis>",
  "observations": [
    {"type": "upside", "text": "..."},
    {"type": "risk", "text": "..."},
    {"type": "concern", "text": "..."}
  ],
  "recommendation": "<2-3 sentence next-steps recommendation>"
}

Rules:
- Include 4-6 observations with a mix of upside, risk, and concern types.
- Be specific with numbers from the property data (occupancy, rents, NOI, vintage, submarket).
- Keep each observation to 1-2 sentences.
- verdict must be exactly one of the four options above.`;

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

interface AISummaryResult {
  verdict: string;
  summary: string;
  observations: Observation[];
  recommendation: string;
}

const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

interface CachedAISummary {
  data: AISummaryResult;
  timestamp: number;
}

function getCachedSummary(propertyId: number): AISummaryResult | null {
  try {
    const raw = localStorage.getItem(`talisman_ai_summary_${propertyId}`);
    if (!raw) return null;
    const cached: CachedAISummary = JSON.parse(raw);
    if (Date.now() - cached.timestamp > CACHE_TTL) {
      localStorage.removeItem(`talisman_ai_summary_${propertyId}`);
      return null;
    }
    return cached.data;
  } catch {
    return null;
  }
}

function setCachedSummary(propertyId: number, data: AISummaryResult): void {
  try {
    const entry: CachedAISummary = { data, timestamp: Date.now() };
    localStorage.setItem(`talisman_ai_summary_${propertyId}`, JSON.stringify(entry));
  } catch {
    // localStorage quota or unavailable — silently ignore
  }
}

export function OverviewTab({ property, dealScore }: OverviewTabProps) {
  const [showAllObs, setShowAllObs] = useState(false);
  const [aiSummary, setAiSummary] = useState<AISummaryResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const fetchedPropertyIdRef = useRef<number | null>(null);

  const fetchAISummary = useCallback((propertyId: number, forceRefresh = false) => {
    if (!forceRefresh) {
      const cached = getCachedSummary(propertyId);
      if (cached) {
        setAiSummary(cached);
        fetchedPropertyIdRef.current = propertyId;
        return;
      }
    }

    abortRef.current?.abort();

    setAiLoading(true);
    setAiError(false);
    setAiSummary(null);

    let accumulated = '';

    const controller = streamPropertyChat(
      {
        message: AI_SUMMARY_PROMPT,
        conversation_history: [],
        property_id: propertyId,
      },
      (chunk) => {
        accumulated += chunk;
      },
      () => {
        try {
          let cleaned = accumulated.trim();
          if (cleaned.startsWith('```')) {
            cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
          }
          const parsed = JSON.parse(cleaned);
          const result: AISummaryResult = {
            verdict: parsed.verdict ?? 'CONDITIONAL PASS',
            summary: parsed.summary ?? '',
            observations: Array.isArray(parsed.observations)
              ? parsed.observations.filter(
                  (o: { type?: string; text?: string }) =>
                    o && typeof o.text === 'string' && ['upside', 'risk', 'concern'].includes(o.type ?? ''),
                )
              : [],
            recommendation: parsed.recommendation ?? '',
          };
          setCachedSummary(propertyId, result);
          setAiSummary(result);
          fetchedPropertyIdRef.current = propertyId;
        } catch {
          setAiError(true);
        }
        setAiLoading(false);
      },
      () => {
        setAiError(true);
        setAiLoading(false);
      },
    );

    abortRef.current = controller;
  }, []);

  useEffect(() => {
    if (property.id && property.id !== fetchedPropertyIdRef.current) {
      fetchAISummary(property.id);
    }
    return () => {
      abortRef.current?.abort();
    };
  }, [property.id, fetchAISummary]);

  const totalUnits = property.total_units ?? 0;
  const totalSF = property.total_residential_sf ?? 0;
  const avgSF = totalUnits > 0 && totalSF > 0 ? Math.round(totalSF / totalUnits) : 0;

  // Score layer data from dealScore
  const layers = dealScore?.layer_scores;
  const l1Metrics = layers?.property_fundamentals?.metrics ?? {};
  const l3Metrics = layers?.deal_comp_analysis?.metrics ?? {};
  const scoreComponents = [
    { label: 'Property Fundamentals', score: layers?.property_fundamentals?.score ?? 0 },
    { label: 'Market Intelligence', score: layers?.market_intelligence?.score ?? 0 },
    { label: 'Deal Comp Analysis', score: layers?.deal_comp_analysis?.score ?? 0 },
    { label: 'Economic Occupancy', score: l1Metrics.economic_occupancy?.raw_score ?? 0 },
    { label: 'OpEx Ratio', score: l1Metrics.opex_ratio?.raw_score ?? 0 },
    { label: 'Cap Rate Spread', score: l3Metrics.cap_rate?.raw_score ?? 0 },
  ];

  // Stats for the strip
  const occupancyPct = property.rr_physical_occupancy_pct ?? (property.rr_occupied_units && property.rr_total_units ? (property.rr_occupied_units / property.rr_total_units * 100) : null);

  // Compute going-in cap from financials
  const t3Noi = property.t3_financials?.noi ?? property.t3_noi;
  const guidancePrice = property.user_guidance_price;
  const bovPrice = property.bov_pricing_tiers?.[0]?.pricing;
  const dealPrice = guidancePrice ?? bovPrice;
  const goingInCap = dealPrice && t3Noi ? ((t3Noi / dealPrice) * 100).toFixed(2) : null;
  const pricePerUnit = dealPrice && totalUnits > 0 ? Math.round(dealPrice / totalUnits) : null;

  return (
    <div className="space-y-6">
      {/* ─── Row 1: Score + Timeline ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
        {/* Score Card */}
        <div className={GLASS_CARD}>
          <p className={SECTION_LABEL + ' mb-5'}>INVESTMENT ANALYSIS SCORE</p>
          <div className="flex items-start gap-8">
            <ScoreRing score={dealScore?.total_score ?? 0} />
            <div className="flex-1 grid grid-cols-2 gap-x-6 gap-y-3">
              {scoreComponents.map((c) => (
                <ScoreBar key={c.label} label={c.label} score={c.score} />
              ))}
            </div>
          </div>
        </div>

        {/* Timeline Card */}
        <div className={GLASS_CARD}>
          <p className={SECTION_LABEL + ' mb-5'}>DEAL TIMELINE</p>
          <DealTimeline property={property} />
        </div>
      </div>

      {/* ─── Row 2: Stats Strip ─── */}
      <div className={GLASS_CARD}>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-5">
          {/* Asset Class */}
          <div className={STAT_BOX}>
            <div className="flex items-center gap-1.5 mb-2">
              <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
              <span className={SECTION_LABEL}>ASSET CLASS</span>
            </div>
            <p className="font-display text-base font-semibold text-foreground">
              {property.property_type ?? 'Multifamily'}
            </p>
            <p className="font-sans text-xs text-muted-foreground mt-0.5">
              {property.document_subtype ?? 'Class A- Garden'}
            </p>
          </div>

          {/* Unit Count */}
          <div className={STAT_BOX}>
            <div className="flex items-center gap-1.5 mb-2">
              <Layers className="w-3.5 h-3.5 text-muted-foreground" />
              <span className={SECTION_LABEL}>UNIT COUNT</span>
            </div>
            <p className="font-display text-base font-semibold text-foreground">
              {totalUnits > 0 ? `${totalUnits} Units` : 'N/A'}
            </p>
            <p className="font-sans text-xs text-muted-foreground mt-0.5">
              {occupancyPct != null ? `${occupancyPct.toFixed(1)}% Occupied` : '—'}
            </p>
          </div>

          {/* Total Area */}
          <div className={STAT_BOX}>
            <div className="flex items-center gap-1.5 mb-2">
              <Maximize2 className="w-3.5 h-3.5 text-muted-foreground" />
              <span className={SECTION_LABEL}>TOTAL AREA</span>
            </div>
            <p className="font-display text-base font-semibold text-foreground">
              {totalSF > 0 ? `${fmtNumber(totalSF)} SF` : 'N/A'}
            </p>
            <p className="font-sans text-xs text-muted-foreground mt-0.5">
              {avgSF > 0 ? `Avg: ${fmtNumber(avgSF)} SF` : '—'}
            </p>
          </div>

          {/* Year Built */}
          <div className={STAT_BOX}>
            <div className="flex items-center gap-1.5 mb-2">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
              <span className={SECTION_LABEL}>YEAR BUILT</span>
            </div>
            <p className="font-display text-base font-semibold text-foreground">
              {property.year_built ?? 'N/A'}
            </p>
            <p className="font-sans text-xs text-muted-foreground mt-0.5">
              Last Reno: {property.renovation_duration_years != null ? `${property.renovation_duration_years}yr ago` : 'N/A'}
            </p>
          </div>

          {/* Deal Value */}
          <div className={STAT_BOX}>
            <div className="flex items-center gap-1.5 mb-2">
              <DollarSign className="w-3.5 h-3.5 text-muted-foreground" />
              <span className={SECTION_LABEL}>DEAL VALUE</span>
            </div>
            <p className="font-display text-base font-semibold text-foreground">
              {dealPrice ? fmtCurrency(dealPrice, true) : 'N/A'}
            </p>
            <p className="font-sans text-xs text-muted-foreground mt-0.5">
              {pricePerUnit ? `${fmtCurrency(pricePerUnit, true)} / Unit` : '—'}
            </p>
          </div>

          {/* Cap Rate */}
          <div className={STAT_BOX}>
            <div className="flex items-center gap-1.5 mb-2">
              <TrendingUp className="w-3.5 h-3.5 text-muted-foreground" />
              <span className={SECTION_LABEL}>CAP RATE</span>
            </div>
            <p className="font-display text-base font-semibold text-foreground">
              {goingInCap ? `${goingInCap}%` : (property.bov_pricing_tiers?.[0]?.cap_rates?.[0]?.cap_rate_value != null ? `${(property.bov_pricing_tiers[0].cap_rates[0].cap_rate_value * (property.bov_pricing_tiers[0].cap_rates[0].cap_rate_value < 1 ? 100 : 1)).toFixed(2)}%` : 'N/A')}
            </p>
            <p className="font-sans text-xs text-muted-foreground mt-0.5">
              Going-In (T3)
            </p>
          </div>
        </div>
      </div>

      {/* ─── Row 3: AI Deal Summary (NEW) ─── */}
      <div className={GLASS_CARD}>
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            <Star className="w-5 h-5 text-primary" />
            <div>
              <h3 className="font-display text-base font-semibold text-foreground">AI Deal Summary</h3>
              <p className="font-sans text-xs text-muted-foreground">
                Generated from OM, T-12, and Rent Roll extraction
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {aiSummary && !aiLoading && (
              <button
                onClick={() => {
                  fetchAISummary(property.id, true);
                }}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                title="Regenerate summary"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
            {aiSummary && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30">
                <CheckCircle className="w-3.5 h-3.5" />
                {aiSummary.verdict}
              </span>
            )}
          </div>
        </div>

        {/* Loading skeleton */}
        {aiLoading && (
          <div className="space-y-4 animate-pulse">
            <div className="bg-muted rounded-xl h-4 w-3/4" />
            <div className="bg-muted rounded-xl h-4 w-full" />
            <div className="bg-muted rounded-xl h-4 w-2/3" />
            {[0, 1, 2].map((i) => (
              <div key={i} className="bg-muted rounded-xl h-12 w-full" />
            ))}
            <div className="bg-muted rounded-xl h-16 w-full" />
          </div>
        )}

        {/* Error state */}
        {aiError && !aiSummary && !aiLoading && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertTriangle className="w-6 h-6 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">AI summary unavailable — check back shortly</p>
            <button
              onClick={() => fetchAISummary(property.id)}
              className="mt-3 flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Try again
            </button>
          </div>
        )}

        {/* Summary */}
        {aiSummary && !aiLoading && (
          <>
            <div className="border-l-[3px] border-primary/40 pl-4 mb-6">
              <p className="text-sm text-foreground leading-relaxed">{aiSummary.summary}</p>
            </div>

            {/* Observations */}
            <div className="space-y-2 mb-5">
              {(showAllObs ? aiSummary.observations : aiSummary.observations.slice(0, 3)).map((obs, i) => {
                const cfg = obs.type === 'upside'
                  ? { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', icon: ArrowUp, iconColor: 'text-emerald-500' }
                  : obs.type === 'risk'
                  ? { bg: 'bg-amber-500/10', border: 'border-amber-500/30', icon: AlertTriangle, iconColor: 'text-amber-500' }
                  : { bg: 'bg-red-500/10', border: 'border-red-500/30', icon: ArrowDown, iconColor: 'text-red-500' };
                const Icon = cfg.icon;
                return (
                  <div key={i} className={cn('flex items-start gap-3 p-3 rounded-xl border', cfg.bg, cfg.border)}>
                    <Icon className={cn('w-4 h-4 mt-0.5 shrink-0', cfg.iconColor)} />
                    <p className="text-sm text-foreground">{obs.text}</p>
                  </div>
                );
              })}
            </div>

            {aiSummary.observations.length > 3 && (
              <button
                onClick={() => setShowAllObs(!showAllObs)}
                className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors mb-5"
              >
                <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', showAllObs && 'rotate-180')} />
                {showAllObs ? 'Show fewer' : `Show ${aiSummary.observations.length - 3} more observations`}
              </button>
            )}

            {/* Recommendation */}
            <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <Star className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-1">Recommendation</p>
                <p className="text-sm text-foreground">{aiSummary.recommendation}</p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
