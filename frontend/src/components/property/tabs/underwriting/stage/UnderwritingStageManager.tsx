import { useEffect } from 'react';
import { cn } from '@/lib/utils';
import type { PropertyDetail } from '@/types/property';
import type { UWInputs, UWOutputs } from '@/types/underwriting';
import type { UWAction } from '../types';
import { useUnderwritingStageStore } from '@/store/underwritingStageStore';
import { StageSidebar } from './StageSidebar';
import { StageCanvas } from './StageCanvas';

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

  useEffect(() => {
    reset();
  }, [property.id, reset]);

  const showT12Mapping = property.financial_data_source === 't12_excel';

  return (
    <div className="flex flex-col h-full min-h-[600px]">
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
            className="px-2 py-1.5 rounded-lg text-xs bg-white/[0.04] border border-white/10 text-white focus:outline-none focus:border-white/20"
            aria-label="Export scenario"
          >
            <option value="premium">Premium</option>
            <option value="market">Market</option>
          </select>
          <button
            onClick={onExport}
            disabled={isExporting || !outputs}
            className={cn(
              'px-4 py-1.5 rounded-lg text-xs font-medium transition-colors border',
              !isExporting && outputs
                ? 'border-white/20 text-white hover:bg-white/[0.04]'
                : 'border-white/[0.04] text-muted-foreground cursor-not-allowed',
            )}
          >
            {isExporting ? 'Exporting…' : 'Export to Excel'}
          </button>
          <button
            onClick={onSave}
            disabled={!hasUnsavedChanges}
            className={cn(
              'px-4 py-1.5 rounded-lg text-xs font-medium transition-colors border',
              hasUnsavedChanges
                ? 'border-white/20 text-white hover:bg-white/[0.04]'
                : 'border-white/[0.04] text-muted-foreground cursor-not-allowed',
            )}
          >
            Save
          </button>
          <button
            type="button"
            disabled
            aria-label="Toggle split view"
            title="Split view coming soon"
            className="px-3 py-1.5 rounded-lg text-xs font-medium border border-white/[0.04] text-muted-foreground cursor-not-allowed"
          >
            Split
          </button>
        </div>
      </div>

      {/* Main area */}
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
    </div>
  );
}
