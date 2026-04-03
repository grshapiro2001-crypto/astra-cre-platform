/**
 * DealCard — Compact deal card for the Dashboard deal list
 *
 * Shows: property name, submarket, units, deal value, deal score badge, document type badge
 * Single click → selects card (highlights on map)
 * Double click → navigates to PropertyDetail
 */
import { cn } from '@/lib/utils';

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
  noi?: number | null;
  capRate?: number | null;
  stage?: string;
  uploadDate?: string;
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

const getScoreStroke = (score: number): string => {
  if (score >= 80) return '#34d399';
  if (score >= 65) return '#a1a1aa';
  return '#f87171';
};

const formatNoi = (noi: number | null | undefined): string => {
  if (!noi) return '\u2014';
  if (noi >= 1_000_000) return `$${(noi / 1_000_000).toFixed(1)}M`;
  if (noi >= 1_000) return `$${(noi / 1_000).toFixed(0)}K`;
  return `$${noi}`;
};

// ============================================================
// Component
// ============================================================

interface DealCardProps {
  deal: DashboardDeal;
  isSelected: boolean;
  onClick: () => void;
  onDoubleClick?: () => void;
}

export const DealCard = ({ deal, isSelected, onClick, onDoubleClick }: DealCardProps) => {
  const scoreColor = deal.dealScore != null ? getScoreStroke(deal.dealScore) : '#71717a';
  const scorePct = deal.dealScore != null ? Math.min(100, Math.max(0, deal.dealScore)) / 100 : 0;
  const scoreCirc = 2 * Math.PI * 12;

  return (
    <div
      id={`deal-card-${deal.id}`}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      className={cn(
        'rounded-[14px] border transition-all duration-300 cursor-pointer overflow-hidden',
        'bg-black/50 backdrop-blur-2xl',
        isSelected
          ? 'border-white/[0.12] shadow-[0_0_24px_rgba(255,255,255,0.05)]'
          : 'border-white/[0.04] hover:border-white/[0.10] hover:shadow-[0_0_24px_rgba(255,255,255,0.03)] hover:-translate-y-px',
      )}
    >
      <div className="p-[14px_16px]">
        {/* Name + Score Ring */}
        <div className="flex items-start justify-between mb-1.5">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-[13px] text-foreground truncate leading-tight">
              {deal.name || 'Untitled Property'}
            </p>
          </div>
          {deal.dealScore != null && deal.dealScore > 0 && (
            <svg width="30" height="30" viewBox="0 0 30 30" className="shrink-0 ml-2">
              <circle cx="15" cy="15" r="12" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2.5" />
              <circle
                cx="15" cy="15" r="12" fill="none" stroke={scoreColor} strokeWidth="2.5"
                strokeDasharray={`${scorePct * scoreCirc} ${scoreCirc}`}
                strokeLinecap="round" transform="rotate(-90 15 15)"
              />
              <text x="15" y="15.5" textAnchor="middle" dominantBaseline="central"
                fill={scoreColor} fontSize="8.5" fontWeight="800" fontFamily="Inter">
                {Math.round(deal.dealScore)}
              </text>
            </svg>
          )}
        </div>

        {/* Submarket + Units */}
        <p className="text-[10px] text-zinc-500 mb-2">
          {deal.submarket || '\u2014'}{deal.units > 0 ? <>&ensp;&middot;&ensp;{deal.units} units</> : ''}
        </p>

        {/* Price + NOI + Cap */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-extrabold text-foreground">
            {formatDealValue(deal.dealValue)}
          </span>
          <div className="flex gap-3">
            {deal.noi != null && deal.noi > 0 && (
              <div className="text-right">
                <div className="text-[8px] text-zinc-600 uppercase tracking-wider">NOI</div>
                <div className="text-[11px] text-zinc-400 font-semibold">{formatNoi(deal.noi)}</div>
              </div>
            )}
            {deal.capRate != null && deal.capRate > 0 && (
              <div className="text-right">
                <div className="text-[8px] text-zinc-600 uppercase tracking-wider">Cap</div>
                <div className="text-[11px] text-zinc-400 font-semibold">{deal.capRate.toFixed(2)}%</div>
              </div>
            )}
          </div>
        </div>

        {/* Badges */}
        <div className="flex items-center gap-2 mt-2">
          {deal.documentType && (
            <span className={cn(
              'text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded',
              deal.documentType === 'BOV'
                ? 'bg-blue-400/[0.08] text-blue-400'
                : 'bg-white/[0.06] text-zinc-400'
            )}>
              {deal.documentType}
            </span>
          )}
          {deal.propertyType && (
            <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/[0.06] text-zinc-500">
              {deal.propertyType}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
