import { describe, expect, it } from 'vitest';
import { OrderError, advance, canPlace, cancelQueued, closePosition, createMatch, endMatch, equity, placeMarketOrder, play, positionFor, setBrackets } from './engine';
import type { Candle, MatchConfig, MatchState } from './types';

// Plan M12: next-open fills (C1–C3), stop-loss / take-profit (C4, C5) and costs (C6–C8).
// Candles here are hand-built test data.

const CONFIG: MatchConfig = { symbol: 'TEST', currency: 'USD', interval: '1m', durationMs: 600_000, startingBalance: 100_000, maxDrawdownPct: 50, lotStep: 1 };

type Bar = [open: number, high: number, low: number, close: number];
const bars = (...rows: Bar[]): Candle[] => rows.map(([open, high, low, close], i) => ({ time: 60 * (i + 1), open, high, low, close, volume: 1 }));
const flat = (n: number, price = 100): Bar[] => Array.from({ length: n }, () => [price, price, price, price]);

function running(rows: Bar[], config: Partial<MatchConfig> = {}): MatchState {
  return play(createMatch({ ...CONFIG, ...config }, bars(...rows), 0), 0);
}

const buy = (s: MatchState, units: number) => placeMarketOrder(s, { side: 'buy', units });
const sell = (s: MatchState, units: number) => placeMarketOrder(s, { side: 'sell', units });
const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    if (e instanceof OrderError) return e.code;
    throw e;
  }
  return null;
};

describe('defaults keep the old rules', () => {
  it('a config without the new fields fills at the close with no fee or trigger fields', () => {
    const s = buy(running(flat(3)), 2);
    expect(s.fills[0]).toEqual({ id: 'TEST-60-f1', symbol: 'TEST', side: 'buy', units: 2, price: 100, time: 60, realizedPnl: 0 });
    expect(s.queued).toBeNull();
    expect(s.positions[0]).toEqual({ symbol: 'TEST', units: 2, avgEntry: 100, openedAt: 60 });
  });
});

describe('next-open fill model (C1–C3)', () => {
  const rows: Bar[] = [
    [100, 100, 100, 100],
    [103, 106, 102, 105],
    [105, 105, 105, 105],
    [105, 105, 105, 105],
  ];
  const nextOpen = (r: Bar[] = rows, config: Partial<MatchConfig> = {}) => running(r, { fillModel: 'next_open', ...config });

  it('queues the order and fills it at the next candle open, not before', () => {
    const queued = buy(nextOpen(), 10);
    expect(queued.fills).toHaveLength(0);
    expect(queued.positions).toHaveLength(0);
    expect(queued.queued).toMatchObject({ side: 'buy', units: 10, placedAt: 60 });

    const next = advance(queued);
    expect(next.queued).toBeNull();
    expect(next.fills[0]).toMatchObject({ price: 103, time: 120, trigger: 'next_open' });
    expect(positionFor(next)).toMatchObject({ units: 10, avgEntry: 103 });
  });

  it('allows one waiting order at a time', () => {
    const queued = buy(nextOpen(), 10);
    expect(code(() => sell(queued, 1))).toBe('order_queued');
    expect(canPlace(queued, { side: 'buy', units: 1 })).toBe('order_queued');
  });

  it('the player can cancel the waiting order', () => {
    const s = cancelQueued(buy(nextOpen(), 10));
    expect(s.queued).toBeNull();
    expect(s.cancelled).toEqual([expect.objectContaining({ reason: 'user', units: 10 })]);
    expect(advance(s).fills).toHaveLength(0);
  });

  it('cancels at the open when the order no longer fits the balance', () => {
    // 1,000 units at 100 = the whole balance; the next open is higher, so it no longer fits.
    const s = advance(buy(nextOpen(), 1000));
    expect(s.fills).toHaveLength(0);
    expect(s.cancelled[0]).toMatchObject({ reason: 'insufficient_balance', cancelledAt: 120 });
  });

  it('queues a close and closes the whole position at the open', () => {
    const open = advance(buy(nextOpen(), 10));
    const closing = closePosition(open);
    expect(closing.queued).toMatchObject({ side: 'sell', units: 10, close: true });
    const closed = advance(closing);
    expect(closed.positions).toHaveLength(0);
    expect(closed.trades[0]).toMatchObject({ entry: 103, exit: 105, pnl: 20 });
  });

  it('ending the match cancels the waiting order and force-closes at the last close (C3)', () => {
    const open = advance(buy(nextOpen(), 10));
    const ended = endMatch(sell(open, 4), 'user');
    expect(ended.cancelled.at(-1)).toMatchObject({ reason: 'match_end', units: 4 });
    expect(ended.fills.at(-1)).toMatchObject({ side: 'sell', units: 10, price: 105, trigger: 'match_end' });
  });
});

