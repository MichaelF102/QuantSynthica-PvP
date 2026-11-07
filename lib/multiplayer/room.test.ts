import { describe, expect, it } from 'vitest';
import type { Candle, Session } from '../types';
import type { ServerMessage } from './protocol';
import { ENDED_TTL_MS, RECONNECT_GRACE_MS, WAITING_TTL_MS, createRoom, nextWakeAt, roomReducer, type RoomEffect, type RoomEvent, type RoomState } from './room';
import type { RoomSettings, RoomSymbol } from './settings';

// TEST FIXTURE: synthetic flat candles (open = high = low = close), not market data.
const BASE = 1_700_000_000;
const HISTORY = 3;
function session(playableCloses: number[]): Session {
  const closes = [...Array(HISTORY).fill(100), ...playableCloses];
  const candles: Candle[] = closes.map((c, i) => ({ time: BASE + 60 * i, open: c, high: c, low: c, close: c, volume: 1 }));
  return { candles, startCursor: HISTORY - 1, limitedData: false };
}
const flat = (n: number, price = 100) => Array<number>(n).fill(price);

const SYMBOL: RoomSymbol = { symbol: 'TEST', name: 'Test fixture', currency: 'USD', lotStep: 1, priceDecimals: 2, assetClass: 'stock' };
const SETTINGS: RoomSettings = { symbol: 'TEST', durationMin: 5, speed: 1, startingBalance: 100_000, maxDrawdownPct: 5 };
const A = 'player-aaaa';
const B = 'player-bbbb';
const TOKEN_A = 'token-aaaaaaaaaaaaaaaa';
const TOKEN_B = 'token-bbbbbbbbbbbbbbbb';
const START = 3_010; // countdown ends here when both are ready at t = 10
const SC = HISTORY - 1;

type Log = { state: RoomState; effects: RoomEffect[] };
function step(log: Log, e: RoomEvent, now: number): Log {
  const r = roomReducer(log.state, e, now);
  return { state: r.state, effects: r.effects };
}
const msgs = (effects: RoomEffect[], to?: string) => effects.flatMap((e) => (e.kind === 'send' && (to === undefined || e.to === to || e.to === '*') ? [e.msg] : []));
const ofType = <T extends ServerMessage['type']>(effects: RoomEffect[], type: T, to?: string) => msgs(effects, to).filter((m): m is Extract<ServerMessage, { type: T }> => m.type === type);
const player = (s: RoomState, id: string) => s.players.find((p) => p.id === id)!;

function lobby(closes = flat(400)): Log {
  let log: Log = { state: createRoom({ code: 'K7M2QX', settings: SETTINGS, symbol: SYMBOL, session: session(closes), now: 0 }), effects: [] };
  log = step(log, { type: 'hello', clientId: A, nickname: 'Ann', newToken: TOKEN_A }, 1);
  log = step(log, { type: 'hello', clientId: B, nickname: 'Bo', newToken: TOKEN_B }, 2);
  return log;
}
function running(closes = flat(400)): Log {
  let log = lobby(closes);
  log = step(log, { type: 'ready', playerId: A }, 5);
  log = step(log, { type: 'ready', playerId: B }, 10);
  return step(log, { type: 'tick' }, START);
}

describe('joining', () => {
  it('seats two players, hands out tokens and refuses a third', () => {
    let log: Log = { state: createRoom({ code: 'K7M2QX', settings: SETTINGS, symbol: SYMBOL, session: session(flat(10)), now: 0 }), effects: [] };
    log = step(log, { type: 'hello', clientId: A, nickname: 'Ann', newToken: TOKEN_A }, 1);
    expect(log.state.phase).toBe('waiting');
    expect(ofType(log.effects, 'welcome', A)[0]).toEqual({ type: 'welcome', you: A, token: TOKEN_A });
    log = step(log, { type: 'hello', clientId: B, nickname: 'Bo', newToken: TOKEN_B }, 2);
    expect(log.state.phase).toBe('lobby');
    log = step(log, { type: 'hello', clientId: 'player-cccc', nickname: 'Cy', newToken: 'token-cccccccccccccccc' }, 3);
    expect(ofType(log.effects, 'error', 'player-cccc')[0].code).toBe('room_full');
    expect(log.state.players).toHaveLength(2);
  });

  it('leaving the lobby frees the seat and clears ready', () => {
    let log = step(lobby(), { type: 'ready', playerId: A }, 3);
    log = step(log, { type: 'leave', playerId: B }, 4);
    expect(log.state.phase).toBe('waiting');
    expect(log.state.players.map((p) => [p.id, p.ready])).toEqual([[A, false]]);
  });
});

