import type { Brackets, Candle, FillTrigger, OrderBrackets, Position, Side } from './types';

// Stop-loss and take-profit on the open position (plan M12 C4, C5). Pure.

export type BracketErrorCode = 'invalid_stop' | 'invalid_target';

const isLevel = (v: number | null): v is number => v !== null && Number.isFinite(v) && v > 0;

/**
 * C4: for a long, the stop must be below the current price and the target above it; for a
 * short, the reverse. null clears a level. Returns the first problem, or null if valid.
 */
export function bracketError(position: Position, price: number, b: Brackets): BracketErrorCode | null {
  const long = position.units > 0;
  if (b.stopLoss !== null) {
    if (!isLevel(b.stopLoss)) return 'invalid_stop';
    if (long ? b.stopLoss >= price : b.stopLoss <= price) return 'invalid_stop';
  }
  if (b.takeProfit !== null) {
    if (!isLevel(b.takeProfit)) return 'invalid_target';
    if (long ? b.takeProfit <= price : b.takeProfit >= price) return 'invalid_target';
  }
  return null;
}

/** Plan M15: the levels an order carries, or null when it carries none (both empty counts as none). */
export function orderBrackets(o: OrderBrackets): Brackets | null {
  const b = { stopLoss: o.stopLoss ?? null, takeProfit: o.takeProfit ?? null };
  return b.stopLoss === null && b.takeProfit === null ? null : b;
}

/** Plan M15: levels for a new position on `side` entered at `price` (a buy is long). */
export const entryBracketError = (side: Side, price: number, b: Brackets) => bracketError({ symbol: '', units: side === 'buy' ? 1 : -1, avgEntry: price, openedAt: 0 }, price, b);

/** The position with its levels replaced (null levels are removed). */
export function withBrackets(position: Position, b: Brackets): Position {
  const { stopLoss: _s, takeProfit: _t, ...rest } = position;
  return { ...rest, ...(b.stopLoss !== null ? { stopLoss: b.stopLoss } : {}), ...(b.takeProfit !== null ? { takeProfit: b.takeProfit } : {}) };
}

export type BracketHit = { trigger: Extract<FillTrigger, 'stop_loss' | 'take_profit'>; price: number };

/**
 * C5: which level `candle` triggers, and the price before slippage. The open comes first, so a
 * gap through a level fills at the open. When the rest of the candle touches both levels, the
 * stop wins: a 1m candle does not say which came first, so we take the worse case.
 */
export function bracketHit(position: Position, candle: Candle): BracketHit | null {
  const sl = position.stopLoss ?? null;
  const tp = position.takeProfit ?? null;
  if (sl === null && tp === null) return null;
  const long = position.units > 0;
  const through = (level: number | null, up: boolean, price: number) => level !== null && (up ? price >= level : price <= level);

  // A stop is hit by the price moving against the position; a target by it moving in favour.
  if (through(tp, long, candle.open)) return { trigger: 'take_profit', price: candle.open };
  if (through(sl, !long, candle.open)) return { trigger: 'stop_loss', price: candle.open };
  if (through(sl, !long, long ? candle.low : candle.high)) return { trigger: 'stop_loss', price: sl as number };
  if (through(tp, long, long ? candle.high : candle.low)) return { trigger: 'take_profit', price: tp as number };
  return null;
}
