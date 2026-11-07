import { BALANCE_LIMITS, CANDLES_PER_SEC_1X, COMMISSION_LIMITS, DURATION_OPTIONS_MIN, MAX_DRAWDOWN_LIMITS, SLIPPAGE_BPS_LIMITS } from './config';
import { DataError } from './data';
import type { MatchResult } from './results';
import { defaultMatchConfig, executionFields, sessionSpecFor } from './session';
import type { Candle, FillModel, MatchConfig, Session, SymbolInfo } from './types';

// Challenge links (plan M13 Part C): the same session and rules, played alone by a friend, with
// the challenger's score carried in the link. No server, so the link is untrusted input (C4).

export const CHALLENGE_PARAM = 'challenge';
export const NAME_MAX = 20;
const CODE_MAX = 2048;

export type ChallengeScore = { returnPct: number; trades: number; winRate: number | null; maxDrawdownPct: number };

export type Challenge = {
  v: 1;
  symbol: string;
  /** UNIX seconds of the candle the challenger started on (the result's sessionStart). */
  start: number;
  durationMin: (typeof DURATION_OPTIONS_MIN)[number];
  balance: number;
  maxDrawdownPct: number;
  fillModel?: FillModel;
  commission?: number;
  slippageBps?: number;
  from: string;
  score: ChallengeScore;
};

/** Saved on the friend's result (C5). */
export type ChallengeRef = { from: string; score: ChallengeScore };

// ---------- encoding ----------

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(code: string): string | null {
  if (!/^[A-Za-z0-9_-]+$/.test(code)) return null;
  try {
    const bin = atob(code.replace(/-/g, '+').replace(/_/g, '/'));
    return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
  } catch {
    return null;
  }
}

export const encodeChallenge = (c: Challenge): string => toBase64Url(JSON.stringify(c));

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const inRange = (v: unknown, lo: number, hi: number): v is number => isNum(v) && v >= lo && v <= hi;

/** Cleans a display name: no control characters, collapsed spaces, at most NAME_MAX characters. */
export function cleanName(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  // eslint-disable-next-line no-control-regex
  const s = v.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX);
  return s || null;
}

/** C4: a valid challenge, or null for anything malformed. */
export function decodeChallenge(code: string | null | undefined): Challenge | null {
  if (!code || code.length > CODE_MAX) return null;
  const text = fromBase64Url(code);
  if (!text) return null;
  let o: Record<string, unknown>;
  try {
    const v: unknown = JSON.parse(text);
    if (typeof v !== 'object' || v === null || Array.isArray(v)) return null;
    o = v as Record<string, unknown>;
  } catch {
    return null;
  }
  const sc = o.score as Record<string, unknown> | null;
  const from = cleanName(o.from);
  const ok =
    o.v === 1 &&
    typeof o.symbol === 'string' &&
    o.symbol.length > 0 &&
    o.symbol.length <= 32 &&
    isNum(o.start) &&
    o.start > 0 &&
    (DURATION_OPTIONS_MIN as readonly unknown[]).includes(o.durationMin) &&
    inRange(o.balance, BALANCE_LIMITS.min, BALANCE_LIMITS.max) &&
    inRange(o.maxDrawdownPct, MAX_DRAWDOWN_LIMITS.min, MAX_DRAWDOWN_LIMITS.max) &&
    (o.fillModel === undefined || o.fillModel === 'close' || o.fillModel === 'next_open') &&
    (o.commission === undefined || inRange(o.commission, COMMISSION_LIMITS.min, COMMISSION_LIMITS.max)) &&
    (o.slippageBps === undefined || inRange(o.slippageBps, SLIPPAGE_BPS_LIMITS.min, SLIPPAGE_BPS_LIMITS.max)) &&
    from !== null &&
    typeof sc === 'object' &&
    sc !== null &&
    inRange(sc.returnPct, -100, 1e6) &&
    Number.isInteger(sc.trades) &&
    inRange(sc.trades, 0, 1e6) &&
    (sc.winRate === null || inRange(sc.winRate, 0, 100)) &&
    inRange(sc.maxDrawdownPct, 0, 100);
  if (!ok) return null;
  return {
    v: 1,
    symbol: o.symbol as string,
    start: o.start as number,
    durationMin: o.durationMin as Challenge['durationMin'],
    balance: o.balance as number,
    maxDrawdownPct: o.maxDrawdownPct as number,
    ...executionFields({ fillModel: o.fillModel as FillModel | undefined, commission: o.commission as number | undefined, slippageBps: o.slippageBps as number | undefined }),
    from,
    score: { returnPct: sc.returnPct as number, trades: sc.trades as number, winRate: sc.winRate as number | null, maxDrawdownPct: sc.maxDrawdownPct as number },
  };
}

// ---------- building ----------

/** C1: the challenge for a saved result. */
export function challengeFromResult(r: MatchResult, from: string): Challenge {
  const minutes = r.config.durationMs / 60_000;
  return {
    v: 1,
    symbol: r.symbol,
    start: r.sessionStart,
    durationMin: ((DURATION_OPTIONS_MIN as readonly number[]).includes(minutes) ? minutes : 10) as Challenge['durationMin'],
    balance: r.config.startingBalance,
    maxDrawdownPct: r.config.maxDrawdownPct,
    ...executionFields(r.config),
    from: cleanName(from) ?? 'A friend',
    score: { returnPct: r.stats.returnPct, trades: r.stats.trades, winRate: r.stats.winRate, maxDrawdownPct: r.stats.maxDrawdownPct },
  };
}

export const challengeUrl = (origin: string, c: Challenge) => `${origin}/practice?${CHALLENGE_PARAM}=${encodeChallenge(c)}`;

export function challengeConfig(c: Challenge, info: SymbolInfo): MatchConfig {
  return defaultMatchConfig(info, {
    durationMs: c.durationMin * 60_000,
    startingBalance: c.balance,
    maxDrawdownPct: c.maxDrawdownPct,
    fillModel: c.fillModel,
    commission: c.commission,
    slippageBps: c.slippageBps,
  });
}

/**
 * C2: the session that starts on the candle at `start`, with the same history and playable span
 * a normal session gets. C3: if the data no longer covers it, a DataError says so.
 */
export function sessionAt(candles: Candle[], start: number, config: MatchConfig): Session {
  const i = candles.findIndex((c) => c.time === start);
  const gone = () => new DataError('not_enough_data', 'The market data no longer covers this challenge session. Data is refreshed on a rolling window.');
  if (i < 0) throw gone();
  const spec = sessionSpecFor(config.durationMs);
  const history = Math.min(spec.history, i + 1);
  const playable = Math.min(spec.playable, candles.length - 1 - i);
  // As for a random session: enough candles to fill the timer at 1x.
  if (playable < Math.ceil((config.durationMs / 1000) * CANDLES_PER_SEC_1X)) throw gone();
  return { candles: candles.slice(i + 1 - history, i + 1 + playable), startCursor: history - 1, limitedData: playable < spec.playable };
}
