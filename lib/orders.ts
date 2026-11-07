import { canPlace, costsOf, currentPrice, sizingPrice, spendableBalance, type OrderErrorCode } from './engine';
import { fmtMoney, fmtPrice, fmtSignedMoney, fmtUnits, shortSymbol } from './format';
import { floorToStep, percentToUnits } from './lots';
import type { Brackets, CancelledOrder, Fill, FillTrigger, MatchConfig, MatchState, OrderRequest, Side } from './types';

// Order-entry helpers for the trade panel and toasts. The engine decides; these only describe.

export type SizeMode = 'units' | 'percent';
export type SizeInput = { mode: SizeMode; value: number };

export function toOrderRequest(side: Side, input: SizeInput, brackets: Brackets | null = null): OrderRequest {
  const base: OrderRequest = input.mode === 'percent' ? { side, percent: input.value } : { side, units: input.value };
  return brackets ? { ...base, stopLoss: brackets.stopLoss, takeProfit: brackets.takeProfit } : base;
}

export type OrderPreview = {
  /** Units the order would fill (after lot rounding); 0 when the input is empty or invalid. */
  units: number;
  notional: number;
  /** The current close (before slippage). Under 'next_open' the real fill is the next candle's open. */
  price: number;
  /** Plan M12 C6: commission per fill (0 when off). */
  fee: number;
  /** Why a buy / sell would be rejected right now, or null if it would fill. */
  buyError: OrderErrorCode | null;
  sellError: OrderErrorCode | null;
};

export function previewOrder(state: MatchState, input: SizeInput, brackets: Brackets | null = null): OrderPreview {
  const price = currentPrice(state);
  const { lotStep } = state.config;
  const valid = Number.isFinite(input.value) && input.value > 0;
  const units = !valid ? 0 : input.mode === 'percent' ? percentToUnits(spendableBalance(state), input.value, sizingPrice(state), lotStep) : floorToStep(input.value, lotStep);
  return {
    units,
    notional: units * price,
    price,
    fee: costsOf(state.config).commission,
    buyError: canPlace(state, toOrderRequest('buy', input, brackets)),
    sellError: canPlace(state, toOrderRequest('sell', input, brackets)),
  };
}

/** Units for a % of balance, the same way the engine converts a % order (leaves room for costs). */
export function percentSize(state: MatchState, percent: number): number {
  return percentToUnits(spendableBalance(state), percent, sizingPrice(state), state.config.lotStep);
}

/** Size as a % of balance (for the slider in units mode), clamped to 0–100. */
export function unitsToPercent(state: MatchState, units: number): number {
  const price = sizingPrice(state);
  const cash = spendableBalance(state);
  if (!(units > 0) || !(cash > 0)) return 0;
  return Math.min(100, Math.max(0, ((units * price) / cash) * 100));
}

/** The text shown for a rejected or disabled order. */
export function orderErrorText(code: OrderErrorCode, state: Pick<MatchState, 'status' | 'config'>): string {
  switch (code) {
    case 'insufficient_balance':
      return 'Insufficient balance';
    case 'size_zero':
      return `Size is below the minimum lot (${fmtUnits(state.config.lotStep, state.config.lotStep)})`;
    case 'invalid_size':
      return 'Enter a positive size';
    case 'match_not_running':
      return state.status === 'ended' ? 'The match has ended' : 'Start the replay to trade';
    case 'order_queued':
      return 'An order is already waiting for the next candle';
    case 'no_position':
      return 'Open a position first';
    case 'invalid_stop':
      return 'Stop must be on the losing side of the current price';
    case 'invalid_target':
      return 'Target must be on the winning side of the current price';
    case 'brackets_need_entry':
      return 'This order only reduces your position, so it cannot carry a stop or target';
  }
}

const TRIGGER_PREFIX: Partial<Record<FillTrigger, string>> = { stop_loss: 'Stop loss hit: ', take_profit: 'Take profit hit: ', next_open: 'Filled at open: ' };

