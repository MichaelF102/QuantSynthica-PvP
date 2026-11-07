'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { FileBarChart } from 'lucide-react';
import { Button } from '@/components/ui';
import { Dialog } from '@/components/ui/Dialog';
import { fmtPct, fmtSignedMoney } from '@/lib/format';
import { END_REASON_TEXT } from '@/lib/results';
import { cn } from '@/lib/utils';
import { useMatchStore } from '@/store/matchStore';

/** How long the end dialog stays up before opening the results report. */
export const END_DIALOG_MS = 2500;

const TONE = { timer: 'text-blue-300', user: 'text-blue-300', drawdown: 'text-rose-300', data_end: 'text-amber-300' } as const;

/** Shown once when the match ends; then opens the results report (plan M7). */
export function MatchEndDialog() {
  const result = useMatchStore((s) => s.result);
  const saved = useMatchStore((s) => s.resultSaved);
  const router = useRouter();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const href = result ? `/results/${result.id}` : null;

  useEffect(() => {
    if (!href) return;
    const t = setTimeout(() => router.push(href), END_DIALOG_MS);
    return () => clearTimeout(t);
  }, [href, router]);

  if (!result || !href) return null;
  const { stats, endReason, config } = result;
  const title =
    endReason === 'drawdown' ? `${END_REASON_TEXT.drawdown} (${fmtPct(stats.maxDrawdownPct, 2, false)} ≥ ${fmtPct(config.maxDrawdownPct, 0, false)})` : END_REASON_TEXT[endReason];

  return (
    <Dialog open title={title} initialFocus={buttonRef}>
      <p className={cn('text-[11px] font-mono uppercase tracking-wider mb-3', TONE[endReason])}>Match over · open positions were closed</p>
      <div className="flex items-baseline gap-3">
        <span className={cn('text-2xl font-bold font-mono', stats.pnl > 0 ? 'text-emerald-400' : stats.pnl < 0 ? 'text-rose-400' : 'text-white')}>{fmtSignedMoney(stats.pnl, result.currency)}</span>
        <span className="text-sm font-mono text-slate-300">{fmtPct(stats.returnPct)}</span>
      </div>
      {!saved && <p className="mt-3 text-[11px] text-amber-300">This result could not be saved in this browser.</p>}
      <div className="mt-5 flex items-center justify-between gap-3">
        <span className="text-[11px] text-faint">Opening the report…</span>
        <Button ref={buttonRef} onClick={() => router.push(href)}>
          <FileBarChart className="w-3.5 h-3.5" aria-hidden /> View results
        </Button>
      </div>
    </Dialog>
  );
}
