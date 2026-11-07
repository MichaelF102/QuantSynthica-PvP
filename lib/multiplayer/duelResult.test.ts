import { describe, expect, it } from 'vitest';
import { computeStats } from '../stats';
import { createMatch } from '../engine';
import type { Candle } from '../types';
import { MAX_DUELS, buildDuelResult, deleteDuel, duelResultId, getDuel, isDuelResult, listDuels, reasonText, saveDuel, DUELS_KEY, type EndMessage } from './duelResult';
import type { RoomInfo } from './roomClient';

// TEST FIXTURE: synthetic candles, not market data.
const candles: Candle[] = [0, 1, 2].map((i) => ({ time: 1_700_000_000 + 60 * i, open: 100, high: 100, low: 100, close: 100, volume: 1 }));
const config = { symbol: 'TEST', currency: 'USD', interval: '1m' as const, durationMs: 300_000, startingBalance: 1_000, maxDrawdownPct: 5, lotStep: 1 };
const stats = computeStats(createMatch(config, candles, 2));

const ROOM: RoomInfo = {
  type: 'room',
  code: 'K7M2QX',
  phase: 'ended',
  settings: { symbol: 'TEST', durationMin: 5, speed: 1, startingBalance: 1_000, maxDrawdownPct: 5 },
  symbol: { symbol: 'TEST', name: 'Test fixture', currency: 'USD', lotStep: 1, priceDecimals: 2, assetClass: 'stock' },
  players: [],
  countdownEndsAt: null,
  serverNow: 0,
};
const end = (winner: string | 'draw' | null, over: Partial<EndMessage> = {}): EndMessage => ({
  type: 'end',
  reason: 'timer',
  winner,
  sessionStart: 1_700_000_120,
  sessionEnd: 1_700_000_420,
  players: [
    { id: 'a', nickname: 'Ann', status: 'done', stats, trades: [], equityCurve: [{ t: 1_700_000_120, equity: 1_000 }] },
    { id: 'b', nickname: 'Bo', status: 'out_drawdown', stats, trades: [], equityCurve: [{ t: 1_700_000_120, equity: 1_000 }] },
  ],
  ...over,
});

function mem() {
  const data = new Map<string, string>();
  return { data, getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
}

describe('buildDuelResult', () => {
  it('reads the outcome from this browser’s seat', () => {
    expect(buildDuelResult(end('a'), ROOM, 'a', 1)?.outcome).toBe('win');
    expect(buildDuelResult(end('a'), ROOM, 'b', 1)?.outcome).toBe('loss');
    expect(buildDuelResult(end('draw'), ROOM, 'a', 1)?.outcome).toBe('draw');
    expect(buildDuelResult(end('a'), ROOM, 'stranger', 1)).toBeNull();
    const r = buildDuelResult(end('a'), ROOM, 'b', 1)!;
    expect(r).toMatchObject({ you: { nickname: 'Bo' }, opponent: { nickname: 'Ann' }, roomCode: 'K7M2QX', sessionStart: 1_700_000_120 });
    expect(isDuelResult(r)).toBe(true);
  });

  it('uses a stable id per match, and explains the end', () => {
    expect(buildDuelResult(end('a'), ROOM, 'a', 1)!.id).toBe(duelResultId('K7M2QX', end('a')));
    expect(reasonText(buildDuelResult(end('a'), ROOM, 'a', 1)!)).toBe('Time ran out · Bo hit the max drawdown');
  });
});

describe('duel storage', () => {
  it('saves, replaces the same match, lists newest first and deletes', () => {
    const s = mem();
    const first = buildDuelResult(end('a'), ROOM, 'a', 1_000)!;
    const again = { ...first, playedAt: 1_500 };
    const other = buildDuelResult(end('b', { sessionStart: 5, sessionEnd: 6 }), ROOM, 'a', 2_000)!;
    expect(saveDuel(first, s) && saveDuel(again, s) && saveDuel(other, s)).toBe(true);
    expect(listDuels(s).duels.map((d) => d.playedAt)).toEqual([2_000, 1_500]);
    expect(getDuel(first.id, s)?.playedAt).toBe(1_500);
    expect(deleteDuel(other.id, s)).toBe(true);
    expect(listDuels(s).duels).toHaveLength(1);
  });

  it('keeps at most MAX_DUELS, skips junk and reports unreadable storage', () => {
    const s = mem();
    for (let i = 0; i < MAX_DUELS + 5; i++) saveDuel(buildDuelResult(end('a', { sessionStart: i, sessionEnd: i + 1 }), ROOM, 'a', i)!, s);
    expect(listDuels(s).duels).toHaveLength(MAX_DUELS);
    s.setItem(DUELS_KEY, JSON.stringify([{ nope: 1 }, buildDuelResult(end('a'), ROOM, 'a', 1)]));
    expect(listDuels(s)).toMatchObject({ error: false, duels: [{ roomCode: 'K7M2QX' }] });
    s.setItem(DUELS_KEY, '{bad');
    expect(listDuels(s)).toEqual({ duels: [], error: true });
    expect(listDuels(null).error).toBe(true);
    expect(saveDuel(buildDuelResult(end('a'), ROOM, 'a', 1)!, null)).toBe(false);
  });
});
