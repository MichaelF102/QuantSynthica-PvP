import { applyFill } from './positions';
import type { FillModel, FillTrigger, MatchConfig, MatchState, Side, Trade } from './types';

// Execution costs and the one function that books a fill (plan M12 C6, C7, C9). Pure; no match
// rules beyond "apply this fill at this price". engine.ts decides when and at what price.

export type Costs = { fillModel: FillModel; commission: number; slippageBps: number };

/** A config's execution settings, with old configs (no fields) read as today's rules. */
export function costsOf(config: Pick<MatchConfig, 'fillModel' | 'commission' | 'slippageBps'>): Costs {
  return {
    fillModel: config.fillModel ?? 'close',
    commission: config.commission && config.commission > 0 ? config.commission : 0,
    slippageBps: config.slippageBps && config.slippageBps > 0 ? config.slippageBps : 0,
  };
}

/** C7: the price moved against the player: up for a buy, down for a sell. */
export function slipped(price: number, side: Side, bps: number): number {
  if (!(bps > 0)) return price;
  const k = bps / 10_000;
  return side === 'buy' ? price * (1 + k) : price * (1 - k);
}

/** The side that closes a position of signed `units`. */
export const closingSide = (units: number): Side => (units > 0 ? 'sell' : 'buy');

/**
 * Books a fill of `units` on `side` at `price` (already including any slippage) on the current
 * candle: updates the net position, charges the commission and records the fill and any trade.
 * No status, balance or rule checks: the caller has done them.
 */
export function executeFill(state: MatchState, side: Side, units: number, price: number, trigger: FillTrigger): MatchState {
  const { symbol, lotStep } = state.config;
  const fee = costsOf(state.config).commission;
  const time = state.candles[state.cursor].time;
  const current = state.positions.find((p) => p.symbol === symbol) ?? null;
  const result = applyFill(current, symbol, side, units, price, time, lotStep, fee);

  const others = state.positions.filter((p) => p.symbol !== symbol);
  const trades: Trade[] = result.closed ? [...state.trades, { ...result.closed, id: `${symbol}-${time}-${state.trades.length + 1}` }] : state.trades;
  const fill = {
    id: `${symbol}-${time}-f${state.fills.length + 1}`,
    symbol,
    side,
    units,
    price,
    time,
    realizedPnl: result.realizedPnl,
    // Defaults are left out so cost-free market fills keep their old shape (C9).
    ...(fee > 0 ? { fee } : {}),
    ...(trigger !== 'market' ? { trigger } : {}),
  };

  return {
    ...state,
    balance: state.balance + result.realizedPnl - fee,
    positions: result.position ? [...others, result.position] : others,
    trades,
    fills: [...state.fills, fill],
  };
}

/** Closes every open position at the current close, with slippage (rules 7 and 8, plan M12 C3). */
export function closeAll(state: MatchState): MatchState {
  const close = state.candles[state.cursor].close;
  const { slippageBps } = costsOf(state.config);
  return state.positions.reduce((s, p) => {
    const side = closingSide(p.units);
    return executeFill(s, side, Math.abs(p.units), slipped(close, side, slippageBps), 'match_end');
  }, state);
}

/** Total commission paid across fills. */
export function feesPaid(fills: readonly { fee?: number }[]): number {
  return fills.reduce((sum, f) => sum + (f.fee ?? 0), 0);
}
