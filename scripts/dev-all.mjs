#!/usr/bin/env node
// `npm run dev`: the Next.js app on :3000 and the 1v1 room server (wrangler dev) on :8787,
// with prefixed output. Ctrl+C stops both. If the room server cannot start, the app keeps
// running and single-player practice works; only 1v1 rooms are unavailable.
//
//   QS_NO_ROOMS=1   start the app only
//   PORT / ROOMS_PORT   change the ports (defaults 3000 / 8787)

import { spawn } from 'node:child_process';

const PORT = process.env.PORT || '3000';
const ROOMS_PORT = process.env.ROOMS_PORT || '8787';
const colour = { app: '\x1b[34m', rooms: '\x1b[35m' };
const children = new Set();

export function prefixLines(tag, chunk) {
  return chunk
    .toString()
    .split(/\r?\n/)
    .filter((l, i, all) => l.length > 0 || i < all.length - 1)
    .map((l) => `${colour[tag] ?? ''}[${tag}]\x1b[0m ${l}`)
    .join('\n');
}

function run(tag, cmd, args, { required }) {
  const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, FORCE_COLOR: '1' } });
  children.add(child);
  child.stdout.on('data', (d) => console.log(prefixLines(tag, d)));
  child.stderr.on('data', (d) => console.error(prefixLines(tag, d)));
  child.on('exit', (code, signal) => {
    children.delete(child);
    if (signal) return;
    if (required) {
      console.error(prefixLines(tag, `exited with code ${code}; stopping.`));
      stopAll(code ?? 1);
    } else {
      console.warn(prefixLines(tag, `room server stopped (code ${code}). The app keeps running; 1v1 rooms are unavailable.`));
    }
  });
  return child;
}

function stopAll(code = 0) {
  for (const c of children) c.kill('SIGTERM');
  setTimeout(() => process.exit(code), 300);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  process.on('SIGINT', () => stopAll(0));
  process.on('SIGTERM', () => stopAll(0));
  run('app', 'npx', ['next', 'dev', '-p', PORT], { required: true });
  if (process.env.QS_NO_ROOMS !== '1') {
    run('rooms', 'npx', ['wrangler', 'dev', '--config', 'room-server/wrangler.toml', '--port', ROOMS_PORT, '--var', `DATA_ORIGIN:http://localhost:${PORT}`, '--var', `ALLOWED_ORIGINS:http://localhost:${PORT},http://127.0.0.1:${PORT}`], { required: false });
  }
}
