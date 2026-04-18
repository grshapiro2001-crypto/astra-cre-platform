// SplitDivider — draggable / keyboard-operable separator between the two
// panes in split mode. Writes the resulting ratio into the stage store
// (which clamps it to [0.3, 0.7]).
import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useUnderwritingStageStore } from '@/store/underwritingStageStore';

export interface SplitDividerProps {
  containerRef: React.RefObject<HTMLElement>;
}

const KEY_STEP = 0.02;

export function SplitDivider({ containerRef }: SplitDividerProps) {
  const draggingRef = useRef(false);
  const [dragging, setDragging] = useState(false);
  const splitRatio = useUnderwritingStageStore((s) => s.splitRatio);
  const setSplitRatio = useUnderwritingStageStore((s) => s.setSplitRatio);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = true;
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    if (rect.width <= 0) return;
    const ratio = (e.clientX - rect.left) / rect.width;
    setSplitRatio(ratio);
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setDragging(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setSplitRatio(splitRatio - KEY_STEP);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      setSplitRatio(splitRatio + KEY_STEP);
    } else if (e.key === 'Home') {
      e.preventDefault();
      setSplitRatio(0.3);
    } else if (e.key === 'End') {
      e.preventDefault();
      setSplitRatio(0.7);
    }
  };

  const pct = Math.round(splitRatio * 100);

  return (
    <motion.div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize split panes"
      aria-valuenow={pct}
      aria-valuemin={30}
      aria-valuemax={70}
      aria-valuetext={`${pct}% left`}
      tabIndex={0}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22, delay: 0.18 }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={onKeyDown}
      className="group relative h-full w-1 shrink-0 cursor-col-resize touch-none select-none focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#060608] rounded-sm"
    >
      <span
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-y-0 left-1/2 -translate-x-1/2 transition-colors [transition-duration:180ms]',
          dragging
            ? 'w-[1.5px] bg-white/60'
            : 'w-px bg-white/15 group-hover:bg-white/40',
        )}
      />
    </motion.div>
  );
}
