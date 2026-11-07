import { describe, expect, it } from 'vitest';
import { advance, createMatch, endMatch, placeMarketOrder, play } from './engine';
import { fillMarkers } from './chartData';
import { shortSymbol } from './format';
import { fillMessage, orderErrorText, previewOrder, toOrderRequest, unitsToPercent } from './orders';
import type { Candle, Fill, MatchConfig } from './types';

const CONFIG: MatchConfig = { symbol: 'NQ=F', currency: 'USD', interval: '1m', durationMs: 600_000, startingBalance: 100_000, maxDrawdownPct: 5, lotStep: 0.01 };
const candles: Candle[] = [20_000, 20_100].map((close, i) => ({ time: 60 * (i + 1), open: close, high: close + 5, low: close - 5, close, volume: 1 }));
const running = (config: Partial<MatchConfig> = {}) => play(createMatch({ ...CONFIG, ...config }, candles), 0);
const fill = (o: Partial<Fill> = {}): Fill => ({ id: 'f', symbol: 'NQ=F', side: 'buy', units: 2, price: 20659.75, time: 60, realizedPnl: 0, ...o });

describe('toOrderRequest', () => {
  it('maps the size mode to the engine order shape', () => {
    expect(toOrderRequest('buy', { mode: 'units', value: 2 })).toEqual({ side: 'buy', units: 2 });
    expect(toOrderRequest('sell', { mode: 'percent', value: 25 })).toEqual({ side: 'sell', percent: 25 });
  });
});

describe('previewOrder', () => {
  it('previews units, notional and fill price for a % order', () => {
    const p = previewOrder(running(), { mode: 'percent', value: 50 });
    expect(p).toEqual({ units: 2.5, notional: 50_000, price: 20_000, fee: 0, buyError: null, sellError: null });
  });

  it('rounds unit input down to the lot step', () => {
    expect(previewOrder(running(), { mode: 'units', value: 1.239 }).units).toBe(1.23);
  });

  it('reports why each side would be rejected', () => {
    expect(previewOrder(running(), { mode: 'units', value: 0 })).toMatchObject({ units: 0, buyError: 'size_zero', sellError: 'size_zero' });
    expect(previewOrder(running(), { mode: 'units', value: Number.NaN })).toMatchObject({ units: 0, buyError: 'invalid_size' });
    expect(previewOrder(running(), { mode: 'units', value: 6 })).toMatchObject({ buyError: 'insufficient_balance', sellError: 'insufficient_balance' });
    // Holding 5 long, selling 6 only opens 1 short, which fits; buying 1 more does not.
    const long = placeMarketOrder(running(), { side: 'buy', units: 5 });
    expect(previewOrder(long, { mode: 'units', value: 1 })).toMatchObject({ buyError: 'insufficient_balance', sellError: null });
    expect(previewOrder(createMatch(CONFIG, candles), { mode: 'units', value: 1 }).buyError).toBe('match_not_running');
  });
});

describe('unitsToPercent', () => {
  it('expresses units as % of balance, clamped', () => {
    expect(unitsToPercent(running(), 2.5)).toBe(50);
    expect(unitsToPercent(running(), 0)).toBe(0);
    expect(unitsToPercent(running(), 99)).toBe(100);
  });
});

describe('orderErrorText', () => {
  it('explains each rejection', () => {
    const m = running();
    expect(orderErrorText('insufficient_balance', m)).toBe('Insufficient balance');
    expect(orderErrorText('size_zero', m)).toBe('Size is below the minimum lot (0.01)');
    expect(orderErrorText('size_zero', running({ lotStep: 1 }))).toBe('Size is below the minimum lot (1)');
    expect(orderErrorText('invalid_size', m)).toBe('Enter a positive size');
    expect(orderErrorText('match_not_running', createMatch(CONFIG, candles))).toBe('Start the replay to trade');
    expect(orderErrorText('match_not_running', endMatch(m, 'user'))).toBe('The match has ended');
  });
});

describe('fillMessage', () => {
  const opts = { lotStep: 0.01, priceDecimals: 2, currency: 'USD' };
  it('matches the CLAUDE.md §10 wording', () => {
    expect(fillMessage(fill(), opts)).toBe('Bought 2 NQ @ 20,659.75');
    expect(fillMessage(fill({ side: 'sell', units: 0.5 }), opts)).toBe('Sold 0.5 NQ @ 20,659.75');
  });

  it('adds realised P&L and supports a custom verb', () => {
    expect(fillMessage(fill({ side: 'sell', realizedPnl: 412.5 }), { ...opts, verb: 'Closed' })).toBe('Closed 2 NQ @ 20,659.75 · P&L +$412.50');
    expect(fillMessage(fill({ symbol: '^NSEI', realizedPnl: -1500 }), { ...opts, currency: 'INR' })).toBe('Bought 2 NSEI @ 20,659.75 · P&L -₹1,500.00');
  });
});

describe('shortSymbol', () => {
  it.each([
    ['NQ=F', 'NQ'],
    ['6E=F', '6E'],
    ['EURUSD=X', 'EURUSD'],
    ['^NSEI', 'NSEI'],
    ['RELIANCE.NS', 'RELIANCE'],
    ['AAPL', 'AAPL'],
  ])('%s -> %s', (s, out) => expect(shortSymbol(s)).toBe(out));
});

describe('fillMarkers', () => {
  it('places buys below and sells above, on the containing bar, sorted by time', () => {
    const fills = [fill({ side: 'sell', time: 1_791_293_400 + 7 * 60, units: 1 }), fill({ time: 1_791_293_400 + 60, units: 2.5 })];
    expect(fillMarkers(fills, '5m', 0.01)).toEqual([
      { time: 1_791_293_400, position: 'belowBar', color: '#10b981', shape: 'arrowUp', text: 'B 2.5' },
      { time: 1_791_293_700, position: 'aboveBar', color: '#f43f5e', shape: 'arrowDown', text: 'S 1' },
    ]);
    expect(fillMarkers(fills, '1m', 0.01).map((m) => m.time)).toEqual([1_791_293_460, 1_791_293_820]);
  });

  it('only ever contains fills that happened, which are all at or before the cursor', () => {
    const m = advance(placeMarketOrder(running(), { side: 'buy', units: 1 }));
    expect(fillMarkers(m.fills, '1m', 0.01).every((k) => k.time <= candles[m.cursor].time)).toBe(true);
  });
});
