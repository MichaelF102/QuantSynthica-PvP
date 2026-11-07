import { describe, expect, it } from 'vitest';
import { VOLUME_DOWN, VOLUME_UP, hasVolume, indexOfTime, planChartUpdate, summarizeBar, toVolumePoint } from './chartData';
import type { Candle } from './types';

const bar = (time: number, close = 10, volume = 0, open = 10): Candle => ({ time, open, high: Math.max(open, close) + 1, low: Math.min(open, close) - 1, close, volume });

describe('volume helpers', () => {
  it('colours volume by candle direction', () => {
    expect(toVolumePoint(bar(60, 11, 5)).color).toBe(VOLUME_UP);
    expect(toVolumePoint(bar(60, 10, 5)).color).toBe(VOLUME_UP); // unchanged counts as up
    expect(toVolumePoint(bar(60, 9, 5)).color).toBe(VOLUME_DOWN);
  });

  it('detects when a series has any volume', () => {
    expect(hasVolume([bar(60), bar(120)])).toBe(false);
    expect(hasVolume([bar(60), bar(120, 10, 3)])).toBe(true);
    expect(hasVolume([])).toBe(false);
  });
});

describe('indexOfTime', () => {
  const bars = [bar(60), bar(120), bar(300), bar(360)];
  it('finds exact times and returns -1 otherwise', () => {
    expect(indexOfTime(bars, 60)).toBe(0);
    expect(indexOfTime(bars, 300)).toBe(2);
    expect(indexOfTime(bars, 360)).toBe(3);
    expect(indexOfTime(bars, 180)).toBe(-1);
    expect(indexOfTime([], 60)).toBe(-1);
  });
});

describe('summarizeBar', () => {
  it('computes change versus the previous close', () => {
    const s = summarizeBar([bar(60, 100), bar(120, 102)], 1);
    expect(s?.change).toBe(2);
    expect(s?.changePct).toBeCloseTo(2);
  });

  it('has no change for the first bar and null for a missing index', () => {
    expect(summarizeBar([bar(60)], 0)).toEqual({ bar: bar(60), change: null, changePct: null });
    expect(summarizeBar([bar(60)], 5)).toBeNull();
    expect(summarizeBar([], -1)).toBeNull();
  });
});

describe('planChartUpdate', () => {
  const a = [bar(60), bar(120), bar(180)];

  it('sets data the first time', () => {
    expect(planChartUpdate([], a)).toEqual({ kind: 'set' });
  });

  it('updates from the last shown bar when it changed or bars were appended', () => {
    expect(planChartUpdate(a, [bar(60), bar(120), bar(180, 11)])).toEqual({ kind: 'update', from: 2 });
    expect(planChartUpdate(a, [...a, bar(240), bar(300)])).toEqual({ kind: 'update', from: 2 });
    expect(planChartUpdate([bar(60)], [bar(60), bar(120)])).toEqual({ kind: 'update', from: 0 });
  });

  it('sets data when history changed, shrank or the first bar moved', () => {
    expect(planChartUpdate(a, [bar(60), bar(120, 50), bar(180)])).toEqual({ kind: 'set' });
    expect(planChartUpdate(a, a.slice(0, 2))).toEqual({ kind: 'set' });
    expect(planChartUpdate(a, [bar(0), bar(60), bar(120), bar(180)])).toEqual({ kind: 'set' });
    expect(planChartUpdate(a, [bar(60), bar(120), bar(240)])).toEqual({ kind: 'set' });
  });
});

describe('tradeMarkers', async () => {
  const { tradeMarkers } = await import('./chartData');
  const t = (id: string, side: 'buy' | 'sell', pnl: number, openedAt: number, closedAt: number) => ({ id, symbol: 'X', side, units: 1, entry: 1, exit: 1, pnl, openedAt, closedAt });
  const trades = [t('a', 'buy', -5, 60, 300), t('b', 'sell', 2, 120, 180)];

  it('puts an entry arrow and an exit dot per trade, sorted by time', () => {
    const m = tradeMarkers(trades);
    expect(m.map((x) => [x.time, x.shape, x.text])).toEqual([
      [60, 'arrowUp', '#1 L'],
      [120, 'arrowDown', '#2 S'],
      [180, 'circle', '#2 exit'],
      [300, 'circle', '#1 exit'],
    ]);
    expect(m[3].color).toBe('#f43f5e'); // losing exit
    expect(m[2].color).toBe('#10b981'); // winning exit
  });

  it('dims every trade but the active one', () => {
    const m = tradeMarkers(trades, 'b');
    expect(m.filter((x) => x.color === '#475569').map((x) => x.text)).toEqual(['#1 L', '#1 exit']);
  });

  it('is empty with no trades', () => {
    expect(tradeMarkers([])).toEqual([]);
  });
});
