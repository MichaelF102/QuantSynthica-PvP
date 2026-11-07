// SVG geometry for the landing page's decorative charts. Pure and unit-tested.

export type Point = [number, number];

const fmt = (n: number) => Number(n.toFixed(2));

// ---------- Hero hexagon grid ----------

export type HexCell = { key: string; cx: number; cy: number; points: string };

/** Pointy-top hexagons of side `s` covering a `w` by `h` box, with one ring of overflow. */
export function hexGrid(s: number, w: number, h: number): HexCell[] {
  const hw = Math.sqrt(3) * s;
  const cells: HexCell[] = [];
  for (let r = -1; r * 1.5 * s <= h + s; r++) {
    for (let c = -1; c * hw <= w + hw; c++) {
      const cx = c * hw + (((r % 2) + 2) % 2 === 1 ? hw / 2 : 0);
      const cy = r * 1.5 * s;
      const corners: Point[] = [
        [0, -s], [hw / 2, -s / 2], [hw / 2, s / 2],
        [0, s], [-hw / 2, s / 2], [-hw / 2, -s / 2],
      ];
      cells.push({ key: `${r}-${c}`, cx, cy, points: corners.map(([x, y]) => `${(cx + x).toFixed(1)},${(cy + y).toFixed(1)}`).join(' ') });
    }
  }
  return cells;
}

/**
 * Glow for a cell, 0 to 1: 1 on the hovered cell, fading to 0 at `reach` cell widths away.
 * Returns 0 when nothing is hovered.
 */
export function hexGlow(cell: Pick<HexCell, 'cx' | 'cy'>, hovered: Pick<HexCell, 'cx' | 'cy'> | null, cellWidth: number, reach = 2.6): number {
  if (!hovered || !(cellWidth > 0) || !(reach > 0)) return 0;
  const d = Math.hypot(cell.cx - hovered.cx, cell.cy - hovered.cy) / cellWidth;
  return Math.max(0, 1 - d / reach);
}

// ---------- Pie and ring ----------

/** Angle (radians) at fraction `f` of a turn, starting at 12 o'clock and going clockwise. */
const angleAt = (f: number) => f * 2 * Math.PI - Math.PI / 2;
const polar = (c: number, r: number, a: number): Point => [c + r * Math.cos(a), c + r * Math.sin(a)];

export type Slice = { d: string; dx: number; dy: number };

/** Slice `i` of `n` equal pie slices centred at (c, c). dx/dy push the slice outward by `pop`. */
export function pieSlice(i: number, n: number, r: number, c: number, pop = 10): Slice {
  const a0 = angleAt(i / n);
  const a1 = angleAt((i + 1) / n);
  const am = (a0 + a1) / 2;
  const [x0, y0] = polar(c, r, a0);
  const [x1, y1] = polar(c, r, a1);
  const large = 1 / n > 0.5 ? 1 : 0;
  return { d: `M ${c} ${c} L ${fmt(x0)} ${fmt(y0)} A ${r} ${r} 0 ${large} 1 ${fmt(x1)} ${fmt(y1)} Z`, dx: fmt(Math.cos(am) * pop), dy: fmt(Math.sin(am) * pop) };
}

/** Segment `i` of `n` equal ring segments between radii `ri` and `ro`, centred at (c, c). */
export function ringSegment(i: number, n: number, ro: number, ri: number, c: number, pop = 8): Slice {
  const a0 = angleAt(i / n);
  const a1 = angleAt((i + 1) / n);
  const am = (a0 + a1) / 2;
  const p = (r: number, a: number) => polar(c, r, a).map(fmt).join(' ');
  const large = 1 / n > 0.5 ? 1 : 0;
  return {
    d: `M ${p(ro, a0)} A ${ro} ${ro} 0 ${large} 1 ${p(ro, a1)} L ${p(ri, a1)} A ${ri} ${ri} 0 ${large} 0 ${p(ri, a0)} Z`,
    dx: fmt(Math.cos(am) * pop),
    dy: fmt(Math.sin(am) * pop),
  };
}

// ---------- Radar ----------

/** Point on spoke `i` of an `n`-spoke radar at radius `r`. Spoke 0 points straight up. */
export function radarPoint(i: number, n: number, r: number, cx: number, cy: number): Point {
  const a = angleAt(i / n);
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

export const pointsAttr = (pts: readonly Point[]): string => pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

/** Text anchor for a label at x, so labels on the left grow leftward. */
export function labelAnchor(x: number, cx: number, tolerance = 6): 'start' | 'middle' | 'end' {
  return x < cx - tolerance ? 'end' : x > cx + tolerance ? 'start' : 'middle';
}

// ---------- Illustrative candles ----------

/** An illustrative candle in SVG pixels (y grows downward). Not market data. */
export type CandlePx = { x: number; o: number; h: number; l: number; c: number };

/**
 * Turns a close sequence into candles: each opens at the previous close, with a fixed wick.
 * `toY` maps a value to a pixel y.
 */
export function candlesFromCloses(closes: readonly number[], x0: number, step: number, toY: (v: number) => number, wick = 1.2): CandlePx[] {
  return closes.map((c, i) => {
    const o = i === 0 ? c : closes[i - 1];
    return { x: x0 + i * step, o: toY(o), c: toY(c), h: toY(Math.max(o, c) + wick), l: toY(Math.min(o, c) - wick) };
  });
}

/** In pixel space a rising candle closes above (smaller y than) its open. */
export const isRisingPx = (k: Pick<CandlePx, 'o' | 'c'>): boolean => k.c <= k.o;
