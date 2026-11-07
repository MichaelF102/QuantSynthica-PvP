import { describe, expect, it } from 'vitest';
import { duelAnnouncement, type AnnounceSnapshot } from './announce';

const base: AnnounceSnapshot = { you: 'live', opponent: { nickname: 'Bo', status: 'live', connected: true }, remainingMs: 120_000 };
const next = (over: Partial<AnnounceSnapshot>, opp: Partial<NonNullable<AnnounceSnapshot['opponent']>> = {}): AnnounceSnapshot => ({ ...base, ...over, opponent: { ...base.opponent!, ...opp } });

describe('duelAnnouncement', () => {
  it('speaks knockouts, forfeits, connection changes and the last minute', () => {
    expect(duelAnnouncement(base, next({}, { status: 'out_drawdown' }))).toBe('Bo hit the max drawdown and is out.');
    expect(duelAnnouncement(base, next({}, { status: 'out_disconnect' }))).toBe('Bo forfeited.');
    expect(duelAnnouncement(base, next({}, { connected: false }))).toBe('Bo lost connection.');
    expect(duelAnnouncement(next({}, { connected: false }), base)).toBe('Bo is back.');
    expect(duelAnnouncement(base, next({ you: 'out_drawdown' }))).toBe('You hit the max drawdown and are out.');
    expect(duelAnnouncement(base, next({ remainingMs: 60_000 }))).toBe('One minute left.');
  });

  it('stays quiet for everything else', () => {
    expect(duelAnnouncement(base, base)).toBeNull();
    expect(duelAnnouncement(base, next({ remainingMs: 90_000 }))).toBeNull();
    expect(duelAnnouncement(next({ remainingMs: 50_000 }), next({ remainingMs: 49_000 }))).toBeNull();
    expect(duelAnnouncement(base, next({ remainingMs: 0 }))).toBeNull(); // the end screen says it
  });
});
