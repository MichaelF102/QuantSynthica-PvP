#!/usr/bin/env node
// End-to-end check of the room server (plan M11.3): `npm run rooms:e2e`.
// Serves public/data on a local port, starts `wrangler dev` against it, and plays a short match
// with two real WebSockets: create, join, ready, countdown, candles, an order, a refresh that
// takes the seat back, a forfeit, and the end. Uses the real clock (about 15 s in total).

import { spawn } from 'node:child_process';
import { createReadStream, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { join, normalize } from 'node:path';

const ROOT = new URL('../..', import.meta.url).pathname;
const DATA_PORT = 3999;
const ROOMS_PORT = 8799;
const APP_ORIGIN = 'http://localhost:3000';
const HTTP = `http://127.0.0.1:${ROOMS_PORT}`;
const WS = `ws://127.0.0.1:${ROOMS_PORT}`;

let failures = 0;
const check = (ok, label) => {
  console.log(`${ok ? '  ✓' : '  ✗'} ${label}`);
  if (!ok) failures++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- static data server ----------
const data = createServer((req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname));
  const file = join(ROOT, 'public', path);
  if (!path.startsWith('/data/') || !existsSync(file)) return res.writeHead(404).end();
  res.writeHead(200);
  createReadStream(file).pipe(res);
});
await new Promise((r) => data.listen(DATA_PORT, '127.0.0.1', r));

// ---------- room server ----------
const wrangler = spawn('npx', ['wrangler', 'dev', '--config', 'room-server/wrangler.toml', '--port', String(ROOMS_PORT), '--ip', '127.0.0.1', '--var', `DATA_ORIGIN:http://127.0.0.1:${DATA_PORT}`, '--var', `ALLOWED_ORIGINS:${APP_ORIGIN}`], {
  cwd: ROOT,
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
  // Own process group, so stopping it also stops the wrangler and workerd children under npx.
  detached: true,
});
let log = '';
wrangler.stdout.on('data', (d) => (log += d));
wrangler.stderr.on('data', (d) => (log += d));
const stop = () => {
  try {
    process.kill(-wrangler.pid, 'SIGTERM');
  } catch {
    /* already gone */
  }
  data.close();
};
process.on('SIGINT', () => (stop(), process.exit(130)));

async function waitHealthy() {
  for (let i = 0; i < 90; i++) {
    try {
      if ((await fetch(`${HTTP}/health`)).ok) return true;
    } catch {}
    await sleep(1000);
  }
  return false;
}

/** A socket that records every message and can wait for one matching a predicate. */
function client(code) {
  const ws = new WebSocket(`${WS}/parties/room/${code}`);
  const got = [];
  const waiters = [];
  let closed = null;
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    got.push(m);
    for (const w of [...waiters]) if (w.pred(m)) (waiters.splice(waiters.indexOf(w), 1), w.resolve(m));
  };
  ws.onclose = (e) => (closed = e.code);
  const open = new Promise((r, j) => ((ws.onopen = r), (ws.onerror = j)));
  return {
    ws,
    got,
    open,
    closedCode: () => closed,
    send: (m) => ws.send(JSON.stringify(m)),
    wait(pred, ms = 8000) {
      const hit = got.find(pred);
      if (hit) return Promise.resolve(hit);
      return new Promise((resolve, reject) => {
        const w = { pred, resolve };
        waiters.push(w);
        setTimeout(() => reject(new Error('timeout')), ms);
      });
    },
  };
}
const type = (t, extra = () => true) => (m) => m.type === t && extra(m);

