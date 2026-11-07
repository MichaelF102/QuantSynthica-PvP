import type { DuelResult } from './multiplayer/duelResult';
import type { MatchResult } from './results';

// Trends across saved results (plan M13 Part A). Pure. Money is never added across matches,
// because accounts can be in USD or INR (P2): everything here is a % or a count.

export const ROLLING_WINDOW = 5;

type Practice = Pick<MatchResult, 'id' | 'symbol' | 'symbolName' | 'playedAt' | 'endReason' | 'stats'>;

export type ProgressSummary = {
  matches: number;
  avgReturn: number | null;
  medianReturn: number | null;
  /** Σ winning trades / Σ closed trades across matches (P3); null with no trades. */
  tradeWinRate: number | null;
  trades: number;
  best: { id: string; symbol: string; returnPct: number } | null;
  worst: { id: string; symbol: string; returnPct: number } | null;
  stopOuts: number;
};

export type TrendPoint = {
  /** 1-based match number, oldest first. */
  n: number;
  id: string;
  symbol: string;
  playedAt: number;
  returnPct: number;
  /** Average return of this match and the ones before it, over ROLLING_WINDOW matches. */
  rollingReturn: number;
  /** Trade win rate over the same window; null when the window has no closed trades (a gap, P4). */
  rollingWinRate: number | null;
};

export type SymbolRow = {
  symbol: string;
  name: string;
  matches: number;
  avgReturn: number;
  bestReturn: number;
  worstReturn: number;
  tradeWinRate: number | null;
  trades: number;
  stopOuts: number;
  tag: 'best' | 'worst' | null;
};

export type DuelRecord = { played: number; wins: number; losses: number; draws: number; winPct: number | null; avgReturn: number | null };

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Σ wins / Σ trades in %, or null with no trades. */
function pooledWinRate(rs: readonly Practice[]): number | null {
  const trades = rs.reduce((n, r) => n + r.stats.trades, 0);
  return trades ? (rs.reduce((n, r) => n + r.stats.wins, 0) / trades) * 100 : null;
}

export function summarize(results: readonly Practice[]): ProgressSummary {
  const returns = results.map((r) => r.stats.returnPct);
  let best: Practice | null = null;
  let worst: Practice | null = null;
  for (const r of results) {
    if (!best || r.stats.returnPct > best.stats.returnPct) best = r;
    if (!worst || r.stats.returnPct < worst.stats.returnPct) worst = r;
  }
  const pick = (r: Practice | null) => (r ? { id: r.id, symbol: r.symbol, returnPct: r.stats.returnPct } : null);
  return {
    matches: results.length,
    avgReturn: mean(returns),
    medianReturn: median(returns),
    tradeWinRate: pooledWinRate(results),
    trades: results.reduce((n, r) => n + r.stats.trades, 0),
    best: pick(best),
    worst: pick(worst),
    stopOuts: results.filter((r) => r.endReason === 'drawdown').length,
  };
}

/** One point per match, oldest first, with rolling averages over the last `window` matches. */
export function trend(results: readonly Practice[], window = ROLLING_WINDOW): TrendPoint[] {
  const ordered = [...results].sort((a, b) => a.playedAt - b.playedAt);
  return ordered.map((r, i) => {
    const slice = ordered.slice(Math.max(0, i - window + 1), i + 1);
    return {
      n: i + 1,
      id: r.id,
      symbol: r.symbol,
      playedAt: r.playedAt,
      returnPct: r.stats.returnPct,
      rollingReturn: mean(slice.map((x) => x.stats.returnPct)) as number,
      rollingWinRate: pooledWinRate(slice),
    };
  });
}

/** Per-symbol rows, best average return first. Best/worst tags need 2+ symbols (P5). */
export function bySymbol(results: readonly Practice[]): SymbolRow[] {
  const groups = new Map<string, Practice[]>();
  for (const r of results) groups.set(r.symbol, [...(groups.get(r.symbol) ?? []), r]);
  const rows: SymbolRow[] = [...groups.entries()].map(([symbol, rs]) => {
    const returns = rs.map((r) => r.stats.returnPct);
    return {
      symbol,
      name: rs[0].symbolName,
      matches: rs.length,
      avgReturn: mean(returns) as number,
      bestReturn: Math.max(...returns),
      worstReturn: Math.min(...returns),
      tradeWinRate: pooledWinRate(rs),
      trades: rs.reduce((n, r) => n + r.stats.trades, 0),
      stopOuts: rs.filter((r) => r.endReason === 'drawdown').length,
      tag: null,
    };
  });
  rows.sort((a, b) => b.avgReturn - a.avgReturn || b.matches - a.matches || a.symbol.localeCompare(b.symbol));
  if (rows.length >= 2) {
    rows[0] = { ...rows[0], tag: 'best' };
    rows[rows.length - 1] = { ...rows[rows.length - 1], tag: 'worst' };
  }
  return rows;
}

export function duelRecord(duels: readonly Pick<DuelResult, 'outcome' | 'you'>[]): DuelRecord {
  const count = (o: DuelResult['outcome']) => duels.filter((d) => d.outcome === o).length;
  const wins = count('win');
  return {
    played: duels.length,
    wins,
    losses: count('loss'),
    draws: count('draw'),
    winPct: duels.length ? (wins / duels.length) * 100 : null,
    avgReturn: mean(duels.map((d) => d.you.stats.returnPct)),
  };
}
