#!/usr/bin/env node
// Runs before every `npm run build` (the `prebuild` script), locally and on Vercel / Render.
// Fails the build on problems that would otherwise ship a broken site without an error:
// missing market data files, a half-set Firebase config, a malformed room server host.
// Warnings only explain what is turned off.
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Next.js reads these for a production build; real environment variables win (as on Vercel/Render).
for (const file of ['.env.production.local', '.env.local', '.env.production', '.env']) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}

const errors = [];
const notes = [];
const DATA = join(process.cwd(), 'public', 'data');

// ---------- Node ----------
const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 20 || (major === 20 && minor < 9) || major >= 23) errors.push(`Node ${process.versions.node} is not supported. Use Node 20.9–22 (.nvmrc says 22).`);

// ---------- market data ----------
try {
  const index = JSON.parse(readFileSync(join(DATA, 'index.json'), 'utf8'));
  if (!Array.isArray(index) || index.length === 0) errors.push('public/data/index.json lists no symbols. Run `npm run data:refresh` and commit public/data/.');
  else {
    const missing = index.filter((s) => !s?.dataFile || !existsSync(join(DATA, s.dataFile)) || statSync(join(DATA, s.dataFile)).size === 0);
    if (missing.length) errors.push(`Missing or empty data files in public/data/: ${missing.map((s) => s?.dataFile ?? '?').join(', ')}. Commit them, or re-run \`npm run data:index\`.`);
    else notes.push(`market data: ${index.length} symbols`);
  }
} catch {
  errors.push('public/data/index.json is missing or unreadable. Run `npm run data:refresh` and commit public/data/.');
}
if (!existsSync(join(DATA, 'catalog.json'))) notes.push('public/data/catalog.json is missing: the symbol picker shows only playable symbols');

// ---------- Firebase (Google sign-in) ----------
const FB = ['NEXT_PUBLIC_FIREBASE_API_KEY', 'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN', 'NEXT_PUBLIC_FIREBASE_PROJECT_ID', 'NEXT_PUBLIC_FIREBASE_APP_ID'];
const fbSet = FB.filter((k) => (process.env[k] ?? '').trim() !== '');
if (fbSet.length === 0) notes.push('Google sign-in: off (no NEXT_PUBLIC_FIREBASE_* set); progress stays in each browser');
else if (fbSet.length < FB.length) errors.push(`Google sign-in is half set up. Missing: ${FB.filter((k) => !fbSet.includes(k)).join(', ')}. Set all four or none.`);
else {
  const domain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN.trim();
  if (/^https?:\/\//.test(domain) || domain.includes('/')) errors.push(`NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN must be a bare host like my-project.firebaseapp.com, not "${domain}".`);
  else notes.push(`Google sign-in: on (project ${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID.trim()})`);
}

// ---------- 1v1 room server ----------
const room = (process.env.NEXT_PUBLIC_ROOM_HOST ?? '').trim();
if (!room) notes.push('1v1 rooms: off in production (no NEXT_PUBLIC_ROOM_HOST)');
else if (/^(https?|wss?):\/\//.test(room) || room.endsWith('/')) errors.push(`NEXT_PUBLIC_ROOM_HOST must be a bare host like quantsynthica-rooms.<you>.workers.dev, not "${room}".`);
else notes.push(`1v1 rooms: ${room}`);

for (const n of notes) console.log(`  deploy check · ${n}`);
if (errors.length) {
  for (const e of errors) console.error(`  deploy check ✗ ${e}`);
  process.exit(1);
}
console.log('  deploy check ✓');
