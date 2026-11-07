import { createMatch } from '../engine';
import type { CancelledOrder, Candle, Fill, MatchState } from '../types';
import type { OpponentView, ServerMessage, YouView } from './protocol';
import { roomMatchConfig, type RoomSettings, type RoomSymbol } from './settings';

// The duel screen's view of a running match, built only from server messages (pure, tested).
// Times are session seconds (MP9). The server decides every fill; the mirror below exists so the
// trade panel can preview orders with the same engine rules, never to change the outcome.

export type DuelState = {
  /** Revealed candles only: the server never sends one past the cursor. */
  candles: Candle[];
  cursor: number;
  startCursor: number;
  tickMs: number;
  durationMs: number;
  /** Server wall-clock ms when the clock started. */
  startedAt: number;
  you: YouView | null;
  opponent: OpponentView | null;
  /** Orders sent and not yet answered. */
  pending: number[];
  nextSeq: number;
  lastFill: { seq: number; fill: Fill } | null;
  lastReject: { seq: number; code: string; message: string } | null;
  /** Plan M12: the latest order the server cancelled (at the open). */
  lastCancel: CancelledOrder | null;
};

export function startDuel(m: Extract<ServerMessage, { type: 'start' }>, prev: DuelState | null): DuelState {
  return {
    candles: m.history,
    cursor: m.cursor,
    startCursor: m.startCursor,
    tickMs: m.tickMs,
    durationMs: m.durationMs,
    startedAt: m.startedAt,
    you: null,
    opponent: null,
    pending: [],
    // A reconnect keeps counting up; `you.lastSeq` corrects it after a reload.
    nextSeq: prev?.nextSeq ?? 0,
    lastFill: null,
    lastReject: null,
    lastCancel: null,
  };
}

/** Applies one server message. `start` is handled by startDuel; other types are ignored here. */
export function reduceDuel(d: DuelState | null, m: ServerMessage): DuelState | null {
  if (m.type === 'start') return startDuel(m, d);
  if (!d) return d;
  switch (m.type) {
    case 'candle':
      // Messages arrive in order on one socket; a stale or repeated candle is ignored.
      return m.cursor <= d.cursor ? d : { ...d, candles: [...d.candles, m.candle], cursor: m.cursor };
    case 'you':
      return { ...d, you: m.you, nextSeq: Math.max(d.nextSeq, m.you.lastSeq + 1) };
    case 'opponent':
      return { ...d, opponent: m.opponent };
    case 'fill':
      return { ...d, pending: d.pending.filter((s) => s !== m.seq), lastFill: { seq: m.seq, fill: m.fill } };
    case 'ack':
      return { ...d, pending: d.pending.filter((s) => s !== m.seq) };
    case 'cancelled':
      return { ...d, lastCancel: m.order };
    case 'reject':
      return { ...d, pending: d.pending.filter((s) => s !== m.seq), lastReject: { seq: m.seq, code: m.code, message: m.message } };
    default:
      return d;
  }
}

/** Records an order the page just sent. */
export function orderSent(d: DuelState, seq: number): DuelState {
  return { ...d, pending: [...d.pending, seq], nextSeq: Math.max(d.nextSeq, seq + 1) };
}

/**
 * A local MatchState mirroring this player's account at the current candle, so TradePanel and
 * PositionsTable render a duel exactly like practice. Status is `running` while live, `ended`
 * once out or done, which disables trading in those components.
 */
export function mirrorMatch(d: DuelState | null, settings: RoomSettings, symbol: RoomSymbol): MatchState | null {
  if (!d || !d.you || d.candles.length === 0) return null;
  const base = createMatch(roomMatchConfig(settings, symbol), d.candles, d.candles.length - 1);
  const { you } = d;
  return {
    ...base,
    status: you.status === 'live' ? 'running' : 'ended',
    startCursor: Math.min(d.startCursor, d.candles.length - 1),
    balance: you.balance,
    positions: you.position ? [you.position] : [],
    fills: you.fills,
    trades: you.closed,
    queued: you.queued ?? null,
    elapsedMs: you.elapsedMs,
    startedAt: d.startedAt,
  };
}

/** Time left on the shared clock, using the server clock offset. */
export function duelRemainingMs(d: DuelState, clockOffset: number, now: number): number {
  return Math.max(0, d.durationMs - (now + clockOffset - d.startedAt));
}

/** "T+1:05" for a session time relative to the start candle; history candles are "T−0:42". */
export function fmtSessionTime(t: number, zero: number): string {
  const diff = Math.round((t - zero) / 60);
  const abs = Math.abs(diff);
  return `T${diff < 0 ? '−' : '+'}${Math.floor(abs / 60)}:${String(abs % 60).padStart(2, '0')}`;
}

/** Session time of the start candle, the zero for fmtSessionTime. */
export const sessionZero = (d: DuelState) => d.candles[Math.min(d.startCursor, d.candles.length - 1)]?.time ?? 0;
