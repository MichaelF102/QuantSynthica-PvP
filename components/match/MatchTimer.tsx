'use client';

import { Clock } from 'lucide-react';
import { remainingMs } from '@/lib/engine';
import { fmtDuration } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useMatchStore } from '@/store/matchStore';

export function timerTone(ms: number): string {
  if (ms < 10_000) return 'text-rose-400 border-rose-500/30 bg-rose-500/10';
  if (ms < 60_000) return 'text-amber-400 border-amber-500/30 bg-amber-500/10';
  return 'text-white border-slate-700/80 bg-slate-900/70';
}

/** Time left in the match, mm:ss. Computed from store state; it has no interval of its own. */
export function MatchTimer() {
  const match = useMatchStore((s) => s.match);
  const ms = match ? remainingMs(match) : null;
  const running = match?.status === 'running';
  return (
    <div
      role="timer"
      aria-label={ms === null ? 'Match timer' : `Time left ${fmtDuration(ms)}${running ? '' : ', paused'}`}
      className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-mono text-sm font-semibold tabular-nums', ms === null ? timerTone(Infinity) : timerTone(ms))}
    >
      <Clock className="w-3.5 h-3.5" aria-hidden />
      {ms === null ? '—' : fmtDuration(ms)}
    </div>
  );
}
