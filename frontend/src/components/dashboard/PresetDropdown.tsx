/**
 * PresetDropdown — Pipeline preset selector for kanban board
 *
 * Three presets: Acquisitions, Dispositions, Broker
 * Each shows a preview of its stage chips.
 * Active preset persisted to localStorage.
 */
import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================
// Types
// ============================================================

export interface PipelineStage {
  id: string;
  label: string;
  color: string;
}

export interface PipelinePreset {
  id: string;
  name: string;
  stages: PipelineStage[];
}

interface PresetDropdownProps {
  presets: PipelinePreset[];
  activePresetId: string;
  onPresetChange: (presetId: string) => void;
}

// ============================================================
// Component
// ============================================================

export const PresetDropdown: React.FC<PresetDropdownProps> = ({
  presets,
  activePresetId,
  onPresetChange,
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const activePreset = presets.find((p) => p.id === activePresetId) ?? presets[0];

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative inline-block" ref={ref}>
      {/* Trigger */}
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
      >
        {activePreset.name}
        <ChevronDown className={cn('w-3 h-3 transition-transform', open && 'rotate-180')} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full mt-2 left-0 z-50 w-72 rounded-xl border border-border bg-card shadow-xl overflow-hidden animate-fade-in">
          {presets.map((preset) => {
            const isActive = preset.id === activePresetId;
            return (
              <button
                key={preset.id}
                onClick={() => {
                  onPresetChange(preset.id);
                  setOpen(false);
                }}
                className={cn(
                  'w-full px-4 py-3 text-left transition-colors hover:bg-muted/50',
                  isActive && 'bg-primary/5',
                )}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className={cn('text-sm font-semibold', isActive ? 'text-primary' : 'text-foreground')}>
                    {preset.name}
                  </span>
                  {isActive && (
                    <span className="flex items-center gap-1 text-2xs font-mono text-primary">
                      <Check className="w-3 h-3" />
                      Active
                    </span>
                  )}
                </div>
                {/* Stage chip preview */}
                <div className="flex flex-wrap gap-1">
                  {preset.stages.map((stage) => (
                    <span
                      key={stage.id}
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-2xs font-mono"
                      style={{
                        backgroundColor: `${stage.color}15`,
                        color: stage.color,
                      }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: stage.color }} />
                      {stage.label}
                    </span>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ============================================================
// Preset Definitions
// ============================================================

export const PIPELINE_PRESETS: PipelinePreset[] = [
  {
    id: 'acquisitions',
    name: 'Acquisitions',
    stages: [
      { id: 'screening', label: 'Screening', color: '#A78BFA' },
      { id: 'under_review', label: 'Under Review', color: '#60A5FA' },
      { id: 'loi', label: 'LOI', color: '#FBBF24' },
      { id: 'under_contract', label: 'Under Contract', color: '#F97316' },
      { id: 'closed', label: 'Closed', color: '#10B981' },
    ],
  },
  {
    id: 'dispositions',
    name: 'Dispositions',
    stages: [
      { id: 'prep', label: 'Prep', color: '#A78BFA' },
      { id: 'listed', label: 'Listed', color: '#60A5FA' },
      { id: 'offers', label: 'Offers', color: '#FBBF24' },
      { id: 'under_contract', label: 'Under Contract', color: '#F97316' },
      { id: 'sold', label: 'Sold', color: '#10B981' },
    ],
  },
  {
    id: 'broker',
    name: 'Broker',
    stages: [
      { id: 'lead', label: 'Lead', color: '#94A3B8' },
      { id: 'pitch', label: 'Pitch', color: '#A78BFA' },
      { id: 'listing', label: 'Listing', color: '#60A5FA' },
      { id: 'marketing', label: 'Marketing', color: '#FBBF24' },
      { id: 'offers', label: 'Offers', color: '#F97316' },
      { id: 'closed', label: 'Closed', color: '#10B981' },
    ],
  },
];

export const STORAGE_KEY = 'astra_pipeline_preset';
