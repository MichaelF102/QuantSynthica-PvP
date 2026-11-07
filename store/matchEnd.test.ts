import { describe, expect, it, vi } from 'vitest';
import type { Candle, MatchConfig, SymbolInfo } from '@/lib/types';
import { createMatchStore } from './matchStore';

const CONFIG: MatchConfig = { symbol: 'NQ=F', currency: 'USD', interval: '1m', durationMs: 1_000, startingBalance: 100_000, maxDrawdownPct: 5, lotStep: 1 };
const INFO: SymbolInfo = { symbol: 'NQ=F', name: 'Nasdaq', assetClass: 'futures', currency: 'USD', dataFile: 'x.csv', barsAvailable: 0, firstTime: 0, lastTime: 0, lotStep: 1, priceDecimals: 2 };
const series = (...closes: number[]): Candle[] => closes.map((close, i) => ({ time: 60 * (i + 1), open: close, high: close + 1, low: close - 1, close, volume: 0 }));

function setup(closes: number[], persist = vi.fn(() => true)) {
  const store = createMatchStore({ now: () => 7, notify: vi.fn(), persist, newId: () => 'match-1' });
  store.getState().start({ config: CONFIG, session: { candles: series(...closes), startCursor: 0, limitedData: false }, info: INFO });
  return { store, persist };
}

describe('match end flow', () => {
  it('timer: builds and saves the result once, with positions closed', () => {
    const { store, persist } = setup([100, 101, 102, 103]);
    store.getState().play();
    store.getState().buy({ mode: 'units', value: 10 });
    for (let i = 0; i < 10; i++) store.getState().frame(250); // 1 s timer
    const s = store.getState();
    expect(s.match).toMatchObject({ status: 'ended', endReason: 'timer', positions: [] });
    expect(s.result).toMatchObject({ id: 'match-1', endReason: 'timer', playedAt: 7 });
    expect(persist).toHaveBeenCalledTimes(1);
    expect(s.resultSaved).toBe(true);
  });

  it('drawdown: the result says so', () => {
    const { store } = setup([100, 94, 90]);
    store.getState().play();
    store.getState().buy({ mode: 'units', value: 1000 });
    store.getState().step();
    expect(store.getState().result?.endReason).toBe('drawdown');
    expect(store.getState().result?.stats.pnl).toBe(-6000);
  });

  it('endEarly ends with "user"; later actions do not save again', () => {
    const { store, persist } = setup([100, 101, 102]);
    store.getState().play();
    store.getState().endEarly();
    store.getState().endEarly();
    store.getState().step();
    store.getState().frame(500);
    expect(store.getState().result?.endReason).toBe('user');
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it('data end through a jump', () => {
    const { store } = setup([100, 101, 102]);
    store.getState().jumpBy(10);
    expect(store.getState().result?.endReason).toBe('data_end');
  });

  it('a failed save is reported, not thrown', () => {
    const { store } = setup(
      [100, 101],
      vi.fn(() => {
        throw new Error('quota');
      }),
    );
    store.getState().play();
    store.getState().endEarly();
    expect(store.getState().result).not.toBeNull();
    expect(store.getState().resultSaved).toBe(false);
  });

  it('warns once when drawdown passes 80% of the limit', () => {
    const { store } = setup([100, 96.1, 95.9, 98, 96]);
    store.getState().play();
    store.getState().buy({ mode: 'units', value: 1000 });
    store.getState().step(); // 3.9%: no warning
    expect(store.getState().drawdownWarned).toBe(false);
    store.getState().step(); // 4.1%: warning
    expect(store.getState().drawdownWarned).toBe(true);
    store.getState().step(); // recovers; the flag stays set so the banner is not repeated
    expect(store.getState().drawdownWarned).toBe(true);
  });

  it('a new match clears the previous result and warning', () => {
    const { store } = setup([100, 101]);
    store.getState().play();
    store.getState().endEarly();
    store.getState().start({ config: CONFIG, session: { candles: series(100, 101), startCursor: 0, limitedData: false }, info: INFO });
    expect(store.getState()).toMatchObject({ result: null, drawdownWarned: false, resultSaved: true });
  });
});
