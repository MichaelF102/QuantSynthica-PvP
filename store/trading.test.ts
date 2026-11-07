import { describe, expect, it, vi } from 'vitest';
import type { Candle, MatchConfig, SymbolInfo } from '@/lib/types';
import { createMatchStore } from './matchStore';
import { MAX_TOASTS, createToastStore } from './toastStore';

const CONFIG: MatchConfig = { symbol: 'NQ=F', currency: 'USD', interval: '1m', durationMs: 600_000, startingBalance: 100_000, maxDrawdownPct: 5, lotStep: 0.01 };
const INFO: SymbolInfo = { symbol: 'NQ=F', name: 'Nasdaq', assetClass: 'futures', currency: 'USD', dataFile: 'x.csv', barsAvailable: 0, firstTime: 0, lastTime: 0, lotStep: 0.01, priceDecimals: 2 };
const candles: Candle[] = [20_000, 20_100, 20_200].map((close, i) => ({ time: 60 * (i + 1), open: close, high: close + 5, low: close - 5, close, volume: 1 }));

function setup() {
  const notify = vi.fn();
  const store = createMatchStore({ now: () => 0, notify });
  store.getState().start({ config: CONFIG, session: { candles, startCursor: 0, limitedData: false }, info: INFO });
  store.getState().play();
  return { store, notify };
}

describe('match store orders', () => {
  it('fills and announces the fill', () => {
    const { store, notify } = setup();
    expect(store.getState().buy({ mode: 'units', value: 2 })).toBe(true);
    expect(store.getState().match?.positions[0]).toMatchObject({ units: 2, avgEntry: 20_000 });
    expect(notify).toHaveBeenCalledWith('success', 'Bought 2 NQ @ 20,000.00');
  });

  it('a rejected order leaves the state unchanged and shows the reason', () => {
    const { store, notify } = setup();
    const before = store.getState().match;
    expect(store.getState().buy({ mode: 'units', value: 100 })).toBe(false);
    expect(store.getState().match).toBe(before);
    expect(notify).toHaveBeenCalledWith('error', 'Order rejected: Insufficient balance');
  });

  it('closePosition says "Closed" with the P&L; closing when flat does nothing', () => {
    const { store, notify } = setup();
    expect(store.getState().closePosition()).toBe(false);
    expect(notify).not.toHaveBeenCalled();
    store.getState().sell({ mode: 'percent', value: 10 });
    store.getState().step();
    expect(store.getState().closePosition()).toBe(true);
    expect(notify).toHaveBeenLastCalledWith('success', 'Closed 0.5 NQ @ 20,100.00 · P&L -$50.00');
  });

  it('cannot trade without a match', () => {
    const notify = vi.fn();
    const store = createMatchStore({ now: () => 0, notify });
    expect(store.getState().buy({ mode: 'units', value: 1 })).toBe(false);
    expect(notify).not.toHaveBeenCalled();
  });
});

describe('toast store', () => {
  it('pushes, dismisses and keeps only the newest few', () => {
    const t = createToastStore();
    const id = t.getState().push('success', 'a');
    expect(t.getState().toasts).toEqual([{ id, kind: 'success', message: 'a' }]);
    t.getState().dismiss(id);
    expect(t.getState().toasts).toEqual([]);
    for (let i = 0; i < MAX_TOASTS + 2; i++) t.getState().push('info', String(i));
    expect(t.getState().toasts.map((x) => x.message)).toEqual(['2', '3', '4', '5']);
  });
});
