import { beforeEach, describe, expect, it } from 'vitest';
import type { MatchResult } from './results';
import { MAX_RESULTS, RESULTS_KEY, clearResults, deleteResult, getResult, isMatchResult, listResults, saveResult, setResultNote } from './storage';

const result = (id: string, playedAt: number, pnl = 100): MatchResult => ({
  version: 1,
  id,
  symbol: 'NQ=F',
  symbolName: 'Nasdaq',
  currency: 'USD',
  priceDecimals: 2,
  lotStep: 0.01,
  config: { symbol: 'NQ=F', currency: 'USD', interval: '1m', durationMs: 600_000, startingBalance: 100_000, maxDrawdownPct: 5, lotStep: 0.01 },
  endReason: 'timer',
  playedAt,
  sessionStart: 60,
  sessionEnd: 120,
  stats: {
    startingBalance: 100_000,
    finalEquity: 100_000 + pnl,
    pnl,
    returnPct: pnl / 1000,
    trades: 0,
    wins: 0,
    losses: 0,
    winRate: null,
    profitFactor: null,
    grossProfit: 0,
    grossLoss: 0,
    maxDrawdownPct: 0,
    avgWin: null,
    avgLoss: null,
    largestWin: null,
    largestLoss: null,
    durationMs: 600_000,
  },
  trades: [],
  equityCurve: [],
});

const throwing = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('quota'); }, removeItem: () => { throw new Error('blocked'); } };

beforeEach(() => localStorage.clear());

describe('results storage', () => {
  it('round-trips, newest first', () => {
    expect(saveResult(result('a', 1))).toBe(true);
    expect(saveResult(result('b', 2))).toBe(true);
    expect(listResults()).toEqual({ results: [result('b', 2), result('a', 1)], error: false });
    expect(getResult('a')).toEqual(result('a', 1));
    expect(getResult('zzz')).toBeNull();
  });

  it('saving the same id replaces it', () => {
    saveResult(result('a', 1, 100));
    saveResult(result('a', 1, 200));
    expect(listResults().results).toHaveLength(1);
    expect(getResult('a')?.stats.pnl).toBe(200);
  });

  it(`keeps only the newest ${MAX_RESULTS}`, () => {
    for (let i = 0; i < MAX_RESULTS + 5; i++) saveResult(result(`r${i}`, i));
    const { results } = listResults();
    expect(results).toHaveLength(MAX_RESULTS);
    expect(results[0].id).toBe(`r${MAX_RESULTS + 4}`);
    expect(getResult('r0')).toBeNull();
  });

  it('sets, trims, caps and removes a note', () => {
    saveResult(result('a', 1));
    expect(setResultNote('a', '  Wait for the breakout.  ')).toBe(true);
    expect(getResult('a')?.note).toBe('Wait for the breakout.');
    setResultNote('a', 'x'.repeat(900));
    expect(getResult('a')?.note).toHaveLength(500);
    setResultNote('a', '   ');
    expect(getResult('a')).not.toHaveProperty('note');
    expect(setResultNote('missing', 'x')).toBe(false);
  });

  it('rejects a result whose note is not a string', () => {
    expect(isMatchResult({ ...result('a', 1), note: 5 })).toBe(false);
    expect(isMatchResult({ ...result('a', 1), note: 'ok' })).toBe(true);
  });

  it('deletes one and clears all', () => {
    saveResult(result('a', 1));
    saveResult(result('b', 2));
    expect(deleteResult('a')).toBe(true);
    expect(listResults().results.map((r) => r.id)).toEqual(['b']);
    expect(clearResults()).toBe(true);
    expect(listResults()).toEqual({ results: [], error: false });
  });

  it('corrupted JSON reads as empty with the error flag', () => {
    localStorage.setItem(RESULTS_KEY, '{nope');
    expect(listResults()).toEqual({ results: [], error: true });
    localStorage.setItem(RESULTS_KEY, '{"a":1}');
    expect(listResults()).toEqual({ results: [], error: true });
  });

  it('skips malformed or old-version entries and flags it', () => {
    localStorage.setItem(RESULTS_KEY, JSON.stringify([result('ok', 1), { ...result('old', 2), version: 0 }, { ...result('nan', 3), stats: { pnl: 'x' } }, null]));
    expect(listResults()).toEqual({ results: [result('ok', 1)], error: true });
  });

  it('never throws when storage is blocked, missing or full', () => {
    expect(listResults(throwing)).toEqual({ results: [], error: true });
    expect(saveResult(result('a', 1), throwing)).toBe(false);
    expect(deleteResult('a', throwing)).toBe(false);
    expect(clearResults(throwing)).toBe(false);
    expect(getResult('a', throwing)).toBeNull();
    expect(listResults(null)).toEqual({ results: [], error: true });
    expect(saveResult(result('a', 1), null)).toBe(false);
  });

  it('isMatchResult accepts null ratios and rejects non-finite numbers', () => {
    expect(isMatchResult(result('a', 1))).toBe(true);
    expect(isMatchResult({ ...result('a', 1), playedAt: Infinity })).toBe(false);
    expect(isMatchResult({ ...result('a', 1), endReason: 'bored' })).toBe(false);
    expect(isMatchResult('x')).toBe(false);
  });
});
