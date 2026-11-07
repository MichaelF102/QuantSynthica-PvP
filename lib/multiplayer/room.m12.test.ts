import { describe, expect, it } from 'vitest';
import type { Candle, Session } from '../types';
import { parseClientMessage, type ServerMessage } from './protocol';
import { createRoom, roomReducer, type RoomEffect, type RoomEvent, type RoomState } from './room';
import { roomMatchConfig, validateRoomSettings, type RoomSettings, type RoomSymbol } from './settings';
import { shiftQueued } from './views';
import { reduceDuel, startDuel, mirrorMatch } from './duelClient';

// Plan M12 in 1v1 rooms: next-open fills, stop-loss / take-profit and costs run on the server.
// TEST FIXTURE: synthetic candles, not market data.

const BASE = 1_700_000_000;
const HISTORY = 3;
type Bar = [open: number, high: number, low: number, close: number];
function session(playable: Bar[]): Session {
  const rows: Bar[] = [...Array<Bar>(HISTORY).fill([100, 100, 100, 100]), ...playable];
  const candles: Candle[] = rows.map(([open, high, low, close], i) => ({ time: BASE + 60 * i, open, high, low, close, volume: 1 }));
  return { candles, startCursor: HISTORY - 1, limitedData: false };
}
const flat = (n: number, price = 100): Bar[] => Array<Bar>(n).fill([price, price, price, price]);

const SYMBOL: RoomSymbol = { symbol: 'TEST', name: 'Test fixture', currency: 'USD', lotStep: 1, priceDecimals: 2, assetClass: 'stock' };
const SETTINGS: RoomSettings = { symbol: 'TEST', durationMin: 5, speed: 1, startingBalance: 100_000, maxDrawdownPct: 50 };
const A = 'player-aaaa';
const B = 'player-bbbb';
const START = 3_010;

type Log = { state: RoomState; effects: RoomEffect[] };
const step = (log: Log, e: RoomEvent, now: number): Log => roomReducer(log.state, e, now);
const msgs = (effects: RoomEffect[], to: string) => effects.flatMap((e) => (e.kind === 'send' && (e.to === to || e.to === '*') ? [e.msg] : []));
const ofType = <T extends ServerMessage['type']>(effects: RoomEffect[], type: T, to: string) => msgs(effects, to).filter((m): m is Extract<ServerMessage, { type: T }> => m.type === type);
const player = (s: RoomState, id: string) => s.players.find((p) => p.id === id)!;

function running(playable: Bar[], settings: Partial<RoomSettings> = {}): Log {
  let log: Log = { state: createRoom({ code: 'K7M2QX', settings: { ...SETTINGS, ...settings }, symbol: SYMBOL, session: session(playable), now: 0 }), effects: [] };
  log = step(log, { type: 'hello', clientId: A, nickname: 'Ann', newToken: 'token-aaaaaaaaaaaaaaaa' }, 1);
  log = step(log, { type: 'hello', clientId: B, nickname: 'Bo', newToken: 'token-bbbbbbbbbbbbbbbb' }, 2);
  log = step(log, { type: 'ready', playerId: A }, 5);
  log = step(log, { type: 'ready', playerId: B }, 10);
  return step(log, { type: 'tick' }, START);
}

