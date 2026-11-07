import { describe, expect, it } from 'vitest';
import { equityAt, equityRows, niceStep, niceTicks, tradeDots, worstDrawdown } from './equitySeries';
import type { Trade } from './types';

const curve = [
  { t: 0, equity: 100_000 },
  { t: 60, equity: 100_100 },
  { t: 120, equity: 99_600 },
  { t: 180, equity: 100_200 },
  { t: 240, equity: 99_900 },
];

describe('equityRows', () => {
  it('adds change, drawdown from the running peak and the loss-limit level', () => {
    const rows = equityRows(curve, 100_000, 5);
    expect(rows[1]).toMatchObject({ change: 100, changePct: expect.closeTo(0.1), ddPct: 0, limit: 100_100 * 0.95 });
    expect(rows[2].ddPct).toBeCloseTo((500 / 100_100) * 100);
    expect(rows[2].limit).toBe(100_100 * 0.95); // limit follows the peak, never the dip
    expect(rows[3].limit).toBe(100_200 * 0.95);
  });
  it('handles an empty curve', () => {
    expect(equityRows([], 100_000, 5)).toEqual([]);
  });
});

describe('worstDrawdown', () => {
  it('finds the largest peak-to-trough window', () => {
    expect(worstDrawdown(curve)).toEqual({ peakT: 60, troughT: 120, peak: 100_100, trough: 99_600, ddPct: expect.closeTo((500 / 100_100) * 100) });
  });
  it('is null for a curve that never falls', () => {
    expect(worstDrawdown([{ t: 0, equity: 1 }, { t: 1, equity: 2 }])).toBeNull();
    expect(worstDrawdown([])).toBeNull();
  });
});

describe('nice ticks', () => {
  it('picks 1/2/2.5/5 steps', () => {
    expect(niceStep(466, 4)).toBe(200);
    expect(niceStep(10, 4)).toBe(2.5);
    expect(niceStep(0.9, 4)).toBe(0.25);
    expect(niceStep(0)).toBe(1);
  });
  it('covers the range with round values', () => {
    // The screenshot's axis: $99,643 to $100,109.
    expect(niceTicks(99_643, 100_109)).toEqual({ ticks: [99_600, 99_800, 100_000, 100_200], domain: [99_600, 100_200] });
  });
  it('widens a flat range and survives bad input', () => {
    const r = niceTicks(100_000, 100_000);
    expect(r.domain[0]).toBeLessThan(100_000);
    expect(r.domain[1]).toBeGreaterThan(100_000);
    expect(niceTicks(Number.NaN, 1)).toEqual({ ticks: [], domain: [0, 1] });
  });
});

describe('trade dots', () => {
  it('reads equity at or before a time', () => {
    expect(equityAt(curve, 130)).toBe(99_600);
    expect(equityAt(curve, 60)).toBe(100_100);
    expect(equityAt(curve, -5)).toBe(100_000);
    expect(equityAt([], 5)).toBeNull();
  });
  it('places an entry and an exit dot per trade', () => {
    const t: Trade = { id: 'x', symbol: 'X', side: 'sell', units: 1, entry: 1, exit: 1, pnl: 0, openedAt: 60, closedAt: 180 };
    expect(tradeDots([t], curve)).toEqual([
      { id: 'x', kind: 'entry', side: 'sell', t: 60, equity: 100_100 },
      { id: 'x', kind: 'exit', side: 'sell', t: 180, equity: 100_200 },
    ]);
  });
});
