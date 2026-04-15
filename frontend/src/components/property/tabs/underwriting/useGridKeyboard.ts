/**
 * useGridKeyboard — Excel-style keyboard navigation for the Proforma grid.
 *
 * Manages a 2D focus coordinate system. Handles Tab, Shift+Tab, Enter,
 * Escape, Arrow keys, F2 (edit entry), and Delete (remove override).
 */

import { useCallback, useRef, useState } from 'react';

export interface GridCoord {
  row: number;
  col: number;
}

interface UseGridKeyboardOptions {
  /** Total row count */
  rowCount: number;
  /** Total column count (including label + growth + T12 + year columns) */
  colCount: number;
  /** Check if a cell at (row, col) is editable/overridable (i.e. can receive focus for editing) */
  isCellNavigable: (row: number, col: number) => boolean;
  /** Called when a cell should enter edit mode */
  onStartEdit: (coord: GridCoord) => void;
  /** Called when the current edit should be committed and focus moved */
  onCommitEdit: () => void;
  /** Called when the current edit should be cancelled */
  onCancelEdit: () => void;
  /** Called when Delete is pressed on an overridden cell */
  onDeleteOverride: (coord: GridCoord) => void;
  /** Whether a cell is currently being edited */
  isEditing: boolean;
}

export function useGridKeyboard(options: UseGridKeyboardOptions) {
  const {
    rowCount,
    colCount,
    isCellNavigable,
    onStartEdit,
    onCommitEdit,
    onCancelEdit,
    onDeleteOverride,
    isEditing,
  } = options;

  const [focused, setFocused] = useState<GridCoord | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const findNextNavigable = useCallback(
    (startRow: number, startCol: number, direction: 'forward' | 'backward'): GridCoord | null => {
      const delta = direction === 'forward' ? 1 : -1;
      let r = startRow;
      let c = startCol + delta;

      for (let steps = 0; steps < rowCount * colCount; steps++) {
        if (c >= colCount) {
          c = 0;
          r++;
        } else if (c < 0) {
          c = colCount - 1;
          r--;
        }
        if (r >= rowCount) r = 0;
        if (r < 0) r = rowCount - 1;

        if (isCellNavigable(r, c)) {
          return { row: r, col: c };
        }
        c += delta;
      }
      return null;
    },
    [rowCount, colCount, isCellNavigable],
  );

  const findNextInColumn = useCallback(
    (startRow: number, col: number, direction: 'down' | 'up'): GridCoord | null => {
      const delta = direction === 'down' ? 1 : -1;
      let r = startRow + delta;

      for (let steps = 0; steps < rowCount; steps++) {
        if (r >= rowCount) r = 0;
        if (r < 0) r = rowCount - 1;

        if (isCellNavigable(r, col)) {
          return { row: r, col };
        }
        r += delta;
      }
      return null;
    },
    [rowCount, isCellNavigable],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!focused) return;

      const { row, col } = focused;

      switch (e.key) {
        case 'Tab': {
          e.preventDefault();
          if (isEditing) onCommitEdit();
          const next = findNextNavigable(row, col, e.shiftKey ? 'backward' : 'forward');
          if (next) setFocused(next);
          break;
        }

        case 'Enter': {
          e.preventDefault();
          if (isEditing) {
            onCommitEdit();
            const next = findNextInColumn(row, col, 'down');
            if (next) setFocused(next);
          } else {
            onStartEdit({ row, col });
          }
          break;
        }

        case 'Escape': {
          e.preventDefault();
          if (isEditing) {
            onCancelEdit();
          } else {
            setFocused(null);
          }
          break;
        }

        case 'F2': {
          e.preventDefault();
          if (!isEditing) {
            onStartEdit({ row, col });
          }
          break;
        }

        case 'Delete':
        case 'Backspace': {
          if (!isEditing) {
            e.preventDefault();
            onDeleteOverride({ row, col });
          }
          break;
        }

        case 'ArrowUp': {
          if (!isEditing) {
            e.preventDefault();
            const next = findNextInColumn(row, col, 'up');
            if (next) setFocused(next);
          }
          break;
        }

        case 'ArrowDown': {
          if (!isEditing) {
            e.preventDefault();
            const next = findNextInColumn(row, col, 'down');
            if (next) setFocused(next);
          }
          break;
        }

        case 'ArrowLeft': {
          if (!isEditing) {
            e.preventDefault();
            const next = findNextNavigable(row, col, 'backward');
            if (next) setFocused(next);
          }
          break;
        }

        case 'ArrowRight': {
          if (!isEditing) {
            e.preventDefault();
            const next = findNextNavigable(row, col, 'forward');
            if (next) setFocused(next);
          }
          break;
        }

        default: {
          // Start typing to enter edit mode (printable character)
          if (
            !isEditing &&
            e.key.length === 1 &&
            !e.ctrlKey &&
            !e.metaKey &&
            !e.altKey
          ) {
            onStartEdit({ row, col });
            // Don't prevent default — let the character propagate to the input
          }
          break;
        }
      }
    },
    [
      focused,
      isEditing,
      onStartEdit,
      onCommitEdit,
      onCancelEdit,
      onDeleteOverride,
      findNextNavigable,
      findNextInColumn,
    ],
  );

  const focusCell = useCallback((coord: GridCoord) => {
    setFocused(coord);
  }, []);

  return {
    focused,
    setFocused: focusCell,
    handleKeyDown,
    gridRef,
  };
}
