/**
 * KanbanBoard — Drag-and-drop pipeline board for the redesigned dashboard
 *
 * Features:
 * - Configurable stages via presets
 * - Deal cards with score ring, price, doc type badge
 * - Drag between columns (client-side state)
 * - Click card → sets selectedDealId (syncs with map)
 * - Empty column placeholder
 */
import { useState, useMemo } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  useSensor,
  useSensors,
  PointerSensor,
  closestCorners,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import type { DashboardDeal } from '@/components/dashboard/DealCard';
import type { PipelineStage } from '@/components/dashboard/PresetDropdown';

// ============================================================
// Types
// ============================================================

interface KanbanBoardProps {
  deals: DashboardDeal[];
  stages: PipelineStage[];
  stageMap: Record<number, string>;
  onStageChange: (dealId: number, newStageId: string) => void;
  onCardClick: (dealId: number) => void;
  selectedDealId: number | null;
  mounted: boolean;
}

// ============================================================
// Helpers
// ============================================================

const formatDollarCompact = (num: number): string => {
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `$${(num / 1_000).toFixed(0)}K`;
  return `$${num}`;
};

const SCORE_COLORS = {
  high: '#10B981',
  medium: '#F59E0B',
  low: '#EF4444',
} as const;

// ============================================================
// Score Ring
// ============================================================

const ScoreRing: React.FC<{ score: number; size?: number }> = ({ score, size = 30 }) => {
  const radius = (size - 4) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(100, Math.max(0, score)) / 100;
  const offset = circumference * (1 - pct);
  const color = score >= 80 ? SCORE_COLORS.high : score >= 60 ? SCORE_COLORS.medium : SCORE_COLORS.low;

  return (
    <svg width={size} height={size} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={2} className="text-border" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={2.5}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="central" fill={color} fontSize={size * 0.32} fontWeight="bold" fontFamily="JetBrains Mono, monospace">
        {Math.round(score)}
      </text>
    </svg>
  );
};

// ============================================================
// Draggable Deal Card
// ============================================================

interface DraggableCardProps {
  deal: DashboardDeal;
  isSelected: boolean;
  onClick: () => void;
}

