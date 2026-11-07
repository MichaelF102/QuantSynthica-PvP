import type { EquityPoint, Trade } from './types';

// Equity-curve helpers for the results chart: per-point change and drawdown, the running loss
// limit, the worst drawdown window, round axis ticks and trade markers.

export type EquityRow = {
  t: number;
  equity: number;
  /** Equity minus the starting balance. */
  change: number;
  changePct: number;
  /** Fall from the running peak, in %. */
  ddPct: number;
  /** Equity at which the drawdown rule ends the match: running peak × (1 − limit). */
  limit: number;
};

export function equityRows(curve: readonly EquityPoint[], startingBalance: number, limitPct: number): EquityRow[] {
  let peak = -Infinity;
  return curve.map(({ t, equity }) => {
    peak = Math.max(peak, equity);
    return {
      t,
      equity,
      change: equity - startingBalance,
      changePct: startingBalance ? ((equity - startingBalance) / startingBalance) * 100 : 0,
      ddPct: peak > 0 ? ((peak - equity) / peak) * 100 : 0,
      limit: peak * (1 - limitPct / 100),
    };
  });
}

export type DrawdownWindow = { peakT: number; troughT: number; peak: number; trough: number; ddPct: number };

/** The largest peak-to-trough fall. Null when equity never falls below a previous peak. */
export function worstDrawdown(curve: readonly EquityPoint[]): DrawdownWindow | null {
  let peak: EquityPoint | null = null;
  let best: DrawdownWindow | null = null;
  for (const p of curve) {
    if (!peak || p.equity > peak.equity) {
      peak = p;
      continue;
    }
    const dd = peak.equity > 0 ? ((peak.equity - p.equity) / peak.equity) * 100 : 0;
    if (dd > 0 && (!best || dd > best.ddPct)) best = { peakT: peak.t, troughT: p.t, peak: peak.equity, trough: p.equity, ddPct: dd };
  }
  return best;
}

/** A "nice" step (1, 2, 2.5 or 5 × 10^k) so that about `count` steps cover `range`. */
export function niceStep(range: number, count = 4): number {
  if (!(range > 0) || !(count > 0)) return 1;
  const raw = range / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const f = raw / mag;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return nice * mag;
}

/** Round ticks covering [lo, hi], and the widened domain they define. */
export function niceTicks(lo: number, hi: number, count = 4): { ticks: number[]; domain: [number, number] } {
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return { ticks: [], domain: [0, 1] };
  if (hi <= lo) {
    const pad = Math.max(Math.abs(lo) * 0.001, 1);
    lo -= pad;
    hi += pad;
  }
  const step = niceStep(hi - lo, count);
  const start = Math.floor(lo / step) * step;
  const end = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= end + step / 2; v += step) ticks.push(Number(v.toFixed(10)));
  return { ticks, domain: [start, end] };
}

/** Equity at time `t`: the last curve point at or before it (the curve is in time order). */
export function equityAt(curve: readonly EquityPoint[], t: number): number | null {
  let lo = 0;
  let hi = curve.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (curve[mid].t <= t) {
      found = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return found < 0 ? (curve[0]?.equity ?? null) : curve[found].equity;
}

export type TradeDot = { id: string; kind: 'entry' | 'exit'; side: Trade['side']; t: number; equity: number };

/** One dot at each trade's entry and exit, placed on the equity curve. */
export function tradeDots(trades: readonly Trade[], curve: readonly EquityPoint[]): TradeDot[] {
  const out: TradeDot[] = [];
  for (const tr of trades) {
    for (const [kind, t] of [['entry', tr.openedAt], ['exit', tr.closedAt]] as const) {
      const e = equityAt(curve, t);
      if (e !== null) out.push({ id: tr.id, kind, side: tr.side, t, equity: e });
    }
  }
  return out;
}
