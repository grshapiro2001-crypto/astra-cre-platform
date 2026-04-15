/**
 * ComparisonToolbar — Sticky toolbar with view toggle, normalization, save/export actions
 */
import { useState, useEffect } from 'react';
import { ArrowLeft, Zap, Layers, Bookmark, Download, ChevronDown, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatPrice } from './constants';
import type { ViewMode, NormalizationMode } from './types';
import { savedComparisonService, type SavedComparisonResponse } from '@/services/savedComparisonService';

interface ComparisonToolbarProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  normalizationMode: NormalizationMode;
  onNormalizationChange: (mode: NormalizationMode) => void;
  propertyCount: number;
  totalValue: number;
  onSave: () => void;
  onExport: () => void;
  onBack: () => void;
  onLoadComparison?: (ids: number[], subjectId?: number) => void;
}

export function ComparisonToolbar({
  viewMode,
  onViewModeChange,
  normalizationMode,
  onNormalizationChange,
  propertyCount,
  totalValue,
  onSave,
  onExport,
  onBack,
  onLoadComparison,
}: ComparisonToolbarProps) {
  const [showSaved, setShowSaved] = useState(false);
  const [savedComparisons, setSavedComparisons] = useState<SavedComparisonResponse[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(false);

  useEffect(() => {
    if (!showSaved) return;
    let cancelled = false;
    setLoadingSaved(true);
    savedComparisonService.list()
      .then((list) => { if (!cancelled) setSavedComparisons(list); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingSaved(false); });
    return () => { cancelled = true; };
  }, [showSaved]);

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await savedComparisonService.delete(id);
      setSavedComparisons((prev) => prev.filter((c) => c.id !== id));
    } catch {
      /* ignore */
    }
  };

  const viewModes = [
    { id: 'quick' as ViewMode, label: 'Quick Analysis', Icon: Zap },
    { id: 'deep' as ViewMode, label: 'Deep Dive', Icon: Layers },
  ] as const;

  const normModes = [
    { id: 'absolute' as NormalizationMode, label: 'Absolute' },
    { id: 'per_unit' as NormalizationMode, label: 'Per Unit' },
    { id: 'per_sf' as NormalizationMode, label: 'Per SF' },
  ] as const;

  return (
    <div className="sticky top-16 z-20 glass border-b border-white/5">
      <div className="px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          {/* Left: Back + Title */}
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2.5 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-zinc-400" />
            </button>
            <div>
              <h1 className="font-display text-2xl font-extrabold tracking-tight text-white">
                Deal Comparison
              </h1>
              <p className="text-sm mt-0.5 text-zinc-400">
                <span className="font-display text-ivory">
                  {propertyCount}
                </span>{' '}
                properties{' '}
                <span className="font-display ml-1">
                  {formatPrice(totalValue)}
                </span>{' '}
                total
              </p>
            </div>
          </div>

          {/* Center: View Toggle */}
          <div className="flex items-center gap-3">
            <div className="flex items-center rounded-xl p-1.5 bg-white/[0.04] border border-white/10">
              {viewModes.map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => onViewModeChange(mode.id)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all',
                    viewMode === mode.id
                      ? 'bg-white text-black shadow-md'
                      : 'text-zinc-400 hover:text-white'
                  )}
                >
                  <mode.Icon className="w-4 h-4" />
                  {mode.label}
                </button>
              ))}
            </div>

            {/* Normalization Toggle */}
            <div className="flex items-center rounded-xl p-1 bg-white/[0.04] border border-white/10">
              {normModes.map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => onNormalizationChange(mode.id)}
                  className={cn(
                    'px-3 py-2 rounded-lg text-xs font-medium transition-all',
                    normalizationMode === mode.id
                      ? 'bg-white/10 text-white'
                      : 'text-zinc-500 hover:text-zinc-300'
                  )}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-3">
            {/* Saved Comparisons Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowSaved(!showSaved)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border border-white/10 bg-white/[0.03] text-zinc-400 hover:bg-white/[0.06] transition-colors"
              >
                <Bookmark className="w-4 h-4" />
                Saved
                <ChevronDown className={cn('w-3 h-3 transition-transform', showSaved && 'rotate-180')} />
              </button>

              {showSaved && (
                <div className="absolute right-0 top-full mt-2 w-72 rounded-xl border border-white/10 bg-[#0c0c0f] shadow-2xl z-50 overflow-hidden">
                  <div className="p-3 border-b border-white/5">
                    <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">
                      Saved Comparisons
                    </p>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {loadingSaved ? (
                      <div className="p-4 text-center text-xs text-zinc-500">Loading...</div>
                    ) : savedComparisons.length === 0 ? (
                      <div className="p-4 text-center text-xs text-zinc-500">No saved comparisons yet</div>
                    ) : (
                      savedComparisons.map((c) => (
                        <div
                          key={c.id}
                          onClick={() => {
                            onLoadComparison?.(c.property_ids, c.subject_property_id ?? undefined);
                            setShowSaved(false);
                          }}
                          className="flex items-center justify-between px-3 py-2.5 hover:bg-white/[0.04] cursor-pointer transition-colors group"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-white truncate">{c.name}</p>
                            <p className="text-[10px] text-zinc-500">{c.property_ids.length} properties</p>
                          </div>
                          <button
                            onClick={(e) => handleDelete(c.id, e)}
                            className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-white/10 transition-all"
                          >
                            <Trash2 className="w-3 h-3 text-zinc-500" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={onSave}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border border-white/10 bg-white/[0.03] text-zinc-400 hover:bg-white/[0.06] transition-colors"
            >
              <Bookmark className="w-4 h-4" />
              Save
            </button>
            <button
              onClick={onExport}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border border-white/10 bg-white/[0.03] text-zinc-400 hover:bg-white/[0.06] transition-colors"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
