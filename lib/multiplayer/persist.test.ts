import { describe, expect, it } from 'vitest';
import type { Candle } from '../types';
import { CANDLE_CHUNK, RATE_PER_SEC, dehydrate, rehydrate, takeToken } from './persist';
import { createRoom, roomReducer, type RoomState } from './room';

// TEST FIXTURE: synthetic flat candles, not market data.
const candles: Candle[] = Array.from({ length: 1234 }, (_, i) => ({ time: 1_700_000_000 + 60 * i, open: 100, high: 100, low: 100, close: 100, volume: 1 }));

function runningRoom(): RoomState {
  let s = createRoom({
    code: 'K7M2QX',
    settings: { symbol: 'TEST', durationMin: 5, speed: 1, startingBalance: 100_000, maxDrawdownPct: 5 },
    symbol: { symbol: 'TEST', name: 'Test fixture', currency: 'USD', lotStep: 1, priceDecimals: 2, assetClass: 'stock' },
    session: { candles, startCursor: 299, limitedData: false },
    now: 0,
  });
  const ev = (e: Parameters<typeof roomReducer>[1], now: number) => (s = roomReducer(s, e, now).state);
  ev({ type: 'hello', clientId: 'player-aaaa', nickname: 'Ann', newToken: 'token-aaaaaaaaaaaaaaaa' }, 1);
  ev({ type: 'hello', clientId: 'player-bbbb', nickname: 'Bo', newToken: 'token-bbbbbbbbbbbbbbbb' }, 2);
  ev({ type: 'ready', playerId: 'player-aaaa' }, 3);
  ev({ type: 'ready', playerId: 'player-bbbb' }, 4);
  ev({ type: 'tick' }, 3_004);
  ev({ type: 'order', playerId: 'player-aaaa', seq: 1, order: { side: 'buy', units: 3 } }, 5_000);
  return s;
}

describe('dehydrate / rehydrate', () => {
  it('stores the candles once, in chunks, and restores an identical state', () => {
    const s = runningRoom();
    const { room, chunks } = dehydrate(s);
    expect(chunks.map((c) => c.length)).toEqual([CANDLE_CHUNK, CANDLE_CHUNK, 234]);
    expect(room.session.candles).toEqual([]);
    expect(room.players.every((p) => p.match?.candles.length === 0)).toBe(true);
    expect(JSON.stringify(room).length).toBeLessThan(JSON.stringify(s).length / 5);
    expect(rehydrate(structuredClone(room), structuredClone(chunks))).toEqual(s);
  });

  it('a restored room keeps playing', () => {
    const { room, chunks } = dehydrate(runningRoom());
    const r = roomReducer(rehydrate(room, chunks), { type: 'tick' }, 10_000);
    expect(r.state.cursor).toBe(299 + 6);
  });
});

describe('takeToken', () => {
  it('allows a burst of 10, then refills at 10 per second', () => {
    let b;
    let allowed = 0;
    for (let i = 0; i < 15; i++) {
      const r = takeToken(b, 1_000);
      b = r.bucket;
      if (r.ok) allowed++;
    }
    expect(allowed).toBe(RATE_PER_SEC);
    expect(takeToken(b, 1_050).ok).toBe(false);
    expect(takeToken(b, 1_100).ok).toBe(true);
  });
});
