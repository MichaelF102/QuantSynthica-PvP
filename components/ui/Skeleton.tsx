import { cn } from '@/lib/utils';
import { PANEL_SHELL } from './Panel';

/** A single grey bar. Put it inside an `animate-pulse` parent (or use PanelSkeleton). */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('bg-slate-800/50 rounded', className)} aria-hidden />;
}

/** Card-shaped loading state from DESIGN.md §7.2. Never show 0, NaN or empty tables while loading. */
export function PanelSkeleton({ rows = 5, className, label = 'Loading' }: { rows?: number; className?: string; label?: string }) {
  return (
    <div className={cn(PANEL_SHELL, 'p-4 animate-pulse space-y-3 h-full')} role="status" aria-label={label}>
      <div className="h-4 w-40 bg-slate-800 rounded" />
      <div className={cn('space-y-2', className)}>
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="h-9 bg-slate-800/50 rounded" />
        ))}
      </div>
      <span className="sr-only">{label}…</span>
    </div>
  );
}
