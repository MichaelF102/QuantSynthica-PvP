import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LOCAL_CHANGE_EVENT, addTombstones, isTombstoned, loadTombstones, removeTombstones } from '../localChanges';
import type { MatchResult } from '../results';
import { clearResults, deleteResult, getResult, saveResult, setResultNote } from '../storage';
import { firebaseConfig } from './config';
import { authErrorText, syncErrorText } from './errors';

// Plan M14: local change events, tombstones and the Firebase config. TEST FIXTURE: a minimal
// result shape, not a real match.

const result = (id: string, playedAt = 1) =>
  ({
    version: 1,
    id,
    symbol: 'NQ=F',
    symbolName: 'x',
    currency: 'USD',
    priceDecimals: 2,
    lotStep: 1,
    config: {},
    endReason: 'timer',
    playedAt,
    sessionStart: 1,
    sessionEnd: 2,
    trades: [],
    equityCurve: [],
    stats: { pnl: 0, returnPct: 0, finalEquity: 1, startingBalance: 1, trades: 0, maxDrawdownPct: 0, winRate: null, profitFactor: null },
  }) as unknown as MatchResult;

beforeEach(() => localStorage.clear());

describe('storage announces changes and leaves tombstones (A5)', () => {
  it('emits put on save and note, delete with tombstones on delete and clear', () => {
    const seen = vi.fn();
    const on = (e: Event) => seen((e as CustomEvent).detail);
    window.addEventListener(LOCAL_CHANGE_EVENT, on);
    saveResult(result('a', 1));
    saveResult(result('b', 2));
    setResultNote('a', 'hi', undefined, 77);
    expect(getResult('a')).toMatchObject({ note: 'hi', noteUpdatedAt: 77 });
    deleteResult('a');
    clearResults();
    window.removeEventListener(LOCAL_CHANGE_EVENT, on);
    expect(seen.mock.calls.map((c) => c[0])).toEqual([
      { kind: 'result', op: 'put', id: 'a' },
      { kind: 'result', op: 'put', id: 'b' },
      { kind: 'result', op: 'put', id: 'a' },
      { kind: 'result', op: 'delete', ids: ['a'] },
      { kind: 'result', op: 'delete', ids: ['b'] },
    ]);
    expect(loadTombstones()).toEqual([
      { kind: 'result', id: 'a' },
      { kind: 'result', id: 'b' },
    ]);
  });

  it('adds, dedupes and removes tombstones; junk reads as empty', () => {
    addTombstones('duel', ['x', 'y']);
    addTombstones('duel', ['x']);
    expect(loadTombstones()).toEqual([
      { kind: 'duel', id: 'y' },
      { kind: 'duel', id: 'x' },
    ]);
    expect(isTombstoned(loadTombstones(), 'duel', 'x')).toBe(true);
    removeTombstones([{ kind: 'duel', id: 'x' }]);
    expect(loadTombstones()).toEqual([{ kind: 'duel', id: 'y' }]);
    localStorage.setItem('qs-pvp:deleted:v1', '{bad');
    expect(loadTombstones()).toEqual([]);
  });
});

describe('firebaseConfig (A1)', () => {
  it('needs all four values', () => {
    const full = { apiKey: 'k', authDomain: 'x.firebaseapp.com', projectId: 'x', appId: '1:2:web:3' };
    expect(firebaseConfig(full)).toEqual(full);
    expect(firebaseConfig({ ...full, appId: ' ' })).toBeNull();
    expect(firebaseConfig({})).toBeNull();
  });
});

describe('error text', () => {
  it('treats a closed popup as no error and explains the common failures', () => {
    expect(authErrorText({ code: 'auth/popup-closed-by-user' })).toBeNull();
    expect(authErrorText({ code: 'auth/unauthorized-domain' })).toMatch(/authorized domains/);
    expect(authErrorText(new Error('x'))).toBe('Sign-in failed. Try again.');
    expect(syncErrorText({ code: 'unavailable' })).toMatch(/Offline/);
    expect(syncErrorText({ code: 'resource-exhausted' })).toMatch(/quota/);
  });

  it('explains email and password failures without saying which part was wrong (plan M16)', () => {
    expect(authErrorText({ code: 'auth/invalid-credential' })).toBe('The email or password is wrong.');
    expect(authErrorText({ code: 'auth/user-not-found' })).toBe('The email or password is wrong.');
    expect(authErrorText({ code: 'auth/email-already-in-use' })).toMatch(/already exists/);
    expect(authErrorText({ code: 'auth/too-many-requests' })).toMatch(/Too many attempts/);
    expect(authErrorText({ code: 'auth/operation-not-allowed' })).toMatch(/not turned on/);
    expect(authErrorText({ code: 'auth/requires-recent-login' })).toMatch(/sign in again/);
  });
});
