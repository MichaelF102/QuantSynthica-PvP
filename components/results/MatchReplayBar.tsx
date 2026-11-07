'use client';

import { ChevronFirst, ChevronLast, Pause, Play, SkipBack, SkipForward } from 'lucide-react';
import { Button, Segmented } from '@/components/ui';
import { fmtDateTime, fmtMoney, fmtPrice, fmtSignedMoney, fmtUnits, shortSymbol } from '@/lib/format';
import { REPLAY_RATES, type ReplayFrame, type ReplayRate } from '@/lib/matchReplay';
import { cn } from '@/lib/utils';

const RATES = REPLAY_RATES.map((r) => ({ value: r, label: `${r}/s` }));

type MatchReplayBarProps = {
  frame: ReplayFrame;
  last: number;
  playing: boolean;
  rate: ReplayRate;
  hasPrev: boolean;
  hasNext: boolean;
  symbol: string;
  currency: string;
  priceDecimals: number;
  lotStep: number;
  onSeek: (index: number) => void;
  onPlay: () => void;
  onRate: (r: ReplayRate) => void;
  onPrevTrade: () => void;
  onNextTrade: () => void;
};

const pnlTone = (v: number) => (v > 0 ? 'text-emerald-400' : v < 0 ? 'text-rose-400' : 'text-slate-200');

/** Plan M15 Part 1: scrub, play and jump between trades; the state of the account at that candle. */
export function MatchReplayBar(p: MatchReplayBarProps) {
  const { frame } = p;
  const atStart = frame.index <= 0;
  const atEnd = frame.index >= p.last;
  const pos = frame.position;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" aria-label="Go to the start" disabled={atStart} onClick={() => p.onSeek(0)}>
          <ChevronFirst className="w-3.5 h-3.5" aria-hidden />
        </Button>
        <Button variant="secondary" aria-label="Previous trade" disabled={!p.hasPrev} onClick={p.onPrevTrade}>
          <SkipBack className="w-3.5 h-3.5" aria-hidden />
        </Button>
        <Button variant="primary" aria-label={p.playing ? 'Pause replay' : atEnd ? 'Replay from the start' : 'Play replay'} onClick={p.onPlay} className="px-3">
          {p.playing ? <Pause className="w-3.5 h-3.5" aria-hidden /> : <Play className="w-3.5 h-3.5" aria-hidden />}
        </Button>
        <Button variant="secondary" aria-label="Next trade" disabled={!p.hasNext} onClick={p.onNextTrade}>
          <SkipForward className="w-3.5 h-3.5" aria-hidden />
        </Button>
        <Button variant="secondary" aria-label="Go to the end" disabled={atEnd} onClick={() => p.onSeek(p.last)}>
          <ChevronLast className="w-3.5 h-3.5" aria-hidden />
        </Button>
        <Segmented<ReplayRate> label="Replay speed" options={RATES} value={p.rate} onChange={p.onRate} />
        <span className="ml-auto text-[11px] font-mono text-slate-400">
          {frame.index + 1} / {p.last + 1}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={p.last}
        step={1}
        value={frame.index}
        onChange={(e) => p.onSeek(Number(e.target.value))}
        aria-label="Replay position"
        aria-valuetext={`${fmtDateTime(frame.time)}, candle ${frame.index + 1} of ${p.last + 1}`}
        className="w-full accent-blue-500"
      />
      <dl className="grid grid-cols-2 sm:grid-cols-5 gap-x-4 gap-y-2 rounded-lg border border-slate-800 bg-[#0b1120]/60 p-2.5" aria-live="off">
        {(
          [
            ['Time', fmtDateTime(frame.time), 'text-slate-200'],
            ['Close', fmtPrice(frame.close, p.priceDecimals), 'text-slate-200'],
            ['Equity', fmtMoney(frame.equity, p.currency), 'text-white'],
            ['Position', pos ? `${pos.side === 'buy' ? 'Long' : 'Short'} ${fmtUnits(pos.units, p.lotStep)} ${shortSymbol(p.symbol)}` : 'Flat', pos ? (pos.side === 'buy' ? 'text-emerald-400' : 'text-rose-400') : 'text-slate-300'],
            ['Realised P&L', `${fmtSignedMoney(frame.realized, p.currency)} · ${frame.closedTrades} trade${frame.closedTrades === 1 ? '' : 's'}`, pnlTone(frame.realized)],
          ] as const
        ).map(([k, v, tone]) => (
          <div key={k} className="min-w-0">
            <dt className="text-[10px] uppercase tracking-wider text-slate-400">{k}</dt>
            <dd className={cn('text-xs font-mono font-semibold truncate', tone)} title={v}>
              {v}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
