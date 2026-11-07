import type { AssetClass, Candle, Session, SymbolInfo } from './types';

export type DataErrorCode =
  | 'not_found'
  | 'network'
  | 'bad_index'
  | 'bad_header'
  | 'bad_row'
  | 'not_finite'
  | 'unsorted'
  | 'duplicate_time'
  | 'inconsistent_bar'
  | 'empty'
  | 'not_enough_data'
  | 'no_valid_window';

export class DataError extends Error {
  readonly code: DataErrorCode;
  constructor(code: DataErrorCode, message: string) {
    super(message);
    this.name = 'DataError';
    this.code = code;
  }
}

const DATA_BASE = '/data';
const HEADER = ['time', 'open', 'high', 'low', 'close', 'volume'];
const ASSET_CLASSES: AssetClass[] = ['futures', 'forex', 'index', 'stock', 'crypto'];

// ---------------------------------------------------------------------------------------------
// Fetching (static files only; the app never calls the market-data source at runtime)
// ---------------------------------------------------------------------------------------------

type FetchOptions = { retries?: number; baseDelayMs?: number; fetchImpl?: typeof fetch; sleep?: (ms: number) => Promise<void> };

const RETRY_STATUS = new Set([502, 503, 504]);
const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** GET a text file, retrying network errors and 502/503/504 with exponential back-off (DESIGN.md §12). */
export async function fetchText(url: string, opts: FetchOptions = {}): Promise<string> {
  const { retries = 3, baseDelayMs = 500, fetchImpl = fetch, sleep = defaultSleep } = opts;
  let lastError: DataError = new DataError('network', `Could not load ${url}`);
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await sleep(baseDelayMs * 2 ** (attempt - 1));
    let res: Response;
    try {
      res = await fetchImpl(url);
    } catch {
      lastError = new DataError('network', `Could not load ${url}`);
      continue;
    }
    if (res.ok) return res.text();
    if (res.status === 404) throw new DataError('not_found', `${url} was not found`);
    lastError = new DataError('network', `Loading ${url} failed (HTTP ${res.status})`);
    if (!RETRY_STATUS.has(res.status)) throw lastError;
  }
  throw lastError;
}

// ---------------------------------------------------------------------------------------------
// index.json
// ---------------------------------------------------------------------------------------------

const isFiniteNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isNonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.length > 0;

/** Validates the parsed index.json and returns it typed. Throws DataError('bad_index'). */
export function parseIndex(json: unknown): SymbolInfo[] {
  if (!Array.isArray(json)) throw new DataError('bad_index', 'Symbol list is not an array');
  return json.map((raw, i) => {
    const e = raw as Record<string, unknown>;
    const ok =
      e !== null &&
      typeof e === 'object' &&
      isNonEmptyString(e.symbol) &&
      isNonEmptyString(e.name) &&
      ASSET_CLASSES.includes(e.assetClass as AssetClass) &&
      isNonEmptyString(e.currency) &&
      isNonEmptyString(e.dataFile) &&
      !/[/\\]|\.\./.test(e.dataFile as string) &&
      isFiniteNum(e.barsAvailable) &&
      isFiniteNum(e.firstTime) &&
      isFiniteNum(e.lastTime) &&
      isFiniteNum(e.lotStep) &&
      (e.lotStep as number) > 0 &&
      Number.isInteger(e.priceDecimals) &&
      (e.sector === undefined || typeof e.sector === 'string');
    if (!ok) throw new DataError('bad_index', `Symbol list entry ${i} is malformed`);
    return e as unknown as SymbolInfo;
  });
}

export async function loadIndex(opts?: FetchOptions): Promise<SymbolInfo[]> {
  const text = await fetchText(`${DATA_BASE}/index.json`, opts);
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new DataError('bad_index', 'Symbol list is not valid JSON');
  }
  return parseIndex(json);
}

// ---------------------------------------------------------------------------------------------
// Candle CSV
// ---------------------------------------------------------------------------------------------

/**
 * Parses `time,open,high,low,close,volume` (time = UNIX seconds UTC).
 * Rejects anything malformed rather than repairing it: a bad file is a pipeline bug.
 */
