import type { Brackets, MatchState, OrderRequest, Session } from '../types';
import type { PlayerStatus, RoomEndReason, RoomErrorCode, RoomPhase, ServerMessage } from './protocol';
import type { SeriesState } from './series';
import type { RoomSettings, RoomSymbol } from './settings';

// State, events and effects of a 1v1 room (plan M11 §4). The reducer in room.ts is pure; the
// room server (room-server/) is a thin shell that feeds it events and carries out its effects.

export const MAX_PLAYERS = 2;
export const COUNTDOWN_MS = 3_000;
/** MP10: a player who drops mid-match has this long to reconnect before forfeiting. */
export const RECONNECT_GRACE_MS = 30_000;
/** MP12: a room nobody joined expires 30 min after creation; a finished room 24 h after the end. */
export const WAITING_TTL_MS = 30 * 60_000;
export const ENDED_TTL_MS = 24 * 60 * 60_000;
/** MP8: the opponent scoreboard is sent at most twice a second (status changes go at once). */
export const OPPONENT_THROTTLE_MS = 500;

export type Player = {
  /** The client's stable id (from its browser storage). Also the effect address. */
  id: string;
  /** Secret handed out on join; required to take the seat back after a disconnect. */
  token: string;
  nickname: string;
  ready: boolean;
  connected: boolean;
  disconnectedAt: number | null;
  status: PlayerStatus;
  match: MatchState | null;
  /** Highest order `seq` processed, so a resent order is not filled twice. */
  lastSeq: number;
};

export type RoomState = {
  code: string;
  phase: RoomPhase;
  settings: RoomSettings;
  symbol: RoomSymbol;
  session: Session;
  /** Shared cursor: the last candle revealed to both players. */
  cursor: number;
  players: Player[];
  createdAt: number;
  countdownEndsAt: number | null;
  startedAt: number | null;
  endedAt: number | null;
  endReason: RoomEndReason | null;
  winner: string | 'draw' | null;
  /** Players who asked for a rematch since the end. */
  rematch: string[];
  lastOpponentAt: number;
  /** Plan M13 R1: game number and wins in the current series (missing on rooms stored before M13). */
  series?: SeriesState;
};

export type RoomEvent =
  | { type: 'hello'; clientId: string; nickname: string; token?: string; newToken: string }
  | { type: 'ready' | 'unready' | 'leave' | 'disconnect' | 'rematch' | 'forfeit'; playerId: string }
  | { type: 'order'; playerId: string; seq: number; order: OrderRequest }
  | { type: 'close'; playerId: string; seq: number }
  /** Plan M12. */
  | { type: 'brackets'; playerId: string; seq: number; brackets: Brackets }
  | { type: 'cancel'; playerId: string; seq: number }
  /** The server picked a fresh session after both players asked for a rematch. */
  | { type: 'restart'; session: Session }
  /** Clock wake-up (alarm). Also safe to send at any time. */
  | { type: 'tick' };

/** `to` is a player id, or '*' for every connected player. */
export type RoomEffect =
  | { kind: 'send'; to: string; msg: ServerMessage }
  /** Both players want a rematch: pick a new session and send a `restart` event. */
  | { kind: 'new_session' }
  /** The room expired: close every socket and drop the stored state. */
  | { kind: 'shutdown' };

/** What a player can ask their account to do (plan M12 adds brackets and cancel). */
export type PlayerAction = OrderRequest | 'close' | 'cancel' | { brackets: Brackets };

export type Reduced = { state: RoomState; effects: RoomEffect[] };

export const send = (to: string, msg: ServerMessage): RoomEffect => ({ kind: 'send', to, msg });

const ERROR_TEXT: Record<RoomErrorCode, string> = {
  room_full: 'This room already has two players.',
  not_found: 'No room with that code.',
  expired: 'This room has expired.',
  bad_message: 'The server could not read that message.',
  rate_limited: 'Too many messages. Slow down.',
  not_joined: 'Join the room first.',
  bad_token: 'This seat belongs to another browser.',
  data_unavailable: 'Market data for this room could not be loaded. Try again shortly.',
};

export const errorMsg = (code: RoomErrorCode, message = ERROR_TEXT[code]): ServerMessage => ({ type: 'error', code, message });

export const otherPlayer = (s: RoomState, id: string) => s.players.find((p) => p.id !== id) ?? null;
export const findPlayer = (s: RoomState, id: string) => s.players.find((p) => p.id === id) ?? null;
export const isOut = (p: Player) => p.status === 'out_drawdown' || p.status === 'out_disconnect';
export const durationMsOf = (s: RoomState) => s.settings.durationMin * 60_000;
