import { fmtDuration, fmtPct, isNum } from './format';
import type { MatchResult } from './results';
import type { Candle, Trade } from './types';

// Post-match analysis for the results page. Pure; every number comes from the saved result or
// from the session's own candles. `null` means "not defined" and is shown as '—'.

// ---------- How the match ended ----------

export function endSummary(r: Pick<MatchResult, 'endReason' | 'config' | 'stats'>): { label: string; detail: string } {
  const total = r.config.durationMs;
  const left = Math.max(0, total - r.stats.durationMs);
  const of = `${fmtDuration(left)} left of ${fmtDuration(total)}`;
  switch (r.endReason) {
    case 'timer':
      return { label: "Time's up", detail: `Full ${fmtDuration(total)} played` };
    case 'drawdown':
      return { label: 'Max drawdown reached', detail: `Hit the ${fmtPct(r.config.maxDrawdownPct, 0, false)} limit · ${of}` };
    case 'data_end':
      return { label: 'End of session data', detail: `The session's candles ran out · ${of}` };
    default:
      return { label: 'Ended by you', detail: of };
  }
}

// ---------- Buy & hold benchmark ----------

/** The candles the player saw: from the start candle to the last revealed one, inclusive. */
export function sessionCandles(candles: readonly Candle[], start: number, end: number): Candle[] {
  return candles.filter((c) => c.time >= start && c.time <= end);
}

/**
 * Return of buying at the close of the start candle and holding to the close of the last revealed
 * candle, in %. Null when the session has fewer than two candles or a zero start price.
 */
export function buyAndHoldPct(session: readonly Candle[]): number | null {
  if (session.length < 2) return null;
  const a = session[0].close;
  const b = session[session.length - 1].close;
  return isNum(a) && isNum(b) && a !== 0 ? ((b - a) / a) * 100 : null;
}

/** Player return minus buy & hold, in percentage points. */
export const edgePts = (returnPct: number, bh: number | null): number | null => (bh === null || !isNum(returnPct) ? null : returnPct - bh);

// ---------- Extra trade statistics ----------

export type SideStats = { count: number; pnl: number };

export type TradeExtras = {
  /** Mean P&L per closed trade. */
  expectancy: number | null;
  /** Average win / |average loss|. Null without both a win and a loss. */
  payoffRatio: number | null;
  /** Mean holding time in seconds of market time. */
  avgHoldWin: number | null;
  avgHoldLoss: number | null;
  longs: SideStats;
  shorts: SideStats;
  maxLosingStreak: number;
  /** Share of the session's market time with a position open, in %. Null for an empty session. */
  timeInMarketPct: number | null;
  /** Largest entry notional as a % of the starting balance. */
  largestPositionPct: number | null;
};

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const hold = (t: Trade) => Math.max(0, t.closedAt - t.openedAt);
export const notional = (t: Pick<Trade, 'entry' | 'units'>) => Math.abs(t.entry * t.units);

/** Total length of the union of [start, end] intervals. Overlaps (partial closes) count once. */
export function unionLength(intervals: readonly [number, number][]): number {
  const sorted = intervals.filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0]);
  let total = 0;
  let curA = -Infinity;
  let curB = -Infinity;
  for (const [a, b] of sorted) {
    if (a > curB) {
      if (curB > curA) total += curB - curA;
      curA = a;
      curB = b;
    } else curB = Math.max(curB, b);
  }
  if (curB > curA) total += curB - curA;
  return total;
}

export function maxLosingStreak(trades: readonly Trade[]): number {
  let best = 0;
  let run = 0;
  for (const t of trades) {
    run = t.pnl < 0 ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

export function tradeExtras(trades: readonly Trade[], sessionStart: number, sessionEnd: number, startingBalance: number): TradeExtras {
  const wins = trades.filter((t) => t.pnl > 0);
  const losses = trades.filter((t) => t.pnl < 0);
  const avgWin = mean(wins.map((t) => t.pnl));
  const avgLoss = mean(losses.map((t) => t.pnl));
  const side = (s: Trade['side']): SideStats => {
    const xs = trades.filter((t) => t.side === s);
    return { count: xs.length, pnl: xs.reduce((a, t) => a + t.pnl, 0) };
  };
  const span = sessionEnd - sessionStart;
  return {
    expectancy: mean(trades.map((t) => t.pnl)),
    payoffRatio: avgWin !== null && avgLoss !== null && avgLoss !== 0 ? avgWin / Math.abs(avgLoss) : null,
    avgHoldWin: mean(wins.map(hold)),
    avgHoldLoss: mean(losses.map(hold)),
    longs: side('buy'),
    shorts: side('sell'),
    maxLosingStreak: maxLosingStreak(trades),
    timeInMarketPct: span > 0 ? Math.min(100, (unionLength(trades.map((t) => [t.openedAt, t.closedAt])) / span) * 100) : null,
    largestPositionPct: trades.length && startingBalance > 0 ? (Math.max(...trades.map(notional)) / startingBalance) * 100 : null,
  };
}

// ---------- Context from other matches ----------

export type SymbolContext = { count: number; rank: number; best: number; avg: number };

/** This result among all saved results on the same symbol (it is included). Null if absent. */
export function symbolContext(all: readonly MatchResult[], current: Pick<MatchResult, 'id' | 'symbol'>): SymbolContext | null {
  const same = all.filter((r) => r.symbol === current.symbol);
  const me = same.find((r) => r.id === current.id);
  if (!me) return null;
  const returns = same.map((r) => r.stats.returnPct);
  return {
    count: same.length,
    rank: 1 + returns.filter((x) => x > me.stats.returnPct).length,
    best: Math.max(...returns),
    avg: returns.reduce((a, b) => a + b, 0) / returns.length,
  };
}

export const ordinal = (n: number): string => {
  const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th';
  return `${n}${s}`;
};