describe('ready and countdown', () => {
  it('starts a 3 s countdown when both are ready; unready cancels it', () => {
    let log = step(lobby(), { type: 'ready', playerId: A }, 5);
    expect(log.state.phase).toBe('lobby');
    log = step(log, { type: 'ready', playerId: B }, 10);
    expect(log.state).toMatchObject({ phase: 'countdown', countdownEndsAt: START });
    expect(nextWakeAt(log.state)).toBe(START);
    const cancelled = step(log, { type: 'unready', playerId: A }, 20);
    expect(cancelled.state).toMatchObject({ phase: 'lobby', countdownEndsAt: null });
  });

  it('opens both accounts at the countdown end and sends the history only', () => {
    const log = running();
    expect(log.state.phase).toBe('running');
    expect(log.state.players.every((p) => p.status === 'live' && p.match?.status === 'running')).toBe(true);
    const start = ofType(log.effects, 'start')[0];
    expect(start.history).toHaveLength(HISTORY);
    expect(start.cursor).toBe(SC);
  });
});

describe('shared clock', () => {
  it('reveals one candle per tick interval to both players and catches up after a late alarm', () => {
    const log = step(running(), { type: 'tick' }, START + 2_500);
    expect(log.state.cursor).toBe(SC + 2);
    expect(ofType(log.effects, 'candle').map((m) => m.cursor)).toEqual([SC + 1, SC + 2]);
    expect(log.state.players.every((p) => p.match?.cursor === SC + 2)).toBe(true);
    expect(nextWakeAt(log.state)).toBe(START + 3_000);
  });

  it('ends on the timer and closes open positions', () => {
    let log = running();
    log = step(log, { type: 'order', playerId: A, seq: 1, order: { side: 'buy', units: 10 } }, START + 100);
    log = step(log, { type: 'tick' }, START + 5 * 60_000);
    expect(log.state).toMatchObject({ phase: 'ended', endReason: 'timer', winner: 'draw' });
    expect(player(log.state, A).match?.positions).toEqual([]);
    const end = ofType(log.effects, 'end')[0];
    expect(end.sessionStart).toBe(BASE + 60 * SC); // MP9: real time revealed at the end
    expect(end.players).toHaveLength(2);
    expect(nextWakeAt(log.state)).toBe(START + 5 * 60_000 + ENDED_TTL_MS);
  });

  it('ends at the data end', () => {
    const log = step(running(flat(5)), { type: 'tick' }, START + 60_000);
    expect(log.state).toMatchObject({ phase: 'ended', endReason: 'data_end' });
  });
});

describe('orders', () => {
  it('fills both players at the close of the candle current when the order arrives', () => {
    let log = running([101, 102, 103, ...flat(400)]);
    log = step(log, { type: 'order', playerId: A, seq: 1, order: { side: 'buy', units: 5 } }, START + 1_500);
    const a = ofType(log.effects, 'fill', A)[0];
    log = step(log, { type: 'order', playerId: B, seq: 1, order: { side: 'buy', units: 5 } }, START + 1_900);
    const b = ofType(log.effects, 'fill', B)[0];
    expect(a.fill.price).toBe(101);
    expect(b.fill.price).toBe(101);
    expect(a.cursor).toBe(SC + 1);
  });

  it('rejects a resent seq and an order the engine refuses', () => {
    let log = running();
    log = step(log, { type: 'order', playerId: A, seq: 1, order: { side: 'buy', units: 1 } }, START + 100);
    log = step(log, { type: 'order', playerId: A, seq: 1, order: { side: 'buy', units: 1 } }, START + 200);
    expect(ofType(log.effects, 'reject', A)[0].code).toBe('duplicate');
    log = step(log, { type: 'order', playerId: A, seq: 2, order: { side: 'buy', units: 1e9 } }, START + 300);
    expect(ofType(log.effects, 'reject', A)[0].code).toBe('insufficient_balance');
    log = step(log, { type: 'close', playerId: B, seq: 1 }, START + 400);
    expect(ofType(log.effects, 'reject', B)[0].code).toBe('size_zero');
    expect(player(log.state, A).match?.positions[0].units).toBe(1);
  });

  it('knocks out the player who breaches drawdown while the other plays on (MP6)', () => {
    let log = running([100, 90, ...flat(400, 90)]);
    log = step(log, { type: 'order', playerId: A, seq: 1, order: { side: 'buy', units: 1000 } }, START + 100);
    log = step(log, { type: 'tick' }, START + 2_000);
    expect(player(log.state, A).status).toBe('out_drawdown');
    expect(player(log.state, B).status).toBe('live');
    expect(log.state.phase).toBe('running');
    const frozen = player(log.state, A).match!.cursor;
    log = step(log, { type: 'tick' }, START + 5_000);
    expect(player(log.state, A).match!.cursor).toBe(frozen);
    log = step(log, { type: 'tick' }, START + 5 * 60_000);
    expect(log.state).toMatchObject({ phase: 'ended', winner: B });
  });

  it('rejects orders from a player who is out', () => {
    let log = running([100, 90, ...flat(400, 90)]);
    log = step(log, { type: 'order', playerId: A, seq: 1, order: { side: 'buy', units: 1000 } }, START + 100);
    log = step(log, { type: 'order', playerId: A, seq: 2, order: { side: 'buy', units: 1 } }, START + 2_000);
    expect(ofType(log.effects, 'reject', A)[0].code).toBe('not_live');
  });
});

