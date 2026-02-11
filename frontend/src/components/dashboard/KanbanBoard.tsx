/**
 * KanbanBoard - Drag-and-drop pipeline board for property management
 *
 * Features:
 * - 6 pipeline stages with drag-and-drop
 * - Property cards with key metrics
 * - Quick notes editing
 * - Optimistic UI updates
 * - Toast notifications on stage changes
 */
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
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
import { MessageSquare, Award, Shield } from 'lucide-react';
import type { PropertyListItem } from '@/types/property';

// ============================================================
// TYPES
// ============================================================

interface PipelineStage {
  id: string;
  label: string;
  color: string;
}

interface KanbanBoardProps {
  properties: PropertyListItem[];
  onStageChange: (propertyId: number, newStage: string) => Promise<void>;
  onNotesUpdate: (propertyId: number, notes: string) => Promise<void>;
  mounted: boolean;
}

// ============================================================
// CONSTANTS
// ============================================================

const PIPELINE_STAGES: PipelineStage[] = [
  { id: 'screening', label: 'Screening', color: '#A78BFA' },  // purple
  { id: 'under_review', label: 'Under Review', color: '#60A5FA' },  // blue
  { id: 'loi', label: 'LOI', color: '#FBBF24' },  // yellow
  { id: 'under_contract', label: 'Under Contract', color: '#F97316' },  // orange
  { id: 'closed', label: 'Closed', color: '#10B981' },  // green
  { id: 'passed', label: 'Passed', color: '#94A3B8' },  // gray
];

// ============================================================
// HELPERS
// ============================================================

const formatPrice = (num: number | null | undefined): string => {
  if (!num) return '—';
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `$${(num / 1_000).toFixed(0)}K`;
  return `$${num}`;
};

// ============================================================
// DRAGGABLE CARD COMPONENT
// ============================================================

interface DraggableCardProps {
  property: PropertyListItem;
  onNotesUpdate: (propertyId: number, notes: string) => Promise<void>;
  onClick: (id: number) => void;
}

const DraggableCard = ({ property, onNotesUpdate, onClick }: DraggableCardProps) => {
  const [showNotesInput, setShowNotesInput] = useState(false);
  const [notesValue, setNotesValue] = useState(property.pipeline_notes || '');
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: property.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleSaveNotes = async () => {
    if (notesValue === (property.pipeline_notes || '')) {
      setShowNotesInput(false);
      return;
    }

    setIsSavingNotes(true);
    try {
      await onNotesUpdate(property.id, notesValue);
      setShowNotesInput(false);
      toast.success('Notes updated');
    } catch (error) {
      toast.error('Failed to update notes');
      console.error('Failed to update notes:', error);
    } finally {
      setIsSavingNotes(false);
    }
  };

  const dealScore = property.screening_score || 0;
  const verdict = property.screening_verdict;

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <div
        className={cn(
          'rounded-xl p-3 border border-border bg-muted transition-all duration-200 hover:scale-[1.02] hover:shadow-md',
          isDragging && 'opacity-50 scale-105 shadow-lg',
        )}
      >
        {/* Draggable handle and card content */}
        <div
          {...listeners}
          className="cursor-grab active:cursor-grabbing"
          onClick={(e) => {
            // Only navigate if not clicking on the notes icon
            if (!(e.target as HTMLElement).closest('.notes-icon')) {
              onClick(property.id);
            }
          }}
        >
          <div className="flex items-start justify-between mb-2">
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm text-foreground truncate">
                {property.deal_name}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {property.submarket || property.property_address || '—'}
              </p>
            </div>
            {property.document_type && (
              <span className="text-[10px] font-mono font-bold px-2 py-1 rounded-lg bg-primary/10 text-primary shrink-0 ml-2">
                {property.document_type}
              </span>
            )}
          </div>

          <div className="flex items-center justify-between text-xs mb-2">
            <span className="text-muted-foreground">
              {property.total_units && property.total_units > 0 ? `${property.total_units} units` : '—'}
            </span>
            <span className={cn(
              "font-mono font-semibold",
              (property.t12_noi || property.y1_noi) ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
            )}>
              {property.t12_noi ? formatPrice(property.t12_noi) : property.y1_noi ? formatPrice(property.y1_noi) : 'No Pricing'}
            </span>
          </div>

          {/* Deal score and verdict badges */}
          <div className="flex items-center gap-2 mb-2">
            {dealScore > 0 && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-primary/10">
                <Award className="w-3 h-3 text-primary" />
                <span className="text-xs font-mono font-bold text-primary">{dealScore}</span>
              </div>
            )}
            {verdict && (
              <div className={cn(
                "flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold",
                verdict === 'PASS' && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                verdict === 'REVIEW' && "bg-amber-500/10 text-amber-600 dark:text-amber-400",
                verdict === 'FAIL' && "bg-rose-500/10 text-rose-600 dark:text-rose-400"
              )}>
                <Shield className="w-3 h-3" />
                <span>{verdict}</span>
              </div>
            )}
          </div>
        </div>

        {/* Notes section */}
        <div className="border-t border-border pt-2 mt-2">
          {!showNotesInput ? (
            <div className="flex items-center justify-between">
              {property.pipeline_notes ? (
                <p className="text-xs text-muted-foreground truncate flex-1">
                  {property.pipeline_notes.length > 50
                    ? `${property.pipeline_notes.slice(0, 50)}...`
                    : property.pipeline_notes}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground/60 italic">No notes</p>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowNotesInput(true);
                }}
                className="notes-icon ml-2 p-1 rounded hover:bg-muted-foreground/10 transition-colors"
              >
                <MessageSquare className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
              </button>
            </div>
          ) : (
            <div onClick={(e) => e.stopPropagation()}>
              <input
                type="text"
                value={notesValue}
                onChange={(e) => setNotesValue(e.target.value)}
                onBlur={handleSaveNotes}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSaveNotes();
                  } else if (e.key === 'Escape') {
                    setNotesValue(property.pipeline_notes || '');
                    setShowNotesInput(false);
                  }
                }}
                disabled={isSavingNotes}
                placeholder="Add notes..."
                autoFocus
                className="w-full px-2 py-1 text-xs rounded border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================
