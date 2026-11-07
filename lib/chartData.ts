import { bucketStart } from './aggregate';
import { fmtUnits } from './format';
import type { Candle, Fill, Timeframe, Trade } from './types';

// Pure helpers for the candle chart (no lightweight-charts imports, so they are easy to test).

export const CANDLE_UP = '#10b981';
export const CANDLE_DOWN = '#f43f5e';
export const VOLUME_UP = 'rgba(16, 185, 129, 0.4)';
export const VOLUME_DOWN = 'rgba(244, 63, 94, 0.4)';

export type VolumePoint = { time: number; value: number; color: string };

export function toVolumePoint(c: Candle): VolumePoint {
  return { time: c.time, value: c.volume, color: c.close >= c.open ? VOLUME_UP : VOLUME_DOWN };
}

/** True when any bar has volume. Indices and some FX feeds report none; then the pane is hidden. */
export function hasVolume(bars: Candle[]): boolean {
  return bars.some((b) => b.volume > 0);
}

/** Index of the bar with exactly `time`, or -1 (binary search; bars are sorted). */
export function indexOfTime(bars: Candle[], time: number): number {
  let lo = 0;
  let hi = bars.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const t = bars[mid].time;
    if (t === time) return mid;
    if (t < time) lo = mid + 1;
    else hi = mid - 1;
  }
  return -1;
}

export type BarSummary = {
  bar: Candle;
  /** Change versus the previous bar's close; null for the first bar. */
  change: number | null;
  changePct: number | null;
};

export function summarizeBar(bars: Candle[], index: number): BarSummary | null {
  const bar = bars[index];
  if (!bar) return null;
  const prev = bars[index - 1];
  if (!prev) return { bar, change: null, changePct: null };
  const change = bar.close - prev.close;
  return { bar, change, changePct: prev.close !== 0 ? (change / prev.close) * 100 : null };
}

export type ChartUpdate = { kind: 'set' } | { kind: 'update'; from: number };

/**
 * Decides how to push `next` into the chart given what it already shows (`prev`).
 * If `next` only changes the last shown bar and/or appends bars after it, the chart can
 * `update()` from that index; anything else (new symbol, timeframe, rewind) needs `setData()`.
 */
export function planChartUpdate(prev: Candle[], next: Candle[]): ChartUpdate {
  if (prev.length === 0 || next.length < prev.length) return { kind: 'set' };
  const k = prev.length - 1;
  if (next[0].time !== prev[0].time || next[k].time !== prev[k].time) return { kind: 'set' };
  if (k > 0 && next[k - 1] !== prev[k - 1] && !sameBar(next[k - 1], prev[k - 1])) return { kind: 'set' };
  return { kind: 'update', from: k };
}

function sameBar(a: Candle, b: Candle): boolean {
  return a.time === b.time && a.open === b.open && a.high === b.high && a.low === b.low && a.close === b.close && a.volume === b.volume;
}

export type FillMarker = {
  time: number;
  position: 'belowBar' | 'aboveBar';
  color: string;
  shape: 'arrowUp' | 'arrowDown' | 'circle';
  text: string;
};

/**
 * One chart marker per fill, placed on the bar (of the current timeframe) that contains it:
 * buys under the bar in emerald, sells over it in rose. Sorted by time, as the chart requires.
 */
export function fillMarkers(fills: Fill[], tf: Timeframe, lotStep: number): FillMarker[] {
  return fills
    .map((f) => ({
      time: tf === '1m' ? f.time : bucketStart(f.time, tf),
      position: f.side === 'buy' ? ('belowBar' as const) : ('aboveBar' as const),
      color: f.side === 'buy' ? CANDLE_UP : CANDLE_DOWN,
      shape: f.side === 'buy' ? ('arrowUp' as const) : ('arrowDown' as const),
      text: `${f.side === 'buy' ? 'B' : 'S'} ${fmtUnits(f.units, lotStep)}`,
    }))
    .sort((a, b) => a.time - b.time);
}

const OPPONENT = '#94a3b8';

/** Plan M13 R4: the opponent's fills, grey circles, so they read apart from your own arrows. */
export function opponentMarkers(fills: Fill[], tf: Timeframe, lotStep: number): FillMarker[] {
  return fills.map((f) => ({
    time: tf === '1m' ? f.time : bucketStart(f.time, tf),
    position: f.side === 'buy' ? ('belowBar' as const) : ('aboveBar' as const),
    color: OPPONENT,
    shape: 'circle' as const,
    text: `Opp ${f.side === 'buy' ? 'B' : 'S'} ${fmtUnits(f.units, lotStep)}`,
  }));
}

/** Two marker lists as one, sorted by time as the chart requires. */
export const mergeMarkers = (...lists: FillMarker[][]): FillMarker[] => lists.flat().sort((a, b) => a.time - b.time);

const DIM = '#475569';

/**
 * Results chart markers: an arrow at each trade's entry (up under the bar for a long, down over it
 * for a short) and a dot at its exit, coloured by the trade's P&L. With `activeId` set, the other
 * trades are dimmed. Sorted by time, as the chart requires.
 */
export function tradeMarkers(trades: readonly Trade[], activeId: string | null = null): FillMarker[] {
  const out: FillMarker[] = [];
  trades.forEach((t, i) => {
    const dim = activeId !== null && t.id !== activeId;
    const long = t.side === 'buy';
    out.push({
      time: t.openedAt,
      position: long ? 'belowBar' : 'aboveBar',
      color: dim ? DIM : long ? CANDLE_UP : CANDLE_DOWN,
      shape: long ? 'arrowUp' : 'arrowDown',
      text: `#${i + 1} ${long ? 'L' : 'S'}`,
    });
    out.push({
      time: t.closedAt,
      position: long ? 'aboveBar' : 'belowBar',
      color: dim ? DIM : t.pnl >= 0 ? CANDLE_UP : CANDLE_DOWN,
      shape: 'circle',
      text: `#${i + 1} exit`,
    });
  });
  return out.sort((a, b) => a.time - b.time);
}