describe('disconnects (MP10)', () => {
  it('keeps the seat for 30 s, then forfeits; the right token reclaims it', () => {
    let log = step(running(), { type: 'disconnect', playerId: B }, START + 1_000);
    expect(player(log.state, B)).toMatchObject({ connected: false, status: 'live' });
    expect(nextWakeAt(log.state)).toBe(START + 2_000);
    const back = step(log, { type: 'hello', clientId: B, nickname: 'Bo', token: TOKEN_B, newToken: 'unused-token-xxxxxxxx' }, START + 20_000);
    expect(player(back.state, B)).toMatchObject({ connected: true, disconnectedAt: null });
    expect(ofType(back.effects, 'start', B)[0].history.length).toBeGreaterThan(HISTORY);
    expect(ofType(back.effects, 'you', B)).toHaveLength(1);

    const stolen = step(log, { type: 'hello', clientId: B, nickname: 'X', token: 'token-wrongwrongwrong', newToken: 'unused-token-xxxxxxxx' }, START + 20_000);
    expect(ofType(stolen.effects, 'error', B)[0].code).toBe('bad_token');

    log = step(log, { type: 'tick' }, START + 1_000 + RECONNECT_GRACE_MS - 1);
    expect(player(log.state, B).status).toBe('live');
    log = step(log, { type: 'tick' }, START + 1_000 + RECONNECT_GRACE_MS);
    expect(player(log.state, B).status).toBe('out_disconnect');
    expect(log.state.phase).toBe('running');
  });

  it('leaving mid-match forfeits at once, and the room ends when nobody is live', () => {
    let log = step(running(), { type: 'leave', playerId: A }, START + 1_000);
    expect(player(log.state, A).status).toBe('out_disconnect');
    log = step(log, { type: 'leave', playerId: B }, START + 2_000);
    expect(log.state).toMatchObject({ phase: 'ended', endReason: 'all_out' });
  });

  it('forfeit ends your match but keeps you connected to watch (M11.5)', () => {
    let log = running();
    log = step(log, { type: 'order', playerId: A, seq: 1, order: { side: 'buy', units: 10 } }, START + 100);
    log = step(log, { type: 'forfeit', playerId: A }, START + 1_000);
    expect(player(log.state, A)).toMatchObject({ status: 'out_disconnect', connected: true });
    expect(player(log.state, A).match?.positions).toEqual([]);
    expect(ofType(log.effects, 'you', A)).toHaveLength(1);
    log = step(log, { type: 'tick' }, START + 5 * 60_000);
    expect(log.state).toMatchObject({ phase: 'ended', winner: B });
    expect(ofType(log.effects, 'end', A)).toHaveLength(1);
  });

  it('your own view lists your closed trades and last seq; times stay shifted', () => {
    let log = running([101, 102, ...flat(400)]);
    log = step(log, { type: 'order', playerId: A, seq: 3, order: { side: 'buy', units: 2 } }, START + 1_100);
    log = step(log, { type: 'close', playerId: A, seq: 4 }, START + 2_100);
    const mine = ofType(log.effects, 'you', A).at(-1)!.you;
    expect(mine).toMatchObject({ lastSeq: 4, trades: 1 });
    expect(mine.returnPct).toBeCloseTo(0.002, 6); // +2 on 100,000
    expect(mine.closed[0]).toMatchObject({ entry: 101, exit: 102, openedAt: 60 * (SC + 1), closedAt: 60 * (SC + 2) });
    expect(mine.closed[0].id).not.toMatch(/1700\d{6}/);
  });

  it('refuses a newcomer once the match has started', () => {
    const log = step(running(), { type: 'hello', clientId: 'player-cccc', nickname: 'Cy', newToken: 'token-cccccccccccccccc' }, START + 10);
    expect(ofType(log.effects, 'error', 'player-cccc')[0].code).toBe('room_full');
  });
});

