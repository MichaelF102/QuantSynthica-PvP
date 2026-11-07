import { orderSent, reduceDuel, type DuelState } from './duelClient';
import type { RoomErrorCode, ServerMessage } from './protocol';

// What the room page knows, built from server messages (pure, so it is unit-tested).
// The lobby fields come from `room`; the match from duelClient; the result from `end`.

export type ConnStatus = 'connecting' | 'open' | 'reconnecting';
/** Errors after which the page stops reconnecting. `replaced`/`unavailable` are client-side. */
export type FatalCode = Extract<RoomErrorCode, 'not_found' | 'expired' | 'room_full' | 'bad_token'> | 'replaced' | 'unavailable';
export type RoomInfo = Extract<ServerMessage, { type: 'room' }>;

export type RoomClientState = {
  status: ConnStatus;
  /** Set once the server seats this browser. */
  you: string | null;
  room: RoomInfo | null;
  /** serverNow − local now, from the latest message that carried the server time. */
  clockOffset: number;
  fatal: { code: FatalCode; message: string } | null;
  /** A non-fatal error to show briefly (rate limited, data unavailable…). */
  notice: string | null;
  rematch: string[];
  duel: DuelState | null;
  end: Extract<ServerMessage, { type: 'end' }> | null;
};

export type RoomClientAction =
  | { kind: 'msg'; msg: ServerMessage; now: number }
  | { kind: 'status'; status: ConnStatus }
  | { kind: 'fatal'; code: FatalCode; message: string }
  | { kind: 'clear_notice' }
  | { kind: 'order_sent'; seq: number };

export const initialRoomClient: RoomClientState = { status: 'connecting', you: null, room: null, clockOffset: 0, fatal: null, notice: null, rematch: [], duel: null, end: null };

const FATAL = new Set<string>(['not_found', 'expired', 'room_full', 'bad_token']);
export const isFatalError = (code: string): code is FatalCode => FATAL.has(code);

export const FATAL_TEXT: Record<FatalCode, string> = {
  not_found: 'No room with that code. Check the code, or create a new room.',
  expired: 'This room has expired. Create a new room to play.',
  room_full: 'This room already has two players, or its match has started.',
  bad_token: 'Your seat in this room belongs to another browser.',
  replaced: 'This room is open in another tab. Continue there, or reload this page to play here.',
  unavailable: '1v1 rooms are not set up on this site yet.',
};

/** Minimal guard on server frames: a JSON object with a string `type`. */
export function parseServerMessage(raw: unknown): ServerMessage | null {
  if (typeof raw !== 'string') return null;
  try {
    const v: unknown = JSON.parse(raw);
    return v && typeof v === 'object' && typeof (v as { type?: unknown }).type === 'string' ? (v as ServerMessage) : null;
  } catch {
    return null;
  }
}

export function roomClientReducer(s: RoomClientState, a: RoomClientAction): RoomClientState {
  switch (a.kind) {
    case 'status':
      return s.fatal ? s : { ...s, status: a.status };
    case 'fatal':
      return { ...s, fatal: { code: a.code, message: a.message } };
    case 'clear_notice':
      return { ...s, notice: null };
    case 'order_sent':
      return s.duel ? { ...s, duel: orderSent(s.duel, a.seq) } : s;
    case 'msg': {
      const m = a.msg;
      switch (m.type) {
        case 'welcome':
          return { ...s, you: m.you };
        case 'room':
          // A new countdown (rematch) clears the previous result.
          return { ...s, room: m, clockOffset: m.serverNow - a.now, rematch: m.phase === 'ended' ? s.rematch : [], end: m.phase === 'countdown' ? null : s.end };
        case 'start':
          return { ...s, clockOffset: m.serverNow - a.now, duel: reduceDuel(s.duel, m), end: null };
        case 'end':
          return { ...s, end: m };
        case 'pong':
          return { ...s, clockOffset: m.serverNow - a.now };
        case 'rematch':
          return { ...s, rematch: m.requestedBy };
        case 'error':
          return isFatalError(m.code) ? { ...s, fatal: { code: m.code, message: FATAL_TEXT[m.code] } } : { ...s, notice: m.message };
        default:
          return { ...s, duel: reduceDuel(s.duel, m) };
      }
    }
  }
}

/** Whole seconds left in the countdown (3, 2, 1), or null when there is none. */
export function countdownLeft(s: RoomClientState, now: number): number | null {
  const ends = s.room?.phase === 'countdown' ? s.room.countdownEndsAt : null;
  if (ends === null || ends === undefined) return null;
  return Math.max(0, Math.ceil((ends - (now + s.clockOffset)) / 1000));
}

export const me = (s: RoomClientState) => s.room?.players.find((p) => p.id === s.you) ?? null;
export const opponentSeat = (s: RoomClientState) => s.room?.players.find((p) => p.id !== s.you) ?? null;