describe('room settings (plan M12 C10)', () => {
  const index = [{ symbol: 'TEST', name: 'Test', assetClass: 'stock' as const, currency: 'USD', dataFile: 'x.csv', barsAvailable: 1, firstTime: 0, lastTime: 0, lotStep: 1, priceDecimals: 2 }];

  it('accepts fills and costs and passes them to both accounts', () => {
    const check = validateRoomSettings({ ...SETTINGS, fillModel: 'next_open', commission: 2, slippageBps: 3 }, index);
    expect(check).toEqual({ ok: true, settings: { ...SETTINGS, fillModel: 'next_open', commission: 2, slippageBps: 3 } });
    if (check.ok) expect(roomMatchConfig(check.settings, SYMBOL)).toMatchObject({ fillModel: 'next_open', commission: 2, slippageBps: 3 });
  });

  it('drops default values and rejects bad ones', () => {
    expect(validateRoomSettings({ ...SETTINGS, fillModel: 'close', commission: 0, slippageBps: 0 }, index)).toEqual({ ok: true, settings: SETTINGS });
    expect(validateRoomSettings({ ...SETTINGS, fillModel: 'later' }, index).ok).toBe(false);
    expect(validateRoomSettings({ ...SETTINGS, commission: -1 }, index).ok).toBe(false);
    expect(validateRoomSettings({ ...SETTINGS, commission: 200_000 }, index).ok).toBe(false);
    expect(validateRoomSettings({ ...SETTINGS, slippageBps: 101 }, index).ok).toBe(false);
  });
});

describe('protocol (plan M12)', () => {
  it('parses brackets and cancel, and refuses bad levels', () => {
    expect(parseClientMessage(JSON.stringify({ type: 'brackets', seq: 3, stopLoss: 95.5, takeProfit: null }))).toEqual({ type: 'brackets', seq: 3, stopLoss: 95.5, takeProfit: null });
    expect(parseClientMessage(JSON.stringify({ type: 'cancel', seq: 4 }))).toEqual({ type: 'cancel', seq: 4 });
    expect(parseClientMessage(JSON.stringify({ type: 'brackets', seq: 3, stopLoss: -1, takeProfit: null }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ type: 'brackets', seq: 3, stopLoss: 'x', takeProfit: null }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ type: 'brackets', seq: 3, stopLoss: 90 }))).toBeNull();
  });
});

describe('next-open orders in a room', () => {
  it('acks the order, then fills it at the next open from the clock with seq −1', () => {
    let log = running([[101, 101, 101, 101], ...flat(400, 101)], { fillModel: 'next_open' });
    log = step(log, { type: 'order', playerId: A, seq: 0, order: { side: 'buy', units: 5 } }, START + 100);
    expect(ofType(log.effects, 'ack', A)).toEqual([{ type: 'ack', seq: 0 }]);
    expect(ofType(log.effects, 'fill', A)).toHaveLength(0);
    expect(ofType(log.effects, 'you', A)[0].you.queued).toMatchObject({ side: 'buy', units: 5 });

    log = step(log, { type: 'tick' }, START + 1000);
    const fill = ofType(log.effects, 'fill', A)[0];
    expect(fill).toMatchObject({ seq: -1, fill: { price: 101, trigger: 'next_open', units: 5 } });
    // Session time, not the real date (MP9).
    expect(fill.fill.time).toBe(60 * HISTORY);
    expect(ofType(log.effects, 'fill', B)).toHaveLength(0);
  });

  it('cancels on request, and rejects a cancel when nothing is waiting', () => {
    let log = running(flat(400), { fillModel: 'next_open' });
    log = step(log, { type: 'order', playerId: A, seq: 0, order: { side: 'buy', units: 5 } }, START + 100);
    log = step(log, { type: 'cancel', playerId: A, seq: 1 }, START + 200);
    expect(ofType(log.effects, 'ack', A)).toEqual([{ type: 'ack', seq: 1 }]);
    expect(player(log.state, A).match?.queued).toBeNull();
    log = step(log, { type: 'cancel', playerId: A, seq: 2 }, START + 300);
    expect(ofType(log.effects, 'reject', A)[0]).toMatchObject({ seq: 2, code: 'nothing_queued' });
  });

  it('tells the player when the open cancels their order', () => {
    let log = running([[150, 150, 150, 150], ...flat(400, 150)], { fillModel: 'next_open' });
    log = step(log, { type: 'order', playerId: A, seq: 0, order: { side: 'buy', units: 1000 } }, START + 100);
    log = step(log, { type: 'tick' }, START + 1000);
    expect(ofType(log.effects, 'cancelled', A)[0].order).toMatchObject({ reason: 'insufficient_balance', units: 1000 });
  });
});

