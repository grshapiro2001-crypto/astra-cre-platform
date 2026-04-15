/**
 * GridCell — Atomic cell component for the Proforma grid.
 *
 * Handles display, edit, and override states. Visual types:
 *   - Input cell: editable assumption (white bg)
 *   - Computed cell: formula-driven (transparent, muted)
 *   - Override cell: pinned computed (ivory tint + pin icon)
 *   - Total row cell: bold, subtle bg
 */

import { useCallback, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { formatCurrencyAccounting, formatPct, parseRawNumber } from './uwFormatters';

export type CellFormat = 'currency' | 'pct' | 'multiple';
export type CellType = 'computed' | 'override' | 'total' | 't12';

interface GridCellProps {
  /** The display value */
  value: number | null | undefined;
  /** The pre-override computed value (only set when overridden) */
  computedValue?: number | null;
  /** Display format */
  format: CellFormat;
  /** Cell type — determines styling */
  cellType: CellType;
  /** Whether this cell is bold (total rows) */
  bold?: boolean;
  /** Whether this cell is focused via keyboard navigation */
  isFocused: boolean;
  /** Whether this cell is currently being edited */
  isEditing: boolean;
  /** Current edit value (controlled from parent) */
  editValue: string;
  /** Called when cell is clicked */
  onClick: () => void;
  /** Called when edit value changes */
  onEditChange: (v: string) => void;
  /** Called on edit commit (blur/Enter) */
  onEditCommit: (v: number | null) => void;
  /** Called on edit cancel (Escape) */
  onEditCancel: () => void;
}

const PinIcon = () => (
  <svg
    width="10"
    height="10"
    viewBox="0 0 16 16"
    fill="none"
    className="text-[#eeecea]/50"
  >
    <path
      d="M10.5 1.5L14.5 5.5L11 9L12 14L8 10L4 14L5 9L1.5 5.5L5.5 1.5L8 4L10.5 1.5Z"
      fill="currentColor"
    />
  </svg>
);

function formatValue(v: number | null | undefined, format: CellFormat): string {
  if (v == null) return '—';
  if (format === 'pct') return formatPct(v);
  return formatCurrencyAccounting(v);
}

export function GridCell({
  value,
  format,
  cellType,
  bold,
  isFocused,
  isEditing,
  editValue,
  onClick,
  onEditChange,
  onEditCommit,
  onEditCancel,
}: GridCellProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isOverride = cellType === 'override';
  const isNegative = value != null && value < 0;

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleBlur = useCallback(() => {
    const parsed = parseRawNumber(editValue);
    onEditCommit(parsed);
  }, [editValue, onEditCommit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const parsed = parseRawNumber(editValue);
        onEditCommit(parsed);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onEditCancel();
      }
      // Stop propagation so grid keyboard handler doesn't also process these
      if (e.key === 'Enter' || e.key === 'Escape' || e.key === 'Tab') {
        // Let Tab propagate for grid navigation
        if (e.key !== 'Tab') e.stopPropagation();
      }
    },
    [editValue, onEditCommit, onEditCancel],
  );

  if (isEditing) {
    return (
      <td
        className={cn(
          'py-0 px-0 relative',
          bold && 'font-bold',
        )}
      >
        <input
          ref={inputRef}
          type="text"
          inputMode="decimal"
          value={editValue}
          onChange={(e) => onEditChange(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className={cn(
            'w-full h-full py-1.5 px-2 text-right font-mono text-xs',
            'bg-white/[0.10] border border-[#eeecea]/20 rounded',
            'text-foreground outline-none',
          )}
        />
      </td>
    );
  }

  return (
    <td
      onClick={onClick}
      className={cn(
        'py-1.5 px-2 text-right font-mono text-xs whitespace-nowrap relative transition-colors',
        // Base cell type styling
        cellType === 'computed' && 'text-[#eeecea]/60 cursor-pointer hover:bg-white/[0.03]',
        cellType === 'override' && 'bg-[#eeecea]/[0.06] text-[#eeecea] cursor-pointer hover:bg-[#eeecea]/[0.08]',
        cellType === 'total' && 'bg-white/[0.03] text-foreground',
        cellType === 't12' && 'bg-white/[0.02] text-muted-foreground',
        // Bold
        bold && 'font-semibold',
        // Negative values in red
        isNegative && 'text-red-400/70',
        // Focus ring
        isFocused && 'ring-1 ring-[#eeecea]/30 ring-inset',
      )}
    >
      {formatValue(value, format)}
      {isOverride && (
        <span className="absolute top-0.5 right-0.5">
          <PinIcon />
        </span>
      )}
    </td>
  );
}
