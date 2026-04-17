import {
  LayoutDashboard,
  SlidersHorizontal,
  Table2,
  BarChart3,
  ListTree,
  FileSpreadsheet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { UWSubPage } from '@/store/underwritingStageStore';
import { StageTile } from './StageTile';
import { SummaryThumb } from './thumbs/SummaryThumb';
import { AssumptionsThumb } from './thumbs/AssumptionsThumb';
import { ProformaThumb } from './thumbs/ProformaThumb';
import { CashFlowsThumb } from './thumbs/CashFlowsThumb';
import { SchedulesThumb } from './thumbs/SchedulesThumb';
import { T12MappingThumb } from './thumbs/T12MappingThumb';

interface TileDef {
  pageId: UWSubPage;
  label: string;
  icon: LucideIcon;
  Thumb: React.ComponentType;
}

const BASE_TILES: TileDef[] = [
  { pageId: 'summary', label: 'Summary', icon: LayoutDashboard, Thumb: SummaryThumb },
  { pageId: 'assumptions', label: 'Assumptions', icon: SlidersHorizontal, Thumb: AssumptionsThumb },
  { pageId: 'proforma', label: 'Proforma', icon: Table2, Thumb: ProformaThumb },
  { pageId: 'cashflows', label: 'Cash Flows', icon: BarChart3, Thumb: CashFlowsThumb },
  { pageId: 'schedules', label: 'Schedules', icon: ListTree, Thumb: SchedulesThumb },
];

const T12_TILE: TileDef = {
  pageId: 't12mapping',
  label: 'T12 Mapping',
  icon: FileSpreadsheet,
  Thumb: T12MappingThumb,
};

export interface StageSidebarProps {
  showT12Mapping: boolean;
}

export function StageSidebar({ showT12Mapping }: StageSidebarProps) {
  const tiles = showT12Mapping
    ? [
        ...BASE_TILES.slice(0, 3), // summary, assumptions, proforma
        T12_TILE,
        ...BASE_TILES.slice(3), // cashflows, schedules
      ]
    : BASE_TILES;

  return (
    <aside className="liquid-glass w-[148px] shrink-0 border-r border-white/10 px-4 py-6">
      <div className="mb-4 text-[10px] font-medium uppercase tracking-[0.18em] text-white/45">
        Pages
      </div>
      <div className="flex flex-col gap-4">
        {tiles.map((t) => (
          <StageTile
            key={t.pageId}
            pageId={t.pageId}
            label={t.label}
            icon={t.icon}
            Thumb={t.Thumb}
          />
        ))}
      </div>
    </aside>
  );
}