export function parseCandlesCsv(text: string): Candle[] {
  const lines = text.split(/\r?\n/);
  const header = (lines[0] ?? '').split(',').map((h) => h.trim().toLowerCase());
  if (header.length !== HEADER.length || header.some((h, i) => h !== HEADER[i])) {
    throw new DataError('bad_header', `Expected columns ${HEADER.join(',')}, got "${lines[0] ?? ''}"`);
  }

  const out: Candle[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '') continue;
    const cells = line.split(',');
    const lineNo = i + 1;
    if (cells.length !== HEADER.length) throw new DataError('bad_row', `Line ${lineNo}: expected 6 values, got ${cells.length}`);
    const nums = cells.map((c) => (c.trim() === '' ? Number.NaN : Number(c)));
    if (!nums.every(Number.isFinite)) throw new DataError('not_finite', `Line ${lineNo}: missing or non-numeric value`);
    const [time, open, high, low, close, volume] = nums;
    if (!Number.isInteger(time)) throw new DataError('bad_row', `Line ${lineNo}: time must be whole UNIX seconds`);
    if (volume < 0) throw new DataError('bad_row', `Line ${lineNo}: negative volume`);
    if (high < Math.max(open, close) || low > Math.min(open, close) || low <= 0) {
      throw new DataError('inconsistent_bar', `Line ${lineNo}: high/low do not contain open/close`);
    }
    const prev = out[out.length - 1];
    if (prev) {
      if (time === prev.time) throw new DataError('duplicate_time', `Line ${lineNo}: duplicate time ${time}`);
      if (time < prev.time) throw new DataError('unsorted', `Line ${lineNo}: time goes backwards`);
    }
    out.push({ time, open, high, low, close, volume });
  }
  if (out.length === 0) throw new DataError('empty', 'Candle file has no rows');
  return out;
}

export async function loadCandles(info: Pick<SymbolInfo, 'dataFile'>, opts?: FetchOptions): Promise<Candle[]> {
  return parseCandlesCsv(await fetchText(`${DATA_BASE}/${info.dataFile}`, opts));
}

// ---------------------------------------------------------------------------------------------
// Random session (CLAUDE.md §8, plan decisions D2 and D3)
// ---------------------------------------------------------------------------------------------

export type SessionSpec = {
  /** Candles the player can reveal during the match. */
  playable: number;
  /** Candles of chart history shown before the start. */
  history: number;
  /** Largest allowed gap inside the playable span, in seconds. Default 3 days (weekends pass). */
  maxGapSec?: number;
  /** Fewest playable candles accepted when the file is short. Default 80% of `playable`, at least 30. */
  minPlayable?: number;
  maxTries?: number;
};

const THREE_DAYS = 3 * 24 * 60 * 60;

function largestGap(candles: Candle[], from: number, to: number): number {
  let max = 0;
  for (let i = Math.max(from, 1); i < to; i++) max = Math.max(max, candles[i].time - candles[i - 1].time);
  return max;
}

/**
 * Cuts a random window: `history` candles, then `playable` candles. Windows are counted in rows,
 * not wall-clock time, so market closures never count as missing data. A window is rejected if
 * a gap inside the playable span (including the step from the last history candle) exceeds
 * `maxGapSec`, e.g. a long holiday. If the file is shorter than history + playable, the playable
 * span is capped and `limitedData` is set, as long as at least `minPlayable` candles remain.
 */
export function pickRandomSession(candles: Candle[], spec: SessionSpec, rng: () => number = Math.random): Session {
  const { history, maxGapSec = THREE_DAYS, maxTries = 10 } = spec;
  const minPlayable = spec.minPlayable ?? Math.max(30, Math.ceil(spec.playable * 0.8));
  if (history < 1 || spec.playable < 1) throw new RangeError('history and playable must be at least 1');

  const available = candles.length - history;
  const playable = Math.min(spec.playable, available);
  if (playable < Math.min(minPlayable, spec.playable)) {
    throw new DataError('not_enough_data', `Need at least ${history + Math.min(minPlayable, spec.playable)} candles, have ${candles.length}`);
  }
  const limitedData = playable < spec.playable;

  // First playable index s lies in [history, candles.length - playable].
  const lo = history;
  const span = candles.length - playable - lo + 1;
  for (let attempt = 0; attempt < maxTries; attempt++) {
    const s = lo + Math.min(span - 1, Math.floor(rng() * span));
    if (largestGap(candles, s, s + playable) > maxGapSec) continue;
    return { candles: candles.slice(s - history, s + playable), startCursor: history - 1, limitedData };
  }
  throw new DataError('no_valid_window', `No usable session found after ${maxTries} tries`);
}
