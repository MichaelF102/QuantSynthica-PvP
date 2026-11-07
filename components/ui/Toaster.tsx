'use client';

import { useEffect } from 'react';
import { CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToastStore, type Toast, type ToastKind } from '@/store/toastStore';

export const TOAST_MS = 3000;

const KIND: Record<ToastKind, { cls: string; icon: typeof Info }> = {
  success: { cls: 'border-emerald-500/30 text-emerald-300', icon: CheckCircle2 },
  error: { cls: 'border-rose-500/30 text-rose-300', icon: XCircle },
  info: { cls: 'border-blue-500/30 text-blue-300', icon: Info },
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  useEffect(() => {
    const t = setTimeout(() => onDismiss(toast.id), TOAST_MS);
    return () => clearTimeout(t);
  }, [toast.id, onDismiss]);
  const { cls, icon: Icon } = KIND[toast.kind];
  return (
    <li className={cn('pointer-events-auto flex items-start gap-2 rounded-xl border bg-[#0b1222]/95 backdrop-blur px-3 py-2.5 shadow-lg shadow-black/40 text-xs font-mono motion-safe:animate-[toast-in_150ms_ease-out]', cls)}>
      <Icon className="w-4 h-4 shrink-0 mt-px" aria-hidden />
      <span className="flex-1 text-slate-100">{toast.message}</span>
      <button type="button" onClick={() => onDismiss(toast.id)} className="text-slate-400 hover:text-white rounded focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500/70" aria-label="Dismiss">
        <X className="w-3.5 h-3.5" aria-hidden />
      </button>
    </li>
  );
}

/** Order feedback toasts (CLAUDE.md §10), announced politely to screen readers. */
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);
  return (
    <ol role="status" aria-live="polite" aria-label="Notifications" className="pointer-events-none fixed bottom-4 right-4 left-4 sm:left-auto z-[70] flex flex-col gap-2 sm:w-96 print:hidden">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
      ))}
    </ol>
  );
}
