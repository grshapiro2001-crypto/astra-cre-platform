/**
 * OverridePopover — shows formula description, computed value, and
 * override controls for a computed cell in the Proforma grid.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { Popover, PopoverContent, PopoverAnchor } from '@/components/ui/popover';
import { formatCurrencyAccounting, parseRawNumber } from './uwFormatters';
import { cn } from '@/lib/utils';

interface OverridePopoverProps {
  /** Whether the popover is open */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Anchor element (the cell) */
  children: React.ReactNode;
  /** The engine-computed value (before override) */
  computedValue: number;
  /** Current override value, if any */
  overrideValue: number | null;
  /** Human-readable formula for this cell */
  formulaDesc: string;
  /** Line item label */
  label: string;
  /** Called when user applies an override */
  onApplyOverride: (value: number) => void;
  /** Called when user removes an override */
  onRemoveOverride: () => void;
}

export function OverridePopover({
  open,
  onOpenChange,
  children,
  computedValue,
  overrideValue,
  formulaDesc,
  label,
  onApplyOverride,
  onRemoveOverride,
}: OverridePopoverProps) {
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const isOverridden = overrideValue != null;

  useEffect(() => {
    if (open) {
      setEditValue(
        isOverridden ? String(overrideValue) : String(Math.round(computedValue)),
      );
      setTimeout(() => inputRef.current?.select(), 50);
    }
  }, [open, isOverridden, overrideValue, computedValue]);

  const handleApply = useCallback(() => {
    const parsed = parseRawNumber(editValue);
    if (parsed != null) {
      onApplyOverride(parsed);
      onOpenChange(false);
    }
  }, [editValue, onApplyOverride, onOpenChange]);

  const handleRemove = useCallback(() => {
    onRemoveOverride();
    onOpenChange(false);
  }, [onRemoveOverride, onOpenChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleApply();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onOpenChange(false);
      }
      e.stopPropagation();
    },
    [handleApply, onOpenChange],
  );

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverAnchor asChild>{children}</PopoverAnchor>
      <PopoverContent
        side="bottom"
        align="start"
        sideOffset={6}
        className="w-72"
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div className="space-y-3">
          {/* Header */}
          <div>
            <p className="text-[11px] font-medium text-foreground">{label}</p>
            <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
              = {formulaDesc}
            </p>
          </div>

          {/* Computed value */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Computed
            </span>
            <span className="text-xs font-mono text-muted-foreground">
              {formatCurrencyAccounting(computedValue)}
            </span>
          </div>

          {/* Override indicator */}
          {isOverridden && (
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-[#eeecea]/70">
                Overridden
              </span>
              <span className="text-xs font-mono text-[#eeecea]">
                {formatCurrencyAccounting(overrideValue)}
              </span>
            </div>
          )}

          {/* Divider */}
          <div className="border-t border-white/[0.06]" />

          {/* Override input */}
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {isOverridden ? 'Update Override' : 'Set Override'}
            </label>
            <input
              ref={inputRef}
              type="text"
              inputMode="decimal"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className={cn(
                'w-full px-3 py-1.5 rounded-lg text-sm font-mono',
                'bg-white/[0.05] border border-white/[0.08]',
                'text-foreground placeholder:text-muted-foreground',
                'focus:outline-none focus:border-[#eeecea]/20',
              )}
              placeholder="$0"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleApply}
              className={cn(
                'flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                'bg-white/[0.08] text-foreground hover:bg-white/[0.12]',
                'border border-white/[0.06]',
              )}
            >
              {isOverridden ? 'Update' : 'Override'}
            </button>
            {isOverridden && (
              <button
                onClick={handleRemove}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                  'text-red-400/80 hover:bg-red-500/10',
                  'border border-white/[0.04]',
                )}
              >
                Remove
              </button>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
