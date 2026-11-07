import { createStore, type StoreApi } from 'zustand/vanilla';
import { useStore } from 'zustand';

export type ToastKind = 'success' | 'error' | 'info';
export type Toast = { id: number; kind: ToastKind; message: string };

export type ToastStore = {
  toasts: Toast[];
  push: (kind: ToastKind, message: string) => number;
  dismiss: (id: number) => void;
  clear: () => void;
};

/** Keep only the newest few; older ones drop off. */
export const MAX_TOASTS = 4;

export function createToastStore(): StoreApi<ToastStore> {
  let nextId = 1;
  return createStore<ToastStore>()((set) => ({
    toasts: [],
    push: (kind, message) => {
      const id = nextId++;
      set((s) => ({ toasts: [...s.toasts, { id, kind, message }].slice(-MAX_TOASTS) }));
      return id;
    },
    dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
    clear: () => set({ toasts: [] }),
  }));
}

export const toastStore = createToastStore();

export function useToastStore<T>(selector: (s: ToastStore) => T): T {
  return useStore(toastStore, selector);
}
