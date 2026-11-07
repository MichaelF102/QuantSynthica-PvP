import { describe, expect, it } from 'vitest';
import { floorToStep, percentToUnits, roundToStep, stepDecimals } from './lots';
import { applyFill, exposureAfter } from './positions';

describe('lot steps', () => {
  it('stepDecimals', () => {
    expect(stepDecimals(1)).toBe(0);
    expect(stepDecimals(0.01)).toBe(2);
    expect(stepDecimals(0.0001)).toBe(4);
    expect(stepDecimals(1e-7)).toBe(7);
    expect(() => stepDecimals(0)).toThrow(RangeError);
  });

  it('floorToStep rounds toward zero onto the grid', () => {
    expect(floorToStep(1.239, 0.01)).toBe(1.23);
    expect(floorToStep(0.3, 0.1)).toBe(0.3); // 0.3 / 0.1 = 2.9999999999999996
    expect(floorToStep(-1.239, 0.01)).toBe(-1.23);
    expect(floorToStep(149.9, 1)).toBe(149);
    expect(floorToStep(0.004, 0.01)).toBe(0);
  });

  it('roundToStep removes float noise', () => {
    expect(roundToStep(0.1 + 0.2, 0.01)).toBe(0.3);
    expect(roundToStep(-0.30000000000000004, 0.01)).toBe(-0.3);
    expect(roundToStep(1e-12, 0.01)).toBe(0);
  });

  it('percentToUnits', () => {
    expect(percentToUnits(100_000, 50, 333, 1)).toBe(150);
    expect(percentToUnits(1_000_000, 100, 23_779.9, 0.01)).toBe(42.05);
    expect(percentToUnits(100_000, 0, 100, 1)).toBe(0);
    expect(percentToUnits(100_000, 50, 0, 1)).toBe(0);
    expect(percentToUnits(0, 50, 100, 1)).toBe(0);
    expect(percentToUnits(100_000, 500, 100, 1)).toBe(1000);
  });
});

describe('positions', () => {
  it('opens, adds, reduces and flips', () => {
    const open = applyFill(null, 'X', 'sell', 5, 100, 60, 1);
    expect(open).toEqual({ position: { symbol: 'X', units: -5, avgEntry: 100, openedAt: 60 }, closed: null, realizedPnl: 0 });
    const add = applyFill(open.position, 'X', 'sell', 5, 90, 120, 1);
    expect(add.position).toEqual({ symbol: 'X', units: -10, avgEntry: 95, openedAt: 60 });
    const flip = applyFill(add.position, 'X', 'buy', 12, 80, 180, 1);
    expect(flip.realizedPnl).toBe(150);
    expect(flip.closed).toMatchObject({ side: 'sell', units: 10, entry: 95, exit: 80 });
    expect(flip.position).toEqual({ symbol: 'X', units: 2, avgEntry: 80, openedAt: 180 });
    const close = applyFill(flip.position, 'X', 'sell', 2, 81, 240, 1);
    expect(close.position).toBeNull();
    expect(close.realizedPnl).toBe(2);
  });

  it('exposureAfter flags orders that add or flip', () => {
    const long = { symbol: 'X', units: 10, avgEntry: 1, openedAt: 0 };
    expect(exposureAfter(null, 'buy', 5, 1)).toEqual({ units: 5, increases: true });
    expect(exposureAfter(long, 'buy', 5, 1)).toEqual({ units: 15, increases: true });
    expect(exposureAfter(long, 'sell', 4, 1)).toEqual({ units: 6, increases: false });
    expect(exposureAfter(long, 'sell', 10, 1)).toEqual({ units: 0, increases: false });
    expect(exposureAfter(long, 'sell', 11, 1)).toEqual({ units: 1, increases: true });
  });
});