describe('stop-loss and take-profit (C4, C5)', () => {
  const long = (rows: Bar[]) => buy(running(rows), 10);
  const short = (rows: Bar[]) => sell(running(rows), 10);

  it('validates levels against the current price and side', () => {
    const l = long(flat(3));
    expect(code(() => setBrackets(l, { stopLoss: 101, takeProfit: null }))).toBe('invalid_stop');
    expect(code(() => setBrackets(l, { stopLoss: null, takeProfit: 99 }))).toBe('invalid_target');
    const s = short(flat(3));
    expect(code(() => setBrackets(s, { stopLoss: 99, takeProfit: null }))).toBe('invalid_stop');
    expect(code(() => setBrackets(s, { stopLoss: null, takeProfit: 101 }))).toBe('invalid_target');
    expect(code(() => setBrackets(running(flat(3)), { stopLoss: 90, takeProfit: null }))).toBe('no_position');
  });

  it('sets and clears levels', () => {
    const s = setBrackets(long(flat(3)), { stopLoss: 95, takeProfit: 110 });
    expect(positionFor(s)).toMatchObject({ stopLoss: 95, takeProfit: 110 });
    const cleared = setBrackets(s, { stopLoss: null, takeProfit: null });
    expect(positionFor(cleared)).toEqual({ symbol: 'TEST', units: 10, avgEntry: 100, openedAt: 60 });
  });

  it('a long stop fills at the stop when the low touches it', () => {
    const s = advance(setBrackets(long([[100, 100, 100, 100], [99, 99.5, 94, 96], ...flat(2)]), { stopLoss: 95, takeProfit: null }));
    expect(s.positions).toHaveLength(0);
    expect(s.fills.at(-1)).toMatchObject({ side: 'sell', price: 95, trigger: 'stop_loss', time: 120 });
    expect(s.trades[0].pnl).toBe(-50);
  });

  it('a gap through the stop fills at the open', () => {
    const s = advance(setBrackets(long([[100, 100, 100, 100], [92, 93, 91, 92], ...flat(2)]), { stopLoss: 95, takeProfit: null }));
    expect(s.fills.at(-1)).toMatchObject({ price: 92, trigger: 'stop_loss' });
  });

  it('a long target fills at the target, and a gap above it fills at the open', () => {
    const touch = advance(setBrackets(long([[100, 100, 100, 100], [101, 106, 100, 104], ...flat(2)]), { stopLoss: null, takeProfit: 105 }));
    expect(touch.fills.at(-1)).toMatchObject({ price: 105, trigger: 'take_profit' });
    const gap = advance(setBrackets(long([[100, 100, 100, 100], [108, 109, 107, 108], ...flat(2)]), { stopLoss: null, takeProfit: 105 }));
    expect(gap.fills.at(-1)).toMatchObject({ price: 108, trigger: 'take_profit' });
  });

  it('when one candle touches both levels the stop wins', () => {
    const s = advance(setBrackets(long([[100, 100, 100, 100], [100, 106, 94, 100], ...flat(2)]), { stopLoss: 95, takeProfit: 105 }));
    expect(s.fills.at(-1)).toMatchObject({ price: 95, trigger: 'stop_loss' });
  });

  it('works for a short (mirror image)', () => {
    const stop = advance(setBrackets(short([[100, 100, 100, 100], [101, 106, 100, 104], ...flat(2)]), { stopLoss: 105, takeProfit: 90 }));
    expect(stop.fills.at(-1)).toMatchObject({ side: 'buy', price: 105, trigger: 'stop_loss' });
    const target = advance(setBrackets(short([[100, 100, 100, 100], [99, 99, 89, 91], ...flat(2)]), { stopLoss: 105, takeProfit: 90 }));
    expect(target.fills.at(-1)).toMatchObject({ side: 'buy', price: 90, trigger: 'take_profit' });
  });

  it('levels are kept when adding or partly reducing, and cleared on a flip', () => {
    const s = setBrackets(long(flat(4)), { stopLoss: 95, takeProfit: 110 });
    expect(positionFor(buy(s, 5))).toMatchObject({ units: 15, stopLoss: 95, takeProfit: 110 });
    expect(positionFor(sell(s, 4))).toMatchObject({ units: 6, stopLoss: 95, takeProfit: 110 });
    const flipped = positionFor(sell(s, 15));
    expect(flipped).toEqual({ symbol: 'TEST', units: -5, avgEntry: 100, openedAt: 60 });
  });

  it('a stop only triggers on candles revealed after it was set (no look-ahead)', () => {
    const s = setBrackets(long([[100, 100, 100, 100], [100, 100, 100, 100], [99, 99, 90, 92], ...flat(1)]), { stopLoss: 95, takeProfit: null });
    const one = advance(s);
    expect(one.positions).toHaveLength(1);
    expect(advance(one).positions).toHaveLength(0);
  });

  it('a queued close fills at the open before the stop is checked', () => {
    const rows: Bar[] = [[100, 100, 100, 100], [100, 100, 100, 100], [97, 97, 90, 92], ...flat(1)];
    const opened = advance(buy(running(rows, { fillModel: 'next_open' }), 10));
    const s = advance(closePosition(setBrackets(opened, { stopLoss: 95, takeProfit: null })));
    expect(s.fills.at(-1)).toMatchObject({ price: 97, trigger: 'next_open' });
    expect(s.fills.filter((f) => f.trigger === 'stop_loss')).toHaveLength(0);
  });
});

