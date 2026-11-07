import { bracketError, bracketHit, entryBracketError, withBrackets } from './brackets';
import { closingSide, costsOf, executeFill, slipped } from './execution';
import { OrderError, currentCandle, currentPrice, positionFor } from './matchRead';
import { exceedsBalance } from './orderChecks';
import type { Brackets, CancelledOrder, MatchState, Side, QueuedOrder } from './types';

// Next-open orders (plan M12 C2) and stop-loss / take-profit (C4, C5). Pure. engine.ts calls the
// candle steps from advance() and re-exports the player actions.

export function assertTradable(state: MatchState): void {
  if (state.status !== 'running' && state.status !== 'paused') {
    throw new OrderError('match_not_running', state.status === 'ended' ? 'The match has ended' : 'Start the match before trading');
  }
}

export function queue(state: MatchState, side: Side, units: number, close = false, brackets: Brackets | null = null): MatchState {
  const t = currentCandle(state).time;
  const queued: QueuedOrder = {
    id: `${state.config.symbol}-${t}-q${state.fills.length + state.cancelled.length + 1}`,
    side,
    units,
    placedAt: t,
    ...(close ? { close } : {}),
    ...(brackets ? { stopLoss: brackets.stopLoss, takeProfit: brackets.takeProfit } : {}),
  };
  return { ...state, queued };
}

export function cancel(state: MatchState, reason: CancelledOrder['reason']): MatchState {
  if (!state.queued) return state;
  const cancelled: CancelledOrder = { ...state.queued, cancelledAt: currentCandle(state).time, reason };
  return { ...state, queued: null, cancelled: [...state.cancelled, cancelled] };
}

/** C2: the player cancels the waiting next-open order. No-op when nothing is waiting. */
export function cancelQueued(state: MatchState): MatchState {
  return state.status === 'ended' ? state : cancel(state, 'user');
}

/** C4: sets or clears the open position's stop-loss and take-profit. Throws OrderError. */
export function setBrackets(state: MatchState, brackets: Brackets, symbol: string = state.config.symbol): MatchState {
  assertTradable(state);
  const p = positionFor(state, symbol);
  if (!p) throw new OrderError('no_position', 'Open a position first');
  const code = bracketError(p, currentPrice(state), brackets);
  if (code === 'invalid_stop') throw new OrderError(code, p.units > 0 ? 'Stop must be below the current price' : 'Stop must be above the current price');
  if (code === 'invalid_target') throw new OrderError(code, p.units > 0 ? 'Target must be above the current price' : 'Target must be below the current price');
  const updated = withBrackets(p, brackets);
  return { ...state, positions: state.positions.map((x) => (x === p ? updated : x)) };
}

/** C2: on a newly revealed candle, a waiting order fills at its open or is cancelled. */
export function fillQueued(state: MatchState): MatchState {
  const q = state.queued;
  if (!q) return state;
  const { open } = currentCandle(state);
  const { slippageBps } = costsOf(state.config);
  const rest = { ...state, queued: null };
  if (q.close) {
    const p = positionFor(rest);
    if (!p) return cancel(state, 'no_position');
    const side = closingSide(p.units);
    return executeFill(rest, side, Math.abs(p.units), slipped(open, side, slippageBps), 'next_open');
  }
  const price = slipped(open, q.side, slippageBps);
  if (exceedsBalance(rest, q.side, q.units, price)) return cancel(state, 'insufficient_balance');
  // Plan M15: an open that is already past the attached stop or target cancels the order.
  const b = 'stopLoss' in q || 'takeProfit' in q ? { stopLoss: q.stopLoss ?? null, takeProfit: q.takeProfit ?? null } : null;
  if (b && entryBracketError(q.side, open, b)) return cancel(state, 'brackets_invalid');
  const filled = executeFill(rest, q.side, q.units, price, 'next_open');
  const p = b ? positionFor(filled) : null;
  return p && b ? { ...filled, positions: filled.positions.map((x) => (x === p ? withBrackets(p, b) : x)) } : filled;
}

/** C5: a stop or target touched by the current candle closes the position. Stops get slippage. */
export function triggerBrackets(state: MatchState): MatchState {
  const p = positionFor(state);
  const hit = p ? bracketHit(p, currentCandle(state)) : null;
  if (!p || !hit) return state;
  const side = closingSide(p.units);
  const price = hit.trigger === 'stop_loss' ? slipped(hit.price, side, costsOf(state.config).slippageBps) : hit.price;
  return executeFill(state, side, Math.abs(p.units), price, hit.trigger);
}

