import { addTombstones, emitLocalChange } from './localChanges';
import { MAX_NOTE_LENGTH, type MatchResult } from './results';

// Saved results live in this browser's localStorage. A signed-in player's results are mirrored to
// the cloud (plan M14): every successful write here announces itself through localChanges.
// Every access is wrapped: storage can be missing, blocked (private mode) or full.

export const RESULTS_KEY = 'qs-pvp:results:v1';
export const MAX_RESULTS = 50;

export type ResultsRead = { results: MatchResult[]; error: boolean };

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function browserStorage(): StorageLike | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null; // accessing localStorage itself can throw when site data is blocked
  }
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const isFiniteNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isNumOrNull = (v: unknown) => v === null || isFiniteNum(v);

/** Shape check for one saved result. Anything else is skipped, never shown. */
export function isMatchResult(v: unknown): v is MatchResult {
  if (!isObj(v) || v.version !== 1) return false;
  const s = v.stats;
  return (
    typeof v.id === 'string' &&
    typeof v.symbol === 'string' &&
    typeof v.symbolName === 'string' &&
    typeof v.currency === 'string' &&
    isFiniteNum(v.priceDecimals) &&
    isFiniteNum(v.lotStep) &&
    isObj(v.config) &&
    typeof v.endReason === 'string' &&
    ['timer', 'drawdown', 'user', 'data_end'].includes(v.endReason as string) &&
    isFiniteNum(v.playedAt) &&
    isFiniteNum(v.sessionStart) &&
    isFiniteNum(v.sessionEnd) &&
    Array.isArray(v.trades) &&
    Array.isArray(v.equityCurve) &&
    (v.note === undefined || typeof v.note === 'string') &&
    (v.challenge === undefined || (isObj(v.challenge) && typeof v.challenge.from === 'string' && isObj(v.challenge.score) && isFiniteNum(v.challenge.score.returnPct))) &&
    isObj(s) &&
    isFiniteNum(s.pnl) &&
    isFiniteNum(s.returnPct) &&
    isFiniteNum(s.finalEquity) &&
    isFiniteNum(s.startingBalance) &&
    isFiniteNum(s.trades) &&
    isFiniteNum(s.maxDrawdownPct) &&
    isNumOrNull(s.winRate) &&
    isNumOrNull(s.profitFactor)
  );
}

export function listResults(storage: StorageLike | null = browserStorage()): ResultsRead {
  if (!storage) return { results: [], error: true };
  try {
    const raw = storage.getItem(RESULTS_KEY);
    if (raw === null) return { results: [], error: false };
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return { results: [], error: true };
    const results = parsed.filter(isMatchResult).sort((a, b) => b.playedAt - a.playedAt);
    return { results, error: results.length !== parsed.length };
  } catch {
    return { results: [], error: true };
  }
}

function write(storage: StorageLike, results: MatchResult[]): boolean {
  try {
    storage.setItem(RESULTS_KEY, JSON.stringify(results));
    return true;
  } catch {
    return false; // quota exceeded or storage blocked
  }
}

/** Saves (or replaces) a result, newest first, keeping at most MAX_RESULTS. */
export function saveResult(result: MatchResult, storage: StorageLike | null = browserStorage()): boolean {
  if (!storage) return false;
  const { results } = listResults(storage);
  const next = [result, ...results.filter((r) => r.id !== result.id)].sort((a, b) => b.playedAt - a.playedAt).slice(0, MAX_RESULTS);
  const ok = write(storage, next);
  if (ok) emitLocalChange({ kind: 'result', op: 'put', id: result.id });
  return ok;
}

/** Plan M14: replaces every saved result (after a cloud merge). Announces nothing. */
export function replaceResults(list: MatchResult[], storage: StorageLike | null = browserStorage()): boolean {
  if (!storage) return false;
  return write(storage, [...list].sort((a, b) => b.playedAt - a.playedAt).slice(0, MAX_RESULTS));
}

export function getResult(id: string, storage: StorageLike | null = browserStorage()): MatchResult | null {
  return listResults(storage).results.find((r) => r.id === id) ?? null;
}

/** Sets the player's note on a saved result (trimmed, capped at MAX_NOTE_LENGTH; empty removes it). */
export function setResultNote(id: string, note: string, storage: StorageLike | null = browserStorage(), now = Date.now()): boolean {
  if (!storage) return false;
  const { results } = listResults(storage);
  const target = results.find((r) => r.id === id);
  if (!target) return false;
  const text = note.trim().slice(0, MAX_NOTE_LENGTH);
  // Plan M14 A4: the note is the only part that changes, so its time settles a sync conflict.
  const updated: MatchResult = { ...target, noteUpdatedAt: now };
  if (text) updated.note = text;
  else delete updated.note;
  const ok = write(storage, results.map((r) => (r.id === id ? updated : r)));
  if (ok) emitLocalChange({ kind: 'result', op: 'put', id });
  return ok;
}

export function deleteResult(id: string, storage: StorageLike | null = browserStorage()): boolean {
  if (!storage) return false;
  const ok = write(storage, listResults(storage).results.filter((r) => r.id !== id));
  if (ok) {
    addTombstones('result', [id]);
    emitLocalChange({ kind: 'result', op: 'delete', ids: [id] });
  }
  return ok;
}

export function clearResults(storage: StorageLike | null = browserStorage()): boolean {
  if (!storage) return false;
  const ids = listResults(storage).results.map((r) => r.id);
  try {
    storage.removeItem(RESULTS_KEY);
  } catch {
    return false;
  }
  addTombstones('result', ids);
  emitLocalChange({ kind: 'result', op: 'delete', ids });
  return true;
}
