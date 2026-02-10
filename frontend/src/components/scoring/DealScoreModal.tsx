/**
 * DealScoreModal — Full three-layer scoring breakdown overlay
 *
 * Shows Layer 1 (Property Fundamentals), Layer 2 (Market Intelligence),
 * Layer 3 (Deal Comp Analysis) with animated metric bars.
 */
import { useEffect, useState } from 'react';
import {
  Building2,
  BarChart3,
  AlertTriangle,
  Brain,
  X,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';
import type { DealScoreResult, MetricBreakdown, CompUsed } from '@/services/scoringService';
import { DealScoreBadge } from './DealScoreBadge';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-400';
  if (score >= 60) return 'text-primary';
  if (score >= 40) return 'text-yellow-400';
  return 'text-red-400';
}

function getBarColor(score: number): string {
  if (score >= 80) return 'bg-green-400';
  if (score >= 60) return 'bg-primary';
  if (score >= 40) return 'bg-yellow-400';
  return 'bg-red-400';
}

function getConfidenceBadge(confidence: string): { label: string; className: string } {
  switch (confidence) {
    case 'high':
      return { label: 'High Confidence', className: 'bg-green-500/10 text-green-400' };
    case 'medium':
      return { label: 'Medium Confidence', className: 'bg-yellow-500/10 text-yellow-400' };
    default:
      return { label: 'Low Confidence', className: 'bg-red-500/10 text-red-400' };
  }
}

function fmtMetricValue(name: string, value: number | null): string {
  if (value == null) return '\u2014';
  if (name === 'economic_occupancy' || name === 'opex_ratio') return `${value.toFixed(1)}%`;
  if (name === 'supply_pipeline') return `${value.toFixed(1)}%`;
  if (name === 'market_sentiment') return value > 0 ? `+${value}` : `${value}`;
  return value.toFixed(1);
}

const METRIC_LABELS: Record<string, string> = {
  economic_occupancy: 'Economic Occupancy',
  opex_ratio: 'OpEx Ratio',
  supply_pipeline: 'Supply Pipeline',
  market_sentiment: 'Market Sentiment',
  cap_rate: 'Cap Rate Spread',
  price_per_unit: 'Price / Unit',
  vintage: 'Vintage Adjustment',
};

const LAYER_CONFIG = [
  {
    key: 'property_fundamentals',
    label: 'Layer 1: Property Fundamentals',
    icon: Building2,
    color: 'text-blue-400',
    borderColor: 'border-blue-500/20',
    bgColor: 'bg-blue-500/5',
  },
  {
    key: 'market_intelligence',
    label: 'Layer 2: Market Intelligence',
    icon: Brain,
    color: 'text-violet-400',
    borderColor: 'border-violet-500/20',
    bgColor: 'bg-violet-500/5',
  },
  {
    key: 'deal_comp_analysis',
    label: 'Layer 3: Deal Comp Analysis',
    icon: BarChart3,
    color: 'text-emerald-400',
    borderColor: 'border-emerald-500/20',
    bgColor: 'bg-emerald-500/5',
  },
];

// ---------------------------------------------------------------------------
// MetricRow
// ---------------------------------------------------------------------------

