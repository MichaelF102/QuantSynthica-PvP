'use client';

import { useEffect, useMemo, useState } from 'react';
import { CandlestickChart } from 'lucide-react';
import { CandleChart } from '@/components/chart/CandleChart';
import { Banner, EmptyState, Panel, Skeleton } from '@/components/ui';
import { eventIndices, frameAt, markersUntil, nextEvent, prevEvent, type ReplayRate } from '@/lib/matchReplay';
import { fmtPrice, shortSymbol } from '@/lib/format';
import type { MatchResult } from '@/lib/results';
import type { Candle } from '@/lib/types';
import { MatchReplayBar } from './MatchReplayBar';
import type { SessionStatus } from './useSessionCandles';

type Props = { result: MatchResult; candles: Candle[]; status: SessionStatus; onRetry: () => void; activeTradeId: string | null };

/**
 * The session the player traded, with each trade's entry and exit marked. Only candles up to
 * the last one revealed are drawn. Picking a trade in the table highlights it here. Plan M15:
 * the replay bar scrubs or plays through it; nothing after the replay position is drawn.
 */
export function SessionChart({ result, candles, status, onRetry, activeTradeId }: Props) {
  const last = Math.max(0, candles.length - 1);
  // The full session shows first, as before; scrubbing moves back from there.
  const [index, setIndex] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState<ReplayRate>(20);
  const at = index === null ? last : Math.min(index, last);
  const events = useMemo(() => eventIndices(candles, result.trades), [candles, result.trades]);
  const frame = candles.length ? frameAt(candles, result.trades, result.equityCurve, at) : null;
  const time = frame?.time ?? 0;
  const bars = useMemo(() => candles.slice(0, at + 1), [candles, at]);
  const markers = useMemo(() => markersUntil(result.trades, time, activeTradeId), [result.trades, time, activeTradeId]);

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => setIndex((i) => Math.min((i ?? last) + 1, last)), 1000 / rate);
    return () => window.clearInterval(id);
  }, [playing, rate, last]);
  // Playback stops on the last candle.
  useEffect(() => {
    if (playing && at >= last) setPlaying(false);
  }, [playing, at, last]);

  const seek = (i: number) => {
    setPlaying(false);
    setIndex(Math.max(0, Math.min(last, i)));
  };
  const togglePlay = () => {
    if (playing) return setPlaying(false);
    if (at >= last) setIndex(0);
    setPlaying(true);
  };
  const prevI = prevEvent(events, at);
  const nextI = nextEvent(events, at);
  const active = result.trades.find((t) => t.id === activeTradeId) ?? null;
  const n = active ? result.trades.indexOf(active) + 1 : 0;

  return (
    <Panel
      title="Session replay"
      description="Candles you saw, 1m, UTC · ▲ long entry · ▼ short entry · ● exit · scrub or play below"
      icon={CandlestickChart}
      actions={
        active && (
          <span className="text-[11px] font-mono text-slate-300">
            Trade #{n}: {fmtPrice(active.entry, result.priceDecimals)} → {fmtPrice(active.exit, result.priceDecimals)}
          </span>
        )
      }
    >
      {status === 'loading' && (
        <div className="animate-pulse" role="status" aria-label="Loading session candles">
          <Skeleton className="h-[320px] w-full" />
        </div>
      )}
      {status === 'error' && (
        <Banner kind="error" onRetry={onRetry}>
          The session&apos;s market data could not be loaded.
        </Banner>
      )}
      {status === 'missing' && (
        <EmptyState
          icon={CandlestickChart}
          title="Session data not available"
          hint={`The data files no longer include ${shortSymbol(result.symbol)} for this session, so the chart cannot be redrawn. The report above is unaffected.`}
        />
      )}
      {status === 'ready' && frame && (
        <div className="space-y-3">
          <CandleChart
            bars={bars}
            symbol={result.symbol}
            timeframe="1m"
            priceDecimals={result.priceDecimals}
            markers={markers}
            entryPrice={active && active.openedAt <= time ? active.entry : null}
            fitAll={at >= last}
            className="min-h-[320px] lg:min-h-[360px]"
          />
          <MatchReplayBar
            frame={frame}
            last={last}
            playing={playing}
            rate={rate}
            hasPrev={prevI !== null}
            hasNext={nextI !== null}
            symbol={result.symbol}
            currency={result.currency}
            priceDecimals={result.priceDecimals}
            lotStep={result.lotStep}
            onSeek={seek}
            onPlay={togglePlay}
            onRate={setRate}
            onPrevTrade={() => prevI !== null && seek(prevI)}
            onNextTrade={() => nextI !== null && seek(nextI)}
          />
        </div>
      )}
    </Panel>
  );
}
