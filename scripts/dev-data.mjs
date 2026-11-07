#!/usr/bin/env node
// Runs before `npm run dev` (npm "predev"): refreshes the market data in public/data when it is
// stale, then lets the dev server start. It never blocks startup: if the fetch fails (offline,
// no Python), it warns and the app starts with the data it already has.
//
// The app itself still never calls the data source at runtime (CLAUDE.md §8); this only runs the
// local pipeline (scripts/fetch_data.py + scripts/build_index.py) for you.
//
//   QS_SKIP_DATA=1        skip this step (same as `npm run dev:offline`)
//   QS_DATA_MAX_AGE_H=12  refetch when the data is older than this many hours (default 12)
//   --force               refetch now regardless of age (`npm run data:refresh`)
//   --add SYM [SYM...]    fetch extra symbols now and add them (`npm run data:add -- RELIANCE.NS`)

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEFAULT_SYMBOLS = [
  'NQ=F', '6E=F', '^GSPC', '^NSEI',
  '^DJI', '^IXIC', '^NSEBANK',
  'AAPL', 'MSFT', 'NVDA', 'AMZN', 'GOOGL', 'META', 'TSLA', 'JPM',
  'RELIANCE.NS', 'TCS.NS', 'HDFCBANK.NS', 'ICICIBANK.NS', 'INFY.NS', 'SBIN.NS', 'BHARTIARTL.NS', 'ITC.NS', 'LT.NS',
];

/** Symbols after `--add` in argv (up to the next flag). */
export function addSymbols(argv) {
  const i = argv.indexOf('--add');
  if (i < 0) return [];
  const out = [];
  for (const a of argv.slice(i + 1)) {
    if (a.startsWith('--')) break;
    out.push(a.trim());
  }
  return out.filter(Boolean);
}
export const DEFAULT_MAX_AGE_H = 12;
const FETCH_TIMEOUT_MS = 10 * 60 * 1000;

const log = (msg) => console.log(`\x1b[36m[data]\x1b[0m ${msg}`);
const warn = (msg) => console.warn(`\x1b[33m[data]\x1b[0m ${msg}`);

/** Sidecars written by fetch_data.py: { symbol, interval, updatedAt (UNIX s) }. */
export function readSidecars(dataDir) {
  if (!existsSync(dataDir)) return [];
  return readdirSync(dataDir)
    .filter((f) => f.endsWith('.meta.json'))
    .flatMap((f) => {
      try {
        const meta = JSON.parse(readFileSync(join(dataDir, f), 'utf8'));
        return typeof meta.symbol === 'string' ? [meta] : [];
      } catch {
        return [];
      }
    });
}

/** Symbols to refresh: the ones already in public/data, or the v1 set on a fresh checkout. */
export function symbolsFor(sidecars) {
  const found = [...new Set(sidecars.map((m) => m.symbol))];
  return found.length ? found : DEFAULT_SYMBOLS;
}

/** Age of the stalest symbol in hours (Infinity when there is no data yet). */
export function dataAgeHours(sidecars, nowMs = Date.now()) {
  const times = sidecars.map((m) => m.updatedAt).filter((t) => Number.isFinite(t));
  if (times.length === 0) return Infinity;
  return (nowMs / 1000 - Math.min(...times)) / 3600;
}

/** 'skip' | 'fetch' | 'index' (rebuild the index only). */
export function decide({ skip = false, force = false, ageHours, maxAgeHours = DEFAULT_MAX_AGE_H, indexExists }) {
  if (skip) return 'skip';
  if (force || !(ageHours <= maxAgeHours)) return 'fetch';
  return indexExists ? 'skip' : 'index';
}

/** First Python that can import the pipeline's packages: the project venv, then the system. */
export function findPython(root, run = spawnSync) {
  const candidates = [join(root, '.venv', 'bin', 'python'), join(root, '.venv', 'Scripts', 'python.exe'), 'python3', 'python'];
  for (const py of candidates) {
    if (py.includes('.venv') && !existsSync(py)) continue;
    const r = run(py, ['-c', 'import yfinance, pandas'], { stdio: 'ignore' });
    if (r.status === 0) return py;
  }
  return null;
}

function runPython(py, root, args, timeout) {
  const r = spawnSync(py, args, { cwd: root, stdio: 'inherit', timeout });
  if (r.error) return { ok: false, why: r.error.code === 'ETIMEDOUT' ? 'timed out' : r.error.message };
  return { ok: r.status === 0, why: `exited with code ${r.status}` };
}

export function main({ root = join(dirname(fileURLToPath(import.meta.url)), '..'), argv = process.argv.slice(2), env = process.env } = {}) {
  const dataDir = join(root, 'public', 'data');
  const sidecars = readSidecars(dataDir);
  const ageHours = dataAgeHours(sidecars);
  const extra = addSymbols(argv);
  const maxAgeHours = Number(env.QS_DATA_MAX_AGE_H) > 0 ? Number(env.QS_DATA_MAX_AGE_H) : DEFAULT_MAX_AGE_H;
  const action = decide({
    skip: env.QS_SKIP_DATA === '1',
    force: argv.includes('--force') || extra.length > 0,
    ageHours,
    maxAgeHours,
    indexExists: existsSync(join(dataDir, 'index.json')) && existsSync(join(dataDir, 'catalog.json')),
  });

  if (action === 'skip') {
    log(env.QS_SKIP_DATA === '1' ? 'Skipping the data refresh (QS_SKIP_DATA=1).' : `Market data is fresh (${ageHours.toFixed(1)} h old). Starting.`);
    return 0;
  }

  const py = findPython(root);
  if (!py) {
    warn('No Python with yfinance and pandas found, so the market data was not refreshed.');
    warn('Set it up once: python3 -m venv .venv && .venv/bin/pip install -r requirements.txt');
    return 0;
  }

  if (action === 'fetch') {
    const symbols = extra.length ? extra : symbolsFor(sidecars);
    log(`${Number.isFinite(ageHours) ? `Market data is ${ageHours.toFixed(1)} h old` : 'No market data yet'}; fetching ${symbols.join(', ')} (last 29 days)...`);
    const fetched = runPython(py, root, ['scripts/fetch_data.py', '--symbols', ...symbols, '--days', '29'], FETCH_TIMEOUT_MS);
    if (!fetched.ok) warn(`Fetch did not fully succeed (${fetched.why}). Continuing with the data already on disk.`);
  }

  const indexed = runPython(py, root, ['scripts/build_index.py'], 60_000);
  if (!indexed.ok) warn(`Could not rebuild public/data/index.json (${indexed.why}).`);
  const catalog = runPython(py, root, ['scripts/build_catalog.py'], 60_000);
  if (!catalog.ok) warn(`Could not rebuild public/data/catalog.json (${catalog.why}). The picker will list playable symbols only.`);
  if (indexed.ok) log('Market data ready.');
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = main();
}
