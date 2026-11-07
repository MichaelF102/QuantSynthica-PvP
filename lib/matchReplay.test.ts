import { describe, expect, it } from 'vitest';
import { eventIndices, frameAt, markersUntil, nextEvent, prevEvent } from './matchReplay';
import type { Candle, Trade } from './types';

// Plan M15 Part 1. TEST FIXTURE: hand-built candles and trades.

const candles: Candle[] = [100, 101, 102, 103, 104, 105].map((close, i) => ({ time: 60 * (i + 1), open: close, high: close, low: close, close, volume: 1 }));
const trade = (id: string, side: Trade['side'], units: number, openedAt: number, closedAt: number, pnl: number): Trade => ({ id, symbol: 'X', side, units, entry: 100, exit: 101, pnl, openedAt, closedAt });
// A 10-unit long opened at 120, closed 4 at 180 and 6 at 240; then a 3-unit short 300 → 360.
const trades = [trade('a', 'buy', 4, 120, 180, 8), trade('b', 'buy', 6, 120, 240, 18), trade('c', 'sell', 3, 300, 360, -3)];
const curve = [
  { t: 60, equity: 1000 },
  { t: 180, equity: 1010 },
  { t: 360, equity: 1023 },
];

describe('frameAt', () => {
  it('rebuilds the position, realised P&L and equity at each candle', () => {
    expect(frameAt(candles, trades, curve, 0)).toMatchObject({ time: 60, equity: 1000, position: null, realized: 0 });
    expect(frameAt(candles, trades, curve, 1)).toMatchObject({ position: { side: 'buy', units: 10 }, equity: 1000 });
    expect(frameAt(candles, trades, curve, 2)).toMatchObject({ position: { side: 'buy', units: 6 }, realized: 8, closedTrades: 1, equity: 1010 });
    expect(frameAt(candles, trades, curve, 3)).toMatchObject({ position: null, realized: 26 });
    expect(frameAt(candles, trades, curve, 4)).toMatchObject({ position: { side: 'sell', units: 3 } });
    expect(frameAt(candles, trades, curve, 5)).toMatchObject({ position: null, realized: 23, closedTrades: 3, equity: 1023 });
  });

  it('clamps the index and has no equity before the first curve point', () => {
    expect(frameAt(candles, trades, curve, 99).index).toBe(5);
    expect(frameAt(candles, trades, [{ t: 200, equity: 1 }], 0).equity).toBeNull();
  });
});

describe('markersUntil', () => {
  it('never draws an entry or exit from the future', () => {
    expect(markersUntil(trades, 60, null)).toEqual([]);
    expect(markersUntil(trades, 120, null).map((m) => m.text)).toEqual(['#1 L', '#2 L']);
    expect(markersUntil(trades, 180, null).map((m) => m.text)).toEqual(['#1 L', '#2 L', '#1 exit']);
    expect(markersUntil(trades, 360, null)).toHaveLength(6);
  });

  it('keeps trade numbers stable when a later trade opened first', () => {
    // Trades are stored in closing order: #1 opened at 180, #2 opened earlier at 60.
    const crossed = [trade('x', 'buy', 1, 180, 300, 1), trade('y', 'buy', 1, 60, 360, 1)];
    expect(markersUntil(crossed, 120, null).map((m) => m.text)).toEqual(['#2 L']);
  });
});

describe('events', () => {
  it('lists trade candles and steps between them', () => {
    const ev = eventIndices(candles, trades);
    expect(ev).toEqual([1, 2, 3, 4, 5]);
    expect(nextEvent(ev, 0)).toBe(1);
    expect(nextEvent(ev, 5)).toBeNull();
    expect(prevEvent(ev, 3)).toBe(2);
    expect(prevEvent(ev, 1)).toBeNull();
  });
});
