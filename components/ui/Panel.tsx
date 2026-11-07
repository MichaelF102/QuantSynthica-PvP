import type { ReactNode } from 'react';
import { Info, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type Tone = 'blue' | 'emerald' | 'rose' | 'amber';

export const TONE_TILE: Record<Tone, string> = {
  blue: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
  emerald: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
  rose: 'bg-rose-500/10 border-rose-500/20 text-rose-400',
  amber: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
};

export const PANEL_SHELL = 'rounded-xl border border-slate-800/90 bg-[#0b1222]/95 shadow-lg shadow-black/20';

type PanelProps = {
  title?: string;
  description?: string;
  icon?: LucideIcon;
  tone?: Tone;
  /** Tooltip text explaining what the card shows (DESIGN.md §7.1). */
  info?: string;
  actions?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children?: ReactNode;
};

/** Card recipe from DESIGN.md §7.1. */
export function Panel({ title, description, icon: Icon, tone = 'blue', info, actions, className, bodyClassName, children }: PanelProps) {
  const hasHeader = Boolean(title || actions);
  return (
    <section className={cn(PANEL_SHELL, 'backdrop-blur-md p-4 h-full', className)} aria-label={title}>
      {hasHeader && (
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 min-w-0 flex-1 basis-56">
            {Icon && (
              <div className={cn('p-1.5 rounded-lg border shrink-0', TONE_TILE[tone])}>
                <Icon className="w-4 h-4" aria-hidden />
              </div>
            )}
            <div className="min-w-0">
              {title && (
                <div className="flex items-center gap-1.5">
                  <h2 className="text-sm font-bold text-white tracking-wide truncate">{title}</h2>
                  {info && (
                    <span className="text-faint hover:text-slate-300 transition-colors" title={info}>
                      <Info className="w-3.5 h-3.5" aria-label={info} role="img" />
                    </span>
                  )}
                </div>
              )}
              {description && <p className="text-[11px] text-slate-400">{description}</p>}
            </div>
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}
