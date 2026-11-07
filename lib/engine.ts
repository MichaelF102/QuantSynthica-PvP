import { entryBracketError, orderBrackets, withBrackets } from './brackets';
import { closeAll, closingSide, costsOf, executeFill, slipped } from './execution';
import { floorToStep, percentToUnits, roundToStep } from './lots';
import { EPS, OrderError, currentCandle, currentPrice, drawdownPct, equity, isLastCandle, positionFor, type OrderErrorCode } from './matchRead';
import { exceedsBalance } from './orderChecks';
import { assertTradable, cancel, fillQueued, queue, triggerBrackets } from './pendingOrders';
import type { Candle, EndReason, MatchConfig, MatchState, OrderBrackets, OrderRequest } from './types';

export * from './matchRead';
export { costsOf } from './execution';
export { cancelQueued, setBrackets } from './pendingOrders';

// The single source of truth for match rules (CLAUDE.md §5). Pure: every function takes a state
// and returns a new one; nothing here touches React, the DOM or the clock. The UI never computes
// P&L, equity or drawdown itself.

// ---------------------------------------------------------------------------------------------
// Creation
// ---------------------------------------------------------------------------------------------

export function createMatch(config: MatchConfig, candles: Candle[], startCursor = 0): MatchState {
  if (candles.length === 0) throw new RangeError('a match needs at least one candle');
  if (!Number.isInteger(startCursor) || startCursor < 0 || startCursor >= candles.length) {
    throw new RangeError(`startCursor ${startCursor} is outside the session`);
  }
  if (!(config.startingBalance > 0)) throw new RangeError('startingBalance must be positive');
  if (!(config.durationMs > 0)) throw new RangeError('durationMs must be positive');
  if (!(config.lotStep > 0)) throw new RangeError('lotStep must be positive');
  return {
    status: 'idle',
    candles,
    cursor: startCursor,
    startCursor,
    balance: config.startingBalance,
    positions: [],
    trades: [],
    fills: [],
    queued: null,
    cancelled: [],
    equityCurve: [{ t: candles[startCursor].time, equity: config.startingBalance }],
    peakEquity: config.startingBalance,
    startedAt: null,
    elapsedMs: 0,
    config,
  };
}

// ---------------------------------------------------------------------------------------------
// Internal steps
// ---------------------------------------------------------------------------------------------

/** Records equity at the current candle (replacing a point at the same time) and updates the peak. */
function markEquity(state: MatchState): MatchState {
  const t = currentCandle(state).time;
  const eq = equity(state);
  const last = state.equityCurve[state.equityCurve.length - 1];
  const point = { t, equity: eq };
  const equityCurve = last && last.t === t ? [...state.equityCurve.slice(0, -1), point] : [...state.equityCurve, point];
  return { ...state, equityCurve, peakEquity: Math.max(state.peakEquity, eq) };
}

/** Rule 6: end the match once drawdown reaches the limit. */
function checkDrawdown(state: MatchState): MatchState {
  if (state.status === 'ended') return state;
  return drawdownPct(state) >= state.config.maxDrawdownPct - EPS ? endMatch(state, 'drawdown') : state;
}

// ---------------------------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------------------------

/** Price used to turn a % of balance into units: the current close with buy-side slippage, so the order always fits (C8). */
export function sizingPrice(state: MatchState): number {
  return slipped(currentPrice(state), 'buy', costsOf(state.config).slippageBps);
}

/** Cash a % size may spend: the balance less one commission (C8). */
export function spendableBalance(state: MatchState): number {
  return Math.max(0, state.balance - costsOf(state.config).commission);
}

/** Converts an order request to whole-lot units (rule 2) and validates it. Throws OrderError. */
export function resolveOrderUnits(state: MatchState, order: OrderRequest): number {
  assertTradable(state);
  if (state.queued) throw new OrderError('order_queued', 'An order is already waiting for the next candle');
  const { lotStep } = state.config;
  const raw = 'percent' in order ? order.percent : order.units;
  if (!Number.isFinite(raw) || raw < 0) throw new OrderError('invalid_size', 'Enter a positive size');
  const units = 'percent' in order ? percentToUnits(spendableBalance(state), order.percent, sizingPrice(state), lotStep) : floorToStep(order.units, lotStep);
  if (units <= 0) throw new OrderError('size_zero', 'Size is below the minimum lot');

  // Rule 4, no leverage: an order that increases exposure may not leave a position worth more
  // than the balance. Reducing or closing is always allowed. A next-open order is checked at the
  // current close now and again at the open (C2).
  const price = slipped(currentPrice(state), order.side, costsOf(state.config).slippageBps);
  if (exceedsBalance(state, order.side, units, price)) throw new OrderError('insufficient_balance', 'Insufficient balance');

  // Plan M15: an attached stop/target needs the order to leave a position on its own side, with
  // the levels on the right sides of the current price.
  const b = orderBrackets(order);
  if (b) {
    const q = positionFor(state)?.units ?? 0;
    const next = roundToStep(q + (order.side === 'buy' ? units : -units), lotStep);
    if (Math.sign(next) !== (order.side === 'buy' ? 1 : -1)) throw new OrderError('brackets_need_entry', 'This order only reduces your position, so it cannot carry a stop or target');
    const code = entryBracketError(order.side, currentPrice(state), b);
    if (code === 'invalid_stop') throw new OrderError(code, order.side === 'buy' ? 'Stop must be below the current price' : 'Stop must be above the current price');
    if (code === 'invalid_target') throw new OrderError(code, order.side === 'buy' ? 'Target must be above the current price' : 'Target must be below the current price');
  }
  return units;
}

