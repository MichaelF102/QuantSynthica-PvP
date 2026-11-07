import type { Candle } from '../types';
import type { RoomState } from './roomTypes';

// Room persistence for the Durable Object. Each player's MatchState holds the same session
// candles as the room, so storing the state as is would triple the size, and storage values are
// size-limited. The candles are stored once, in chunks, and put back on load.

export const CANDLE_CHUNK = 500;

export type Dehydrated = { room: RoomState; chunks: Candle[][] };

export function dehydrate(s: RoomState): Dehydrated {
  const { candles } = s.session;
  const chunks: Candle[][] = [];
  for (let i = 0; i < candles.length; i += CANDLE_CHUNK) chunks.push(candles.slice(i, i + CANDLE_CHUNK));
  return {
    room: {
      ...s,
      session: { ...s.session, candles: [] },
      players: s.players.map((p) => (p.match ? { ...p, match: { ...p.match, candles: [] } } : p)),
    },
    chunks,
  };
}

export function rehydrate(room: RoomState, chunks: Candle[][]): RoomState {
  const candles = chunks.flat();
  return {
    ...room,
    session: { ...room.session, candles },
    // Rooms stored before plan M12 have no queued / cancelled fields on the match.
    players: room.players.map((p) => (p.match ? { ...p, match: { ...p.match, candles, queued: p.match.queued ?? null, cancelled: p.match.cancelled ?? [] } } : p)),
  };
}

// Per-socket rate limit (plan M11.3): a token bucket of 10 messages, refilled at 10 per second.
export type Bucket = { tokens: number; at: number };
export const RATE_PER_SEC = 10;

export function takeToken(b: Bucket | undefined, now: number): { ok: boolean; bucket: Bucket } {
  const prev = b ?? { tokens: RATE_PER_SEC, at: now };
  const tokens = Math.min(RATE_PER_SEC, prev.tokens + ((now - prev.at) / 1000) * RATE_PER_SEC);
  return tokens >= 1 ? { ok: true, bucket: { tokens: tokens - 1, at: now } } : { ok: false, bucket: { tokens, at: now } };
}
