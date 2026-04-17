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
      aria-label={label}
      disabled={dimmedForPicker}
      className={cn(
        'relative block w-full text-left group focus:outline-none focus-visible:ring-1 focus-visible:ring-white/30 rounded-lg',
        'transition-opacity [transition-duration:220ms]',
        dimmedForPicker && 'opacity-[0.35] pointer-events-none',
      )}
    >
      {isActiveInPane1 && (
        <span
          aria-hidden
          className="absolute -left-3 top-[42px] w-[2px] h-10 -translate-y-1/2 bg-white/90 rounded-sm"
        />
      )}
      <motion.div
        layoutId={isActiveInPane1 ? `uw-pane-${pageId}` : undefined}
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
          'aspect-[120/84] rounded-lg border overflow-hidden [transition:border-color_180ms,background-color_180ms]',
          isActiveInPane1
            ? 'border-white/25 bg-white/[0.06]'
            : 'border-white/10 bg-white/[0.02] group-hover:border-white/20 group-hover:bg-white/[0.04]',
          pulsing && 'ring-2 ring-white/30',
        )}
      >
        <Thumb />
      </motion.div>
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