/** Plan M15: puts an order's levels on the position it left. */
export function attachBrackets(state: MatchState, order: OrderBrackets): MatchState {
  const b = orderBrackets(order);
  const p = positionFor(state);
  if (!b || !p) return state;
  const updated = withBrackets(p, b);
  return { ...state, positions: state.positions.map((x) => (x === p ? updated : x)) };
}

/** null if the order would be accepted, otherwise the reason it would be rejected. */
export function canPlace(state: MatchState, order: OrderRequest): OrderErrorCode | null {
  try {
    resolveOrderUnits(state, order);
    return null;
  } catch (e) {
    if (e instanceof OrderError) return e.code;
    throw e;
  }
}

/**
 * A market order. Rule 1: under the default fill model it fills now at the current close (plus
 * slippage). Under 'next_open' (C2) it is queued and fills when the next candle is revealed.
 * Throws OrderError when rejected.
 */
export function placeMarketOrder(state: MatchState, order: OrderRequest): MatchState {
  const units = resolveOrderUnits(state, order);
  const { fillModel, slippageBps } = costsOf(state.config);
  if (fillModel === 'next_open') return queue(state, order.side, units, false, orderBrackets(order));
  const filled = executeFill(state, order.side, units, slipped(currentPrice(state), order.side, slippageBps), 'market');
  return checkDrawdown(markEquity(attachBrackets(filled, order)));
}

/** Closes the whole position in `symbol` (queued under 'next_open'). No-op when flat. */
export function closePosition(state: MatchState, symbol: string = state.config.symbol): MatchState {
  const p = positionFor(state, symbol);
  if (!p) return state;
  if (costsOf(state.config).fillModel === 'next_open') {
    resolveOrderUnits(state, { side: closingSide(p.units), units: Math.abs(p.units) });
    return queue(state, closingSide(p.units), Math.abs(p.units), true);
  }
  return placeMarketOrder(state, { side: closingSide(p.units), units: Math.abs(p.units) });
}

// ---------------------------------------------------------------------------------------------
// Replay and lifecycle
// ---------------------------------------------------------------------------------------------

/** Starts (from idle) or resumes the match. `now` is the wall-clock start time. */
export function play(state: MatchState, now: number = Date.now()): MatchState {
  if (state.status === 'ended' || state.status === 'running') return state;
  return { ...state, status: 'running', startedAt: state.startedAt ?? now };
}

export function pause(state: MatchState, now: number = Date.now()): MatchState {
  if (state.status === 'ended' || state.status === 'paused') return state;
  // Pausing an idle match counts as starting it (e.g. the player stepped before pressing play).
  return { ...state, status: 'paused', startedAt: state.startedAt ?? now };
}

/**
 * Rule 9: reveal one candle and record equity. On the new candle a waiting next-open order fills
 * at the open first (C2), then a stop or target can trigger (C5). Rule 6: drawdown is checked
 * after the move. Rule 8: revealing the last candle ends the match (drawdown takes precedence).
 */
export function advance(state: MatchState): MatchState {
  if (state.status === 'ended' || isLastCandle(state)) return state;
  const revealed = triggerBrackets(fillQueued({ ...state, cursor: state.cursor + 1 }));
  const moved = checkDrawdown(markEquity(revealed));
  return isLastCandle(moved) ? endMatch(moved, 'data_end') : moved;
}

/** Rule 7: the timer only counts while running; reaching the duration ends the match. */
export function tick(state: MatchState, dtMs: number): MatchState {
  if (state.status !== 'running' || !(dtMs > 0)) return state;
  const elapsedMs = Math.min(state.config.durationMs, state.elapsedMs + dtMs);
  const next = { ...state, elapsedMs };
  return elapsedMs >= state.config.durationMs ? endMatch(next, 'timer') : next;
}

/**
 * Ends the match once (later calls return the state unchanged). A waiting order is cancelled,
 * open positions close at the last revealed candle's close (rules 7 and 8, C3) and a final
 * equity point is recorded.
 */
export function endMatch(state: MatchState, reason: EndReason): MatchState {
  if (state.status === 'ended') return state;
  const closed = markEquity(closeAll(cancel(state, 'match_end')));
  return { ...closed, status: 'ended', endReason: reason };
}
