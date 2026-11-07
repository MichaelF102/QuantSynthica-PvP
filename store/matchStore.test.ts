import { describe, expect, it, vi } from 'vitest';
import { aggregate } from '@/lib/aggregate';
import type { Candle, MatchConfig, Session, SymbolInfo } from '@/lib/types';
import type { FrameLoop } from './clock';
import { createMatchStore } from './matchStore';
import { bindReplayLoop } from './useReplayLoop';

const CONFIG: MatchConfig = { symbol: 'TEST', currency: 'USD', interval: '1m', durationMs: 10_000, startingBalance: 100_000, maxDrawdownPct: 5, lotStep: 0.01 };
const INFO: SymbolInfo = { symbol: 'TEST', name: 'Test', assetClass: 'index', currency: 'USD', dataFile: 't.csv', barsAvailable: 0, firstTime: 0, lastTime: 0, lotStep: 0.01, priceDecimals: 2 };
const T0 = 1_791_293_400;
const candles = (n: number): Candle[] => Array.from({ length: n }, (_, i) => ({ time: T0 + 60 * i, open: 100 + i, high: 102 + i, low: 99 + i, close: 101 + i, volume: 1 }));
const session = (n = 100, startCursor = 9): Session => ({ candles: candles(n), startCursor, limitedData: false });

function started(n = 100, startCursor = 9) {
  const store = createMatchStore({ now: () => 1000 });
  store.getState().start({ config: CONFIG, session: session(n, startCursor), info: INFO });
  return store;
}

describe('matchStore', () => {
  it('start builds bars from the history only', () => {
    const store = started();
    const s = store.getState();
    expect(s.match?.status).toBe('idle');
    expect(s.bars).toHaveLength(10);
    expect(s.bars.at(-1)?.time).toBe(T0 + 9 * 60);
  });

  it('frames advance the timer and reveal 1 candle per second at 1x and 5 at 5x', () => {
    const store = started();
    store.getState().play();
    for (let i = 0; i < 60; i++) store.getState().frame(1000 / 60);
    expect(store.getState().match?.cursor).toBe(10);
    expect(store.getState().match?.elapsedMs).toBeCloseTo(1000);

    store.getState().setSpeed(5);
    for (let i = 0; i < 60; i++) store.getState().frame(1000 / 60);
    expect(store.getState().match?.cursor).toBe(15);
    expect(store.getState().bars.at(-1)?.time).toBe(T0 + 15 * 60);
  });

  it('frames do nothing while idle or paused (pause stops the timer and the candles)', () => {
    const store = started();
    store.getState().frame(500);
    expect(store.getState().match).toMatchObject({ cursor: 9, elapsedMs: 0 });
    store.getState().play();
    store.getState().frame(100);
    store.getState().pause();
    store.getState().frame(5000);
    expect(store.getState().match).toMatchObject({ status: 'paused', elapsedMs: 100 });
  });

  it('a 5 s background frame is clamped to 250 ms', () => {
    const store = started();
    store.getState().play();
    store.getState().frame(5000);
    expect(store.getState().match?.elapsedMs).toBe(250);
  });

  it('the timer ends the match and stops revealing candles', () => {
    const store = started();
    store.getState().play();
    for (let i = 0; i < 41; i++) store.getState().frame(250);
    expect(store.getState().match).toMatchObject({ status: 'ended', endReason: 'timer', elapsedMs: 10_000 });
    const cursor = store.getState().match?.cursor;
    store.getState().frame(250);
    expect(store.getState().match?.cursor).toBe(cursor);
  });

  it('step pauses a running match and reveals exactly one candle', () => {
    const store = started();
    store.getState().play();
    store.getState().step();
    expect(store.getState().match).toMatchObject({ status: 'paused', cursor: 10, elapsedMs: 0 });
  });

  it('step from idle starts the match paused', () => {
    const store = started();
    store.getState().step();
    expect(store.getState().match).toMatchObject({ status: 'paused', cursor: 10, startedAt: 1000 });
  });

  it('jumpBy reveals n candles in one update and keeps the bars in sync', () => {
    const store = started();
    const listener = vi.fn();
    store.subscribe(listener);
    store.getState().jumpBy(60);
    expect(listener).toHaveBeenCalledTimes(1);
    const s = store.getState();
    expect(s.match?.cursor).toBe(69);
    expect(s.bars).toEqual(aggregate(s.match!.candles, '1m', 69));
  });

  it('jumping past the end stops at the last candle with data_end', () => {
    const store = started(30);
    store.getState().jumpBy(500);
    expect(store.getState().match).toMatchObject({ cursor: 29, status: 'ended', endReason: 'data_end' });
  });

  it('jumpToTime lands on the first candle at or after the time; earlier times do nothing', () => {
    const store = started();
    store.getState().jumpToTime(T0 + 20 * 60 + 30);
    expect(store.getState().match?.cursor).toBe(21);
    store.getState().jumpToTime(T0);
    expect(store.getState().match?.cursor).toBe(21);
  });

  it('switching timeframe rebuilds bars from revealed candles only', () => {
    const store = started();
    store.getState().jumpBy(7); // cursor 16
    store.getState().setTimeframe('5m');
    const s = store.getState();
    expect(s.bars).toEqual(aggregate(s.match!.candles, '5m', 16));
    store.getState().step();
    expect(store.getState().bars).toEqual(aggregate(s.match!.candles, '5m', 17));
  });

  it('reset clears the match but keeps speed and timeframe', () => {
    const store = started();
    store.getState().setSpeed(2);
    store.getState().setTimeframe('15m');
    store.getState().reset();
    expect(store.getState()).toMatchObject({ match: null, bars: [], speed: 2, timeframe: '15m' });
  });
});

describe('bindReplayLoop', () => {
  const fakeLoop = () => {
    let running = false;
    const loop: FrameLoop = {
      start: vi.fn(() => void (running = true)),
      stop: vi.fn(() => void (running = false)),
      get running() {
        return running;
      },
    };
    return loop;
  };

  it('runs the loop only while the match is running', () => {
    const store = started();
    const loop = fakeLoop();
    const unbind = bindReplayLoop(store, document, loop);
    expect(loop.running).toBe(false);
    store.getState().play();
    expect(loop.running).toBe(true);
    store.getState().pause();
    expect(loop.running).toBe(false);
    unbind();
  });

  it('pauses when the tab is hidden', () => {
    const store = started();
    const unbind = bindReplayLoop(store, document, fakeLoop());
    store.getState().play();
    const spy = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(store.getState().match?.status).toBe('paused');
    spy.mockRestore();
    unbind();
  });

  it('unbinding stops the loop and the visibility listener', () => {
    const store = started();
    const loop = fakeLoop();
    const unbind = bindReplayLoop(store, document, loop);
    store.getState().play();
    unbind();
    expect(loop.running).toBe(false);
    const spy = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(store.getState().match?.status).toBe('running');
    spy.mockRestore();
  });
});
