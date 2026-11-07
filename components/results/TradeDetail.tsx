import { Gauge } from 'lucide-react';
import { Panel } from '@/components/ui';
import { tradeExtras } from '@/lib/analysis';
import { DASH, fmtDuration, fmtMoney, fmtPct, fmtRatio, fmtSignedMoney, fmtSpan, isNum } from '@/lib/format';
import type { MatchResult } from '@/lib/results';
import { cn } from '@/lib/utils';

type Tone = 'positive' | 'negative' | 'neutral';
type Row = { k: string; v: string; tone?: Tone; hint?: string };
const sign = (v: number | null): Tone => (v === null ? 'neutral' : v > 0 ? 'positive' : v < 0 ? 'negative' : 'neutral');

/** Averages, extremes and behaviour of the closed trades, in two groups. */
export function TradeDetail({ result }: { result: MatchResult }) {
  const { stats, currency, trades } = result;
  const x = tradeExtras(trades, result.sessionStart, result.sessionEnd, stats.startingBalance);
  const money = (v: number | null) => (v === null ? DASH : fmtSignedMoney(v, currency));
  const side = (s: { count: number; pnl: number }) => (s.count ? `${s.count} · ${fmtSignedMoney(s.pnl, currency)}` : DASH);

  const outcome: Row[] = [
    { k: 'Expectancy', v: money(x.expectancy), tone: sign(x.expectancy), hint: 'Average P&L per closed trade.' },
    { k: 'Average win', v: money(stats.avgWin), tone: sign(stats.avgWin) },
    { k: 'Average loss', v: money(stats.avgLoss), tone: sign(stats.avgLoss) },
    { k: 'Payoff ratio', v: x.payoffRatio === null ? DASH : `${fmtRatio(x.payoffRatio)}×`, hint: 'Average win ÷ average loss.' },
    { k: 'Largest win', v: money(stats.largestWin), tone: sign(stats.largestWin) },
    { k: 'Largest loss', v: money(stats.largestLoss), tone: sign(stats.largestLoss) },
    { k: 'Gross profit / loss', v: `${fmtMoney(stats.grossProfit, currency)} / ${fmtMoney(stats.grossLoss, currency)}` },
    { k: 'Longs', v: side(x.longs), tone: x.longs.count ? sign(x.longs.pnl) : 'neutral' },
    { k: 'Shorts', v: side(x.shorts), tone: x.shorts.count ? sign(x.shorts.pnl) : 'neutral' },
  ];
  const behaviour: Row[] = [
    { k: 'Avg hold, winners', v: isNum(x.avgHoldWin) ? fmtSpan(x.avgHoldWin) : DASH, hint: 'Market time, not wall-clock time.' },
    { k: 'Avg hold, losers', v: isNum(x.avgHoldLoss) ? fmtSpan(x.avgHoldLoss) : DASH },
    { k: 'Longest losing streak', v: stats.trades ? String(x.maxLosingStreak) : DASH },
    { k: 'Time in market', v: fmtPct(x.timeInMarketPct, 0, false), hint: 'Share of the session with a position open.' },
    { k: 'Largest position', v: x.largestPositionPct === null ? DASH : `${fmtPct(x.largestPositionPct, 1, false)} of balance` },
    { k: 'Time played', v: fmtDuration(stats.durationMs) },
    { k: 'Max drawdown limit', v: fmtPct(result.config.maxDrawdownPct, 0, false) },
  ];

  return (
    <Panel title="Trade detail" description="Outcomes, then how you traded" icon={Gauge}>
      {[outcome, behaviour].map((rows, i) => (
        <dl key={i} className={cn('grid grid-cols-[1fr_auto] gap-x-3 gap-y-2 text-xs', i === 1 && 'mt-4 pt-4 border-t border-slate-800/70')}>
          {rows.map(({ k, v, tone = 'neutral', hint }) => (
            <div key={k} className="contents">
              <dt className="text-slate-400" title={hint}>
                {k}
              </dt>
              <dd className={cn('text-right font-mono font-semibold', v === DASH ? 'text-faint' : tone === 'positive' ? 'text-emerald-400' : tone === 'negative' ? 'text-rose-400' : 'text-slate-200')}>{v}</dd>
            </div>
          ))}
        </dl>
      ))}
    </Panel>
  );
}
