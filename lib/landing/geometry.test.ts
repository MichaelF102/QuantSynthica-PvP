import { describe, expect, it } from 'vitest';
import { candlesFromCloses, hexGlow, hexGrid, isRisingPx, labelAnchor, pieSlice, pointsAttr, radarPoint, ringSegment } from './geometry';

describe('hexGrid', () => {
  const cells = hexGrid(30, 1600, 900);

  it('covers the box with one ring of overflow', () => {
    const xs = cells.map((c) => c.cx);
    const ys = cells.map((c) => c.cy);
    expect(Math.min(...xs)).toBeLessThan(0);
    expect(Math.max(...xs)).toBeGreaterThan(1600);
    expect(Math.min(...ys)).toBeLessThan(0);
    expect(Math.max(...ys) + 30).toBeGreaterThan(900); // bottom row's lower corners clear the box
  });

  it('gives each cell a unique key and six corners', () => {
    expect(new Set(cells.map((c) => c.key)).size).toBe(cells.length);
    for (const c of cells.slice(0, 20)) expect(c.points.split(' ')).toHaveLength(6);
  });

  it('offsets odd rows by half a cell', () => {
    const w = Math.sqrt(3) * 30;
    const r0 = cells.find((c) => c.key === '0-0')!;
    const r1 = cells.find((c) => c.key === '1-0')!;
    expect(r1.cx - r0.cx).toBeCloseTo(w / 2);
  });
});

describe('hexGlow', () => {
  const w = 52;
  it('is 1 on the hovered cell and fades with distance', () => {
    const h = { cx: 0, cy: 0 };
    expect(hexGlow(h, h, w)).toBe(1);
    const near = hexGlow({ cx: w, cy: 0 }, h, w);
    const far = hexGlow({ cx: 2 * w, cy: 0 }, h, w);
    expect(near).toBeGreaterThan(far);
    expect(far).toBeGreaterThan(0);
    expect(hexGlow({ cx: 3 * w, cy: 0 }, h, w)).toBe(0);
  });
  it('is 0 with nothing hovered or bad sizes', () => {
    expect(hexGlow({ cx: 0, cy: 0 }, null, w)).toBe(0);
    expect(hexGlow({ cx: 0, cy: 0 }, { cx: 0, cy: 0 }, 0)).toBe(0);
    expect(hexGlow({ cx: 0, cy: 0 }, { cx: 0, cy: 0 }, w, 0)).toBe(0);
  });
});

describe('pieSlice', () => {
  it('starts the first slice at 12 o’clock and pops it toward its middle', () => {
    const s = pieSlice(0, 4, 100, 130);
    expect(s.d.startsWith('M 130 130 L 130 30 A 100 100 0 0 1 230 130 Z')).toBe(true);
    expect(s.dx).toBeCloseTo(7.07, 1);
    expect(s.dy).toBeCloseTo(-7.07, 1);
  });
  it('uses the large-arc flag for a slice over half a turn', () => {
    expect(pieSlice(0, 1, 100, 130).d).toContain('A 100 100 0 1 1');
  });
});

describe('ringSegment', () => {
  it('draws the outer arc clockwise and the inner arc back', () => {
    const s = ringSegment(0, 6, 110, 70, 130);
    expect(s.d).toMatch(/^M 130 20 A 110 110 0 0 1 /);
    expect(s.d).toContain('A 70 70 0 0 0 130 60 Z');
  });
});

describe('radar helpers', () => {
  it('places spoke 0 straight up and spoke n/2 straight down', () => {
    const [x0, y0] = radarPoint(0, 6, 100, 200, 150);
    expect(x0).toBeCloseTo(200);
    expect(y0).toBeCloseTo(50);
    const [x3, y3] = radarPoint(3, 6, 100, 200, 150);
    expect(x3).toBeCloseTo(200);
    expect(y3).toBeCloseTo(250);
  });
  it('formats points and chooses anchors', () => {
    expect(pointsAttr([[1, 2], [3.456, 4]])).toBe('1.0,2.0 3.5,4.0');
    expect(labelAnchor(100, 200)).toBe('end');
    expect(labelAnchor(300, 200)).toBe('start');
    expect(labelAnchor(203, 200)).toBe('middle');
  });
});

describe('candlesFromCloses', () => {
  it('opens each candle at the previous close and keeps the wick outside the body', () => {
    const k = candlesFromCloses([100, 103, 101], 10, 20, (v) => -v);
    expect(k.map((c) => c.x)).toEqual([10, 30, 50]);
    expect(k[1]).toEqual({ x: 30, o: -100, c: -103, h: -104.2, l: -98.8 });
    expect(isRisingPx(k[1])).toBe(true);
    expect(isRisingPx(k[2])).toBe(false);
    for (const c of k) {
      expect(c.h).toBeLessThanOrEqual(Math.min(c.o, c.c));
      expect(c.l).toBeGreaterThanOrEqual(Math.max(c.o, c.c));
    }
  });
  it('returns nothing for no closes', () => {
    expect(candlesFromCloses([], 0, 1, (v) => v)).toEqual([]);
  });
});
