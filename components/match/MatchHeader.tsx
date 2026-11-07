'use client';

import { Keyboard } from 'lucide-react';
import { TimeframeSwitch } from '@/components/chart/TimeframeSwitch';
import { Badge, Button, PANEL_SHELL } from '@/components/ui';
import { drawdownPct, equity, realizedPnl, unrealizedPnl } from '@/lib/engine';
import { fmtMoney, fmtPct, fmtSignedMoney, shortSymbol } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useMatchStore } from '@/store/matchStore';
import { EndMatchButton } from './EndMatchButton';
import { MatchTimer } from './MatchTimer';

/** Drawdown chip colour: amber from 70% of the limit, rose from 90%. */
export function drawdownTone(dd: number, limit: number): string {
  if (dd >= limit * 0.9) return 'text-rose-400';
  if (dd >= limit * 0.7) return 'text-amber-400';
  return 'text-slate-200';
}

const signTone = (v: number) => (v > 0 ? 'text-emerald-400' : v < 0 ? 'text-rose-400' : 'text-slate-200');

function Chip({ label, value, tone = 'text-slate-200' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex flex-col items-start sm:items-end min-w-0">
      <span className="text-[10px] uppercase tracking-wider text-slate-400">{label}</span>
      <span className={cn('text-sm font-mono font-bold whitespace-nowrap', tone)}>{value}</span>
    </div>
  );
}

/** Symbol, timeframe, timer and account numbers. Every figure comes from the engine. */
export function MatchHeader({ onShowShortcuts }: { onShowShortcuts?: () => void } = {}) {
  const match = useMatchStore((s) => s.match);
  const info = useMatchStore((s) => s.info);
  const timeframe = useMatchStore((s) => s.timeframe);
  const setTimeframe = useMatchStore((s) => s.setTimeframe);
  if (!match || !info) return null;

  const { currency, maxDrawdownPct } = match.config;
  const dd = drawdownPct(match);
  const realized = realizedPnl(match);
  const unrealized = unrealizedPnl(match);

  return (
    <section aria-label="Match summary" className={cn(PANEL_SHELL, 'p-3.5 flex flex-col xl:flex-row xl:items-center gap-3')}>
      <div className="flex flex-wrap items-center gap-2.5 min-w-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-white tracking-wide font-mono">{shortSymbol(info.symbol)}</h2>
            <Badge>{info.assetClass}</Badge>
          </div>
          <p className="text-[11px] text-slate-400 truncate">{info.name}</p>
        </div>
        <TimeframeSwitch value={timeframe} onChange={setTimeframe} />
        <MatchTimer />
        <EndMatchButton />
        {onShowShortcuts && (
          <Button variant="icon" aria-label="Keyboard shortcuts" aria-keyshortcuts="?" title="Keyboard shortcuts (?)" onClick={onShowShortcuts}>
            <Keyboard className="w-4 h-4" aria-hidden />
          </Button>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-x-5 gap-y-2 xl:ml-auto">
        <Chip label="Balance" value={fmtMoney(match.balance, currency)} />
        <Chip label="Realized" value={fmtSignedMoney(realized, currency)} tone={signTone(realized)} />
        <Chip label="Unrealized" value={fmtSignedMoney(unrealized, currency)} tone={signTone(unrealized)} />
        <Chip label="Equity" value={fmtMoney(equity(match), currency)} />
        <Chip label="Drawdown" value={`${fmtPct(dd, 2, false)} / ${fmtPct(maxDrawdownPct, 0, false)}`} tone={drawdownTone(dd, maxDrawdownPct)} />
      </div>
    </section>
  );
}
