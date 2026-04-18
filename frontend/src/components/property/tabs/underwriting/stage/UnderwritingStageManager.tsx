// UnderwritingStageManager — top-level shell for the stage-manager feature.
// Owns the breadcrumb bar (save/export/split toggle), resets stage state on
// property change, and wires the sidebar + canvas under a shared LayoutGroup
// so framer-motion can fly tiles into pane positions via matching layoutIds.
import { useEffect } from 'react';
import { LayoutGroup } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { PropertyDetail } from '@/types/property';
import type { UWInputs, UWOutputs } from '@/types/underwriting';
import type { UWAction } from '../types';
import { useUnderwritingStageStore } from '@/store/underwritingStageStore';
import { StageSidebar } from './StageSidebar';
import { StageCanvas } from './StageCanvas';
import { StageAnnouncer } from './StageAnnouncer';

export interface UnderwritingStageManagerProps {
  property: PropertyDetail;
  inputs: UWInputs;
  outputs: UWOutputs | null;
  dispatch: React.Dispatch<UWAction>;
  isComputing: boolean;
  hasUnsavedChanges: boolean;
  saveStatus: string | null;
  exportScenario: 'premium' | 'market';
  onExportScenarioChange: (scenario: 'premium' | 'market') => void;
  isExporting: boolean;
  onExport: () => void;
  onSave: () => void;
}

export function UnderwritingStageManager({
  property,
  inputs,
  outputs,
  dispatch,
  isComputing,
  hasUnsavedChanges,
  saveStatus,
  exportScenario,
  onExportScenarioChange,
  isExporting,
  onExport,
  onSave,
}: UnderwritingStageManagerProps) {
  const reset = useUnderwritingStageStore((s) => s.reset);
  const activePane2 = useUnderwritingStageStore((s) => s.activePane2);
  const pickingSecond = useUnderwritingStageStore((s) => s.pickingSecond);
  const startPicker = useUnderwritingStageStore((s) => s.startPicker);
  const closeSplit = useUnderwritingStageStore((s) => s.closeSplit);
  const cancelPicker = useUnderwritingStageStore((s) => s.cancelPicker);

  const splitMode = activePane2 !== null;

  useEffect(() => {
    reset();
  }, [property.id, reset]);

  useEffect(() => {
    if (!pickingSecond) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cancelPicker();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pickingSecond, cancelPicker]);

  const showT12Mapping = property.financial_data_source === 't12_excel';

  const splitButtonLabel = splitMode
    ? 'Exit Split'
    : pickingSecond
      ? 'Pick Second Page…'
      : 'Split View';
  const splitButtonActive = splitMode || pickingSecond;

  const onSplitToggle = () => {
    if (splitMode || pickingSecond) closeSplit();
    else startPicker();
  };

  return (
    <div className="flex flex-col h-full min-h-[600px]">
      <StageAnnouncer />
      {/* Breadcrumb bar */}
      <div className="flex items-center justify-between border-b border-white/[0.04] px-4 py-2">
        <div className="text-xs text-muted-foreground font-sans tracking-wide">
          Property Detail / Underwriting
        </div>
        <div className="flex items-center gap-3">
          {saveStatus && (
            <span
              className={cn(
                'text-xs',
                saveStatus === 'Saved'
                  ? 'text-emerald-500'
                  : saveStatus === 'Save failed'
                    ? 'text-destructive'
                    : 'text-muted-foreground',
              )}
            >
              {saveStatus}
            </span>
          )}
          <select
            value={exportScenario}
            onChange={(e) =>
              onExportScenarioChange(e.target.value as 'premium' | 'market')
            }
            className="px-2 py-1.5 rounded-lg text-xs bg-white/[0.04] border border-white/10 text-white focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#060608]"
            aria-label="Export scenario"
          >
            <option value="premium">Premium</option>
            <option value="market">Market</option>
          </select>
          <button
            type="button"
            onClick={onExport}
            disabled={isExporting || !outputs}
            className={cn(
              'px-4 py-1.5 rounded-lg text-xs font-medium transition-colors border focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#060608]',
              !isExporting && outputs
                ? 'border-white/20 text-white hover:bg-white/[0.04]'
                : 'border-white/[0.04] text-muted-foreground cursor-not-allowed',
            )}
          >
            {isExporting ? 'Exporting…' : 'Export to Excel'}
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={!hasUnsavedChanges}
            className={cn(
              'px-4 py-1.5 rounded-lg text-xs font-medium transition-colors border focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#060608]',
              hasUnsavedChanges
                ? 'border-white/20 text-white hover:bg-white/[0.04]'
                : 'border-white/[0.04] text-muted-foreground cursor-not-allowed',
            )}
          >
            Save
          </button>
          <button
            type="button"
            onClick={onSplitToggle}
            aria-pressed={splitButtonActive}
            aria-label={splitButtonLabel}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors [transition-duration:180ms]',
              'focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#060608]',
              splitButtonActive
                ? 'border-white/30 bg-white/[0.08] text-white'
                : 'border-white/15 bg-white/[0.02] text-white/60 hover:bg-white/[0.04]',
            )}
          >
            {splitButtonLabel}
          </button>
        </div>
      </div>

      {/* Main area */}
      <LayoutGroup>
        <div className="flex flex-1 overflow-hidden">
          <StageSidebar showT12Mapping={showT12Mapping} />
          <StageCanvas
            property={property}
            inputs={inputs}
            outputs={outputs}
            dispatch={dispatch}
            isComputing={isComputing}
          />
        </div>
      </LayoutGroup>
    </div>
  );
}
