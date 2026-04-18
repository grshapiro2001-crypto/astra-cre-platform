// StageTile — single tile in the sidebar stage rail. Renders the SVG thumb,
// the label row, and the active-pane rail. Handles click dispatch into the
// Zustand stage store (promote pane 1, or pick pane 2 during picker mode).
import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UWSubPage } from '@/store/underwritingStageStore';
import { useUnderwritingStageStore } from '@/store/underwritingStageStore';

export interface StageTileProps {
  pageId: UWSubPage;
  label: string;
  icon: LucideIcon;
  Thumb: React.ComponentType;
}

const EASE_OUT_QUART: [number, number, number, number] = [0.22, 1, 0.36, 1];

export function StageTile({ pageId, label, icon: Icon, Thumb }: StageTileProps) {
  const activePane1 = useUnderwritingStageStore((s) => s.activePane1);
  const activePane2 = useUnderwritingStageStore((s) => s.activePane2);
  const pickingSecond = useUnderwritingStageStore((s) => s.pickingSecond);
  const promotePane1 = useUnderwritingStageStore((s) => s.promotePane1);
  const openSplit = useUnderwritingStageStore((s) => s.openSplit);
  const cancelPicker = useUnderwritingStageStore((s) => s.cancelPicker);

  const isActiveInPane1 = activePane1 === pageId;
  const isActiveInPane2 = activePane2 === pageId;
  const isActiveInAny = isActiveInPane1 || isActiveInPane2;

  const dimmedForPicker = pickingSecond && isActiveInPane1;
  const pulsing = pickingSecond && !isActiveInPane1;

  const ariaState = isActiveInPane1
    ? 'currently active'
    : isActiveInPane2
      ? 'currently active in second pane'
      : pickingSecond
        ? 'click to open alongside'
        : 'not active';

  const handleClick = () => {
    if (pickingSecond) {
      if (pageId !== activePane1) openSplit(pageId);
      else cancelPicker();
      return;
    }
    if (pageId !== activePane1 && pageId !== activePane2) {
      promotePane1(pageId);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-current={isActiveInPane1 ? 'page' : undefined}
      aria-label={`${label}, ${ariaState}`}
      disabled={dimmedForPicker}
      className={cn(
        'relative block w-full text-left group rounded-lg',
        'focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#060608]',
        'transition-opacity [transition-duration:220ms]',
        dimmedForPicker && 'opacity-[0.35] pointer-events-none',
      )}
    >
      <div className="relative">
        {isActiveInPane1 && (
          <span
            aria-hidden
            className="absolute -left-3 top-1/2 -translate-y-1/2 w-[2px] h-10 bg-white/90 rounded-sm"
          />
        )}
        <motion.div
          layoutId={isActiveInAny ? `uw-pane-${pageId}` : undefined}
          whileHover={{ scale: isActiveInAny ? 1 : 1.035 }}
          whileTap={{ scale: 0.98 }}
          animate={
            pulsing
              ? {
                  boxShadow: [
                    '0 0 0 0 rgba(255,255,255,0.25)',
                    '0 0 0 6px rgba(255,255,255,0)',
                    '0 0 0 0 rgba(255,255,255,0.0)',
                  ],
                }
              : { boxShadow: '0 0 0 0 rgba(255,255,255,0)' }
          }
          transition={
            pulsing
              ? { duration: 1.6, repeat: Infinity, ease: 'easeOut' }
              : { duration: 0.18, ease: EASE_OUT_QUART }
          }
          className={cn(
            'relative aspect-[120/84] rounded-lg border overflow-hidden [transition:border-color_180ms,background-color_180ms]',
            isActiveInPane1
              ? 'border-white/25 bg-white/[0.06]'
              : 'border-white/10 bg-white/[0.02] group-hover:border-white/20 group-hover:bg-white/[0.04]',
            pulsing && 'ring-2 ring-white/30',
          )}
        >
          <Thumb />
          {isActiveInPane1 && (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-[30%] bg-gradient-to-b from-white/[0.08] to-transparent"
            />
          )}
        </motion.div>
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        <Icon
          className={cn(
            'h-3 w-3 transition-colors [transition-duration:180ms]',
            isActiveInPane1
              ? 'text-white/90'
              : 'text-white/45 group-hover:text-white/75',
          )}
        />
        <span
          className={cn(
            'text-[10px] font-medium uppercase tracking-[0.1em] transition-colors [transition-duration:180ms]',
            isActiveInPane1
              ? 'text-white/90'
              : 'text-white/45 group-hover:text-white/75',
          )}
        >
          {label}
        </span>
      </div>
    </button>
  );
}
