import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PANEL_SHELL } from './Panel';

export type DeltaTone = 'positive' | 'negative' | 'neutral';

const DELTA: Record<DeltaTone, string> = {
  positive: 'text-emerald-400',
  negative: 'text-rose-400',
  neutral: 'text-faint',
};

type StatTileProps = {
  label: string;
  /** Already formatted by lib/format (a missing value is the string '—'). */
  value: string;
  icon?: LucideIcon;
  delta?: string;
  deltaTone?: DeltaTone;
  /** Colours the value itself: emerald for up, rose for down. Default white. */
  valueTone?: DeltaTone;
  info?: string;
  className?: string;
};

/** KPI tile from DESIGN.md §7.8. */
const VALUE: Record<DeltaTone, string> = { positive: 'text-emerald-400', negative: 'text-rose-400', neutral: 'text-white' };

export function StatTile({ label, value, icon: Icon, delta, deltaTone = 'neutral', valueTone = 'neutral', info, className }: StatTileProps) {
  return (
    <div className={cn(PANEL_SHELL, 'p-3.5 shadow-none', className)} title={info}>
      <div className="flex items-center gap-1 text-[10px] text-slate-400 mb-0.5">
        {Icon && <Icon className="w-3 h-3" aria-hidden />}
        {label}
      </div>
      <div className={cn('text-lg font-bold font-mono', value === '—' ? 'text-faint' : VALUE[valueTone])}>{value}</div>
      {delta && <div className={cn('text-xs font-mono font-semibold', DELTA[deltaTone])}>{delta}</div>}
    </div>
  );
}
