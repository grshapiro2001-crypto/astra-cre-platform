/**
 * PropertyPicker — Property selection UI shown when no IDs are in URL
 */
import { useNavigate } from 'react-router-dom';
import { Layers, Check, ArrowRight, Pin } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PropertyListItem } from '@/services/propertyService';
import { EM_DASH } from './constants';

interface PropertyPickerProps {
  allProperties: PropertyListItem[];
  pickerLoading: boolean;
  pickerSelected: Set<number>;
  subjectId: number | null;
  onToggle: (id: number) => void;
  onSetSubject: (id: number) => void;
  onStartComparison: () => void;
}

export function PropertyPicker({
  allProperties,
  pickerLoading,
  pickerSelected,
  subjectId,
  onToggle,
  onSetSubject,
  onStartComparison,
}: PropertyPickerProps) {
  const navigate = useNavigate();

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h2 className="font-display text-xl font-extrabold tracking-tight text-white mb-1">
          Compare Properties
        </h2>
        <p className="text-sm text-zinc-400">
          Select 2-10 deals to compare side-by-side. Click the pin to designate a subject property.
        </p>
      </div>

      {pickerLoading ? (
        <div className="py-16 text-center text-sm text-zinc-500">Loading your deals...</div>
      ) : allProperties.length === 0 ? (
        <div className="border border-dashed border-white/10 rounded-2xl p-12 text-center">
          <Layers className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
          <h3 className="text-base font-semibold text-white mb-2">No deals yet</h3>
          <p className="text-sm text-zinc-400 mb-6">Upload a deal to get started.</p>
          <button
            onClick={() => navigate('/upload')}
            className="px-5 py-2.5 rounded-xl bg-white text-black text-sm font-medium hover:bg-zinc-200 transition-colors"
          >
            Upload Deal
          </button>
        </div>
      ) : (
        <>
          <div className="space-y-2 mb-6">
            {allProperties.map((p) => {
              const isSelected = pickerSelected.has(p.id);
              const isDisabled = !isSelected && pickerSelected.size >= 10;
              const isSubject = subjectId === p.id;

              return (
                <div key={p.id} className="flex items-center gap-2">
                  <button
                    onClick={() => onToggle(p.id)}
                    disabled={isDisabled}
                    className={cn(
                      'flex-1 flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all',
                      isSelected
                        ? 'border-white/20 bg-white/[0.04]'
                        : 'border-white/5 bg-white/[0.02] hover:border-white/10',
                      isDisabled && 'opacity-40 cursor-not-allowed',
                    )}
                  >
                    <div
                      className={cn(
                        'w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors',
                        isSelected ? 'bg-white border-white' : 'border-zinc-600',
                      )}
                    >
                      {isSelected && <Check className="w-3 h-3 text-black" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-white truncate">
                        {p.property_name || p.deal_name}
                      </p>
                      <p className="text-xs text-zinc-500 truncate">
                        {p.property_address || p.submarket || p.document_type}
                      </p>
                    </div>
                    {isSubject && (
                      <span className="text-[9px] uppercase tracking-wider font-bold text-ivory px-2 py-0.5 rounded bg-white/10">
                        Subject
                      </span>
                    )}
                    {p.total_units != null && p.total_units > 0 && (
                      <span className="text-xs text-zinc-500 flex-shrink-0">
                        {p.total_units} units
                      </span>
                    )}
                  </button>
                  {isSelected && (
                    <button
                      onClick={() => onSetSubject(p.id)}
                      className={cn(
                        'p-2 rounded-lg border transition-all',
                        isSubject
                          ? 'border-ivory/30 bg-ivory/10 text-ivory'
                          : 'border-white/10 bg-white/[0.03] text-zinc-500 hover:text-white'
                      )}
                      title="Set as subject property"
                    >
                      <Pin className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm text-zinc-400">
              {pickerSelected.size === 0
                ? 'Select at least 2 deals'
                : `${pickerSelected.size} selected`}
            </p>
            <button
              onClick={onStartComparison}
              disabled={pickerSelected.size < 2}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-black text-sm font-medium hover:bg-zinc-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Compare {pickerSelected.size >= 2 ? pickerSelected.size : ''} Deals
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
