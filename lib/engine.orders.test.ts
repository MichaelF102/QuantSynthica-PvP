import { describe, expect, it } from 'vitest';
import {
  OrderError,
  advance,
  canPlace,
  closePosition,
  createMatch,
  drawdownPct,
  endMatch,
  equity,
  pause,
  placeMarketOrder,
  play,
  positionFor,
  realizedPnl,
  tick,
  unrealizedPnl,
} from './engine';
import type { Candle, MatchConfig, MatchState, OrderRequest } from './types';

// CLAUDE.md §5 rules 1–10 and the §12 required cases. Candles here are hand-built test data.

const CONFIG: MatchConfig = { symbol: 'TEST', currency: 'USD', interval: '1m', durationMs: 600_000, startingBalance: 100_000, maxDrawdownPct: 5, lotStep: 1 };

/** Candles whose closes are the given prices, one minute apart. */
function closes(...prices: number[]): Candle[] {
  return prices.map((close, i) => {
    const open = i === 0 ? close : prices[i - 1];
    return { time: 60 * (i + 1), open, high: Math.max(open, close) + 1, low: Math.min(open, close) - 1, close, volume: 1 };
  });
}

/** A running match on these closes, cursor on the first candle. */
function running(prices: number[], config: Partial<MatchConfig> = {}): MatchState {
  return play(createMatch({ ...CONFIG, ...config }, closes(...prices), 0), 0);
}

const order = (s: MatchState, o: OrderRequest) => placeMarketOrder(s, o);
const buy = (s: MatchState, units: number) => order(s, { side: 'buy', units });
const sell = (s: MatchState, units: number) => order(s, { side: 'sell', units });

function rejects(fn: () => unknown, code: OrderError['code']) {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(OrderError);
    expect((e as OrderError).code).toBe(code);
    return;
  }
  throw new Error(`expected OrderError(${code})`);
}

function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object') {
    Object.freeze(o);
    for (const v of Object.values(o)) deepFreeze(v);
  }
  return o;
}

describe('rule 1: fills at the current close', () => {
  it('records the fill at candles[cursor].close', () => {
    const m = buy(advance(running([100, 103.5, 90])), 10);
    expect(m.fills).toEqual([{ id: 'TEST-120-f1', symbol: 'TEST', side: 'buy', units: 10, price: 103.5, time: 120, realizedPnl: 0 }]);
    expect(positionFor(m)).toEqual({ symbol: 'TEST', units: 10, avgEntry: 103.5, openedAt: 120 });
  });
});

describe('rules 3 and 5: positions and P&L', () => {
  it('buy then sell at a profit', () => {
    const m = sell(advance(buy(running([100, 110, 120]), 10)), 10);
    expect(m.positions).toEqual([]);
    expect(m.balance).toBe(100_100);
    expect(m.trades).toEqual([{ id: 'TEST-120-1', symbol: 'TEST', side: 'buy', units: 10, entry: 100, exit: 110, pnl: 100, openedAt: 60, closedAt: 120 }]);
    expect(realizedPnl(m)).toBe(100);
  });

  it('buy then sell at a loss', () => {
    const m = sell(advance(buy(running([100, 98, 120]), 10)), 10);
    expect(m.balance).toBe(99_980);
    expect(m.trades[0]).toMatchObject({ pnl: -20, side: 'buy' });
  });

  it('sell short then buy back at a profit and at a loss', () => {
    const win = buy(advance(sell(running([100, 90, 120]), 10)), 10);
    expect(win.trades[0]).toMatchObject({ side: 'sell', entry: 100, exit: 90, pnl: 100 });
    const loss = buy(advance(sell(running([100, 104, 120]), 10)), 10);
    expect(loss.trades[0]).toMatchObject({ side: 'sell', pnl: -40 });
  });

  it('unrealized P&L and equity follow the current close, signed by side', () => {
    const long = advance(buy(running([100, 104, 120]), 10));
    expect(unrealizedPnl(long)).toBe(40);
    expect(equity(long)).toBe(100_040);
    const short = advance(sell(running([100, 104, 120]), 10));
    expect(unrealizedPnl(short)).toBe(-40);
    expect(equity(short)).toBe(99_960);
  });

  it('adding to a position averages the entry by size', () => {
    const m = buy(advance(buy(running([100, 110, 120]), 10)), 30);
    expect(positionFor(m)).toEqual({ symbol: 'TEST', units: 40, avgEntry: 107.5, openedAt: 60 });
  });

  it('partial close realises P&L on the closed units only and keeps the entry', () => {
    const m = sell(advance(buy(running([100, 105, 120]), 10)), 4);
    expect(m.trades).toHaveLength(1);
    expect(m.trades[0]).toMatchObject({ units: 4, pnl: 20 });
    expect(positionFor(m)).toEqual({ symbol: 'TEST', units: 6, avgEntry: 100, openedAt: 60 });
    expect(m.balance).toBe(100_020);
  });

  it('overshoot flips the side: the remainder opens at the fill price', () => {
    const m = sell(advance(buy(running([100, 105, 120]), 5)), 8);
    expect(m.trades).toHaveLength(1);
    expect(m.trades[0]).toMatchObject({ side: 'buy', units: 5, pnl: 25 });
    expect(positionFor(m)).toEqual({ symbol: 'TEST', units: -3, avgEntry: 105, openedAt: 120 });
    expect(m.fills.at(-1)).toMatchObject({ side: 'sell', units: 8, realizedPnl: 25 });
  });

  it('closePosition closes longs and shorts and is a no-op when flat', () => {
    const flat = running([100, 105]);
    expect(closePosition(flat)).toBe(flat);
    const closedShort = closePosition(advance(sell(running([100, 95, 120]), 7)));
    expect(closedShort.positions).toEqual([]);
    expect(closedShort.trades[0]).toMatchObject({ side: 'sell', units: 7, pnl: 35 });
  });
});