/** Prefix for fills the player did not place at that moment (plan M12 C2, C5). */
export const triggerPrefix = (fill: Pick<Fill, 'trigger'>) => (fill.trigger ? (TRIGGER_PREFIX[fill.trigger] ?? '') : '');

const CANCEL_TEXT: Record<CancelledOrder['reason'], string> = {
  user: 'Order cancelled',
  insufficient_balance: 'Order cancelled at the open: insufficient balance',
  no_position: 'Close cancelled: no open position',
  match_end: 'Order cancelled: the match ended',
  brackets_invalid: 'Order cancelled at the open: the price had already passed your stop or target',
};

export const cancelMessage = (c: CancelledOrder) => CANCEL_TEXT[c.reason];

/**
 * "Bought 2 NQ @ 28,179.50", with the realised P&L when the fill closed something, the fee when
 * costs are on, and a prefix for stop, target and next-open fills.
 */
export function fillMessage(fill: Fill, opts: { lotStep: number; priceDecimals: number; currency: string; verb?: string }): string {
  const verb = opts.verb ?? (fill.side === 'buy' ? 'Bought' : 'Sold');
  let text = `${triggerPrefix(fill)}${verb} ${fmtUnits(fill.units, opts.lotStep)} ${shortSymbol(fill.symbol)} @ ${fmtPrice(fill.price, opts.priceDecimals)}`;
  if (fill.realizedPnl !== 0) text += ` · P&L ${fmtSignedMoney(fill.realizedPnl, opts.currency)}`;
  if (fill.fee) text += ` · fee ${fmtMoney(fill.fee, opts.currency)}`;
  return text;
}

/** Plan M15: " · SL 95.00 · TP 110.00" for the levels sent with an order ('' when none). */
export function levelsText(b: Brackets | null, decimals: number): string {
  if (!b) return '';
  return `${b.stopLoss !== null ? ` · SL ${fmtPrice(b.stopLoss, decimals)}` : ''}${b.takeProfit !== null ? ` · TP ${fmtPrice(b.takeProfit, decimals)}` : ''}`;
}

/** "Buy 2 NQ at the next open" for a queued order. */
export function queuedMessage(order: { side: Side; units: number; close?: boolean }, symbol: string, lotStep: number): string {
  if (order.close) return 'Close queued for the next open';
  return `${order.side === 'buy' ? 'Buy' : 'Sell'} ${fmtUnits(order.units, lotStep)} ${shortSymbol(symbol)} queued for the next open`;
}

/** Plan M12: one-line descriptions of a config's fill model and costs, for rules cards and reports. */
export function executionSummary(config: Pick<MatchConfig, 'currency' | 'fillModel' | 'commission' | 'slippageBps'>): { fills: string; commission: string; slippage: string } {
  const c = costsOf(config);
  return {
    fills: c.fillModel === 'next_open' ? 'Next candle open' : 'Current close',
    commission: c.commission > 0 ? `${fmtMoney(c.commission, config.currency)} per fill` : 'None',
    slippage: c.slippageBps > 0 ? `${c.slippageBps} bps` : 'None',
  };
}

/**
 * Plan M15: what an attached stop and target mean in money for `units` entered at `price` on
 * `side`, before fees and slippage. null for a level that is not set or on the wrong side.
 */
export function bracketPlan(side: Side, units: number, price: number, b: Brackets): { risk: number | null; reward: number | null; ratio: number | null } {
  const dir = side === 'buy' ? 1 : -1;
  const risk = b.stopLoss !== null && (b.stopLoss - price) * dir < 0 ? Math.abs(price - b.stopLoss) * units : null;
  const reward = b.takeProfit !== null && (b.takeProfit - price) * dir > 0 ? Math.abs(b.takeProfit - price) * units : null;
  return { risk, reward, ratio: risk && reward ? reward / risk : null };
}
