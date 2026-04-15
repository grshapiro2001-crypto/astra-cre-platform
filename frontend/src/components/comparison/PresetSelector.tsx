/**
 * PresetSelector — Scoring template button group
 */
import { cn } from '@/lib/utils';
import { DEFAULT_PRESETS } from './constants';

interface PresetSelectorProps {
  selectedPreset: string;
  onPresetChange: (preset: string) => void;
}

export function PresetSelector({ selectedPreset, onPresetChange }: PresetSelectorProps) {
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          Scoring Template
        </h2>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {Object.entries(DEFAULT_PRESETS).map(([key, preset]) => (
          <button
            key={key}
            onClick={() => onPresetChange(key)}
            className={cn(
              'px-4 py-2.5 rounded-xl text-sm font-medium transition-all border',
              selectedPreset === key
                ? 'bg-white/10 border-white/20 text-white'
                : 'bg-white/[0.03] border-white/5 text-zinc-500 hover:bg-white/[0.06]'
            )}
          >
            {preset.name}
          </button>
        ))}
      </div>
    </div>
  );
}
