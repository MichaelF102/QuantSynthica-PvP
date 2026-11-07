/** time = UNIX seconds (UTC). lightweight-charts expects this. */
export type Candle = { time: number; open: number; high: number; low: number; close: number; volume: number };

export type Side = 'buy' | 'sell';

/** units > 0 long, < 0 short */
export type Position = {
  symbol: string;
  units: number;
  avgEntry: number;
  openedAt: number;
  /** Plan M12 C4: protective levels, cleared when the position closes or flips. */
  stopLoss?: number | null;
  takeProfit?: number | null;
  /** Plan M12 C6: opening fees not yet charged to a closed trade. */
  openFees?: number;
};

export type Trade = {
  id: string;
  symbol: string;
  side: Side;
  units: number;
  entry: number;
  exit: number;
  pnl: number;
  openedAt: number;
  closedAt: number;
  /** Plan M12 C6: fees included in `pnl` (0 or missing when costs are off). */
  fees?: number;
};

/** Plan M12 C1: when a market order fills. */
export type FillModel = 'close' | 'next_open';

export type MatchConfig = {
  symbol: string;
  currency: 'USD' | 'INR' | string;
  interval: '1m';
  durationMs: number;
  startingBalance: number;
  maxDrawdownPct: number;
  lotStep: number;
  /** Plan M12 C1. Missing = 'close'. */
  fillModel?: FillModel;
  /** Plan M12 C6: flat fee per fill, account currency. Missing = 0. */
  commission?: number;
  /** Plan M12 C7: slippage against the player, basis points. Missing = 0. */
  slippageBps?: number;
};

export type AssetClass = 'futures' | 'forex' | 'index' | 'stock' | 'crypto';

export type SymbolInfo = {
  symbol: string;
  name: string;
  assetClass: AssetClass;
  currency: string;
  /** File name under /public/data, e.g. "NQ_F.csv". */
  dataFile: string;
  barsAvailable: number;
  firstTime: number;
  lastTime: number;
  /** Added in M2 (plan D4): smallest tradable size step. */
  lotStep: number;
  /** Added in M2: decimals used to display prices. */
  priceDecimals: number;
  sector?: string;
};

/** A session cut from a symbol's candles by pickRandomSession. */
export type Session = {
  candles: Candle[];
  /** Index of the last history candle; the player starts here. */
  startCursor: number;
  /** True when the file was too short and the playable span was capped. */
  limitedData: boolean;
};

export type Timeframe = '1m' | '5m' | '15m' | '1h' | '1d';

/** Plan M12 C9: what caused a fill. */
export type FillTrigger = 'market' | 'next_open' | 'stop_loss' | 'take_profit' | 'match_end';

/** Every executed order (for chart markers and the History tab). */
export type Fill = {
  id: string;
  symbol: string;
  side: Side;
  units: number;
  price: number;
  time: number;
  /** Price P&L realised by this fill, before fees (0 when it only opened or added to a position). */
  realizedPnl: number;
  /** Plan M12 C6: commission charged on this fill. Missing = 0. */
  fee?: number;
  /** Missing = 'market'. */
  trigger?: FillTrigger;
};

/** Plan M12 C2: a next-open order waiting for the next candle. Units are fixed when placed. */
export type QueuedOrder = { id: string; side: Side; units: number; placedAt: number; close?: boolean } & OrderBrackets;

/** A queued order that never filled. */
export type CancelledOrder = QueuedOrder & { cancelledAt: number; reason: 'user' | 'insufficient_balance' | 'match_end' | 'no_position' | 'brackets_invalid' };

/** Plan M12 C4: stop-loss / take-profit levels; null clears one. */
export type Brackets = { stopLoss: number | null; takeProfit: number | null };

/**
 * Plan M15: a stop and/or target attached to an order. They apply to the position the order
 * opens, adds to or flips into, and replace any levels it had. Missing = the order carries none.
 */
export type OrderBrackets = { stopLoss?: number | null; takeProfit?: number | null };

export type OrderRequest = ({ side: Side; units: number } | { side: Side; percent: number }) & OrderBrackets;

export type MatchStatus = 'idle' | 'running' | 'paused' | 'ended';
export type EndReason = 'timer' | 'drawdown' | 'user' | 'data_end';
export type EquityPoint = { t: number; equity: number };

/** CLAUDE.md §5. Only lib/engine.ts creates or changes this. */
export type MatchState = {
  status: MatchStatus;
  endReason?: EndReason;
  /** Full session, 1m base. Never hand this to the UI; use visibleCandles(). */
  candles: Candle[];
  /** Index of the last candle revealed to the player. */
  cursor: number;
  /** Index of the last history candle (the match starts here). */
  startCursor: number;
  balance: number;
  positions: Position[];
  trades: Trade[];
  /** Added in M5: every executed order. */
  fills: Fill[];
  /** Plan M12 C2: the next-open order waiting for the next candle, if any. */
  queued: QueuedOrder | null;
  /** Plan M12 C2: queued orders that were cancelled, oldest first. */
  cancelled: CancelledOrder[];
  equityCurve: EquityPoint[];
  /** Added in M5: running maximum of equity, for the drawdown rule. */
  peakEquity: number;
  startedAt: number | null;
  elapsedMs: number;
  config: MatchConfig;
};
