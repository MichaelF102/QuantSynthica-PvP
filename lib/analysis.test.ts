import { describe, expect, it } from 'vitest';
import { buyAndHoldPct, edgePts, endSummary, maxLosingStreak, ordinal, sessionCandles, symbolContext, tradeExtras, unionLength } from './analysis';
import type { MatchResult } from './results';
import type { Candle, Trade } from './types';

const tr = (id: string, side: Trade['side'], units: number, entry: number, exit: number, pnl: number, openedAt: number, closedAt: number): Trade => ({ id, symbol: 'X', side, units, entry, exit, pnl, openedAt, closedAt });
const candle = (time: number, close: number): Candle => ({ time, open: close, high: close, low: close, close, volume: 0 });
const base = { config: { durationMs: 600_000, maxDrawdownPct: 5 } as MatchResult['config'], stats: { durationMs: 54_000 } as MatchResult['stats'] };

describe('endSummary', () => {
  it('says who or what ended the match and how much time was left', () => {
    expect(endSummary({ ...base, endReason: 'user' })).toEqual({ label: 'Ended by you', detail: '09:06 left of 10:00' });
    expect(endSummary({ ...base, endReason: 'timer' })).toEqual({ label: "Time's up", detail: 'Full 10:00 played' });
    expect(endSummary({ ...base, endReason: 'drawdown' }).detail).toBe('Hit the 5% limit · 09:06 left of 10:00');
    expect(endSummary({ ...base, endReason: 'data_end' }).label).toBe('End of session data');
  });
  it('never shows negative time left', () => {
    expect(endSummary({ ...base, stats: { durationMs: 700_000 } as MatchResult['stats'], endReason: 'user' }).detail).toBe('00:00 left of 10:00');
  });
});

describe('buy & hold', () => {
  const cs = [candle(60, 100), candle(120, 105), candle(180, 99), candle(240, 110)];
  it('slices the revealed session inclusively', () => {
    expect(sessionCandles(cs, 120, 180).map((c) => c.time)).toEqual([120, 180]);
  });
  it('is the change from the start close to the last close', () => {
    expect(buyAndHoldPct(sessionCandles(cs, 60, 180))).toBeCloseTo(-1);
    expect(buyAndHoldPct(cs)).toBeCloseTo(10);
  });
  it('is null with fewer than two candles or a zero price', () => {
    expect(buyAndHoldPct([])).toBeNull();
    expect(buyAndHoldPct([candle(1, 100)])).toBeNull();
    expect(buyAndHoldPct([candle(1, 0), candle(2, 5)])).toBeNull();
  });
  it('edge is the difference in points', () => {
    expect(edgePts(-0.28, -1.1)).toBeCloseTo(0.82);
    expect(edgePts(1, null)).toBeNull();
    expect(edgePts(Number.NaN, 1)).toBeNull();
  });
});

describe('unionLength / maxLosingStreak', () => {
  it('counts overlapping intervals once', () => {
    expect(unionLength([[0, 10], [5, 15], [20, 25]])).toBe(20);
    expect(unionLength([[10, 5], [3, 3]])).toBe(0);
    expect(unionLength([])).toBe(0);
  });
  it('finds the longest run of losers', () => {
    const t = (pnl: number) => tr('a', 'buy', 1, 1, 1, pnl, 0, 1);
    expect(maxLosingStreak([t(-1), t(-1), t(2), t(-1), t(-1), t(-1), t(0)])).toBe(3);
    expect(maxLosingStreak([])).toBe(0);
  });
});

describe('tradeExtras', () => {
  // The screenshot match: three losing longs and one tiny winning short.
  const trades = [
    tr('1', 'buy', 0.37, 26384.99, 26306.82, -28.92, 0, 2040),
    tr('2', 'buy', 2.62, 26228.36, 26172.89, -145.33, 5340, 6840),
    tr('3', 'sell', 0.01, 26172.89, 26154.73, 0.18, 6840, 7740),
    tr('4', 'buy', 2.63, 26107.59, 26067.32, -105.91, 9600, 10260),
  ];
  const x = tradeExtras(trades, 0, 11340, 100_000);
  it('computes expectancy, payoff and holds', () => {
    expect(x.expectancy).toBeCloseTo(-279.98 / 4);
    expect(x.payoffRatio).toBeCloseTo(0.18 / (280.16 / 3));
    expect(x.avgHoldWin).toBe(900);
    expect(x.avgHoldLoss).toBeCloseTo((2040 + 1500 + 660) / 3);
  });
  it('splits longs and shorts', () => {
    expect(x.longs.count).toBe(3);
    expect(x.longs.pnl).toBeCloseTo(-280.16);
    expect(x.shorts).toEqual({ count: 1, pnl: 0.18 });
    expect(x.maxLosingStreak).toBe(2);
  });
  it('measures time in market and the largest position', () => {
    expect(x.timeInMarketPct).toBeCloseTo(((2040 + 1500 + 900 + 660) / 11340) * 100);
    expect(x.largestPositionPct).toBeCloseTo(((2.62 * 26228.36) / 100_000) * 100); // trade 2 is the largest notional
  });
  it('is empty-safe', () => {
    const e = tradeExtras([], 0, 0, 100_000);
    expect(e).toMatchObject({ expectancy: null, payoffRatio: null, avgHoldWin: null, avgHoldLoss: null, maxLosingStreak: 0, timeInMarketPct: null, largestPositionPct: null });
  });
});

describe('symbolContext', () => {
  const r = (id: string, symbol: string, returnPct: number) => ({ id, symbol, stats: { returnPct } }) as MatchResult;
  const all = [r('a', 'NQ=F', 1), r('b', 'NQ=F', -0.5), r('c', 'AAPL', 3), r('d', 'NQ=F', 0.2)];
  it('ranks the result among matches on the same symbol', () => {
    expect(symbolContext(all, { id: 'd', symbol: 'NQ=F' })).toEqual({ count: 3, rank: 2, best: 1, avg: expect.closeTo(0.2333, 3) });
    expect(symbolContext(all, { id: 'c', symbol: 'AAPL' })).toEqual({ count: 1, rank: 1, best: 3, avg: 3 });
  });
  it('is null when the result is not saved', () => {
    expect(symbolContext(all, { id: 'zz', symbol: 'NQ=F' })).toBeNull();
  });
  it('ordinal', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 101].map(ordinal)).toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '101st']);
  });
});