// MAIN KANBAN BOARD COMPONENT
// ============================================================

export const KanbanBoard = ({ properties, onStageChange, onNotesUpdate, mounted }: KanbanBoardProps) => {
  const navigate = useNavigate();
  const [activeId, setActiveId] = useState<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement required before drag starts
      },
    })
  );

  // Group properties by stage
  const propertiesByStage = useMemo(() => {
    const grouped: Record<string, PropertyListItem[]> = {};
    PIPELINE_STAGES.forEach(stage => {
      grouped[stage.id] = properties.filter(p => (p.pipeline_stage || 'screening') === stage.id);
    });
    return grouped;
  }, [properties]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as number);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over) {
      setActiveId(null);
      return;
    }

    const propertyId = active.id as number;
    const newStageId = over.id as string;

    // Find the property that was dragged
    const property = properties.find(p => p.id === propertyId);
    if (!property) {
      setActiveId(null);
      return;
    }

    const currentStage = property.pipeline_stage || 'screening';

    if (newStageId !== currentStage) {
      const newStage = PIPELINE_STAGES.find(s => s.id === newStageId);
      if (newStage) {
        try {
          await onStageChange(propertyId, newStageId);
          toast.success(`${property.deal_name} moved to ${newStage.label}`);
        } catch (error) {
          toast.error('Failed to update stage');
          console.error('Failed to update stage:', error);
        }
      }
    }

    setActiveId(null);
  };

  const handleCardClick = (id: number) => {
    navigate(`/library/${id}`);
  };

  const activeProperty = activeId ? properties.find(p => p.id === activeId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: 400 }}>
        {PIPELINE_STAGES.map((stage, stageIndex) => {
          const stageProperties = propertiesByStage[stage.id] || [];
          const stageNOI = stageProperties.reduce((sum, p) => sum + (p.t12_noi || p.y1_noi || 0), 0);

          return (
            <SortableContext
              key={stage.id}
              id={stage.id}
              items={stageProperties.map(p => p.id)}
              strategy={verticalListSortingStrategy}
            >
              <div
                className={cn(
                  'flex-shrink-0 w-72 border border-border rounded-2xl bg-card overflow-hidden transition-all duration-500',
                  mounted ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-5',
                )}
                style={{ transitionDelay: `${300 + stageIndex * 100}ms` }}
              >
                {/* Stage Header */}
                <div
                  className="px-4 py-3 flex items-center justify-between border-b-2"
                  style={{ borderBottomColor: stage.color }}
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
                      {stageProperties.length}
                    </span>
                  </div>
                  <span className="text-xs font-mono text-muted-foreground">
                    {formatPrice(stageNOI)}
                  </span>
                </div>

                {/* Stage Cards */}
                <div className="p-3 space-y-3 min-h-[300px]">
                  {stageProperties.length > 0 ? (
                    stageProperties.map((property) => (
                      <DraggableCard
                        key={property.id}
                        property={property}
                        onNotesUpdate={onNotesUpdate}
                        onClick={handleCardClick}
                      />
                    ))
                  ) : (
                    <div className="h-32 rounded-xl border-2 border-dashed border-border flex items-center justify-center">
                      <span className="text-xs text-muted-foreground">
                        Drag deals here
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </SortableContext>
          );
        })}
      </div>

      {/* Drag Overlay */}
      <DragOverlay>
        {activeProperty ? (
          <div className="rounded-xl p-3 border border-border bg-muted shadow-lg scale-105">
            <div className="flex items-start justify-between mb-2">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-sm text-foreground truncate">
                  {activeProperty.deal_name}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {activeProperty.submarket || activeProperty.property_address || '—'}
                </p>
              </div>
              {activeProperty.document_type && (
                <span className="text-[10px] font-mono font-bold px-2 py-1 rounded-lg bg-primary/10 text-primary shrink-0 ml-2">
                  {activeProperty.document_type}
                </span>
              )}
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                {activeProperty.total_units && activeProperty.total_units > 0 ? `${activeProperty.total_units} units` : '—'}
              </span>
              <span className={cn(
                "font-mono font-semibold",
                (activeProperty.t12_noi || activeProperty.y1_noi) ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
              )}>
                {activeProperty.t12_noi ? formatPrice(activeProperty.t12_noi) : activeProperty.y1_noi ? formatPrice(activeProperty.y1_noi) : 'No Pricing'}
              </span>
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};
