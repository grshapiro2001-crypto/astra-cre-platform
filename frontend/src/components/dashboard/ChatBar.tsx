/**
 * ChatBar — Inline ASTRA chat bar for the dashboard
 *
 * Features:
 * - Input with prism icon and send button
 * - Suggestion chips that auto-fill and submit
 * - Simulated AI response with loading dots
 * - Response area below chips
 */
import { useState, useCallback } from 'react';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DashboardDeal } from '@/components/dashboard/DealCard';

// ============================================================
// Types
// ============================================================

interface ChatBarProps {
  deals: DashboardDeal[];
}

// ============================================================
// Constants
// ============================================================

const SUGGESTION_CHIPS = [
  "What's my best deal?",
  'Summarize pipeline',
  'Compare submarkets',
  'Deals needing attention',
] as const;

// ============================================================
// Helpers
// ============================================================

/** Simulate an AI response based on actual deal data. */
const generateSimulatedResponse = (query: string, deals: DashboardDeal[]): string => {
  const q = query.toLowerCase();
  const scored = deals.filter((d) => d.dealScore != null).sort((a, b) => (b.dealScore ?? 0) - (a.dealScore ?? 0));
  const totalVolume = deals.reduce((s, d) => s + (d.dealValue ?? 0), 0);

  if (q.includes('best deal') || q.includes('top deal') || q.includes('highest')) {
    if (scored.length === 0) return 'No scored deals in your pipeline yet. Upload and score deals to get started.';
    const top = scored[0];
    return `Your top-scoring deal is **${top.name}** in ${top.submarket || 'N/A'} with a score of ${Math.round(top.dealScore!)}. It has ${top.units} units${top.dealValue ? ` valued at $${(top.dealValue / 1_000_000).toFixed(1)}M` : ''}.`;
  }

  if (q.includes('summarize') || q.includes('summary') || q.includes('pipeline')) {
    const submarkets = [...new Set(deals.map((d) => d.submarket).filter(Boolean))];
    return `Your pipeline has **${deals.length} deals** with a total volume of **$${(totalVolume / 1_000_000).toFixed(1)}M** across ${submarkets.length} submarkets. ${scored.length > 0 ? `Average deal score is ${Math.round(scored.reduce((s, d) => s + (d.dealScore ?? 0), 0) / scored.length)}.` : ''}`;
  }

  if (q.includes('submarket') || q.includes('compare')) {
    const bySubmarket: Record<string, { count: number; volume: number }> = {};
    deals.forEach((d) => {
      const sm = d.submarket || 'Unknown';
      if (!bySubmarket[sm]) bySubmarket[sm] = { count: 0, volume: 0 };
      bySubmarket[sm].count++;
      bySubmarket[sm].volume += d.dealValue ?? 0;
    });
    const lines = Object.entries(bySubmarket)
      .sort((a, b) => b[1].volume - a[1].volume)
      .slice(0, 5)
      .map(([name, data]) => `- **${name}**: ${data.count} deals, $${(data.volume / 1_000_000).toFixed(1)}M`);
    return `Top submarkets by volume:\n${lines.join('\n')}`;
  }

  if (q.includes('attention') || q.includes('weak') || q.includes('risk')) {
    const weak = scored.filter((d) => (d.dealScore ?? 0) < 60);
    if (weak.length === 0) return 'All scored deals are above the review threshold. No immediate concerns.';
    return `**${weak.length} deal${weak.length > 1 ? 's' : ''}** need${weak.length === 1 ? 's' : ''} attention (score < 60):\n${weak.slice(0, 3).map((d) => `- ${d.name}: score ${Math.round(d.dealScore!)}`).join('\n')}`;
  }

  return `I found **${deals.length} deals** in your pipeline with a combined volume of **$${(totalVolume / 1_000_000).toFixed(1)}M**. ${scored.length > 0 ? `The highest-scored deal is ${scored[0].name} at ${Math.round(scored[0].dealScore!)}.` : 'Score your deals to get deeper insights.'}`;
};

// ============================================================
// Prism Icon SVG
// ============================================================

const PrismIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-primary shrink-0">
    <path d="M8 1L14 13H2L8 1Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="currentColor" fillOpacity="0.1" />
  </svg>
);

// ============================================================
// Component
// ============================================================

export const ChatBar: React.FC<ChatBarProps> = ({ deals }) => {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState(false);

  const handleSubmit = useCallback(
    (text: string) => {
      if (!text.trim() || isLoading) return;
      const q = text.trim();
      setQuery('');
      setIsLoading(true);
      setResponse(null);

      // Simulated 1.5-2s delay
      const delay = 1500 + Math.random() * 500;
      setTimeout(() => {
        setResponse(generateSimulatedResponse(q, deals));
        setIsLoading(false);
      }, delay);
    },
    [deals, isLoading],
  );

  const handleChipClick = (chip: string) => {
    handleSubmit(chip);
  };

  return (
    <div className="flex-1 min-w-0">
      {/* Context text */}
      <p className="font-mono text-2xs uppercase tracking-wider text-muted-foreground/60 mb-1.5 font-semibold">
        Ask ASTRA about your pipeline
      </p>

      {/* Input bar */}
      <div
        className={cn(
          'relative flex items-center rounded-xl bg-background/50 border transition-all duration-200',
          isFocused ? 'border-primary/60 shadow-[0_0_12px_-3px] shadow-primary/20' : 'border-border/60',
        )}
      >
        <div className="pl-3">
          <PrismIcon />
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit(query)}
          disabled={isLoading}
          placeholder="Ask about deals, markets, or your portfolio..."
          className="flex-1 bg-transparent px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none disabled:opacity-50"
        />
        {query.length > 0 && (
          <button
            onClick={() => handleSubmit(query)}
            disabled={isLoading}
            className="mr-2 p-1.5 rounded-lg bg-primary text-primary-foreground hover:brightness-110 transition-all disabled:opacity-50"
          >
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Suggestion chips */}
      <div className="flex flex-wrap gap-1.5 mt-2">
        {SUGGESTION_CHIPS.map((chip) => (
          <button
            key={chip}
            onClick={() => handleChipClick(chip)}
            disabled={isLoading}
            className="px-2.5 py-1 rounded-full text-2xs font-medium bg-muted/50 border border-border/40 text-muted-foreground hover:border-primary/40 hover:text-primary transition-all disabled:opacity-50"
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Response area */}
      {(isLoading || response) && (
        <div className="mt-3 p-3 rounded-xl bg-primary/5 border border-primary/10">
          {isLoading ? (
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          ) : response ? (
            <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-line">
              {response.split(/\*\*(.*?)\*\*/g).map((part, i) =>
                i % 2 === 1 ? (
                  <span key={i} className="font-semibold text-foreground">
                    {part}
                  </span>
                ) : (
                  <span key={i}>{part}</span>
                ),
              )}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
};