try {
  if (!(await waitHealthy())) throw new Error(`room server did not start:\n${log.slice(-2000)}`);
  console.log('Room server up.');

  // ---------- HTTP ----------
  const post = (body, origin = APP_ORIGIN) => fetch(`${HTTP}/rooms`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify(body) });
  const settings = { symbol: 'NQ=F', durationMin: 5, speed: 5, startingBalance: 100000, maxDrawdownPct: 5 };
  check((await post({ settings: { ...settings, speed: 3 } })).status === 400, 'bad settings → 400');
  check((await post({ settings }, 'https://evil.example')).status === 403, 'foreign origin → 403');
  const created = await post({ settings });
  const { code } = await created.json();
  check(created.status === 201 && /^[A-HJKMNP-Z2-9]{6}$/.test(code), `created room ${code}`);
  check(created.headers.get('access-control-allow-origin') === APP_ORIGIN, 'CORS header for the app origin');
  const peek = await (await fetch(`${HTTP}/rooms/${code}`)).json();
  check(peek.phase === 'waiting' && peek.players === 0, 'GET /rooms/:code shows the waiting room');
  check((await fetch(`${HTTP}/rooms/ZZZZZZ`)).status === 404, 'unknown room → 404');
  check((await fetch(`${HTTP}/rooms/nope`)).status === 400, 'malformed code → 400');

  const ghost = client('ZZZZZZ');
  await ghost.open;
  check((await ghost.wait(type('error'))).code === 'not_found', 'socket to an unknown room gets not_found');

  // ---------- lobby ----------
  const a = client(code);
  const b = client(code);
  await Promise.all([a.open, b.open]);
  a.send({ type: 'order', seq: 1, order: { side: 'buy', units: 1 } });
  check((await a.wait(type('error'))).code === 'not_joined', 'messages before hello → not_joined');
  a.send({ type: 'hello', clientId: 'e2e-player-a', nickname: 'Ann' });
  b.send({ type: 'hello', clientId: 'e2e-player-b', nickname: 'Bo' });
  const tokenA = (await a.wait(type('welcome'))).token;
  await b.wait(type('welcome'));
  await a.wait(type('room', (m) => m.phase === 'lobby'));
  check(true, 'both seated, room in lobby');

  const c = client(code);
  await c.open;
  c.send({ type: 'hello', clientId: 'e2e-player-c', nickname: 'Cy' });
  check((await c.wait(type('error'))).code === 'room_full', 'third player → room_full');
  c.ws.close();

  // ---------- match ----------
  a.send({ type: 'ready' });
  b.send({ type: 'ready' });
  const cd = await a.wait(type('room', (m) => m.phase === 'countdown'));
  check(cd.countdownEndsAt - cd.serverNow > 2000, 'countdown started (3 s)');
  const start = await a.wait(type('start'), 6000);
  check(start.history.length === 300 && start.tickMs === 200, 'start: 300 history candles, 200 ms ticks at 5x');
  check(start.history.every((x) => x.time < 1e8), 'history times are session seconds (date hidden)');
  await sleep(1200);
  const candles = a.got.filter((m) => m.type === 'candle');
  check(candles.length >= 4 && candles.every((x, i) => x.cursor === start.cursor + i + 1), `candles arrive in order (${candles.length} in 1.2 s)`);

  a.send({ type: 'order', seq: 1, order: { side: 'buy', units: 1 } });
  const fill = await a.wait(type('fill'));
  check(fill.seq === 1 && fill.fill.units === 1 && fill.fill.time < 1e8, `fill at ${fill.fill.price} (session time ${fill.fill.time})`);
  const opp = await b.wait(type('opponent', (m) => m.opponent.trades === 0 && m.opponent.id === 'e2e-player-a'));
  check(!('position' in opp.opponent) && !('fills' in opp.opponent), 'opponent view has no position or fills');
  check(!b.got.some((m) => m.type === 'fill'), 'B never receives A’s fill');

  // Refresh: a new socket takes the seat back before the old one closes.
  const a2 = client(code);
  await a2.open;
  a2.send({ type: 'hello', clientId: 'e2e-player-a', nickname: 'Ann', token: tokenA });
  const restart = await a2.wait(type('start'));
  check(restart.history.length > 300, 'reconnect gets the revealed candles so far');
  await a2.wait(type('you', (m) => m.you.position?.units === 1));
  check(true, 'reconnect gets own position back');
  await sleep(500);
  check(a.closedCode() === 4000, 'the old socket was closed as replaced');
  const peekRunning = await (await fetch(`${HTTP}/rooms/${code}`)).json();
  check(peekRunning.phase === 'running', 'room still running after the refresh (old close ignored)');

  const thief = client(code);
  await thief.open;
  thief.send({ type: 'hello', clientId: 'e2e-player-a', nickname: 'X', token: 'wrong-token-wrong-token' });
  check((await thief.wait(type('error'))).code === 'bad_token', 'wrong token → bad_token');
  await sleep(300);
  check(!a2.got.some((m) => m.type === 'error'), 'the seat holder does not see the impostor\u2019s error');
  thief.ws.close();

  // Rate limit: a burst of 30 pings.
  for (let i = 0; i < 30; i++) b.send({ type: 'ping' });
  await b.wait(type('error', (m) => m.code === 'rate_limited'));
  check(true, 'burst of 30 messages is rate limited');
  await sleep(1100);

  // ---------- end ----------
  b.send({ type: 'leave' });
  await a2.wait(type('opponent', (m) => m.opponent.status === 'out_disconnect'));
  check(true, 'B leaves → shown to A as out');
  a2.send({ type: 'leave' });
  const end = await b.wait(type('end')).catch(() => null);
  const endA = end ?? (await a2.wait(type('end')));
  check(endA.reason === 'all_out' && endA.players.length === 2, 'room ends when nobody is live');
  check(endA.sessionStart > 1e9, 'end reveals the real session date');
  const peekEnded = await (await fetch(`${HTTP}/rooms/${code}`)).json();
  check(peekEnded.phase === 'ended', 'room is ended');
  for (const x of [a2, b]) x.ws.close();
} catch (err) {
  failures++;
  console.error('  ✗', err.message);
} finally {
  stop();
}

console.log(failures ? `\n${failures} check(s) failed.` : '\nAll room server checks passed.');
process.exit(failures ? 1 : 0);