describe('what goes on the wire', () => {
  function fullMatch(): { log: Log; all: { effects: RoomEffect[]; cursor: number; phase: string }[] } {
    let log = running([101, 99, 102, ...flat(400, 100)]);
    const all = [{ effects: log.effects, cursor: log.state.cursor, phase: log.state.phase }];
    const events: [RoomEvent, number][] = [
      [{ type: 'order', playerId: A, seq: 1, order: { side: 'buy', percent: 50 } }, START + 1_200],
      [{ type: 'tick' }, START + 2_000],
      [{ type: 'order', playerId: B, seq: 1, order: { side: 'sell', units: 3 } }, START + 2_100],
      [{ type: 'tick' }, START + 4_000],
      [{ type: 'close', playerId: A, seq: 2 }, START + 4_500],
      [{ type: 'tick' }, START + 5 * 60_000],
    ];
    for (const [e, now] of events) {
      log = step(log, e, now);
      all.push({ effects: log.effects, cursor: log.state.cursor, phase: log.state.phase });
    }
    return { log, all };
  }

  it('never sends a candle past the shared cursor, and hides the date during the match (MP9)', () => {
    const { all } = fullMatch();
    for (const { effects, cursor, phase } of all) {
      const shiftedCursorTime = 60 * cursor;
      for (const m of msgs(effects)) {
        const candles = m.type === 'start' ? m.history : m.type === 'candle' ? [m.candle] : [];
        for (const c of candles) expect(c.time).toBeLessThanOrEqual(shiftedCursorTime);
        if (phase === 'running' && m.type !== 'room') expect(JSON.stringify(m)).not.toMatch(/1700\d{6}/);
      }
    }
  });

  it('never shows the opponent positions, sides, sizes or fills (MP8)', () => {
    const { all } = fullMatch();
    const opp = all.flatMap(({ effects }) => ofType(effects, 'opponent'));
    expect(opp.length).toBeGreaterThan(0);
    for (const m of opp) expect(Object.keys(m.opponent).sort()).toEqual(['connected', 'drawdownPct', 'equity', 'id', 'nickname', 'returnPct', 'status', 'trades']);
    // Fills go only to the player who placed the order.
    for (const { effects } of all) for (const e of effects) if (e.kind === 'send' && e.msg.type === 'fill') expect(e.to).not.toBe('*');
  });
});

describe('rematch and expiry', () => {
  it('asks for a new session once both accept, then counts down again', () => {
    let log = step(running(), { type: 'tick' }, START + 5 * 60_000);
    log = step(log, { type: 'rematch', playerId: A }, START + 400_000);
    expect(log.effects.some((e) => e.kind === 'new_session')).toBe(false);
    log = step(log, { type: 'rematch', playerId: B }, START + 401_000);
    expect(log.effects.some((e) => e.kind === 'new_session')).toBe(true);
    log = step(log, { type: 'restart', session: session(flat(400, 50)) }, START + 402_000);
    expect(log.state).toMatchObject({ phase: 'countdown', winner: null, cursor: SC });
    expect(log.state.players.every((p) => p.match === null && p.ready)).toBe(true);
  });

  it('expires an unjoined room after 30 min and a finished room after 24 h (MP12)', () => {
    const fresh: Log = { state: createRoom({ code: 'K7M2QX', settings: SETTINGS, symbol: SYMBOL, session: session(flat(10)), now: 0 }), effects: [] };
    expect(step(fresh, { type: 'tick' }, WAITING_TTL_MS - 1).state.phase).toBe('waiting');
    const gone = step(fresh, { type: 'tick' }, WAITING_TTL_MS);
    expect(gone.state.phase).toBe('expired');
    expect(gone.effects.some((e) => e.kind === 'shutdown')).toBe(true);
    expect(ofType(step(gone, { type: 'hello', clientId: A, nickname: 'Ann', newToken: TOKEN_A }, WAITING_TTL_MS + 1).effects, 'error', A)[0].code).toBe('expired');

    const ended = step(running(), { type: 'tick' }, START + 5 * 60_000);
    expect(step(ended, { type: 'tick' }, ended.state.endedAt! + ENDED_TTL_MS).state.phase).toBe('expired');
  });

  it('a reconnecting player after the end gets the final result (MP11)', () => {
    let log = step(running(), { type: 'disconnect', playerId: B }, START + 1_000);
    log = step(log, { type: 'tick' }, START + 5 * 60_000);
    const back = step(log, { type: 'hello', clientId: B, nickname: 'Bo', token: TOKEN_B, newToken: 'unused-token-xxxxxxxx' }, START + 400_000);
    expect(ofType(back.effects, 'end', B)[0].winner).toBe(A);
  });
});
