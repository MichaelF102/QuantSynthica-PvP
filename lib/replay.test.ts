import { describe, expect, it } from 'vitest';
import { MAX_FRAME_MS, candlesForFrame, clampFrame } from './replay';

describe('clampFrame', () => {
  it('caps long frames and drops invalid ones', () => {
    expect(clampFrame(16)).toBe(16);
    expect(clampFrame(5000)).toBe(MAX_FRAME_MS);
    expect(clampFrame(0)).toBe(0);
    expect(clampFrame(-5)).toBe(0);
    expect(clampFrame(Number.NaN)).toBe(0);
  });
});

describe('candlesForFrame (plan D1: 1x = 1 candle per second)', () => {
  const run = (speed: number, frameMs: number, totalMs: number) => {
    let carry = 0;
    let count = 0;
    for (let t = 0; t < totalMs; t += frameMs) {
      const r = candlesForFrame(carry, frameMs, speed, 1);
      carry = r.carry;
      count += r.count;
    }
    return count;
  };

  it.each([
    [1, 3000, 3],
    [2, 3000, 6],
    [5, 1000, 5],
    [5, 10_000, 50],
  ])('at %ix for %i ms reveals %i candles (60 fps)', (speed, ms, expected) => {
    expect(run(speed, 1000 / 60, ms)).toBe(expected);
  });

  it('carries the remainder between frames', () => {
    expect(candlesForFrame(0, 100, 1, 1)).toEqual({ count: 0, carry: 0.1 });
    const r = candlesForFrame(0.95, 100, 1, 1);
    expect(r.count).toBe(1);
    expect(r.carry).toBeCloseTo(0.05);
  });

  it('a stalled frame counts as at most MAX_FRAME_MS', () => {
    expect(candlesForFrame(0, 60_000, 5, 1).count).toBe(1); // 250 ms x 5/s = 1.25
  });

  it('1000 frames of 1 ms land on exactly one candle', () => {
    expect(run(1, 1, 1000)).toBe(1);
  });
});
