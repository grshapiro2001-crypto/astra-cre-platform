import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UIState {
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  toggleTheme: () => void;

  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;

  mobileSidebarOpen: boolean;
  setMobileSidebarOpen: (open: boolean) => void;
  toggleMobileSidebar: () => void;

  comparisonPropertyIds: number[];
  setComparisonPropertyIds: (ids: number[]) => void;
  addToComparison: (id: number) => void;
  removeFromComparison: (id: number) => void;
  togglePropertyComparison: (id: number) => void;
  clearComparison: () => void;
}

function applyTheme(theme: 'light' | 'dark') {
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      theme: 'dark',
      setTheme: (theme) => {
        applyTheme(theme);
        set({ theme });
      },
      toggleTheme: () =>
        set((state) => {
          const next = state.theme === 'dark' ? 'light' : 'dark';
          applyTheme(next);
          return { theme: next };
        }),

      sidebarCollapsed: false,
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

      mobileSidebarOpen: false,
      setMobileSidebarOpen: (open) => set({ mobileSidebarOpen: open }),
      toggleMobileSidebar: () => set((state) => ({ mobileSidebarOpen: !state.mobileSidebarOpen })),

      comparisonPropertyIds: [],
      setComparisonPropertyIds: (ids) => set({ comparisonPropertyIds: ids }),
      addToComparison: (id) =>
        set((state) => {
          if (state.comparisonPropertyIds.includes(id)) return state;
          if (state.comparisonPropertyIds.length >= 5) return state;
          return { comparisonPropertyIds: [...state.comparisonPropertyIds, id] };
        }),
      removeFromComparison: (id) =>
        set((state) => ({
          comparisonPropertyIds: state.comparisonPropertyIds.filter((pid) => pid !== id),
        })),
      togglePropertyComparison: (id) =>
        set((state) => {
          if (state.comparisonPropertyIds.includes(id)) {
            return { comparisonPropertyIds: state.comparisonPropertyIds.filter((pid) => pid !== id) };
          }
          if (state.comparisonPropertyIds.length >= 5) return state;
          return { comparisonPropertyIds: [...state.comparisonPropertyIds, id] };
        }),
      clearComparison: () => set({ comparisonPropertyIds: [] }),
    }),
    {
      name: 'astra-ui-storage',
      partialize: (state) => ({
        theme: state.theme,
        sidebarCollapsed: state.sidebarCollapsed,
        comparisonPropertyIds: state.comparisonPropertyIds,
      }),
      onRehydrateStorage: () => {
        return (state) => {
          if (state) {
            applyTheme(state.theme);
          }
        };
      },
    }
  )
);
