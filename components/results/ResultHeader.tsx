import { Badge } from '@/components/ui';
import { endSummary, ordinal, type SymbolContext } from '@/lib/analysis';
import { fmtDateTime, fmtMoney, fmtPct, fmtPlayedAtBoth, fmtSignedMoney, shortSymbol } from '@/lib/format';
import type { MatchResult } from '@/lib/results';
import { cn } from '@/lib/utils';

const REASON_TONE = { timer: 'blue', user: 'blue', drawdown: 'rose', data_end: 'amber' } as const;

/** Title, how the match ended, when it was played, the P&L, and how it ranks on this symbol. */
export function ResultHeader({ result, context }: { result: MatchResult; context: SymbolContext | null }) {
  const { stats, currency } = result;
  const end = endSummary(result);
  return (
    <header className="relative isolate border-b border-slate-800/60 pb-5 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
      <div className="absolute top-0 left-1/4 w-96 max-w-[60%] h-24 bg-blue-600/10 blur-3xl pointer-events-none rounded-full -z-10" aria-hidden />
      <div className="space-y-1.5 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={REASON_TONE[result.endReason]}>{end.label}</Badge>
          <span className="text-[11px] font-mono text-slate-300">{end.detail}</span>
          <span className="text-[11px] text-faint">· Played {fmtPlayedAtBoth(result.playedAt)}</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-primary">
          <span className="font-mono">{shortSymbol(result.symbol)}</span> <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-cyan-400 bg-clip-text text-transparent">results</span>
        </h1>
        <p className="text-xs text-secondary">
          {result.symbolName} · Session <span className="font-mono">{fmtDateTime(result.sessionStart)} → {fmtDateTime(result.sessionEnd)}</span> · Market data
        </p>
      </div>
      <div className="lg:text-right">
        <div className={cn('text-3xl font-bold font-mono', stats.pnl > 0 ? 'text-emerald-400' : stats.pnl < 0 ? 'text-rose-400' : 'text-white')}>{fmtSignedMoney(stats.pnl, currency)}</div>
        <div className="text-sm font-mono text-slate-300">
          {fmtPct(stats.returnPct)} · {fmtMoney(stats.startingBalance, currency)} → {fmtMoney(stats.finalEquity, currency)}
        </div>
        {context && context.count > 1 && (
          <p className="mt-1 text-[11px] text-faint">
            <span className="font-mono text-slate-300">{ordinal(context.rank)}</span> best of <span className="font-mono">{context.count}</span> matches on {shortSymbol(result.symbol)} · best{' '}
            <span className="font-mono">{fmtPct(context.best)}</span> · average <span className="font-mono">{fmtPct(context.avg)}</span>
          </p>
        )}
        {context && context.count === 1 && <p className="mt-1 text-[11px] text-faint">Your first match on {shortSymbol(result.symbol)}</p>}
      </div>
    </header>
  );
}
