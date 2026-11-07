import { getServerByName, routePartykitRequest } from 'partyserver';
import { DataError, fetchText, parseIndex } from '../../lib/data';
import { generateRoomCode, isRoomCode } from '../../lib/multiplayer/code';
import { validateRoomSettings } from '../../lib/multiplayer/settings';
import type { SymbolInfo } from '../../lib/types';
import { Room } from './Room';

export { Room };

// Room server entry (plan M11.3).
//   POST /rooms          { settings } → { code }     create a room (the server picks the session)
//   GET  /rooms/:code    → { phase, players, settings } or 404
//   WS   /parties/room/:code                          the room socket (partyserver routing)
//   GET  /health         → ok

const MAX_BODY = 4096;
const INDEX_TTL_MS = 5 * 60_000;
const CREATE_TRIES = 5;

let indexCache: { at: number; list: SymbolInfo[] } | null = null;

async function loadIndex(env: Env): Promise<SymbolInfo[]> {
  if (indexCache && Date.now() - indexCache.at < INDEX_TTL_MS) return indexCache.list;
  const list = parseIndex(JSON.parse(await fetchText(`${env.DATA_ORIGIN.replace(/\/$/, '')}/data/index.json`, { retries: 2 })));
  indexCache = { at: Date.now(), list };
  return list;
}

/** Trimmed, without trailing slashes: browsers send `https://host`, people often paste `https://host/`. */
const allowedOrigins = (env: Env) => env.ALLOWED_ORIGINS.split(',').map((s) => s.trim().replace(/\/+$/, '')).filter(Boolean);

function cors(env: Env, origin: string | null): Record<string, string> {
  if (!origin || !allowedOrigins(env).includes(origin)) return {};
  return { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', Vary: 'Origin' };
}

const json = (body: unknown, status: number, headers: Record<string, string>) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

const secureRandom = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;

async function createRoomRoute(request: Request, env: Env, h: Record<string, string>): Promise<Response> {
  const length = Number(request.headers.get('Content-Length') ?? '0');
  if (length > MAX_BODY) return json({ error: 'Request too large.' }, 413, h);
  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY) return json({ error: 'Request too large.' }, 413, h);
    body = JSON.parse(text);
  } catch {
    return json({ error: 'Send JSON: { "settings": { … } }.' }, 400, h);
  }

  let index: SymbolInfo[];
  try {
    index = await loadIndex(env);
  } catch (err) {
    console.error('index load failed', err);
    return json({ error: 'Market data is unavailable right now. Try again shortly.' }, 503, h);
  }
  const check = validateRoomSettings((body as { settings?: unknown } | null)?.settings, index);
  if (!check.ok) return json({ error: check.error }, 400, h);
  const info = index.find((i) => i.symbol === check.settings.symbol)!;

  for (let i = 0; i < CREATE_TRIES; i++) {
    const code = generateRoomCode(secureRandom);
    const stub = await getServerByName(env.Room, code);
    try {
      if ((await stub.create(check.settings, info)) === 'ok') return json({ code }, 201, h);
    } catch (err) {
      const message = err instanceof DataError && (err.code === 'not_enough_data' || err.code === 'no_valid_window') ? 'This symbol does not have enough data for that time limit and speed.' : 'Market data is unavailable right now. Try again shortly.';
      console.error('room create failed', err);
      return json({ error: message }, err instanceof DataError && err.code !== 'network' ? 422 : 503, h);
    }
  }
  return json({ error: 'Could not allocate a room code. Try again.' }, 503, h);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');
    const h = cors(env, origin);
    if (url.pathname === '/health') return new Response('ok');
    // Browsers always send Origin on WebSocket and cross-site requests; tools without one pass.
    if (origin && !allowedOrigins(env).includes(origin)) return new Response('Forbidden origin', { status: 403 });
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });

    if (url.pathname === '/rooms' && request.method === 'POST') return createRoomRoute(request, env, h);

    const peek = /^\/rooms\/([^/]+)$/.exec(url.pathname);
    if (peek && request.method === 'GET') {
      if (!isRoomCode(peek[1])) return json({ error: 'Not a room code.' }, 400, h);
      const info = await (await getServerByName(env.Room, peek[1])).peek();
      return info ? json(info, 200, h) : json({ error: 'No room with that code.' }, 404, h);
    }

    // Only valid codes reach a Durable Object, so random paths cannot create objects.
    const party = /^\/parties\/room\/([^/]+)$/.exec(url.pathname);
    if (party && !isRoomCode(party[1])) return new Response('Not found', { status: 404 });
    return (await routePartykitRequest(request, env)) ?? new Response('Not found', { status: 404 });
  },
} satisfies ExportedHandler<Env>;
