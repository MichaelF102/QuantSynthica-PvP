import { tradeMarkers, type FillMarker } from './chartData';
import type { Candle, EquityPoint, Side, Trade } from './types';

// Replaying a finished match on the results page (plan M15 Part 1). Pure. A saved result keeps
// closed trades and the equity curve, not every fill, so the position at a moment is rebuilt
// from the trades that were open then: a net position is the sum of the trade pieces it was
// later closed in, and every position is closed by the end of the match.

export type ReplayFrame = {
  index: number;
  time: number;
  close: number;
  /** Equity at the last curve point at or before this candle; null before the first. */
  equity: number | null;
  position: { side: Side; units: number } | null;
  /** P&L of trades closed so far, net of their fees. */
  realized: number;
  closedTrades: number;
};

export function frameAt(candles: readonly Candle[], trades: readonly Trade[], curve: readonly EquityPoint[], index: number): ReplayFrame {
  const i = Math.max(0, Math.min(candles.length - 1, index));
  const c = candles[i];
  const t = c.time;
  let equity: number | null = null;
  for (const p of curve) {
    if (p.t > t) break;
    equity = p.equity;
  }
  let units = 0;
  let realized = 0;
  let closedTrades = 0;
  for (const tr of trades) {
    if (tr.openedAt <= t && t < tr.closedAt) units += tr.side === 'buy' ? tr.units : -tr.units;
    if (tr.closedAt <= t) {
      realized += tr.pnl;
      closedTrades++;
    }
  }
  // Float noise from adding lot sizes.
  const net = Math.round(units * 1e8) / 1e8;
  return { index: i, time: t, close: c.close, equity, position: net === 0 ? null : { side: net > 0 ? 'buy' : 'sell', units: Math.abs(net) }, realized, closedTrades };
}

/**
 * Entry and exit markers that have happened by `time`: nothing from the future is drawn. Built
 * from every trade first, so "#n" matches the trade table at any point of the replay.
 */
export function markersUntil(trades: readonly Trade[], time: number, activeId: string | null): FillMarker[] {
  return tradeMarkers(trades, activeId).filter((m) => m.time <= time);
}

/** Candle indices where a trade opened or closed, ascending, for "previous / next trade". */
export function eventIndices(candles: readonly Candle[], trades: readonly Trade[]): number[] {
  const times = new Set(trades.flatMap((t) => [t.openedAt, t.closedAt]));
  const out: number[] = [];
  candles.forEach((c, i) => {
    if (times.has(c.time)) out.push(i);
  });
  return out;
}

export const nextEvent = (events: readonly number[], i: number): number | null => events.find((e) => e > i) ?? null;
export const prevEvent = (events: readonly number[], i: number): number | null => [...events].reverse().find((e) => e < i) ?? null;

/** Candles revealed per second at each replay speed. */
export const REPLAY_RATES = [5, 20, 60] as const;
export type ReplayRate = (typeof REPLAY_RATES)[number];