describe('stop-loss / take-profit in a room', () => {
  it('sets levels with an ack and fills the stop from the clock', () => {
    let log = running([[99, 99, 94, 96], ...flat(400, 96)]);
    log = step(log, { type: 'order', playerId: A, seq: 0, order: { side: 'buy', units: 10 } }, START + 100);
    log = step(log, { type: 'brackets', playerId: A, seq: 1, brackets: { stopLoss: 95, takeProfit: 110 } }, START + 200);
    expect(ofType(log.effects, 'ack', A)).toEqual([{ type: 'ack', seq: 1 }]);
    expect(ofType(log.effects, 'you', A)[0].you.position).toMatchObject({ stopLoss: 95, takeProfit: 110 });

    log = step(log, { type: 'tick' }, START + 1000);
    expect(ofType(log.effects, 'fill', A)[0]).toMatchObject({ seq: -1, fill: { price: 95, trigger: 'stop_loss' } });
    expect(player(log.state, A).match?.positions).toHaveLength(0);
  });

  it('rejects levels on the wrong side of the price', () => {
    let log = running(flat(400));
    log = step(log, { type: 'order', playerId: A, seq: 0, order: { side: 'buy', units: 10 } }, START + 100);
    log = step(log, { type: 'brackets', playerId: A, seq: 1, brackets: { stopLoss: 101, takeProfit: null } }, START + 200);
    expect(ofType(log.effects, 'reject', A)[0]).toMatchObject({ seq: 1, code: 'invalid_stop' });
  });

  it('never shows the opponent your levels or queued order (MP8)', () => {
    let log = running(flat(400), { fillModel: 'next_open' });
    log = step(log, { type: 'order', playerId: A, seq: 0, order: { side: 'buy', units: 10 } }, START + 100);
    const seen = JSON.stringify(ofType(log.effects, 'opponent', B));
    expect(seen).not.toMatch(/queued|stopLoss|takeProfit|units/);
  });
});

describe('duel client (plan M12)', () => {
  const start = { type: 'start' as const, history: session(flat(1)).candles, cursor: 2, startCursor: 2, tickMs: 1000, durationMs: 300_000, startedAt: 0, serverNow: 0 };

  it('clears a pending seq on ack and keeps the latest server cancel', () => {
    let d = reduceDuel(null, start)!;
    d = { ...d, pending: [4] };
    d = reduceDuel(d, { type: 'ack', seq: 4 })!;
    expect(d.pending).toEqual([]);
    const order = { id: 'q', side: 'buy' as const, units: 1, placedAt: 120, cancelledAt: 180, reason: 'insufficient_balance' as const };
    expect(reduceDuel(d, { type: 'cancelled', order })?.lastCancel).toEqual(order);
  });

  it('mirrors the queued order so the trade panel shows it', () => {
    const d = startDuel(start, null);
    const you = { status: 'live' as const, balance: 100_000, equity: 100_000, returnPct: 0, drawdownPct: 0, position: null, fills: [], trades: 0, closed: [], elapsedMs: 0, lastSeq: 0, queued: { id: 'q', side: 'sell' as const, units: 2, placedAt: 120 } };
    expect(mirrorMatch({ ...d, you }, { ...SETTINGS, fillModel: 'next_open' }, SYMBOL)).toMatchObject({ queued: you.queued, config: { fillModel: 'next_open' } });
  });

  it('shifts queued order times to session time', () => {
    expect(shiftQueued({ id: `TEST-${BASE + 120}-q1`, side: 'buy', units: 1, placedAt: BASE + 120 }, BASE)).toEqual({ id: 'TEST-120-q1', side: 'buy', units: 1, placedAt: 120 });
  });
});