function MetricRow({
  name,
  metric,
  animateDelay,
}: {
  name: string;
  metric: MetricBreakdown;
  animateDelay: number;
}) {
  const [animated, setAnimated] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), animateDelay);
    return () => clearTimeout(t);
  }, [animateDelay]);

  const label = METRIC_LABELS[name] || name.replace(/_/g, ' ');
  const score = metric.raw_score;
  const hasScore = score != null;

  return (
    <div className="py-2.5">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm text-foreground font-medium truncate">{label}</span>
          {metric.context && (
            <span className="hidden sm:inline text-[10px] text-muted-foreground truncate max-w-[200px]">
              {metric.context}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="font-mono text-xs text-muted-foreground">
            {fmtMetricValue(name, metric.value)}
          </span>
          {hasScore && (
            <span className={cn('font-mono text-sm font-bold', getScoreColor(score))}>
              {Math.round(score)}
            </span>
          )}
          {!hasScore && (
            <span className="font-mono text-sm text-muted-foreground">&mdash;</span>
          )}
        </div>
      </div>
      {/* Score bar */}
      <div className="h-1.5 rounded-full bg-border/50 overflow-hidden">
        {hasScore && (
          <div
            className={cn(
              'h-full rounded-full transition-all duration-700 ease-out',
              getBarColor(score),
            )}
            style={{ width: animated ? `${score}%` : '0%' }}
          />
        )}
      </div>
      {/* Weight tag */}
      <div className="flex items-center justify-between mt-1">
        <span className="text-[10px] text-muted-foreground">
          Weight: {metric.weight}%
        </span>
        {metric.weighted_score != null && (
          <span className="text-[10px] font-mono text-muted-foreground">
            Contribution: {metric.weighted_score.toFixed(1)}
          </span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CompTable
// ---------------------------------------------------------------------------

function CompTable({ comps }: { comps: CompUsed[] }) {
  if (!comps.length) {
    return (
      <div className="flex items-center gap-2 py-3 px-4 rounded-xl bg-muted/30 border border-border">
        <Info className="w-4 h-4 text-muted-foreground shrink-0" />
        <span className="text-sm text-muted-foreground">
          No comps loaded. Upload sales comps in the Data Bank to enable Layer 3 scoring.
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <div className="grid grid-cols-[1.5fr_0.8fr_0.6fr_0.7fr_0.6fr_0.4fr] gap-2 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted/50 border-b border-border">
        <div>Property</div>
        <div>Submarket</div>
        <div className="text-right">Cap Rate</div>
        <div className="text-right">Sale Price</div>
        <div className="text-right">$/Unit</div>
        <div className="text-right">Rel.</div>
      </div>
      {comps.slice(0, 8).map((comp) => (
        <div
          key={comp.id}
          className="grid grid-cols-[1.5fr_0.8fr_0.6fr_0.7fr_0.6fr_0.4fr] gap-2 px-3 py-2 text-xs border-b border-border last:border-b-0 hover:bg-accent/30 transition-colors"
        >
          <div className="truncate text-foreground font-medium">
            {comp.property_name || '\u2014'}
          </div>
          <div className="truncate text-muted-foreground">
            {comp.submarket || '\u2014'}
          </div>
          <div className="text-right font-mono text-foreground">
            {comp.cap_rate != null ? `${(comp.cap_rate * 100).toFixed(1)}%` : '\u2014'}
          </div>
          <div className="text-right font-mono text-foreground">
            {comp.sale_price != null
              ? `$${(Math.round(comp.sale_price / 1_000_000 * 10) / 10).toFixed(1)}M`
              : '\u2014'}
          </div>
          <div className="text-right font-mono text-foreground">
            {comp.price_per_unit != null
              ? `$${Math.round(comp.price_per_unit).toLocaleString()}`
              : '\u2014'}
          </div>
          <div className="text-right font-mono text-primary font-semibold">
            {(comp.relevance * 100).toFixed(0)}%
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Modal
// ---------------------------------------------------------------------------

interface DealScoreModalProps {
  open: boolean;
  onClose: () => void;
  scoreData: DealScoreResult | null;
  propertyName?: string;
}

export function DealScoreModal({
  open,
  onClose,
  scoreData,
  propertyName,
}: DealScoreModalProps) {
  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!scoreData) return null;

  const confidenceBadge = getConfidenceBadge(scoreData.confidence);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="score-modal-overlay"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

          {/* Modal */}
          <motion.div
            className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 z-10 p-2 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>

            {/* Header */}
            <div className="px-6 pt-6 pb-4 border-b border-border">
              <div className="flex items-center gap-4">
                <DealScoreBadge score={scoreData.total_score} size="lg" animated />
                <div>
                  <h2 className="font-display text-xl font-bold text-foreground">
                    Deal Score Breakdown
                  </h2>
                  {propertyName && (
                    <p className="text-sm text-muted-foreground mt-0.5">{propertyName}</p>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <span
                      className={cn(
                        'px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider',
                        confidenceBadge.className,
                      )}
                    >
                      {confidenceBadge.label}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Warnings */}
            {scoreData.warnings.length > 0 && (
              <div className="px-6 py-3 bg-yellow-500/5 border-b border-yellow-500/10">
                {scoreData.warnings.map((w, i) => (
                  <div key={i} className="flex items-start gap-2 py-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 shrink-0 mt-0.5" />
                    <span className="text-xs text-yellow-300/80">{w}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Layer Sections */}
            <div className="px-6 py-4 space-y-4">
              {LAYER_CONFIG.map((layer, layerIdx) => {
                const layerKey = layer.key as keyof typeof scoreData.layer_scores;
                const layerData = scoreData.layer_scores[layerKey];
                if (!layerData) return null;

                const Icon = layer.icon;
                const metrics = layerData.metrics || {};
                const metricEntries = Object.entries(metrics);
                const compsUsed = layerData.comps_used || [];

                return (
                  <div
                    key={layer.key}
                    className={cn(
                      'rounded-xl border p-4',
                      layer.borderColor,
                      layer.bgColor,
                    )}
                  >
                    {/* Layer header */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Icon className={cn('w-4 h-4', layer.color)} />
                        <span className="text-sm font-semibold text-foreground">
                          {layer.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        {layerData.weight > 0 && (
                          <span className="text-[10px] font-mono text-muted-foreground">
                            Weight: {layerData.weight}%
                          </span>
                        )}
                        {layerData.score != null ? (
                          <span
                            className={cn(
                              'font-mono text-lg font-bold',
                              getScoreColor(layerData.score),
                            )}
                          >
                            {Math.round(layerData.score)}
                          </span>
                        ) : (
                          <span className="font-mono text-lg text-muted-foreground">&mdash;</span>
                        )}
                      </div>
                    </div>

                    {/* Metric rows */}
                    {metricEntries.length > 0 ? (
                      <div className="divide-y divide-border/30">
                        {metricEntries.map(([name, metric], mIdx) => (
                          <MetricRow
                            key={name}
                            name={name}
                            metric={metric}
                            animateDelay={200 + layerIdx * 200 + mIdx * 100}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="py-3 text-sm text-muted-foreground flex items-center gap-2">
                        <Info className="w-4 h-4" />
                        {layer.key === 'market_intelligence'
                          ? 'Market intelligence not yet analyzed (Phase 4)'
                          : 'No data available for this layer'}
                      </div>
                    )}

                    {/* Comp table for Layer 3 */}
                    {layer.key === 'deal_comp_analysis' && (
                      <div className="mt-3 pt-3 border-t border-border/30">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                          Comparable Sales
                        </p>
                        <CompTable comps={compsUsed} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-border">
              <p className="text-[10px] text-muted-foreground">
                Deal Score v2 &middot; Three-layer architecture &middot; Scores are 0-100 based on
                user-configured weights &middot; Layer weights redistribute when data is unavailable
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
