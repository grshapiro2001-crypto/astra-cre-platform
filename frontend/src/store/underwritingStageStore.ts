import { create } from 'zustand';

export type UWSubPage =
  | 'summary'
  | 'assumptions'
  | 'proforma'
  | 'cashflows'
  | 'schedules'
  | 't12mapping';

interface UnderwritingStageState {
  activePane1: UWSubPage;
  activePane2: UWSubPage | null;
  splitRatio: number;
  pickingSecond: boolean;

  promotePane1: (page: UWSubPage) => void;
  openSplit: (page: UWSubPage) => void;
  closeSplit: () => void;
  startPicker: () => void;
  cancelPicker: () => void;
  setSplitRatio: (ratio: number) => void;
  reset: () => void;
}

const DEFAULT_STATE: Pick<
  UnderwritingStageState,
  'activePane1' | 'activePane2' | 'splitRatio' | 'pickingSecond'
> = {
  activePane1: 'summary',
  activePane2: null,
  splitRatio: 0.5,
  pickingSecond: false,
};

export const useUnderwritingStageStore = create<UnderwritingStageState>((set) => ({
  ...DEFAULT_STATE,
  promotePane1: (page) => set({ activePane1: page, pickingSecond: false }),
  openSplit: (page) => set({ activePane2: page, pickingSecond: false }),
  closeSplit: () => set({ activePane2: null, pickingSecond: false }),
  startPicker: () => set({ pickingSecond: true }),
  cancelPicker: () => set({ pickingSecond: false }),
  setSplitRatio: (ratio) =>
    set({ splitRatio: Math.min(0.7, Math.max(0.3, ratio)) }),
  reset: () => set(DEFAULT_STATE),
}));
