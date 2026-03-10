import { create } from 'zustand';
import type { ChatMessage } from '@/types/assistant';
import { useUIStore } from '@/store/uiStore';

interface AssistantState {
  isOpen: boolean;
  _prevSidebarCollapsed: boolean | null;
  messages: ChatMessage[];
  isLoading: boolean;
  scopedPropertyId: number | null;
  scopedFolderId: number | null;

  togglePanel: () => void;
  setOpen: (open: boolean) => void;
  addMessage: (msg: ChatMessage) => void;
  updateLastAssistant: (content: string) => void;
  finalizeLastAssistant: () => void;
  setLoading: (loading: boolean) => void;
  setScopedProperty: (id: number | null) => void;
  setScopedFolder: (id: number | null) => void;
  clearMessages: () => void;
}

export const useAssistantStore = create<AssistantState>((set) => ({
  isOpen: false,
  _prevSidebarCollapsed: null,
  messages: [],
  isLoading: false,
  scopedPropertyId: null,
  scopedFolderId: null,

  togglePanel: () =>
    set((s) => {
      const ui = useUIStore.getState();
      if (!s.isOpen) {
        // Opening: save sidebar state then collapse
        const prev = ui.sidebarCollapsed;
        if (!ui.sidebarCollapsed) ui.setSidebarCollapsed(true);
        return { isOpen: true, _prevSidebarCollapsed: prev };
      } else {
        // Closing: restore sidebar state
        if (s._prevSidebarCollapsed !== null) {
          ui.setSidebarCollapsed(s._prevSidebarCollapsed);
        }
        return { isOpen: false, _prevSidebarCollapsed: null };
      }
    }),
  setOpen: (open) =>
    set((s) => {
      const ui = useUIStore.getState();
      if (open && !s.isOpen) {
        const prev = ui.sidebarCollapsed;
        if (!ui.sidebarCollapsed) ui.setSidebarCollapsed(true);
        return { isOpen: true, _prevSidebarCollapsed: prev };
      } else if (!open && s.isOpen) {
        if (s._prevSidebarCollapsed !== null) {
          ui.setSidebarCollapsed(s._prevSidebarCollapsed);
        }
        return { isOpen: false, _prevSidebarCollapsed: null };
      }
      return { isOpen: open };
    }),

  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),

  updateLastAssistant: (content) =>
    set((s) => {
      const msgs = [...s.messages];
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].role === 'assistant') {
          msgs[i] = { ...msgs[i], content, isStreaming: true };
          break;
        }
      }
      return { messages: msgs };
    }),

  finalizeLastAssistant: () =>
    set((s) => {
      const msgs = [...s.messages];
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].role === 'assistant') {
          msgs[i] = { ...msgs[i], isStreaming: false };
          break;
        }
      }
      return { messages: msgs };
    }),

  setLoading: (loading) => set({ isLoading: loading }),
  setScopedProperty: (id) => set({ scopedPropertyId: id }),
  setScopedFolder: (id) => set({ scopedFolderId: id }),
  clearMessages: () => set({ messages: [] }),
}));
