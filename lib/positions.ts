import { roundToStep } from './lots';
import type { Position, Side, Trade } from './types';

// Net-position maths (CLAUDE.md §5 rules 3 and 5). Pure; no match state here.

export type FillResult = {
  /** The position after the fill, or null if it is now flat. */
  position: Position | null;
  /** Closed portion, if the fill reduced or flipped the position. */
  closed: Omit<Trade, 'id'> | null;
  realizedPnl: number;
};

/** Adds `fees` to an object only when non-zero, so cost-free matches keep their old shape. */
function withOpenFees(p: Position, fees: number): Position {
  const { openFees: _drop, ...rest } = p;
  return fees > 1e-12 ? { ...rest, openFees: fees } : rest;
}

/**
 * Applies a fill of `units` (> 0) on `side` at `price` to the current position.
 * Same direction adds with a weighted average entry (and keeps any stop-loss / take-profit).
 * Opposite direction reduces first, realising P&L on the reduced units; any remainder opens the
 * other side at the fill price with no stop or target (plan M12 C4).
 *
 * `fee` (plan M12 C6) is the commission on this fill. The part that closes units, plus the same
 * share of the position's opening fees, is charged to the closed trade's P&L; the rest is kept on
 * the position as `openFees`. `realizedPnl` is the price P&L only; the caller deducts `fee` from cash.
 */
export function applyFill(position: Position | null, symbol: string, side: Side, units: number, price: number, time: number, lotStep: number, fee = 0): FillResult {
  const delta = side === 'buy' ? units : -units;
  const q = position?.units ?? 0;

  if (q === 0 || Math.sign(q) === Math.sign(delta)) {
    const next = roundToStep(q + delta, lotStep);
    if (q === 0) return { position: withOpenFees({ symbol, units: next, avgEntry: price, openedAt: time }, fee), closed: null, realizedPnl: 0 };
    const pos = position!;
    const avgEntry = (Math.abs(q) * pos.avgEntry + units * price) / Math.abs(next);
    return { position: withOpenFees({ ...pos, units: next, avgEntry }, (pos.openFees ?? 0) + fee), closed: null, realizedPnl: 0 };
  }

  const pos = position!;
  const closeUnits = Math.min(units, Math.abs(q));
  const realizedPnl = (price - pos.avgEntry) * closeUnits * Math.sign(q);
  const closeFee = fee * (closeUnits / units);
  const openFeeShare = (pos.openFees ?? 0) * (closeUnits / Math.abs(q));
  const fees = closeFee + openFeeShare;
  const closed: Omit<Trade, 'id'> = {
    symbol,
    side: q > 0 ? 'buy' : 'sell',
    units: closeUnits,
    entry: pos.avgEntry,
    exit: price,
    pnl: realizedPnl - fees,
    openedAt: pos.openedAt,
    closedAt: time,
    ...(fees > 1e-12 ? { fees } : {}),
  };
  const next = roundToStep(q + delta, lotStep);
  if (next === 0) return { position: null, closed, realizedPnl };
  if (Math.sign(next) === Math.sign(q)) return { position: withOpenFees({ ...pos, units: next }, (pos.openFees ?? 0) - openFeeShare), closed, realizedPnl };
  // Overshoot: the remainder opens the other side at the fill price, without stop or target.
  return { position: withOpenFees({ symbol, units: next, avgEntry: price, openedAt: time }, fee - closeFee), closed, realizedPnl };
}

/** |units| after the fill, and whether the fill increases exposure. */
export function exposureAfter(position: Position | null, side: Side, units: number, lotStep: number): { units: number; increases: boolean } {
  const q = position?.units ?? 0;
  const next = roundToStep(q + (side === 'buy' ? units : -units), lotStep);
  return { units: Math.abs(next), increases: Math.abs(next) > Math.abs(q) || Math.sign(next) === -Math.sign(q) };
}
