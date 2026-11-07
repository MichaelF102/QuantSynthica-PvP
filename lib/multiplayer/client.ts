import { emitLocalChange } from '../localChanges';
import { executionFields } from '../session';
import { parseAmount, type SetupForm } from '../setup';
import { roomOptionFields, type RoomSettings, type RoomSpeed } from './settings';

// Browser side of 1v1 rooms: where the room server is, who this browser is, and the create
// request. Storage wrappers never throw; without storage the ids live for the page only.

/**
 * Room server host ("rooms.example.workers.dev" or "localhost:8787"), from NEXT_PUBLIC_ROOM_HOST.
 * Unset in development → the local `wrangler dev`; unset in production → null (rooms are off).
 */
export function roomHost(env: string | undefined = process.env.NEXT_PUBLIC_ROOM_HOST, dev = process.env.NODE_ENV !== 'production'): string | null {
  const host = (env ?? '').trim().replace(/^(https?|wss?):\/\//, '').replace(/\/+$/, '');
  if (host) return host;
  return dev ? 'localhost:8787' : null;
}

const isLocal = (host: string) => /^(localhost|127\.0\.0\.1|\[::1\])(:|$)/.test(host);
export const roomHttpBase = (host: string) => `${isLocal(host) ? 'http' : 'https'}://${host}`;

// ---------- identity ----------

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;
function local(): StorageLike | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export const CLIENT_ID_KEY = 'qs-pvp:client-id';
export const NICKNAME_KEY = 'qs-pvp:nickname';
export const TOKENS_KEY = 'qs-pvp:room-tokens';
/** Seat tokens are kept a little longer than a finished room lives (24 h). */
const TOKEN_TTL_MS = 48 * 60 * 60_000;

let memoryId: string | null = null;
const randomId = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, '0')).join('');

/** This browser's stable player id. */
export function getClientId(storage: StorageLike | null = local()): string {
  try {
    const stored = storage?.getItem(CLIENT_ID_KEY);
    if (stored && /^[A-Za-z0-9_-]{8,64}$/.test(stored)) return stored;
    const id = randomId();
    storage?.setItem(CLIENT_ID_KEY, id);
    return storage ? id : (memoryId ??= id);
  } catch {
    return (memoryId ??= randomId());
  }
}

export function loadNickname(storage: StorageLike | null = local()): string | null {
  try {
    return storage?.getItem(NICKNAME_KEY) || null;
  } catch {
    return null;
  }
}

export function saveNickname(name: string, storage: StorageLike | null = local(), announce = true): void {
  try {
    storage?.setItem(NICKNAME_KEY, name);
  } catch {
    /* storage blocked: the name lasts for this page */
    return;
  }
  if (announce) emitLocalChange({ kind: 'profile' });
}

type Tokens = Record<string, { token: string; at: number }>;
function readTokens(storage: StorageLike | null): Tokens {
  try {
    const v: unknown = JSON.parse(storage?.getItem(TOKENS_KEY) ?? '{}');
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Tokens) : {};
  } catch {
    return {};
  }
}

/** The seat token for a room, kept in localStorage so a refresh or another tab takes the seat back. */
export function loadToken(code: string, storage: StorageLike | null = local(), now = Date.now()): string | undefined {
  const t = readTokens(storage)[code];
  return t && typeof t.token === 'string' && now - t.at < TOKEN_TTL_MS ? t.token : undefined;
}

export function saveToken(code: string, token: string, storage: StorageLike | null = local(), now = Date.now()): void {
  const kept = Object.fromEntries(Object.entries(readTokens(storage)).filter(([, v]) => v && now - v.at < TOKEN_TTL_MS));
  try {
    storage?.setItem(TOKENS_KEY, JSON.stringify({ ...kept, [code]: { token, at: now } }));
  } catch {
    /* storage blocked */
  }
}

// ---------- create ----------

export function toRoomSettings(form: SetupForm, speed: RoomSpeed, options: Pick<RoomSettings, 'series' | 'openPositions'> = {}): RoomSettings {
  const cost = (text: string) => (text.trim() === '' ? 0 : parseAmount(text));
  return {
    symbol: form.symbol,
    durationMin: form.durationMin,
    speed,
    startingBalance: parseAmount(form.balanceText),
    maxDrawdownPct: Number(form.drawdownText.trim()),
    ...executionFields({ fillModel: form.fillModel, commission: cost(form.commissionText), slippageBps: cost(form.slippageText) }),
    ...roomOptionFields(options),
  };
}

export class RoomRequestError extends Error {}

/** POST /rooms. Resolves to the room code; rejects with a message fit to show. */
export async function requestRoom(host: string, settings: RoomSettings, fetchImpl: typeof fetch = fetch): Promise<string> {
  let res: Response;
  try {
    res = await fetchImpl(`${roomHttpBase(host)}/rooms`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ settings }) });
  } catch {
    throw new RoomRequestError('Could not reach the room server. Check your connection and try again.');
  }
  let body: { code?: unknown; error?: unknown } = {};
  try {
    body = await res.json();
  } catch {
    /* not JSON */
  }
  if (res.ok && typeof body.code === 'string') return body.code;
  throw new RoomRequestError(typeof body.error === 'string' ? body.error : `The room server refused the request (HTTP ${res.status}).`);
}
