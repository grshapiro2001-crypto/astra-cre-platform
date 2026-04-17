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

export function StageTile({ pageId, label, icon: Icon, Thumb }: StageTileProps) {
  const activePane1 = useUnderwritingStageStore((s) => s.activePane1);
  const promotePane1 = useUnderwritingStageStore((s) => s.promotePane1);
  const isActive = activePane1 === pageId;

  return (
    <button
      type="button"
      onClick={() => {
        if (!isActive) promotePane1(pageId);
      }}
      aria-current={isActive ? 'page' : undefined}
      aria-label={label}
      className="relative block w-full text-left group focus:outline-none focus-visible:ring-1 focus-visible:ring-white/30 rounded-lg"
    >
      {isActive && (
        <span
          aria-hidden
          className="absolute -left-3 top-[42px] w-[2px] h-10 -translate-y-1/2 bg-white/90 rounded-sm"
        />
      )}
      <div
        className={cn(
          'aspect-[120/84] rounded-lg border overflow-hidden transition-[border-color,background-color] [transition-duration:180ms]',
          isActive
            ? 'border-white/25 bg-white/[0.06]'
            : 'border-white/10 bg-white/[0.02] group-hover:border-white/20 group-hover:bg-white/[0.04]',
        )}
      >
        <Thumb />
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        <Icon
          className={cn(
            'h-3 w-3 transition-colors [transition-duration:180ms]',
            isActive
              ? 'text-white/90'
              : 'text-white/45 group-hover:text-white/75',
          )}
        />
        <span
          className={cn(
            'text-[10px] font-medium uppercase tracking-[0.1em] transition-colors [transition-duration:180ms]',
            isActive
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