describe('rule 2: size', () => {
  it('converts % of balance to units at the fill price, rounded down to the lot step', () => {
    expect(positionFor(order(running([333, 340]), { side: 'buy', percent: 50 }))?.units).toBe(150); // 150.15 -> 150
    expect(positionFor(order(running([333, 340], { lotStep: 0.01 }), { side: 'buy', percent: 50 }))?.units).toBe(150.15);
  });

  it('rounds unit sizes down to the lot step without float drift', () => {
    let m = running([10, 11], { lotStep: 0.01 });
    m = buy(m, 0.1);
    m = buy(m, 0.2);
    expect(positionFor(m)?.units).toBe(0.3);
    expect(positionFor(buy(running([10, 11], { lotStep: 0.01 }), 1.239))?.units).toBe(1.23);
  });

  it('rejects sizes that round to zero', () => {
    rejects(() => buy(running([100, 101]), 0), 'size_zero');
    rejects(() => buy(running([100, 101], { lotStep: 0.01 }), 0.005), 'size_zero');
    rejects(() => order(running([1000, 1001]), { side: 'buy', percent: 0.0001 }), 'size_zero');
  });

  it('rejects negative, NaN and infinite sizes', () => {
    rejects(() => buy(running([100, 101]), -1), 'invalid_size');
    rejects(() => buy(running([100, 101]), Number.NaN), 'invalid_size');
    rejects(() => order(running([100, 101]), { side: 'sell', percent: Infinity }), 'invalid_size');
  });

  it('caps percent at 100', () => {
    expect(positionFor(order(running([100, 101]), { side: 'buy', percent: 250 }))?.units).toBe(1000);
  });
});

describe('rule 4: no leverage', () => {
  it('rejects an order whose notional exceeds the balance (insufficient balance)', () => {
    rejects(() => buy(running([100, 101]), 1001), 'insufficient_balance');
    expect(positionFor(buy(running([100, 101]), 1000))?.units).toBe(1000);
  });

  it('cannot stack orders past the balance', () => {
    const m = buy(running([100, 101]), 600);
    rejects(() => buy(m, 500), 'insufficient_balance');
    expect(canPlace(m, { side: 'buy', units: 400 })).toBeNull();
  });

  it('always allows reducing or closing, even when the position is worth more than the balance', () => {
    const m = advance(buy(running([100, 120, 130]), 1000)); // worth 120,000 vs balance 100,000
    rejects(() => buy(m, 1), 'insufficient_balance');
    expect(canPlace(m, { side: 'sell', units: 400 })).toBeNull();
    expect(sell(m, 1000).positions).toEqual([]);
  });

  it('checks the opening remainder of a flip', () => {
    const m = buy(running([100, 101]), 1000);
    rejects(() => sell(m, 2001), 'insufficient_balance');
    expect(positionFor(sell(m, 2000))?.units).toBe(-1000);
  });

  it('canPlace reports the rejection reason without throwing', () => {
    const m = running([100, 101]);
    expect(canPlace(m, { side: 'buy', units: 0 })).toBe('size_zero');
    expect(canPlace(m, { side: 'buy', units: 5000 })).toBe('insufficient_balance');
    expect(canPlace(m, { side: 'buy', units: 5 })).toBeNull();
  });
});

