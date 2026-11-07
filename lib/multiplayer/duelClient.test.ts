import { describe, expect, it } from 'vitest';
import { canPlace } from '../engine';
import type { Candle } from '../types';
import { duelRemainingMs, fmtSessionTime, mirrorMatch, orderSent, reduceDuel, sessionZero, type DuelState } from './duelClient';
import type { ServerMessage, YouView } from './protocol';
import { initialRoomClient, roomClientReducer } from './roomClient';
import type { RoomSettings, RoomSymbol } from './settings';

// TEST FIXTURE: synthetic candles in session seconds, not market data.
const c = (i: number, close = 100): Candle => ({ time: 60 * i, open: close, high: close, low: close, close, volume: 1 });
const SETTINGS: RoomSettings = { symbol: 'TEST', durationMin: 5, speed: 1, startingBalance: 1_000, maxDrawdownPct: 5 };
const SYMBOL: RoomSymbol = { symbol: 'TEST', name: 'Test fixture', currency: 'USD', lotStep: 1, priceDecimals: 2, assetClass: 'stock' };
const start: Extract<ServerMessage, { type: 'start' }> = { type: 'start', history: [c(0), c(1), c(2)], cursor: 2, startCursor: 2, tickMs: 1000, durationMs: 300_000, startedAt: 10_000, serverNow: 10_000 };
const you = (over: Partial<YouView> = {}): YouView => ({ status: 'live', balance: 1_000, equity: 1_000, returnPct: 0, drawdownPct: 0, position: null, fills: [], trades: 0, closed: [], elapsedMs: 0, lastSeq: -1, ...over });

describe('reduceDuel', () => {
  it('starts from the history and appends candles in order only', () => {
    let d = reduceDuel(null, start) as DuelState;
    d = reduceDuel(d, { type: 'candle', candle: c(3, 101), cursor: 3, elapsedMs: 1000 })!;
    d = reduceDuel(d, { type: 'candle', candle: c(3, 999), cursor: 3, elapsedMs: 1000 })!; // repeat ignored
    expect(d.candles.map((x) => x.close)).toEqual([100, 100, 100, 101]);
    expect(d.cursor).toBe(3);
    expect(reduceDuel(null, { type: 'candle', candle: c(1), cursor: 1, elapsedMs: 0 })).toBeNull();
  });

  it('continues seq numbers above what the server already processed (reload safety)', () => {
    let d = reduceDuel(null, start)!;
    expect(d.nextSeq).toBe(0);
    d = reduceDuel(d, { type: 'you', you: you({ lastSeq: 7 }) })!;
    expect(d.nextSeq).toBe(8);
    d = orderSent(d, 8);
    expect(d).toMatchObject({ pending: [8], nextSeq: 9 });
    d = reduceDuel(d, { type: 'reject', seq: 8, code: 'insufficient_balance', message: 'Insufficient balance' })!;
    expect(d.pending).toEqual([]);
    expect(d.lastReject?.code).toBe('insufficient_balance');
  });

  it('keeps counting across a reconnect start', () => {
    const d = orderSent(reduceDuel(null, start)!, 4);
    expect(reduceDuel(d, start)!.nextSeq).toBe(5);
  });
});

describe('mirrorMatch', () => {
  it('rebuilds the account at the current candle so engine previews match the server', () => {
    let d = reduceDuel(null, start)!;
    expect(mirrorMatch(d, SETTINGS, SYMBOL)).toBeNull(); // no `you` yet
    d = reduceDuel(d, { type: 'you', you: you({ balance: 500, position: { symbol: 'TEST', units: 4, avgEntry: 100, openedAt: 120 } }) })!;
    const m = mirrorMatch(d, SETTINGS, SYMBOL)!;
    expect(m).toMatchObject({ status: 'running', balance: 500, cursor: 2, config: { startingBalance: 1_000, lotStep: 1 } });
    expect(canPlace(m, { side: 'buy', units: 1 })).toBeNull(); // 5 × 100 = 500, exactly the balance
    expect(canPlace(m, { side: 'buy', units: 2 })).toBe('insufficient_balance'); // 6 × 100 > 500
    expect(canPlace(m, { side: 'sell', units: 4 })).toBeNull();
    expect(mirrorMatch(reduceDuel(d, { type: 'you', you: you({ status: 'out_drawdown' }) }), SETTINGS, SYMBOL)!.status).toBe('ended');
  });
});

describe('clock and time labels', () => {
  it('counts down from the server clock', () => {
    const d = reduceDuel(null, start)!;
    expect(duelRemainingMs(d, 0, 10_000)).toBe(300_000);
    expect(duelRemainingMs(d, 2_000, 10_000)).toBe(298_000); // local clock 2 s behind
    expect(duelRemainingMs(d, 0, 400_000)).toBe(0);
  });

  it('labels times relative to the start candle', () => {
    const d = reduceDuel(null, start)!;
    expect(sessionZero(d)).toBe(120);
    expect(fmtSessionTime(120, 120)).toBe('T+0:00');
    expect(fmtSessionTime(120 + 65 * 60, 120)).toBe('T+1:05');
    expect(fmtSessionTime(60, 120)).toBe('T−0:01');
  });
});

describe('roomClientReducer with a match', () => {
  it('routes match messages to the duel and keeps the end result', () => {
    let s = roomClientReducer(initialRoomClient, { kind: 'msg', msg: start, now: 9_000 });
    expect(s.clockOffset).toBe(1_000);
    s = roomClientReducer(s, { kind: 'order_sent', seq: 0 });
    expect(s.duel?.pending).toEqual([0]);
    const end: ServerMessage = { type: 'end', reason: 'timer', winner: 'draw', sessionStart: 1, sessionEnd: 2, players: [] };
    s = roomClientReducer(s, { kind: 'msg', msg: end, now: 0 });
    expect(s.end).toEqual(end);
    expect(s.duel).not.toBeNull();
  });
});
