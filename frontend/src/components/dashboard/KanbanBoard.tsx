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
import { useState, useMemo, useCallback, useRef } from 'react';
import { Search, X, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  useSensor,
  useSensors,
  PointerSensor,
  closestCorners,
  useDroppable,
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
  excellent: '#34d399',
  high: '#34d399',
  good: '#a1a1aa',
  low: '#f87171',
} as const;

// ============================================================
// Score Ring
// ============================================================

const ScoreRing: React.FC<{ score: number; size?: number }> = ({ score, size = 30 }) => {
  const radius = (size - 4) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(100, Math.max(0, score)) / 100;
  const offset = circumference * (1 - pct);
  const color = score >= 90 ? SCORE_COLORS.excellent : score >= 80 ? SCORE_COLORS.high : score >= 70 ? SCORE_COLORS.good : SCORE_COLORS.low;

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
      <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="central" fill={color} fontSize={size * 0.32} fontWeight="bold" fontFamily="Inter, system-ui, sans-serif">
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
          'deal-card cursor-grab active:cursor-grabbing',
          isDragging && 'opacity-50 scale-105 shadow-lg',
          isSelected && 'border-white/[0.12] shadow-[0_0_24px_rgba(255,255,255,0.05)]',
        )}
      >
        {/* Row 1: Name + Score Ring */}
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-[13px] text-foreground truncate leading-tight">{deal.name || 'Untitled'}</p>
          </div>
          {deal.dealScore != null && <ScoreRing score={deal.dealScore} size={30} />}
        </div>

        {/* Row 2: Submarket + Units */}
        <p className="text-[10px] text-zinc-500 mb-2">
          {deal.submarket || '\u2014'}{deal.units > 0 ? <>&ensp;&middot;&ensp;{deal.units} units</> : ''}
        </p>

        {/* Row 3: Price + NOI + Cap */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-extrabold text-foreground">
            {deal.dealValue ? formatDollarCompact(deal.dealValue) : '\u2014'}
          </span>
          <div className="flex gap-3">
            {deal.noi != null && deal.noi > 0 && (
              <div className="text-right">
                <div className="text-[8px] text-zinc-600 uppercase tracking-wider">NOI</div>
                <div className="text-[11px] text-zinc-400 font-semibold">{formatDollarCompact(deal.noi)}</div>
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

        {/* Row 4: Badges */}
        <div className="flex items-center gap-2 mt-2">
          {deal.documentType && (
            <span
              className={cn(
                'text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded',
                deal.documentType === 'BOV' ? 'bg-blue-400/[0.08] text-blue-400' : 'bg-white/[0.06] text-zinc-400',
              )}
            >
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
// Droppable column body — makes empty columns accept drops
// ============================================================

const DropZone: React.FC<{ stageId: string; children: React.ReactNode }> = ({ stageId, children }) => {
  const { setNodeRef } = useDroppable({ id: stageId });
  return (
    <div ref={setNodeRef} className="p-2 space-y-2 max-h-[420px] overflow-y-auto scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
      {children}
    </div>
  );
};

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
  const navigate = useNavigate();
  const [activeId, setActiveId] = useState<number | null>(null);
  const [overStageId, setOverStageId] = useState<string | null>(null);
  const [pipelineView, setPipelineView] = useState<'board' | 'list'>('board');
  const [listSort, setListSort] = useState('stage');
  const [collapsedStages, setCollapsedStages] = useState<Set<string>>(new Set());

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return deals.filter(d =>
      (d.name || '').toLowerCase().includes(q) ||
      (d.submarket || '').toLowerCase().includes(q) ||
      (d.propertyType || '').toLowerCase().includes(q) ||
      (d.documentType || '').toLowerCase().includes(q)
    ).slice(0, 6);
  }, [deals, searchQuery]);

  const toggleStageCollapse = useCallback((stageId: string) => {
    setCollapsedStages(prev => {
      const next = new Set(prev);
      if (next.has(stageId)) next.delete(stageId); else next.add(stageId);
      return next;
    });
  }, []);

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

  // Resolve the stage ID from an over target (may be a stage id string or a card id number)
  const resolveStageId = (overId: string | number): string | undefined => {
    if (stages.some((s) => s.id === overId)) return overId as string;
    return stageMap[overId as number];
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    const stageId = over ? (resolveStageId(over.id) ?? null) : null;
    setOverStageId((prev) => (prev === stageId ? prev : stageId));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setOverStageId(null);
    const { active, over } = event;
    if (!over) {
      setActiveId(null);
      return;
    }

    const dealId = active.id as number;
    const targetStageId = resolveStageId(over.id);
    const currentStageId = stageMap[dealId] || stages[0]?.id || 'screening';

    if (targetStageId && targetStageId !== currentStageId && stages.some((s) => s.id === targetStageId)) {
      onStageChange(dealId, targetStageId);
    }

    setActiveId(null);
  };

  const activeDeal = activeId != null ? deals.find((d) => d.id === activeId) : null;

  // Score ring for list view
  const listScoreRing = (score: number, sz = 22) => {
    const r = (sz - 4) / 2;
    const circ = 2 * Math.PI * r;
    const pct = score / 100;
    const color = score >= 80 ? '#34d399' : score >= 65 ? '#a1a1aa' : '#f87171';
    return (
      <svg width={sz} height={sz} viewBox={`0 0 ${sz} ${sz}`}>
        <circle cx={sz/2} cy={sz/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1.5" />
        <circle cx={sz/2} cy={sz/2} r={r} fill="none" stroke={color} strokeWidth="1.5"
          strokeDasharray={`${pct * circ} ${circ}`} strokeLinecap="round" transform={`rotate(-90 ${sz/2} ${sz/2})`} />
        <text x={sz/2} y={sz/2 + 0.5} textAnchor="middle" dominantBaseline="central"
          fill={color} fontSize={sz * 0.36} fontWeight="800" fontFamily="Inter">{Math.round(score)}</text>
      </svg>
    );
  };

  // Sorted deals for list view
  const sortedListDeals = useMemo(() => {
    const arr = [...deals];
    switch (listSort) {
      case 'stage': return arr.sort((a, b) => {
        const ai = stages.findIndex(s => s.id === (stageMap[a.id] || stages[0]?.id));
        const bi = stages.findIndex(s => s.id === (stageMap[b.id] || stages[0]?.id));
        return ai - bi;
      });
      case 'score-desc': return arr.sort((a, b) => (b.dealScore ?? -1) - (a.dealScore ?? -1));
      case 'score-asc': return arr.sort((a, b) => (a.dealScore ?? 999) - (b.dealScore ?? 999));
      case 'price-desc': return arr.sort((a, b) => (b.dealValue ?? 0) - (a.dealValue ?? 0));
      case 'name': return arr.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      default: return arr;
    }
  }, [deals, listSort, stages, stageMap]);

  return (
    <div>
      {/* ── Toolbar: Search + View Toggle ── */}
      <div className="flex items-center gap-3 mb-3">
        {/* Search */}
        <div className="relative flex-1" ref={searchRef}>
          <div className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-xl border transition-all duration-200',
            searchOpen ? 'border-white/[0.10] bg-white/[0.03]' : 'border-white/[0.04] bg-white/[0.015]',
          )}>
            <Search className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setSearchOpen(true); }}
              onFocus={() => setSearchOpen(true)}
              placeholder="Search deals..."
              className="flex-1 bg-transparent border-none outline-none text-xs text-foreground placeholder:text-zinc-600"
            />
            {searchQuery && (
              <button onClick={() => { setSearchQuery(''); setSearchOpen(false); }} className="p-0.5 rounded text-zinc-600 hover:text-zinc-300 transition-colors">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          {/* Search Dropdown */}
          {searchOpen && searchQuery.trim() && (
            <div className="absolute top-full left-0 right-0 mt-1 z-50 liquid-glass rounded-xl overflow-hidden shadow-2xl max-h-[280px] overflow-y-auto scrollbar-hide">
              {searchResults.length === 0 ? (
                <div className="px-4 py-6 text-center text-xs text-zinc-600">No deals match "{searchQuery}"</div>
              ) : (
                searchResults.map((deal) => {
                  const stageId = stageMap[deal.id] || stages[0]?.id;
                  const stage = stages.find(s => s.id === stageId);
                  return (
                    <div
                      key={deal.id}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.04] cursor-pointer transition-all border-b border-white/[0.03] last:border-b-0"
                      onClick={() => { onCardClick(deal.id); setSearchQuery(''); setSearchOpen(false); navigate(`/library/${deal.id}`); }}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-semibold text-foreground truncate">{deal.name}</p>
                        <p className="text-[10px] text-zinc-500">{deal.submarket}{deal.units > 0 ? ` · ${deal.units}u` : ''}</p>
                      </div>
                      {stage && (
                        <span className="text-[8px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0" style={{ background: `${stage.color}15`, color: stage.color }}>
                          {stage.label}
                        </span>
                      )}
                      <span className="text-[11px] font-extrabold text-foreground shrink-0">{deal.dealValue ? formatDollarCompact(deal.dealValue) : '\u2014'}</span>
                      {deal.dealScore != null && listScoreRing(deal.dealScore, 20)}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Sort (list view only) */}
        {pipelineView === 'list' && (
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[9px] text-zinc-600 uppercase tracking-wider">Sort</span>
            <select
              value={listSort}
              onChange={(e) => setListSort(e.target.value)}
              className="text-[10px] bg-white/[0.04] border border-white/[0.04] text-zinc-300 rounded-md px-2 py-1 outline-none cursor-pointer"
            >
              <option value="stage">Stage</option>
              <option value="score-desc">Score (high-low)</option>
              <option value="score-asc">Score (low-high)</option>
              <option value="price-desc">Price (high-low)</option>
              <option value="name">Name (A-Z)</option>
            </select>
          </div>
        )}

        {/* Board / List Toggle */}
        <div className="flex gap-1.5 bg-white/[0.04] rounded-lg p-0.5 shrink-0">
          <button
            onClick={() => setPipelineView('board')}
            className={cn('rounded-md px-3 py-1 text-[11px] font-semibold transition-all',
              pipelineView === 'board' ? 'bg-white text-[#060608] shadow-sm' : 'text-zinc-500 hover:text-zinc-300'
            )}
          >Board</button>
          <button
            onClick={() => setPipelineView('list')}
            className={cn('rounded-md px-3 py-1 text-[11px] font-semibold transition-all',
              pipelineView === 'list' ? 'bg-white text-[#060608] shadow-sm' : 'text-zinc-500 hover:text-zinc-300'
            )}
          >List</button>
        </div>
      </div>

      {/* ── BOARD VIEW ── */}
      {pipelineView === 'board' && (
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
          <div className="flex gap-3 overflow-x-auto pb-3 scrollbar-hide" style={{ minHeight: 320, scrollbarWidth: 'none' }}>
            {stages.map((stage, idx) => {
              const stageDeals = dealsByStage[stage.id] || [];
              const stageVolume = stageDeals.reduce((s, d) => s + (d.dealValue ?? 0), 0);
              return (
                <SortableContext key={stage.id} id={stage.id} items={stageDeals.map(d => d.id)} strategy={verticalListSortingStrategy}>
                  <div
                    className={cn(
                      'flex-shrink-0 rounded-2xl overflow-hidden transition-all duration-500',
                      overStageId === stage.id ? 'border border-primary/50' : '',
                      mounted ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-5',
                    )}
                    style={{ flex: '1 1 0', minWidth: 160, transitionDelay: `${200 + idx * 80}ms` }}
                  >
                    <div className="flex items-center justify-between px-3 py-2.5 rounded-xl" style={{ background: `${stage.color}0F`, borderBottom: `2px solid ${stage.color}4D` }}>
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: stage.color, boxShadow: `0 0 8px ${stage.color}66` }} />
                        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground">{stage.label}</span>
                      </div>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-md" style={{ color: stage.color, background: `${stage.color}1F` }}>{stageDeals.length}</span>
                    </div>
                    <div className="text-[11px] text-zinc-500 px-3 py-1 font-medium">{stageVolume > 0 ? formatDollarCompact(stageVolume) : '\u2014'}</div>
                    <DropZone stageId={stage.id}>
                      {stageDeals.length > 0 ? stageDeals.map(deal => (
                        <DraggableCard key={deal.id} deal={deal} isSelected={selectedDealId === deal.id} onClick={() => onCardClick(deal.id)} />
                      )) : (
                        <div className={cn('h-24 rounded-xl border-2 border-dashed flex items-center justify-center transition-colors duration-150', overStageId === stage.id ? 'border-primary/40 bg-primary/5' : 'border-border/40')}>
                          <span className="text-2xs text-muted-foreground/50">Drop deals here</span>
                        </div>
                      )}
                    </DropZone>
                  </div>
                </SortableContext>
              );
            })}
          </div>
          <DragOverlay>{activeDeal ? <StaticCard deal={activeDeal} /> : null}</DragOverlay>
        </DndContext>
      )}

      {/* ── LIST VIEW (Grouped Accordion) ── */}
      {pipelineView === 'list' && (
        <div className="liquid-glass rounded-2xl overflow-hidden">
          {listSort === 'stage' ? (
            // Grouped by stage
            stages.map(stage => {
              const stageDeals = (dealsByStage[stage.id] || []);
              if (stageDeals.length === 0) return null;
              const isWhite = stage.color === '#ffffff';
              const totalVol = stageDeals.reduce((s, d) => s + (d.dealValue ?? 0), 0);
              const avgScore = stageDeals.reduce((s, d) => s + (d.dealScore ?? 0), 0) / stageDeals.length;
              const isCollapsed = collapsedStages.has(stage.id);

              return (
                <div key={stage.id}>
                  {/* Stage header */}
                  <div
                    className="flex items-center gap-2.5 px-4 py-3 cursor-pointer hover:bg-white/[0.025] transition-all border-b border-white/[0.03]"
                    onClick={() => toggleStageCollapse(stage.id)}
                  >
                    <ChevronDown className={cn('w-3 h-3 text-zinc-600 transition-transform duration-200 shrink-0', isCollapsed && '-rotate-90')} />
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: stage.color, opacity: isWhite ? 0.6 : 1, boxShadow: `0 0 6px ${stage.color}40` }} />
                    <span className={cn('text-[11px] font-semibold uppercase tracking-[0.06em]', isWhite ? 'text-zinc-300' : '')} style={isWhite ? {} : { color: stage.color }}>{stage.label}</span>
                    <span className="text-[10px] text-zinc-600 ml-auto">{stageDeals.length} deal{stageDeals.length > 1 ? 's' : ''}</span>
                    <span className="text-[10px] text-zinc-500 font-semibold">{totalVol > 0 ? formatDollarCompact(totalVol) : '\u2014'}</span>
                    <span className="text-[10px] text-zinc-600">avg {Math.round(avgScore)}</span>
                  </div>
                  {/* Deal rows */}
                  <div className={cn('overflow-hidden transition-all duration-300', isCollapsed ? 'max-h-0 opacity-0' : 'max-h-[600px] opacity-100')}>
                    {stageDeals.map(deal => (
                      <div
                        key={deal.id}
                        className="grid items-center px-4 py-2.5 pl-10 border-b border-white/[0.02] hover:bg-white/[0.025] cursor-pointer transition-all"
                        style={{ gridTemplateColumns: '1.8fr 1fr 0.7fr 0.55fr 0.45fr' }}
                        onClick={() => { onCardClick(deal.id); navigate(`/library/${deal.id}`); }}
                      >
                        <div className="min-w-0">
                          <span className="text-[12px] font-semibold text-zinc-200 truncate block hover:text-white transition-colors">{deal.name}</span>
                          <span className="text-[10px] text-zinc-600">{deal.submarket}</span>
                        </div>
                        <div className="text-right text-[12px] font-extrabold text-foreground">{deal.dealValue ? formatDollarCompact(deal.dealValue) : '\u2014'}</div>
                        <div className="text-right text-[11px] font-medium text-zinc-500">{deal.capRate ? `${deal.capRate.toFixed(2)}%` : '\u2014'}</div>
                        <div className="flex justify-center">{deal.dealScore != null ? listScoreRing(deal.dealScore) : null}</div>
                        <div className="flex justify-end">
                          {deal.dealScore != null && deal.dealScore >= 80 && <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded text-emerald-400" style={{ background: 'rgba(52,211,153,0.08)' }}>Pass</span>}
                          {deal.dealScore != null && deal.dealScore >= 60 && deal.dealScore < 80 && <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded text-amber-400" style={{ background: 'rgba(251,191,36,0.08)' }}>Review</span>}
                          {deal.dealScore != null && deal.dealScore < 60 && <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded text-red-400" style={{ background: 'rgba(248,113,113,0.08)' }}>Fail</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          ) : (
            // Flat sorted list
            <>
              <div className="grid items-center px-4 py-2.5 pl-10 border-b border-white/[0.04] text-[9px] font-semibold uppercase tracking-[0.1em] text-zinc-600" style={{ gridTemplateColumns: '1.8fr 1fr 0.7fr 0.55fr 0.45fr' }}>
                <span>Deal</span><span className="text-right">Price</span><span className="text-right">Cap</span><span className="text-center">Score</span><span className="text-right">Verdict</span>
              </div>
              {(() => {
                let lastStage = '';
                return sortedListDeals.map(deal => {
                  const stageId = stageMap[deal.id] || stages[0]?.id;
                  const stage = stages.find(s => s.id === stageId);
                  const showSep = stage?.label !== lastStage;
                  lastStage = stage?.label || '';
                  return (
                    <div key={deal.id}>
                      {showSep && stage && (
                        <div className="flex items-center gap-2 px-4 py-1.5 border-b border-white/[0.03]">
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: stage.color, opacity: stage.color === '#ffffff' ? 0.5 : 1 }} />
                          <span className="text-[9px] font-semibold uppercase tracking-[0.08em] text-zinc-600">{stage.label}</span>
                        </div>
                      )}
                      <div
                        className="grid items-center px-4 py-2.5 pl-10 border-b border-white/[0.02] hover:bg-white/[0.025] cursor-pointer transition-all"
                        style={{ gridTemplateColumns: '1.8fr 1fr 0.7fr 0.55fr 0.45fr' }}
                        onClick={() => { onCardClick(deal.id); navigate(`/library/${deal.id}`); }}
                      >
                        <div className="min-w-0">
                          <span className="text-[12px] font-semibold text-zinc-200 truncate block">{deal.name}</span>
                          <span className="text-[10px] text-zinc-600">{deal.submarket}</span>
                        </div>
                        <div className="text-right text-[12px] font-extrabold text-foreground">{deal.dealValue ? formatDollarCompact(deal.dealValue) : '\u2014'}</div>
                        <div className="text-right text-[11px] font-medium text-zinc-500">{deal.capRate ? `${deal.capRate.toFixed(2)}%` : '\u2014'}</div>
                        <div className="flex justify-center">{deal.dealScore != null ? listScoreRing(deal.dealScore) : null}</div>
                        <div className="flex justify-end">
                          {deal.dealScore != null && deal.dealScore >= 80 && <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded text-emerald-400" style={{ background: 'rgba(52,211,153,0.08)' }}>Pass</span>}
                          {deal.dealScore != null && deal.dealScore >= 60 && deal.dealScore < 80 && <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded text-amber-400" style={{ background: 'rgba(251,191,36,0.08)' }}>Review</span>}
                          {deal.dealScore != null && deal.dealScore < 60 && <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded text-red-400" style={{ background: 'rgba(248,113,113,0.08)' }}>Fail</span>}
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </>
          )}
        </div>
      )}
    </div>
  );
};