describe('commission and slippage (C6–C8)', () => {
  it('charges the commission on every fill and nets it into trade P&L', () => {
    const rows: Bar[] = [[100, 100, 100, 100], [110, 110, 110, 110], ...flat(2, 110)];
    const opened = buy(running(rows, { commission: 5 }), 10);
    expect(opened.balance).toBe(100_000 - 5);
    expect(opened.fills[0].fee).toBe(5);
    expect(equity(opened)).toBe(100_000 - 5);

    const closed = sell(advance(opened), 10);
    expect(closed.trades[0]).toMatchObject({ pnl: 100 - 10, fees: 10 });
    expect(closed.balance).toBe(100_000 + 100 - 10);
  });

  it('splits fees pro rata on partial closes so trade P&L adds up to the balance change', () => {
    const rows: Bar[] = [[100, 100, 100, 100], [104, 104, 104, 104], [97, 97, 97, 97], [101, 101, 101, 101]];
    let s = buy(running(rows, { commission: 3 }), 10);
    s = sell(advance(s), 4); // closes 4 of 10
    s = sell(advance(s), 12); // closes the other 6 and opens a 6 short
    s = endMatch(advance(s), 'user');
    const total = s.trades.reduce((sum, t) => sum + t.pnl, 0);
    expect(total).toBeCloseTo(s.balance - 100_000, 9);
    expect(s.fills.reduce((sum, f) => sum + (f.fee ?? 0), 0)).toBe(12);
  });

  it('applies slippage against the player on market and forced-close fills', () => {
    const s = buy(running(flat(3), { slippageBps: 10 }), 10);
    expect(s.fills[0].price).toBeCloseTo(100.1, 9);
    const ended = endMatch(s, 'user');
    expect(ended.fills.at(-1)?.price).toBeCloseTo(99.9, 9);
    expect(ended.trades[0].pnl).toBeCloseTo(-2, 9);
  });

  it('applies slippage to stops but not to targets', () => {
    const stopRows: Bar[] = [[100, 100, 100, 100], [99, 99, 94, 96], ...flat(2)];
    const stop = advance(setBrackets(buy(running(stopRows, { slippageBps: 100 }), 1), { stopLoss: 95, takeProfit: null }));
    expect(stop.fills.at(-1)?.price).toBeCloseTo(95 * 0.99, 9);
    const tpRows: Bar[] = [[100, 100, 100, 100], [101, 106, 100, 104], ...flat(2)];
    const target = advance(setBrackets(buy(running(tpRows, { slippageBps: 100 }), 1), { stopLoss: null, takeProfit: 105 }));
    expect(target.fills.at(-1)?.price).toBe(105);
  });

  it('no leverage counts the fee and slippage (C8), and 100% of balance still fits', () => {
    const s = running(flat(3), { commission: 10 });
    expect(canPlace(s, { side: 'buy', units: 1000 })).toBe('insufficient_balance');
    expect(canPlace(s, { side: 'buy', units: 999 })).toBeNull();
    const slip = running(flat(3), { slippageBps: 50 });
    expect(canPlace(slip, { side: 'buy', units: 1000 })).toBe('insufficient_balance');
    const all = placeMarketOrder(running(flat(3), { commission: 10, slippageBps: 50 }), { side: 'buy', percent: 100 });
    expect(all.fills).toHaveLength(1);
    expect(all.balance).toBeGreaterThanOrEqual(0);
  });
});
