import { describe, expect, it } from 'vitest';
import type { Candle, Session } from '../types';
import type { ServerMessage } from './protocol';
import { createRoom, roomReducer, type RoomEffect, type RoomEvent, type RoomState } from './room';
import { newSeries, nextGame, recordGame, seriesView } from './series';
import type { RoomSettings, RoomSymbol } from './settings';

// Plan M13 R1–R4. TEST FIXTURE: synthetic flat candles, not market data.

const A = 'player-aaaa';
const B = 'player-bbbb';

describe('series rules', () => {
  const ids = [A, B];
  const after = (...winners: (string | 'draw')[]) => winners.reduce((s, w, i) => recordGame(i === 0 ? s : { ...s, game: i + 1 }, w), newSeries());

  it('best of 1 is done after one game', () => {
    expect(seriesView(1, recordGame(newSeries(), A), ids, true)).toMatchObject({ done: true, winner: A });
    expect(seriesView(1, newSeries(), ids, false).done).toBe(false);
  });

  it('best of 3 ends at 2 wins', () => {
    expect(seriesView(3, after(A), ids, true)).toMatchObject({ done: false, winner: null });
    expect(seriesView(3, after(A, A), ids, true)).toMatchObject({ done: true, winner: A, game: 2, wins: { [A]: 2 } });
    expect(seriesView(3, after(A, B), ids, true).done).toBe(false);
    expect(seriesView(3, after(A, B, B), ids, true)).toMatchObject({ done: true, winner: B });
  });

  it('a draw counts for nobody; after 3 games more wins takes it, equal is a drawn series', () => {
    expect(seriesView(3, after(A, 'draw', 'draw'), ids, true)).toMatchObject({ done: true, winner: A });
    expect(seriesView(3, after('draw', 'draw', 'draw'), ids, true)).toMatchObject({ done: true, winner: 'draw' });
  });

  it('nextGame counts up, or starts over once the series is finished', () => {
    expect(nextGame({ game: 1, wins: { [A]: 1 } }, false)).toEqual({ game: 2, wins: { [A]: 1 } });
    expect(nextGame({ game: 2, wins: { [A]: 2 } }, true)).toEqual(newSeries());
  });
});

// ---------- in a room ----------

const BASE = 1_700_000_000;
function session(): Session {
  const candles: Candle[] = Array.from({ length: 403 }, (_, i) => ({ time: BASE + 60 * i, open: 100, high: 100, low: 100, close: 100, volume: 1 }));
  return { candles, startCursor: 2, limitedData: false };
}
const SYMBOL: RoomSymbol = { symbol: 'TEST', name: 'Test fixture', currency: 'USD', lotStep: 1, priceDecimals: 2, assetClass: 'stock' };
const SETTINGS: RoomSettings = { symbol: 'TEST', durationMin: 5, speed: 1, startingBalance: 100_000, maxDrawdownPct: 50 };
type Log = { state: RoomState; effects: RoomEffect[] };
const step = (log: Log, e: RoomEvent, now: number): Log => roomReducer(log.state, e, now);
const ofType = <T extends ServerMessage['type']>(effects: RoomEffect[], type: T, to: string) =>
  effects.flatMap((e) => (e.kind === 'send' && (e.to === to || e.to === '*') && e.msg.type === type ? [e.msg as Extract<ServerMessage, { type: T }>] : []));

function running(settings: Partial<RoomSettings>, t0 = 0): Log {
  let log: Log = { state: createRoom({ code: 'K7M2QX', settings: { ...SETTINGS, ...settings }, symbol: SYMBOL, session: session(), now: t0 }), effects: [] };
  log = step(log, { type: 'hello', clientId: A, nickname: 'Ann', newToken: 'token-aaaaaaaaaaaaaaaa' }, t0 + 1);
  log = step(log, { type: 'hello', clientId: B, nickname: 'Bo', newToken: 'token-bbbbbbbbbbbbbbbb' }, t0 + 2);
  log = step(log, { type: 'ready', playerId: A }, t0 + 5);
  log = step(log, { type: 'ready', playerId: B }, t0 + 10);
  return step(log, { type: 'tick' }, t0 + 3_010);
}

/** B forfeits a game that started at `startedAt`; A plays on to the 5-minute timer and wins. */
function aWinsGame(log: Log, startedAt: number): Log {
  log = step(log, { type: 'forfeit', playerId: B }, startedAt + 1_000);
  return step(log, { type: 'tick' }, startedAt + 300_000);
}

describe('best of 3 in a room', () => {
  it('counts games, offers the next game and finishes at 2 wins', () => {
    let log = aWinsGame(running({ series: 3 }), 3_010);
    let end = ofType(log.effects, 'end', A)[0];
    expect(end.series).toMatchObject({ of: 3, game: 1, wins: { [A]: 1 }, done: false });

    log = step(log, { type: 'rematch', playerId: A }, 400_000);
    log = step(log, { type: 'rematch', playerId: B }, 400_001);
    expect(log.effects.some((e) => e.kind === 'new_session')).toBe(true);
    log = step(log, { type: 'restart', session: session() }, 400_002);
    expect(ofType(log.effects, 'room', A).at(-1)?.series).toMatchObject({ game: 2, wins: { [A]: 1 }, done: false });

    log = step(log, { type: 'tick' }, 403_002);
    log = aWinsGame(log, 403_002);
    end = ofType(log.effects, 'end', A)[0];
    expect(end.series).toMatchObject({ game: 2, wins: { [A]: 2 }, done: true, winner: A });

    // A rematch after the series starts a new one at 0–0.
    log = step(log, { type: 'rematch', playerId: A }, 800_000);
    log = step(log, { type: 'rematch', playerId: B }, 800_001);
    log = step(log, { type: 'restart', session: session() }, 800_002);
    expect(ofType(log.effects, 'room', A).at(-1)?.series).toMatchObject({ game: 1, wins: {}, done: false });
  });

  it('a single-game room reports a finished series of 1', () => {
    const log = aWinsGame(running({}), 3_010);
    expect(ofType(log.effects, 'end', A)[0].series).toMatchObject({ of: 1, done: true, winner: A });
  });
});

describe('open positions (R4)', () => {
  it('shows the opponent position and fills only when the room allows it, never stops or queued orders', () => {
    const order = (log: Log) => step(log, { type: 'order', playerId: A, seq: 0, order: { side: 'buy', units: 5 } }, 3_100);
    const hidden = ofType(order(running({})).effects, 'opponent', B).at(-1)!.opponent;
    expect(hidden).not.toHaveProperty('position');
    expect(hidden).not.toHaveProperty('fills');

    let log = order(running({ openPositions: true }));
    log = step(log, { type: 'brackets', playerId: A, seq: 1, brackets: { stopLoss: 90, takeProfit: null } }, 3_200);
    const seen = ofType(log.effects, 'opponent', B).at(-1)!.opponent;
    expect(seen.position).toEqual({ symbol: 'TEST', units: 5, avgEntry: 100, openedAt: 120 });
    expect(seen.fills).toHaveLength(1);
    expect(seen.fills?.[0].time).toBe(120); // session time (MP9)
    expect(JSON.stringify(seen)).not.toMatch(/stopLoss|takeProfit|queued/);
  });
});
