/**
 * RecommendationPanel — AI-style recommendation callout
 */
import { Sparkles } from 'lucide-react';
import { fmtCapRate } from '@/utils/formatUtils';
import type { ScoredProperty, MetricPreset } from './types';

interface RecommendationPanelProps {
  scoredProperties: ScoredProperty[];
  preset: MetricPreset;
}

export function RecommendationPanel({ scoredProperties, preset }: RecommendationPanelProps) {
  if (scoredProperties.length === 0) return null;

  return (
    <div className="liquid-glass p-6 relative overflow-hidden">
      <div className="absolute top-4 right-4 opacity-10">
        <Sparkles className="w-20 h-20 text-ivory" />
      </div>

      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-5 h-5 text-ivory" />
        <span className="text-xs font-bold uppercase tracking-wider text-ivory">
          Recommendation
        </span>
      </div>

      <p className="text-sm leading-relaxed relative z-10 text-zinc-300">
        Based on your{' '}
        <strong className="text-white">{preset.name}</strong> criteria,{' '}
        <strong className="text-emerald-500">
          {scoredProperties[0].property.property_name}
        </strong>{' '}
        leads with a score of{' '}
        <strong className="font-display text-white">
          {scoredProperties[0].score?.total ?? 0}
        </strong>
        .
        {scoredProperties[0].property.cap_rates.going_in != null &&
          ` Strong yield at ${fmtCapRate(scoredProperties[0].property.cap_rates.going_in)} cap.`}
        {scoredProperties.length > 1 &&
          ` Runner-up: ${scoredProperties[1].property.property_name} (${scoredProperties[1].score?.total ?? 0}).`}
      </p>
    </div>
  );
}
