import type { OrderErrorCode } from '../engine';
import type { Stats } from '../stats';
import type { CancelledOrder, Candle, EquityPoint, Fill, OrderRequest, Position, QueuedOrder, Trade } from '../types';
import type { SeriesView } from './series';
import type { RoomSettings, RoomSymbol } from './settings';

// Wire protocol for 1v1 rooms (plan M11 §4). JSON text frames with a `type`. Everything a client
// sends is untrusted and goes through parseClientMessage. Times in match messages are
// "session seconds": candle time minus the first history candle's time (MP9 hides the date).

export const MAX_MESSAGE_BYTES = 4096;
export const NICKNAME_MAX = 20;
const CLIENT_ID = /^[A-Za-z0-9_-]{8,64}$/;
const TOKEN = /^[A-Za-z0-9_-]{16,128}$/;

// ---------- Client → server ----------

export type ClientMessage =
  | { type: 'hello'; clientId: string; nickname: string; token?: string }
  | { type: 'ready' }
  | { type: 'unready' }
  | { type: 'order'; seq: number; order: OrderRequest }
  | { type: 'close'; seq: number }
  /** Plan M12: set or clear stop-loss / take-profit on the open position. */
  | { type: 'brackets'; seq: number; stopLoss: number | null; takeProfit: number | null }
  /** Plan M12: cancel the order waiting for the next open. */
  | { type: 'cancel'; seq: number }
  | { type: 'rematch' }
  | { type: 'leave' }
  /** Give up the match but stay in the room to watch and see the result. */
  | { type: 'forfeit' }
  | { type: 'ping' };

/** Trims, collapses spaces and drops control characters. Empty → null. */
export function cleanNickname(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  // eslint-disable-next-line no-control-regex
  const s = v.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim().slice(0, NICKNAME_MAX);
  return s.length ? s : null;
}

const isSeq = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < 2 ** 31;
const isSide = (v: unknown): v is 'buy' | 'sell' => v === 'buy' || v === 'sell';
const isSize = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0 && v < 1e12;
const isLevel = (v: unknown): v is number | null => v === null || isSize(v);

function parseOrder(v: unknown): OrderRequest | null {
  if (typeof v !== 'object' || v === null) return null;
  const o = v as Record<string, unknown>;
  if (!isSide(o.side)) return null;
  const hasUnits = 'units' in o;
  const hasPct = 'percent' in o;
  if (hasUnits === hasPct) return null;
  // Plan M15: optional stop / target on the order.
  if ((o.stopLoss !== undefined && !isLevel(o.stopLoss)) || (o.takeProfit !== undefined && !isLevel(o.takeProfit))) return null;
  const levels = { ...(o.stopLoss !== undefined ? { stopLoss: o.stopLoss as number | null } : {}), ...(o.takeProfit !== undefined ? { takeProfit: o.takeProfit as number | null } : {}) };
  if (hasUnits) return isSize(o.units) ? { side: o.side, units: o.units, ...levels } : null;
  return isSize(o.percent) && o.percent <= 100 ? { side: o.side, percent: o.percent, ...levels } : null;
}

/** Parses and validates one client frame. Anything malformed, oversized or unknown → null. */
export function parseClientMessage(raw: unknown): ClientMessage | null {
  if (typeof raw !== 'string' || raw.length > MAX_MESSAGE_BYTES) return null;
  let m: Record<string, unknown>;
  try {
    const v: unknown = JSON.parse(raw);
    if (typeof v !== 'object' || v === null || Array.isArray(v)) return null;
    m = v as Record<string, unknown>;
  } catch {
    return null;
  }
  switch (m.type) {
    case 'hello': {
      const nickname = cleanNickname(m.nickname);
      if (typeof m.clientId !== 'string' || !CLIENT_ID.test(m.clientId) || !nickname) return null;
      if (m.token !== undefined && (typeof m.token !== 'string' || !TOKEN.test(m.token))) return null;
      return m.token === undefined ? { type: 'hello', clientId: m.clientId, nickname } : { type: 'hello', clientId: m.clientId, nickname, token: m.token };
    }
    case 'order': {
      const order = parseOrder(m.order);
      return isSeq(m.seq) && order ? { type: 'order', seq: m.seq, order } : null;
    }
    case 'close':
      return isSeq(m.seq) ? { type: 'close', seq: m.seq } : null;
    case 'cancel':
      return isSeq(m.seq) ? { type: 'cancel', seq: m.seq } : null;
    case 'brackets':
      return isSeq(m.seq) && isLevel(m.stopLoss) && isLevel(m.takeProfit) ? { type: 'brackets', seq: m.seq, stopLoss: m.stopLoss, takeProfit: m.takeProfit } : null;
    case 'ready':
    case 'unready':
    case 'rematch':
    case 'leave':
    case 'forfeit':
    case 'ping':
      return { type: m.type };
    default:
      return null;
  }
}

