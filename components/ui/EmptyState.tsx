import type { ReactNode } from 'react';
import { Inbox, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Empty state from DESIGN.md §7.13: say what is missing and why. Never fill with sample data. */
export function EmptyState({ icon: Icon = Inbox, title, hint, action, className }: { icon?: LucideIcon; title: string; hint?: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center gap-2 py-10 px-4', className)}>
      <Icon className="h-8 w-8 text-slate-600" aria-hidden />
      <p className="text-sm text-slate-300">{title}</p>
      {hint && <p className="text-xs text-faint max-w-sm">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
