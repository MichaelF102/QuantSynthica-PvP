import { describe, expect, it, vi } from 'vitest';
import type { Candle, MatchConfig, SymbolInfo } from '@/lib/types';
import { createMatchStore } from './matchStore';

// Plan M12 in the practice store: queued orders, stop-loss / take-profit and their toasts.
// TEST FIXTURE: hand-built candles, not market data.

const CONFIG: MatchConfig = { symbol: 'NQ=F', currency: 'USD', interval: '1m', durationMs: 600_000, startingBalance: 100_000, maxDrawdownPct: 50, lotStep: 1 };
const INFO: SymbolInfo = { symbol: 'NQ=F', name: 'Nasdaq', assetClass: 'futures', currency: 'USD', dataFile: 'x.csv', barsAvailable: 0, firstTime: 0, lastTime: 0, lotStep: 1, priceDecimals: 2 };
const bar = (i: number, open: number, high: number, low: number, close: number): Candle => ({ time: 60 * (i + 1), open, high, low, close, volume: 1 });
const candles: Candle[] = [bar(0, 100, 100, 100, 100), bar(1, 101, 102, 100, 101), bar(2, 100, 101, 90, 92), bar(3, 92, 92, 92, 92)];

function setup(config: Partial<MatchConfig> = {}) {
  const notify = vi.fn();
  const store = createMatchStore({ now: () => 0, notify, persist: () => true });
  store.getState().start({ config: { ...CONFIG, ...config }, session: { candles, startCursor: 0, limitedData: false }, info: INFO });
  store.getState().play();
  return { store, notify };
}

describe('next-open orders in the store', () => {
  it('announces the queued order, then the fill at the open', () => {
    const { store, notify } = setup({ fillModel: 'next_open' });
    expect(store.getState().buy({ mode: 'units', value: 3 })).toBe(true);
    expect(notify).toHaveBeenLastCalledWith('info', 'Buy 3 NQ queued for the next open');
    store.getState().step();
    expect(notify).toHaveBeenLastCalledWith('success', 'Filled at open: Bought 3 NQ @ 101.00');
  });

  it('cancels the queued order', () => {
    const { store, notify } = setup({ fillModel: 'next_open' });
    store.getState().buy({ mode: 'units', value: 3 });
    store.getState().cancelQueued();
    expect(store.getState().match?.queued).toBeNull();
    expect(notify).toHaveBeenLastCalledWith('info', 'Order cancelled');
  });
});

describe('stop-loss / take-profit in the store', () => {
  it('sets levels and announces the stop when it fills, with the fee', () => {
    const { store, notify } = setup({ commission: 2 });
    store.getState().buy({ mode: 'units', value: 10 });
    expect(store.getState().setBrackets({ stopLoss: 95, takeProfit: 110 })).toBe(true);
    store.getState().step();
    expect(store.getState().match?.positions).toHaveLength(1);
    store.getState().step();
    expect(store.getState().match?.positions).toHaveLength(0);
    expect(notify).toHaveBeenLastCalledWith('error', 'Stop loss hit: Sold 10 NQ @ 95.00 · P&L -$50.00 · fee $2.00');
  });

  it('shows why bad levels are refused and keeps the state', () => {
    const { store, notify } = setup();
    store.getState().buy({ mode: 'units', value: 10 });
    const before = store.getState().match;
    expect(store.getState().setBrackets({ stopLoss: 105, takeProfit: null })).toBe(false);
    expect(store.getState().match).toBe(before);
    expect(notify).toHaveBeenLastCalledWith('error', 'Stop must be on the losing side of the current price');
  });
});
