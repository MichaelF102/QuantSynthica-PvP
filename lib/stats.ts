import { equity } from './engine';
import type { EquityPoint, MatchState, Trade } from './types';

// Results statistics (CLAUDE.md §5 Stats). `null` means "not defined" and is shown as '—'.

export type Stats = {
  startingBalance: number;
  finalEquity: number;
  pnl: number;
  returnPct: number;
  trades: number;
  wins: number;
  losses: number;
  /** % of closed trades with positive P&L; null with no trades. */
  winRate: number | null;
  /** gross profit / gross loss; null with no trades or no losing trades. */
  profitFactor: number | null;
  grossProfit: number;
  grossLoss: number;
  maxDrawdownPct: number;
  avgWin: number | null;
  avgLoss: number | null;
  largestWin: number | null;
  largestLoss: number | null;
  durationMs: number;
};

/** Largest peak-to-trough drop of the curve, in % of the peak. 0 for a flat or rising curve. */
export function maxDrawdownPct(curve: EquityPoint[]): number {
  let peak = -Infinity;
  let worst = 0;
  for (const { equity: e } of curve) {
    if (e > peak) peak = e;
    else if (peak > 0) worst = Math.max(worst, ((peak - e) / peak) * 100);
  }
  return worst;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export function tradeStats(trades: Trade[]) {
  const winners = trades.filter((t) => t.pnl > 0).map((t) => t.pnl);
  const losers = trades.filter((t) => t.pnl < 0).map((t) => t.pnl);
  const grossProfit = winners.reduce((a, b) => a + b, 0);
  const grossLoss = -losers.reduce((a, b) => a + b, 0);
  return {
    trades: trades.length,
    wins: winners.length,
    losses: losers.length,
    winRate: trades.length ? (winners.length / trades.length) * 100 : null,
    profitFactor: trades.length && grossLoss > 0 ? grossProfit / grossLoss : null,
    grossProfit,
    grossLoss,
    avgWin: mean(winners),
    avgLoss: mean(losers),
    largestWin: winners.length ? Math.max(...winners) : null,
    largestLoss: losers.length ? Math.min(...losers) : null,
  };
}

export function computeStats(state: MatchState): Stats {
  const startingBalance = state.config.startingBalance;
  const finalEquity = equity(state);
  return {
    startingBalance,
    finalEquity,
    pnl: finalEquity - startingBalance,
    returnPct: ((finalEquity - startingBalance) / startingBalance) * 100,
    ...tradeStats(state.trades),
    maxDrawdownPct: maxDrawdownPct(state.equityCurve),
    durationMs: state.elapsedMs,
  };
}
