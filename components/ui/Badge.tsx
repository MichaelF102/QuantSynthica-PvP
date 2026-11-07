import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Tone } from './Panel';

const TONES: Record<Tone | 'slate', string> = {
  emerald: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400',
  rose: 'bg-rose-500/15 border-rose-500/40 text-rose-400',
  amber: 'bg-amber-500/15 border-amber-500/40 text-amber-400',
  blue: 'bg-blue-500/15 border-blue-500/40 text-blue-400',
  slate: 'bg-slate-800/60 border-slate-700 text-slate-300',
};

/** Status pill from DESIGN.md §7.6. */
export function Badge({ tone = 'slate', icon: Icon, children, className }: { tone?: Tone | 'slate'; icon?: LucideIcon; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-mono font-bold tracking-wider uppercase',
        TONES[tone],
        className,
      )}
    >
      {Icon && <Icon className="w-3.5 h-3.5" aria-hidden />}
      {children}
    </span>
  );
}
