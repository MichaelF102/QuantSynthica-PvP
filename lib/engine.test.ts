import { describe, expect, it } from 'vitest';
import {
  advance,
  createMatch,
  currentCandle,
  endMatch,
  equity,
  pause,
  play,
  remainingMs,
  replayProgress,
  sessionEndTime,
  tick,
  visibleCandles,
} from './engine';
import type { Candle, MatchConfig, MatchState } from './types';

// M4 subset: replay rules. M5 adds orders, P&L and drawdown tests.

const CONFIG: MatchConfig = { symbol: 'TEST', currency: 'USD', interval: '1m', durationMs: 10_000, startingBalance: 100_000, maxDrawdownPct: 5, lotStep: 0.01 };
const candles = (n: number): Candle[] => Array.from({ length: n }, (_, i) => ({ time: 60 * (i + 1), open: 100 + i, high: 101 + i, low: 99 + i, close: 100.5 + i, volume: i }));

function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object') {
    Object.freeze(o);
    for (const v of Object.values(o)) deepFreeze(v);
  }
  return o;
}

describe('createMatch', () => {
  it('starts idle at the start cursor with one equity point', () => {
    const m = createMatch(CONFIG, candles(10), 3);
    expect(m).toMatchObject({ status: 'idle', cursor: 3, startCursor: 3, balance: 100_000, elapsedMs: 0, startedAt: null, positions: [], trades: [] });
    expect(m.equityCurve).toEqual([{ t: 240, equity: 100_000 }]);
  });

  it('rejects empty sessions, bad cursors and bad config', () => {
    expect(() => createMatch(CONFIG, [], 0)).toThrow(RangeError);
    expect(() => createMatch(CONFIG, candles(5), 5)).toThrow(RangeError);
    expect(() => createMatch(CONFIG, candles(5), -1)).toThrow(RangeError);
    expect(() => createMatch(CONFIG, candles(5), 1.5)).toThrow(RangeError);
    expect(() => createMatch({ ...CONFIG, startingBalance: 0 }, candles(5))).toThrow(RangeError);
    expect(() => createMatch({ ...CONFIG, durationMs: 0 }, candles(5))).toThrow(RangeError);
  });
});

describe('play / pause', () => {
  it('play from idle starts the match and records the start time once', () => {
    const m = play(createMatch(CONFIG, candles(5)), 1234);
    expect(m.status).toBe('running');
    expect(m.startedAt).toBe(1234);
    expect(play(pause(m, 9999), 5555).startedAt).toBe(1234);
  });

  it('pause from idle counts as started; pause twice is a no-op', () => {
    const p = pause(createMatch(CONFIG, candles(5)), 42);
    expect(p).toMatchObject({ status: 'paused', startedAt: 42 });
    expect(pause(p, 99)).toBe(p);
  });

  it('cannot play or pause an ended match', () => {
    const ended = endMatch(createMatch(CONFIG, candles(5)), 'user');
    expect(play(ended, 1)).toBe(ended);
    expect(pause(ended, 1)).toBe(ended);
  });
});

describe('advance', () => {
  it('moves the cursor by one and appends an equity point (rule 9)', () => {
    const m = advance(createMatch(CONFIG, candles(5), 1));
    expect(m.cursor).toBe(2);
    expect(m.equityCurve).toEqual([
      { t: 120, equity: 100_000 },
      { t: 180, equity: 100_000 },
    ]);
  });

  it('ends with data_end when the last candle is revealed and never moves past it (rule 8)', () => {
    let m = createMatch(CONFIG, candles(3), 0);
    m = advance(advance(m));
    expect(m).toMatchObject({ cursor: 2, status: 'ended', endReason: 'data_end' });
    expect(advance(m)).toBe(m);
  });

  it('does nothing once the match has ended', () => {
    const ended = endMatch(createMatch(CONFIG, candles(5)), 'user');
    expect(advance(ended)).toBe(ended);
  });
});

describe('tick (rule 7)', () => {
  it('adds time only while running', () => {
    const idle = createMatch(CONFIG, candles(5));
    expect(tick(idle, 500)).toBe(idle);
    const running = tick(play(idle, 0), 500);
    expect(running.elapsedMs).toBe(500);
    const paused = pause(running, 0);
    expect(tick(paused, 500).elapsedMs).toBe(500);
  });

  it('ignores zero, negative and non-finite frames', () => {
    const m = play(createMatch(CONFIG, candles(5)), 0);
    expect(tick(m, 0)).toBe(m);
    expect(tick(m, -10)).toBe(m);
    expect(tick(m, Number.NaN)).toBe(m);
  });

  it('ends with timer exactly at the duration and clamps the elapsed time', () => {
    let m = play(createMatch(CONFIG, candles(5)), 0);
    m = tick(m, 9_999);
    expect(m.status).toBe('running');
    expect(remainingMs(m)).toBe(1);
    m = tick(m, 5_000);
    expect(m).toMatchObject({ status: 'ended', endReason: 'timer', elapsedMs: 10_000 });
    expect(remainingMs(m)).toBe(0);
  });
});

describe('endMatch', () => {
  it('is idempotent: the first reason wins', () => {
    const m = endMatch(createMatch(CONFIG, candles(5)), 'timer');
    expect(endMatch(m, 'user')).toBe(m);
    expect(m.endReason).toBe('timer');
  });
});

describe('no look-ahead (rule 10)', () => {
  it('visibleCandles stops at the cursor', () => {
    const m = advance(advance(createMatch(CONFIG, candles(10), 2)));
    expect(visibleCandles(m)).toHaveLength(5);
    expect(visibleCandles(m).at(-1)).toBe(currentCandle(m));
    expect(visibleCandles(m).some((c) => c.time > currentCandle(m).time)).toBe(false);
  });

  it('changing future candles changes nothing the player can see', () => {
    const a = candles(10);
    const b = a.map((c, i) => (i > 4 ? { ...c, close: 1e9, high: 1e9 } : c));
    const run = (cs: Candle[]) => {
      let m = play(createMatch(CONFIG, cs, 2), 0);
      m = tick(advance(advance(m)), 100);
      return { visible: visibleCandles(m), equity: equity(m), curve: m.equityCurve, cursor: m.cursor };
    };
    expect(run(b)).toEqual(run(a));
  });
});

describe('helpers', () => {
  it('reports progress over playable candles only and the session end time', () => {
    const m = advance(createMatch(CONFIG, candles(10), 3));
    expect(replayProgress(m)).toEqual({ revealed: 1, total: 6 });
    expect(sessionEndTime(m)).toBe(600);
  });
});

describe('immutability', () => {
  it('never mutates the state it is given', () => {
    const frozen = deepFreeze(createMatch(CONFIG, candles(5), 1)) as MatchState;
    expect(() => {
      let m = play(frozen, 0);
      m = tick(m, 100);
      m = advance(m);
      m = pause(m, 0);
      endMatch(m, 'user');
    }).not.toThrow();
    expect(frozen.cursor).toBe(1);
  });
});
