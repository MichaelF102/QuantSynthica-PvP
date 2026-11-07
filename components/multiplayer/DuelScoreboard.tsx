'use client';

import { useState } from 'react';
import { Flag, Timer } from 'lucide-react';
import { Badge, Button, PANEL_SHELL } from '@/components/ui';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { drawdownTone } from '@/components/match/MatchHeader';
import { fmtDuration, fmtMoney, fmtPct, shortSymbol } from '@/lib/format';
import type { PlayerStatus } from '@/lib/multiplayer/protocol';
import { cn } from '@/lib/utils';

export type ScoreLine = { nickname: string; status: PlayerStatus; connected: boolean; equity: number; returnPct: number; drawdownPct: number; trades: number } | null;

type DuelScoreboardProps = {
  symbol: string;
  symbolName: string;
  currency: string;
  maxDrawdownPct: number;
  speed: number;
  remainingMs: number;
  you: ScoreLine;
  opponent: ScoreLine;
  onForfeit: () => void;
  /** Plan M13 R3: "Game 2 of 3 · You lead 1–0". */
  seriesLabel?: string;
  /** Plan M13 R4: "Long 5 @ 20,101.25" in rooms with open positions. */
  opponentPosition?: string;
};

const signTone = (v: number) => (v > 0 ? 'text-emerald-400' : v < 0 ? 'text-rose-400' : 'text-slate-200');

export function StatusBadge({ status, connected }: { status: PlayerStatus; connected: boolean }) {
  if (status === 'out_drawdown') return <Badge tone="rose">Out · drawdown</Badge>;
  if (status === 'out_disconnect') return <Badge tone="rose">Out · left</Badge>;
  if (status === 'done') return <Badge>Finished</Badge>;
  if (!connected) return <Badge tone="amber">Reconnecting</Badge>;
  return <Badge tone="emerald">Live</Badge>;
}

function Side({ label, line, currency, limit, align, note }: { label: string; line: ScoreLine; currency: string; limit: number; align: 'left' | 'right'; note?: string }) {
  const cell = (k: string, v: string, tone = 'text-slate-200') => (
    <div className={cn('min-w-0', align === 'right' && 'sm:text-right')}>
      <dt className="text-[10px] uppercase tracking-wider text-slate-400">{k}</dt>
      <dd className={cn('text-sm font-mono font-bold whitespace-nowrap', tone)}>{v}</dd>
    </div>
  );
  return (
    <section aria-label={`${label} score`} className="min-w-0 space-y-2">
      <div className={cn('flex items-center gap-2 min-w-0', align === 'right' && 'sm:flex-row-reverse')}>
        <span className="text-[10px] uppercase tracking-wider text-blue-300">{label}</span>
        <span className="text-sm text-white truncate">{line?.nickname ?? '—'}</span>
        {line && <StatusBadge status={line.status} connected={line.connected} />}
      </div>
      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2">
        {cell('Equity', line ? fmtMoney(line.equity, currency) : '—')}
        {cell('Return', line ? fmtPct(line.returnPct) : '—', line ? signTone(line.returnPct) : undefined)}
        {cell('Drawdown', line ? fmtPct(line.drawdownPct, 2, false) : '—', line ? drawdownTone(line.drawdownPct, limit) : undefined)}
        {cell('Trades', line ? String(line.trades) : '—')}
      </dl>
      {note && <p className={cn('text-[11px] font-mono text-slate-300', align === 'right' && 'sm:text-right')}>Position: {note}</p>}
    </section>
  );
}

/** You vs opponent, the shared clock and forfeit (plan M11.5). Every number comes from the server. */
export function DuelScoreboard({ symbol, symbolName, currency, maxDrawdownPct, speed, remainingMs, you, opponent, onForfeit, seriesLabel, opponentPosition }: DuelScoreboardProps) {
  const [confirm, setConfirm] = useState(false);
  const live = you?.status === 'live';
  return (
    <div className={cn(PANEL_SHELL, 'p-4 space-y-4')}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-white tracking-wide truncate">
            <span className="font-mono">{shortSymbol(symbol)}</span> · {symbolName}
          </p>
          <p className="text-[11px] text-slate-400">
            1v1 · {speed}x · no pause · max drawdown {fmtPct(maxDrawdownPct, maxDrawdownPct % 1 ? 1 : 0, false)}
          </p>
          {seriesLabel && <p className="text-[11px] font-mono text-blue-300">{seriesLabel}</p>}
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5" aria-label={`Time left ${fmtDuration(remainingMs)}`}>
            <Timer className="w-4 h-4 text-slate-400" aria-hidden />
            <span className={cn('text-lg font-bold font-mono tabular-nums', remainingMs < 60_000 ? 'text-amber-400' : 'text-white')}>{fmtDuration(remainingMs)}</span>
          </span>
          {live && (
            <Button variant="secondary" onClick={() => setConfirm(true)}>
              <Flag className="w-3.5 h-3.5" aria-hidden /> Forfeit
            </Button>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:divide-x divide-slate-800">
        <Side label="You" line={you} currency={currency} limit={maxDrawdownPct} align="left" />
        <div className="sm:pl-4">
          <Side label="Opponent" line={opponent} currency={currency} limit={maxDrawdownPct} align="right" note={opponentPosition} />
        </div>
      </div>
      <ConfirmDialog
        open={confirm}
        title="Forfeit the match?"
        confirmLabel="Forfeit"
        destructive
        onCancel={() => setConfirm(false)}
        onConfirm={() => {
          setConfirm(false);
          onForfeit();
        }}
      >
        <p className="text-xs text-slate-300">Your open position closes at the current candle and you lose to an opponent who is still playing.</p>
      </ConfirmDialog>
    </div>
  );
}