describe('order status', () => {
  it('allows orders while running or paused, not while idle or ended', () => {
    const idle = createMatch(CONFIG, closes(100, 101));
    rejects(() => buy(idle, 1), 'match_not_running');
    expect(positionFor(buy(pause(running([100, 101]), 0), 1))?.units).toBe(1);
    rejects(() => buy(endMatch(running([100, 101]), 'user'), 1), 'match_not_running');
  });
});

describe('rule 6: drawdown', () => {
  it('ends the match exactly at the threshold and closes the position', () => {
    const m = advance(buy(running([100, 95, 90]), 1000)); // equity 95,000 = 5.00%
    expect(m).toMatchObject({ status: 'ended', endReason: 'drawdown', positions: [] });
    expect(m.trades[0]).toMatchObject({ exit: 95, pnl: -5000 });
    expect(m.balance).toBe(95_000);
  });

  it('does not end just under the threshold', () => {
    const m = advance(buy(running([100, 95.01, 90]), 1000)); // 4.99%
    expect(m.status).toBe('running');
    expect(drawdownPct(m)).toBeCloseTo(4.99);
  });

  it('measures from the running peak, not the start', () => {
    let m = buy(running([100, 110, 104.4, 104.6]), 1000);
    m = advance(m); // equity 110,000 -> new peak
    expect(m.peakEquity).toBe(110_000);
    m = advance(m); // 104,400 -> 5.09% below the peak
    expect(m).toMatchObject({ status: 'ended', endReason: 'drawdown' });
  });

  it('is checked after a fill as well as after an advance', () => {
    const m = { ...buy(running([100, 101]), 10), peakEquity: 106_000 }; // already 5.66% under the peak
    const after = sell(m, 1);
    expect(after).toMatchObject({ status: 'ended', endReason: 'drawdown' });
  });

  it('records equity on every advance and tracks the peak', () => {
    const m = advance(advance(buy(running([100, 102, 101, 200]), 100)));
    expect(m.equityCurve.map((p) => p.equity)).toEqual([100_000, 100_200, 100_100]);
    expect(m.peakEquity).toBe(100_200);
  });
});

describe('rules 7 and 8: the match ends and positions close at the last revealed close', () => {
  it('timer: closes at the current candle, never a later one', () => {
    let m = advance(buy(running([100, 103, 500]), 10));
    m = tick(m, 600_000);
    expect(m).toMatchObject({ status: 'ended', endReason: 'timer', positions: [], balance: 100_030 });
    expect(m.trades[0]).toMatchObject({ exit: 103, closedAt: 120 });
    expect(m.equityCurve.at(-1)).toEqual({ t: 120, equity: 100_030 });
  });

  it('pause stops the timer, so a paused match cannot time out', () => {
    const m = tick(pause(buy(running([100, 101]), 1), 0), 10_000_000);
    expect(m.status).toBe('paused');
  });

  it('data end: closes at the final close', () => {
    const m = advance(advance(sell(running([100, 99, 98]), 10)));
    expect(m).toMatchObject({ status: 'ended', endReason: 'data_end', balance: 100_020, positions: [] });
  });

  it('user end closes positions; ending twice keeps the first result', () => {
    const m = endMatch(advance(buy(running([100, 101, 102]), 10)), 'user');
    expect(m).toMatchObject({ endReason: 'user', balance: 100_010, positions: [] });
    expect(endMatch(m, 'timer')).toBe(m);
  });

  it('ending flat adds no trades', () => {
    expect(endMatch(running([100, 101]), 'user').trades).toEqual([]);
  });
});

describe('rule 10: no look-ahead', () => {
  it('future candles cannot change fills, P&L or equity', () => {
    const play = (prices: number[]) => {
      let m = running(prices);
      m = buy(m, 10);
      m = advance(m);
      m = sell(m, 4);
      m = advance(m);
      return { fills: m.fills, trades: m.trades, balance: m.balance, equity: equity(m), curve: m.equityCurve, peak: m.peakEquity };
    };
    expect(play([100, 104, 103, 1, 1])).toEqual(play([100, 104, 103, 9999, 9999]));
  });
});

describe('purity', () => {
  it('order functions never mutate their input', () => {
    const frozen = deepFreeze(advance(buy(running([100, 105, 110, 120]), 10)));
    expect(() => {
      let m = sell(frozen, 15);
      m = closePosition(m);
      m = buy(m, 2);
      endMatch(m, 'user');
    }).not.toThrow();
    expect(positionFor(frozen)?.units).toBe(10);
  });
});
