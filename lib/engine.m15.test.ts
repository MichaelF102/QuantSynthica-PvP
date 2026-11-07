import { describe, expect, it } from 'vitest';
import { OrderError, advance, canPlace, createMatch, placeMarketOrder, play, positionFor, setBrackets } from './engine';
import { bracketPlan, toOrderRequest } from './orders';
import type { Candle, MatchConfig, MatchState } from './types';

// Plan M15: a stop and target attached to the order. TEST FIXTURE: hand-built candles.

const CONFIG: MatchConfig = { symbol: 'TEST', currency: 'USD', interval: '1m', durationMs: 600_000, startingBalance: 100_000, maxDrawdownPct: 50, lotStep: 1 };
type Bar = [open: number, high: number, low: number, close: number];
const bars = (...rows: Bar[]): Candle[] => rows.map(([open, high, low, close], i) => ({ time: 60 * (i + 1), open, high, low, close, volume: 1 }));
const flat = (n: number, p = 100): Bar[] => Array.from({ length: n }, () => [p, p, p, p]);
const running = (rows: Bar[], c: Partial<MatchConfig> = {}): MatchState => play(createMatch({ ...CONFIG, ...c }, bars(...rows), 0), 0);
const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    if (e instanceof OrderError) return e.code;
    throw e;
  }
  return null;
};

describe('levels on the order (close fills)', () => {
  it('opens the position with its stop and target', () => {
    const s = placeMarketOrder(running(flat(3)), { side: 'buy', units: 10, stopLoss: 95, takeProfit: 110 });
    expect(positionFor(s)).toMatchObject({ units: 10, stopLoss: 95, takeProfit: 110 });
  });

  it('validates the levels for the order side', () => {
    const s = running(flat(3));
    expect(canPlace(s, { side: 'buy', units: 1, stopLoss: 101 })).toBe('invalid_stop');
    expect(canPlace(s, { side: 'sell', units: 1, stopLoss: 95 })).toBe('invalid_stop');
    expect(canPlace(s, { side: 'sell', units: 1, stopLoss: 105, takeProfit: 90 })).toBeNull();
    expect(canPlace(s, { side: 'sell', units: 1, takeProfit: 110 })).toBe('invalid_target');
  });

  it('refuses levels on an order that only reduces the position', () => {
    const long = placeMarketOrder(running(flat(3)), { side: 'buy', units: 10 });
    expect(code(() => placeMarketOrder(long, { side: 'sell', units: 4, stopLoss: 105 }))).toBe('brackets_need_entry');
    expect(code(() => placeMarketOrder(long, { side: 'sell', units: 10, stopLoss: 105 }))).toBe('brackets_need_entry');
  });

  it('a flip carries the levels to the new side; an add replaces the old ones', () => {
    const long = setBrackets(placeMarketOrder(running(flat(3)), { side: 'buy', units: 10 }), { stopLoss: 90, takeProfit: 120 });
    expect(positionFor(placeMarketOrder(long, { side: 'sell', units: 15, stopLoss: 105, takeProfit: 95 }))).toMatchObject({ units: -5, stopLoss: 105, takeProfit: 95 });
    expect(positionFor(placeMarketOrder(long, { side: 'buy', units: 5, stopLoss: 97, takeProfit: null }))).toEqual({ symbol: 'TEST', units: 15, avgEntry: 100, openedAt: 60, stopLoss: 97 });
    // Without levels on the order, the position keeps its own.
    expect(positionFor(placeMarketOrder(long, { side: 'buy', units: 5 }))).toMatchObject({ stopLoss: 90, takeProfit: 120 });
  });

  it('empty levels count as none', () => {
    expect(toOrderRequest('buy', { mode: 'units', value: 1 }, null)).toEqual({ side: 'buy', units: 1 });
    const s = placeMarketOrder(running(flat(3)), { side: 'buy', units: 1, stopLoss: null, takeProfit: null });
    expect(positionFor(s)).not.toHaveProperty('stopLoss');
  });

  it('the attached stop protects the position from the next candle', () => {
    const s = advance(placeMarketOrder(running([[100, 100, 100, 100], [99, 99, 93, 94], ...flat(2)]), { side: 'buy', units: 10, stopLoss: 95 }));
    expect(s.fills.at(-1)).toMatchObject({ trigger: 'stop_loss', price: 95 });
  });
});

describe('levels on a next-open order', () => {
  it('fills at the open with the levels attached', () => {
    const q = placeMarketOrder(running([[100, 100, 100, 100], [101, 101, 101, 101], ...flat(2, 101)], { fillModel: 'next_open' }), { side: 'buy', units: 10, stopLoss: 95, takeProfit: 110 });
    expect(q.queued).toMatchObject({ stopLoss: 95, takeProfit: 110 });
    expect(positionFor(advance(q))).toMatchObject({ avgEntry: 101, stopLoss: 95, takeProfit: 110 });
  });

  it('is cancelled when the open is already past a level', () => {
    const q = placeMarketOrder(running([[100, 100, 100, 100], [94, 95, 93, 94], ...flat(2, 94)], { fillModel: 'next_open' }), { side: 'buy', units: 10, stopLoss: 95 });
    const s = advance(q);
    expect(s.positions).toHaveLength(0);
    expect(s.cancelled.at(-1)).toMatchObject({ reason: 'brackets_invalid' });
  });
});

describe('bracketPlan', () => {
  it('turns levels into risk, reward and ratio', () => {
    expect(bracketPlan('buy', 10, 100, { stopLoss: 95, takeProfit: 110 })).toEqual({ risk: 50, reward: 100, ratio: 2 });
    expect(bracketPlan('sell', 10, 100, { stopLoss: 102, takeProfit: null })).toEqual({ risk: 20, reward: null, ratio: null });
    expect(bracketPlan('buy', 10, 100, { stopLoss: 105, takeProfit: null }).risk).toBeNull();
  });
});