const DraggableCard: React.FC<DraggableCardProps> = ({ deal, isSelected, onClick }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: deal.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <div
        {...listeners}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        className={cn(
          'rounded-xl p-3 border bg-muted/50 cursor-grab active:cursor-grabbing transition-all duration-200 hover:shadow-md',
          isDragging && 'opacity-50 scale-105 shadow-lg',
          isSelected ? 'border-primary ring-1 ring-primary/30' : 'border-border/60',
        )}
      >
        {/* Row 1: Name + submarket/units */}
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm text-foreground truncate">{deal.name || 'Untitled'}</p>
            <p className="font-mono text-2xs text-muted-foreground truncate">
              {deal.submarket || '\u2014'} &middot; {deal.units > 0 ? `${deal.units} units` : '\u2014'}
            </p>
          </div>
          {deal.dealScore != null && <ScoreRing score={deal.dealScore} size={30} />}
        </div>

        {/* Row 2: Price + doc type */}
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs font-bold text-foreground">
            {deal.dealValue ? formatDollarCompact(deal.dealValue) : '\u2014'}
          </span>
          {deal.documentType && (
            <span
              className={cn(
                'text-2xs font-mono font-bold px-1.5 py-0.5 rounded',
                deal.documentType === 'OM' ? 'bg-primary/10 text-primary' : 'bg-blue-500/10 text-blue-400',
              )}
            >
              {deal.documentType}
            </span>
          )}
        </div>

        {/* Row 3: NOI + Cap Rate (if available) */}
        {(deal.noi != null || deal.capRate != null) && (
          <div className="flex items-center gap-2 mt-1.5 font-mono text-2xs text-muted-foreground/70">
            {deal.noi != null && <span>NOI: {formatDollarCompact(deal.noi)}</span>}
            {deal.capRate != null && <span>Cap: {deal.capRate.toFixed(2)}%</span>}
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================
// Static card for drag overlay
// ============================================================

const StaticCard: React.FC<{ deal: DashboardDeal }> = ({ deal }) => (
  <div className="rounded-xl p-3 border border-primary bg-muted shadow-lg scale-105 w-[180px]">
    <p className="font-semibold text-sm text-foreground truncate">{deal.name || 'Untitled'}</p>
    <p className="font-mono text-2xs text-muted-foreground truncate">
      {deal.submarket || '\u2014'} &middot; {deal.units > 0 ? `${deal.units} units` : ''}
    </p>
    <span className="font-mono text-xs font-bold text-foreground mt-1 block">
      {deal.dealValue ? formatDollarCompact(deal.dealValue) : '\u2014'}
    </span>
  </div>
);

// ============================================================
// Main KanbanBoard
// ============================================================

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  deals,
  stages,
  stageMap,
  onStageChange,
  onCardClick,
  selectedDealId,
  mounted,
}) => {
  const [activeId, setActiveId] = useState<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  // Group deals by stage
  const dealsByStage = useMemo(() => {
    const grouped: Record<string, DashboardDeal[]> = {};
    stages.forEach((s) => {
      grouped[s.id] = [];
    });
    deals.forEach((d) => {
      const stageId = stageMap[d.id] || stages[0]?.id || 'screening';
      if (grouped[stageId]) {
        grouped[stageId].push(d);
      } else if (stages.length > 0) {
        grouped[stages[0].id].push(d);
      }
    });
    return grouped;
  }, [deals, stages, stageMap]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as number);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) {
      setActiveId(null);
      return;
    }

    const dealId = active.id as number;
    const targetStageId = over.id as string;
    const currentStageId = stageMap[dealId] || stages[0]?.id || 'screening';

    if (targetStageId !== currentStageId && stages.some((s) => s.id === targetStageId)) {
      onStageChange(dealId, targetStageId);
    }

    setActiveId(null);
  };

  const activeDeal = activeId != null ? deals.find((d) => d.id === activeId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-3 overflow-x-auto pb-3" style={{ minHeight: 320 }}>
        {stages.map((stage, idx) => {
          const stageDeals = dealsByStage[stage.id] || [];
          const stageVolume = stageDeals.reduce((s, d) => s + (d.dealValue ?? 0), 0);

          return (
            <SortableContext
              key={stage.id}
              id={stage.id}
              items={stageDeals.map((d) => d.id)}
              strategy={verticalListSortingStrategy}
            >
              <div
                className={cn(
                  'flex-shrink-0 rounded-2xl bg-card/50 border border-border/60 overflow-hidden transition-all duration-500',
                  mounted ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-5',
                )}
                style={{ flex: '0 0 195px', transitionDelay: `${200 + idx * 80}ms` }}
              >
                {/* Column Header */}
                <div className="px-3 py-2.5 border-b-2" style={{ borderBottomColor: stage.color }}>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: stage.color }} />
                    <span className="text-xs font-semibold text-foreground truncate">{stage.label}</span>
                    <span className="text-2xs px-1.5 py-0.5 rounded-full font-mono bg-muted text-muted-foreground ml-auto">
                      {stageDeals.length}
                    </span>
                  </div>
                  <p className="font-mono text-2xs text-muted-foreground/60">
                    {stageVolume > 0 ? formatDollarCompact(stageVolume) : '\u2014'}
                  </p>
                </div>

                {/* Cards */}
                <div className="p-2 space-y-2 max-h-[420px] overflow-y-auto">
                  {stageDeals.length > 0 ? (
                    stageDeals.map((deal) => (
                      <DraggableCard
                        key={deal.id}
                        deal={deal}
                        isSelected={selectedDealId === deal.id}
                        onClick={() => onCardClick(deal.id)}
                      />
                    ))
                  ) : (
                    <div className="h-24 rounded-xl border-2 border-dashed border-border/40 flex items-center justify-center">
                      <span className="text-2xs text-muted-foreground/50">Drop deals here</span>
                    </div>
                  )}
                </div>
              </div>
            </SortableContext>
          );
        })}
      </div>

      <DragOverlay>
        {activeDeal ? <StaticCard deal={activeDeal} /> : null}
      </DragOverlay>
    </DndContext>
  );
};
