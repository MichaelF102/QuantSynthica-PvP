import type { ReactNode } from 'react';
import { AlertTriangle, Info, X, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export type BannerKind = 'warning' | 'error' | 'info';

const KINDS: Record<BannerKind, { cls: string; icon: typeof Info }> = {
  warning: { cls: 'bg-amber-500/10 border-amber-500/30 text-amber-300', icon: AlertTriangle },
  error: { cls: 'bg-rose-500/10 border-rose-500/30 text-rose-300', icon: XCircle },
  info: { cls: 'bg-blue-500/10 border-blue-500/30 text-blue-300', icon: Info },
};

/** Alert banner from DESIGN.md §7.12. */
export function Banner({ kind = 'info', children, onRetry, onDismiss, className }: { kind?: BannerKind; children: ReactNode; onRetry?: () => void; onDismiss?: () => void; className?: string }) {
  const { cls, icon: Icon } = KINDS[kind];
  return (
    <div
      role={kind === 'error' ? 'alert' : 'status'}
      className={cn('p-3 rounded-lg border text-xs flex items-center justify-between gap-3', cls, className)}
    >
      <div className="flex items-center gap-2 min-w-0">
        <Icon className="w-4 h-4 shrink-0" aria-hidden />
        <div className="min-w-0">{children}</div>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="shrink-0 font-semibold underline-offset-2 hover:underline rounded focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500/70"
        >
          Retry
        </button>
      )}
      {onDismiss && (
        <button type="button" onClick={onDismiss} aria-label="Dismiss" className="shrink-0 rounded opacity-80 hover:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500/70">
          <X className="w-3.5 h-3.5" aria-hidden />
        </button>
      )}
    </div>
  );
}
