/**
 * DealCard — Compact deal card for the Dashboard deal list
 *
 * Shows: property name, submarket, units, deal value, deal score badge, document type badge
 * Single click → selects card (highlights on map)
 * Double click → navigates to PropertyDetail
 */
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Award } from 'lucide-react';

// ============================================================
// Shared type used by Dashboard, DealCard, and DashboardMap
// ============================================================

export interface DashboardDeal {
  id: number;
  name: string;
  address: string;
  submarket: string;
  units: number;
  dealValue: number | null;
  dealScore: number | null;
  documentType: string;
  propertyType: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

// ============================================================
// Helpers
// ============================================================

const formatDealValue = (value: number | null): string => {
  if (!value) return '\u2014';
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value}`;
};

const getScoreColor = (score: number): string => {
  if (score >= 75) return 'text-green-400';
  if (score >= 65) return 'text-yellow-400';
  return 'text-red-400';
};

const getScoreBg = (score: number): string => {
  if (score >= 75) return 'bg-green-500/10';
  if (score >= 65) return 'bg-yellow-500/10';
  return 'bg-red-500/10';
};

// ============================================================
// Component
// ============================================================

interface DealCardProps {
  deal: DashboardDeal;
  isSelected: boolean;
  onClick: () => void;
  onDoubleClick: () => void;
}

export const DealCard = ({ deal, isSelected, onClick, onDoubleClick }: DealCardProps) => {
  const [thumbFailed, setThumbFailed] = useState(false);
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const showThumb = apiKey && deal.address && !thumbFailed;

  return (
    <div
      id={`deal-card-${deal.id}`}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      className={cn(
        'rounded-xl border bg-card transition-all duration-200 cursor-pointer hover:shadow-md overflow-hidden',
        isSelected
          ? 'border-l-4 border-l-primary border-t-border border-r-border border-b-border shadow-md'
          : 'border-border hover:border-border/80',
      )}
    >
      {showThumb && (
        <img
          src={`https://maps.googleapis.com/maps/api/streetview?size=400x150&location=${encodeURIComponent(deal.address)}&key=${apiKey}&fov=90&pitch=5`}
          alt=""
          className="w-full h-20 object-cover"
          loading="lazy"
          onError={() => setThumbFailed(true)}
        />
      )}
      <div className="p-3">
      <div className="flex items-start justify-between mb-2">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm text-foreground truncate">
            {deal.name || 'Untitled Property'}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {deal.submarket || '\u2014'}
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
        <span
          className={cn(
            'font-mono font-semibold',
            deal.dealValue
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-muted-foreground',
          )}
        >
          {formatDealValue(deal.dealValue)}
        </span>
      </div>

      {deal.dealScore != null && deal.dealScore > 0 && (
        <div className="flex items-center gap-2 mt-2">
          <div
            className={cn(
              'flex items-center gap-1 px-2 py-1 rounded-lg',
              getScoreBg(deal.dealScore),
            )}
          >
            <Award className="w-3 h-3" />
            <span
              className={cn(
                'text-xs font-mono font-bold',
                getScoreColor(deal.dealScore),
              )}
            >
              {Math.round(deal.dealScore)}
            </span>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};
