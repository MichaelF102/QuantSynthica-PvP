import type { Candle, MatchState, Position } from './types';

// Read-only views of a match (CLAUDE.md §5). engine.ts re-exports everything here.

const EPS = 1e-9;
export { EPS };

export type OrderErrorCode =
  | 'insufficient_balance'
  | 'size_zero'
  | 'invalid_size'
  | 'match_not_running'
  /** Plan M12 C2: a next-open order is already waiting. */
  | 'order_queued'
  /** Plan M12 C4: stop-loss / take-profit need an open position and valid levels. */
  | 'no_position'
  | 'invalid_stop'
  | 'invalid_target'
  /** Plan M15: a stop/target on an order that only reduces the position. */
  | 'brackets_need_entry';

export class OrderError extends Error {
  readonly code: OrderErrorCode;
  constructor(code: OrderErrorCode, message: string) {
    super(message);
    this.name = 'OrderError';
    this.code = code;
  }
}

/** The candles the player may see: never anything after the cursor (rule 10). */
export function visibleCandles(state: MatchState): Candle[] {
  return state.candles.slice(0, state.cursor + 1);
}

export function currentCandle(state: MatchState): Candle {
  return state.candles[state.cursor];
}

/** Rule 1: the close of the current candle (the price P&L and equity use). */
export function currentPrice(state: MatchState): number {
  return currentCandle(state).close;
}

export function isLastCandle(state: MatchState): boolean {
  return state.cursor >= state.candles.length - 1;
}

export function positionFor(state: MatchState, symbol: string = state.config.symbol): Position | null {
  return state.positions.find((p) => p.symbol === symbol) ?? null;
}

/** Rule 5 for one position: (price − avgEntry) × units, with signed units. */
export function positionPnl(state: MatchState, position: Position): number {
  return (currentPrice(state) - position.avgEntry) * position.units;
}

/** Rule 5: Σ (price − avgEntry) × units, with signed units. */
export function unrealizedPnl(state: MatchState): number {
  const price = currentPrice(state);
  return state.positions.reduce((sum, p) => sum + (price - p.avgEntry) * p.units, 0);
}

/** Rule 5: equity = balance + unrealized. */
export function equity(state: MatchState): number {
  return state.balance + unrealizedPnl(state);
}

/** Rule 6: (peak − equity) / peak × 100, with the peak including the current equity. */
export function drawdownPct(state: MatchState): number {
  const eq = equity(state);
  const peak = Math.max(state.peakEquity, eq);
  return peak > 0 ? Math.max(0, ((peak - eq) / peak) * 100) : 0;
}

export function realizedPnl(state: MatchState): number {
  return state.balance - state.config.startingBalance;
}

/** Playable candles revealed so far and in total (history candles not counted). */
export function replayProgress(state: MatchState): { revealed: number; total: number } {
  return { revealed: state.cursor - state.startCursor, total: state.candles.length - 1 - state.startCursor };
}

/** Time of the session's last candle: a bound for "jump to time". Exposes no price data. */
export function sessionEndTime(state: MatchState): number {
  return state.candles[state.candles.length - 1].time;
}

export function remainingMs(state: MatchState): number {
  return Math.max(0, state.config.durationMs - state.elapsedMs);
}

