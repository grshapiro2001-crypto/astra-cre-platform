import { create } from 'zustand';
import type { ChatMessage } from '@/types/assistant';

interface AssistantState {
  isOpen: boolean;
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
  messages: [],
  isLoading: false,
  scopedPropertyId: null,
  scopedFolderId: null,

  togglePanel: () => set((s) => ({ isOpen: !s.isOpen })),
  setOpen: (open) => set({ isOpen: open }),

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
