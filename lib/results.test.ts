import { describe, expect, it } from 'vitest';
import { advance, createMatch, endMatch, placeMarketOrder, play } from './engine';
import { MAX_EQUITY_POINTS, buildResult, downsampleEquity } from './results';
import { maxDrawdownPct } from './stats';
import type { Candle, MatchConfig, SymbolInfo } from './types';

const CONFIG: MatchConfig = { symbol: 'NQ=F', currency: 'USD', interval: '1m', durationMs: 600_000, startingBalance: 100_000, maxDrawdownPct: 50, lotStep: 0.01 };
const INFO: SymbolInfo = { symbol: 'NQ=F', name: 'Nasdaq', assetClass: 'futures', currency: 'USD', dataFile: 'x.csv', barsAvailable: 0, firstTime: 0, lastTime: 0, lotStep: 0.01, priceDecimals: 2 };
const candles: Candle[] = [100, 100, 110, 105, 120].map((close, i) => ({ time: 60 * (i + 1), open: close, high: close + 1, low: close - 1, close, volume: 0 }));

describe('buildResult', () => {
  it('records a finished match without candles', () => {
    let m = play(createMatch(CONFIG, candles, 1), 5000);
    m = placeMarketOrder(m, { side: 'buy', units: 100 });
    m = advance(advance(m)); // 110, 105
    m = endMatch(m, 'user');
    const r = buildResult(m, INFO, 'abc', 9999);
    expect(r).toMatchObject({
      version: 1,
      id: 'abc',
      symbol: 'NQ=F',
      symbolName: 'Nasdaq',
      currency: 'USD',
      endReason: 'user',
      playedAt: 5000,
      sessionStart: 120, // the candle the player started on (last history candle)
      sessionEnd: 240,
    });
    expect(r.stats).toMatchObject({ pnl: 500, trades: 1 });
    expect(r.trades).toHaveLength(1);
    expect(r).not.toHaveProperty('candles');
  });

  it('refuses a match that has not ended', () => {
    expect(() => buildResult(createMatch(CONFIG, candles), INFO, 'x', 0)).toThrow();
  });

  it('uses the end time as the play time if the match never started', () => {
    expect(buildResult(endMatch(createMatch(CONFIG, candles), 'user'), INFO, 'x', 42).playedAt).toBe(42);
  });
});

describe('downsampleEquity', () => {
  const wave = (n: number) => Array.from({ length: n }, (_, t) => ({ t, equity: 100_000 + Math.sin(t / 37) * 1000 + (t === 1234 ? -9000 : 0) + (t === 2345 ? 7000 : 0) }));

  it('leaves short curves untouched', () => {
    const c = wave(300);
    expect(downsampleEquity(c)).toBe(c);
  });

  it('caps the length and keeps first, last, the global min and max, in time order', () => {
    const c = wave(5000);
    const d = downsampleEquity(c);
    expect(d.length).toBeLessThanOrEqual(MAX_EQUITY_POINTS);
    expect(d[0]).toBe(c[0]);
    expect(d.at(-1)).toBe(c.at(-1));
    expect(d).toContain(c[1234]);
    expect(d).toContain(c[2345]);
    expect(d.every((p, i) => i === 0 || p.t > d[i - 1].t)).toBe(true);
  });

  it('preserves the worst drawdown of the full curve', () => {
    const c = wave(5000);
    expect(maxDrawdownPct(downsampleEquity(c))).toBeCloseTo(maxDrawdownPct(c), 6);
  });
});
