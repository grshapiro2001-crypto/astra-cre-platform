import { useRef } from 'react';
import { motion } from 'framer-motion';
import { useUnderwritingStageStore } from '@/store/underwritingStageStore';

export interface SplitDividerProps {
  containerRef: React.RefObject<HTMLElement>;
}

export function SplitDivider({ containerRef }: SplitDividerProps) {
  const dragging = useRef(false);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    if (rect.width <= 0) return;
    const ratio = (e.clientX - rect.left) / rect.width;
    useUnderwritingStageStore.getState().setSplitRatio(ratio);
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    dragging.current = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  return (
    <motion.div
      role="separator"
      aria-orientation="vertical"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22, delay: 0.18 }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      className="group relative h-full w-1 shrink-0 cursor-col-resize touch-none select-none"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-white/15 transition-colors [transition-duration:180ms] group-hover:bg-white/40"
      />
    </motion.div>
  );
}
