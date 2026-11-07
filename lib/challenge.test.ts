import { describe, expect, it } from 'vitest';
import { challengeConfig, challengeFromResult, challengeUrl, cleanName, decodeChallenge, encodeChallenge, sessionAt, type Challenge } from './challenge';
import { DataError } from './data';
import type { MatchResult } from './results';
import type { Candle, SymbolInfo } from './types';

// Plan M13 Part C. TEST FIXTURE: synthetic candles and a hand-written result, not market data.

const CH: Challenge = {
  v: 1,
  symbol: '^NSEI',
  start: 1_791_293_400,
  durationMin: 5,
  balance: 1_000_000,
  maxDrawdownPct: 4,
  fillModel: 'next_open',
  commission: 20,
  from: 'Ann ✓',
  score: { returnPct: 1.25, trades: 3, winRate: 66.66, maxDrawdownPct: 0.8 },
};
const INFO: SymbolInfo = { symbol: '^NSEI', name: 'Nifty 50', assetClass: 'index', currency: 'INR', dataFile: 'x.csv', barsAvailable: 0, firstTime: 0, lastTime: 0, lotStep: 0.01, priceDecimals: 2 };
const enc = (o: unknown) => encodeChallenge(o as Challenge);

describe('encode / decode', () => {
  it('round-trips, including non-ASCII names, and is URL-safe', () => {
    const code = encodeChallenge(CH);
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeChallenge(code)).toEqual(CH);
  });

  it('rejects junk, wrong shapes and out-of-range settings (C4)', () => {
    expect(decodeChallenge('')).toBeNull();
    expect(decodeChallenge('not base64!')).toBeNull();
    expect(decodeChallenge(enc([1, 2]))).toBeNull();
    expect(decodeChallenge(enc({ ...CH, v: 2 }))).toBeNull();
    expect(decodeChallenge(enc({ ...CH, durationMin: 7 }))).toBeNull();
    expect(decodeChallenge(enc({ ...CH, balance: 5 }))).toBeNull();
    expect(decodeChallenge(enc({ ...CH, maxDrawdownPct: 90 }))).toBeNull();
    expect(decodeChallenge(enc({ ...CH, fillModel: 'later' }))).toBeNull();
    expect(decodeChallenge(enc({ ...CH, from: '   ' }))).toBeNull();
    expect(decodeChallenge(enc({ ...CH, score: { ...CH.score, trades: 1.5 } }))).toBeNull();
    expect(decodeChallenge('A'.repeat(3000))).toBeNull();
  });

  it('cleans the name and drops default costs', () => {
    expect(cleanName('  a\u0007b   c ')).toBe('ab c');
    expect(cleanName('x'.repeat(40))).toHaveLength(20);
    const plain = decodeChallenge(enc({ ...CH, fillModel: 'close', commission: 0, slippageBps: 0 }));
    expect(plain).not.toHaveProperty('fillModel');
    expect(plain).not.toHaveProperty('commission');
  });
});

describe('challengeFromResult', () => {
  it('carries the session start, rules and score', () => {
    const r = {
      symbol: '^NSEI',
      sessionStart: CH.start,
      config: { symbol: '^NSEI', currency: 'INR', interval: '1m', durationMs: 300_000, startingBalance: 1_000_000, maxDrawdownPct: 4, lotStep: 0.01, fillModel: 'next_open', commission: 20 },
      stats: { returnPct: 1.25, trades: 3, winRate: 66.66, maxDrawdownPct: 0.8 },
    } as unknown as MatchResult;
    expect(challengeFromResult(r, ' Ann ✓ ')).toEqual(CH);
    expect(challengeFromResult(r, '').from).toBe('A friend');
    expect(challengeUrl('https://x.test', CH)).toBe(`https://x.test/practice?challenge=${encodeChallenge(CH)}`);
  });

  it('builds the same match config', () => {
    expect(challengeConfig(CH, INFO)).toMatchObject({ symbol: '^NSEI', currency: 'INR', durationMs: 300_000, startingBalance: 1_000_000, maxDrawdownPct: 4, fillModel: 'next_open', commission: 20 });
  });
});

describe('sessionAt', () => {
  const candles: Candle[] = Array.from({ length: 2_500 }, (_, i) => ({ time: 1_000 + 60 * i, open: 1, high: 1, low: 1, close: 1, volume: 1 }));
  const config = challengeConfig({ ...CH, durationMin: 5 }, INFO);

  it('starts on the challenge candle with the usual history (C2)', () => {
    const start = candles[400].time;
    const s = sessionAt(candles, start, config);
    expect(s.candles[s.startCursor].time).toBe(start);
    expect(s.startCursor).toBe(299);
    expect(s.limitedData).toBe(false);
    expect(s.candles.length - 1 - s.startCursor).toBe(1800); // 300 s × 5x × 1.2
  });

  it('works with less history and flags a short tail as limited', () => {
    const early = sessionAt(candles, candles[10].time, config);
    expect(early.startCursor).toBe(10);
    const late = sessionAt(candles, candles[2_100].time, config);
    expect(late.limitedData).toBe(true);
  });

  it('says so when the data no longer covers the session (C3)', () => {
    expect(() => sessionAt(candles, 999, config)).toThrow(DataError);
    expect(() => sessionAt(candles, candles[2_400].time, config)).toThrow(/no longer covers/);
  });
});