// ---------- Server → client ----------

export type RejectCode = OrderErrorCode | 'not_live' | 'duplicate' | 'nothing_queued';

export type RoomPhase = 'waiting' | 'lobby' | 'countdown' | 'running' | 'ended' | 'expired';
export type PlayerStatus = 'live' | 'out_drawdown' | 'out_disconnect' | 'done';
export type RoomEndReason = 'timer' | 'data_end' | 'all_out';
export type RoomErrorCode = 'room_full' | 'not_found' | 'expired' | 'bad_message' | 'rate_limited' | 'not_joined' | 'bad_token' | 'data_unavailable';

export type PlayerSummary = { id: string; nickname: string; ready: boolean; connected: boolean; status: PlayerStatus };

export type YouView = {
  status: PlayerStatus;
  balance: number;
  equity: number;
  returnPct: number;
  drawdownPct: number;
  position: Position | null;
  fills: Fill[];
  trades: number;
  /** Your own closed trades (session times). The opponent only ever gets a count. */
  closed: Trade[];
  elapsedMs: number;
  /** Highest order seq the server has processed, so a reloaded page continues above it. */
  lastSeq: number;
  /** Plan M12: the order waiting for the next open (session times). Missing on old servers. */
  queued?: QueuedOrder | null;
};

export type OpponentView = {
  id: string;
  nickname: string;
  connected: boolean;
  status: PlayerStatus;
  equity: number;
  returnPct: number;
  drawdownPct: number;
  trades: number;
  /** Plan M13 R4: only in rooms with open positions. Never stops, targets or queued orders. */
  position?: Pick<Position, 'symbol' | 'units' | 'avgEntry' | 'openedAt'> | null;
  fills?: Fill[];
};

export type PlayerResult = { id: string; nickname: string; status: PlayerStatus; stats: Stats; trades: Trade[]; equityCurve: EquityPoint[] };

export type ServerMessage =
  | { type: 'welcome'; you: string; token: string }
  | { type: 'room'; code: string; phase: RoomPhase; settings: RoomSettings; symbol: RoomSymbol; players: PlayerSummary[]; countdownEndsAt: number | null; serverNow: number; series?: SeriesView }
  | { type: 'start'; history: Candle[]; cursor: number; startCursor: number; tickMs: number; durationMs: number; startedAt: number; serverNow: number }
  | { type: 'candle'; candle: Candle; cursor: number; elapsedMs: number }
  | { type: 'you'; you: YouView }
  | { type: 'opponent'; opponent: OpponentView }
  /** seq −1: a fill the clock caused (next-open order, stop or target), not an answer to a message. */
  | { type: 'fill'; seq: number; fill: Fill; cursor: number }
  /** Plan M12: accepted without a fill (order queued for the next open, levels set, cancel done). */
  | { type: 'ack'; seq: number }
  /** Plan M12: a queued order was cancelled by the server (at the open, or the match ended). */
  | { type: 'cancelled'; order: CancelledOrder }
  | { type: 'reject'; seq: number; code: RejectCode; message: string }
  /** Real times: the session date is revealed here (MP9). */
  | { type: 'end'; reason: RoomEndReason; winner: string | 'draw' | null; sessionStart: number; sessionEnd: number; players: PlayerResult[]; series?: SeriesView }
  | { type: 'rematch'; requestedBy: string[] }
  | { type: 'error'; code: RoomErrorCode; message: string }
  | { type: 'pong'; serverNow: number };

export const encode = (m: ServerMessage): string => JSON.stringify(m);
