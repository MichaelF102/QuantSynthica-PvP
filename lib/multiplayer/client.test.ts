import { describe, expect, it, vi } from 'vitest';
import { CLIENT_ID_KEY, RoomRequestError, getClientId, loadNickname, loadToken, requestRoom, roomHost, roomHttpBase, saveNickname, saveToken, toRoomSettings } from './client';
import type { ServerMessage } from './protocol';
import { countdownLeft, initialRoomClient, me, opponentSeat, parseServerMessage, roomClientReducer, type RoomInfo } from './roomClient';

function memStorage(): Pick<Storage, 'getItem' | 'setItem'> & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}
const blocked: Pick<Storage, 'getItem' | 'setItem'> = {
  getItem: () => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('blocked');
  },
};

describe('roomHost', () => {
  it('strips the scheme and slashes, defaults to local wrangler in dev, and is off in production', () => {
    expect(roomHost('https://rooms.example.workers.dev/', false)).toBe('rooms.example.workers.dev');
    expect(roomHost('  ', true)).toBe('localhost:8787');
    expect(roomHost(undefined, false)).toBeNull();
    expect(roomHttpBase('localhost:8787')).toBe('http://localhost:8787');
    expect(roomHttpBase('rooms.example.workers.dev')).toBe('https://rooms.example.workers.dev');
  });
});

describe('identity storage', () => {
  it('creates a stable client id and survives blocked storage', () => {
    const s = memStorage();
    const id = getClientId(s);
    expect(id).toMatch(/^[a-f0-9]{24}$/);
    expect(getClientId(s)).toBe(id);
    expect(s.data.get(CLIENT_ID_KEY)).toBe(id);
    expect(getClientId(blocked)).toMatch(/^[a-f0-9]{24}$/);
  });

  it('keeps nicknames and per-room tokens; tokens expire after 48 h', () => {
    const s = memStorage();
    expect(loadNickname(s)).toBeNull();
    saveNickname('Ann', s);
    expect(loadNickname(s)).toBe('Ann');
    saveToken('K7M2QX', 'tok-1', s, 1_000);
    saveToken('ABCDEF', 'tok-2', s, 2_000);
    expect(loadToken('K7M2QX', s, 5_000)).toBe('tok-1');
    expect(loadToken('K7M2QX', s, 1_000 + 48 * 3600_000)).toBeUndefined();
    saveToken('GHJKMN', 'tok-3', s, 1_500 + 48 * 3600_000); // prunes K7M2QX
    expect(Object.keys(JSON.parse(s.data.get('qs-pvp:room-tokens')!))).toEqual(['ABCDEF', 'GHJKMN']);
    expect(loadToken('K7M2QX', blocked)).toBeUndefined();
    expect(() => saveToken('K7M2QX', 't', blocked)).not.toThrow();
  });
});

describe('requestRoom', () => {
  const form = { symbol: 'NQ=F', durationMin: 10 as const, balanceText: '100,000', balanceEdited: false, drawdownText: ' 5 ', fillModel: 'close' as const, commissionText: '0', slippageText: '' };
  const settings = toRoomSettings(form, 2);

  it('converts the setup form', () => {
    expect(settings).toEqual({ symbol: 'NQ=F', durationMin: 10, speed: 2, startingBalance: 100_000, maxDrawdownPct: 5 });
  });

  it('carries the fill model and costs (plan M12)', () => {
    expect(toRoomSettings({ ...form, fillModel: 'next_open', commissionText: '2', slippageText: '1.5' }, 1)).toMatchObject({ fillModel: 'next_open', commission: 2, slippageBps: 1.5 });
  });

  it('posts the settings and returns the code', async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ code: 'K7M2QX' }), { status: 201 }));
    await expect(requestRoom('localhost:8787', settings, f)).resolves.toBe('K7M2QX');
    expect(f).toHaveBeenCalledWith('http://localhost:8787/rooms', expect.objectContaining({ method: 'POST', body: JSON.stringify({ settings }) }));
  });

  it('turns server and network failures into readable errors', async () => {
    const bad = vi.fn(async () => new Response(JSON.stringify({ error: 'Choose a speed of 1x, 2x or 5x.' }), { status: 400 }));
    await expect(requestRoom('h', settings, bad)).rejects.toThrow('Choose a speed');
    const html = vi.fn(async () => new Response('<html>', { status: 502 }));
    await expect(requestRoom('h', settings, html)).rejects.toThrow('HTTP 502');
    const down = vi.fn(async () => Promise.reject(new TypeError('fetch failed')));
    await expect(requestRoom('h', settings, down)).rejects.toBeInstanceOf(RoomRequestError);
  });
});

describe('roomClientReducer', () => {
  const room: RoomInfo = {
    type: 'room',
    code: 'K7M2QX',
    phase: 'countdown',
    settings: { symbol: 'NQ=F', durationMin: 10, speed: 1, startingBalance: 100_000, maxDrawdownPct: 5 },
    symbol: { symbol: 'NQ=F', name: 'Nasdaq', currency: 'USD', lotStep: 0.01, priceDecimals: 2, assetClass: 'futures' },
    players: [
      { id: 'a', nickname: 'Ann', ready: true, connected: true, status: 'live' },
      { id: 'b', nickname: 'Bo', ready: true, connected: true, status: 'live' },
    ],
    countdownEndsAt: 13_000,
    serverNow: 10_000,
  };
  const msg = (m: ServerMessage, now = 9_000) => ({ kind: 'msg' as const, msg: m, now });

  it('tracks the seat, the room and the server clock offset', () => {
    let s = roomClientReducer(initialRoomClient, msg({ type: 'welcome', you: 'a', token: 't' }));
    s = roomClientReducer(s, msg(room, 9_000));
    expect(s.clockOffset).toBe(1_000);
    expect(me(s)?.nickname).toBe('Ann');
    expect(opponentSeat(s)?.nickname).toBe('Bo');
    // Local 9 000 ≈ server 10 000 → 3 s left; local 10 100 → 2 s left (ceil).
    expect(countdownLeft(s, 9_000)).toBe(3);
    expect(countdownLeft(s, 10_100)).toBe(2);
    expect(countdownLeft(roomClientReducer(s, msg({ ...room, phase: 'lobby', countdownEndsAt: null })), 9_000)).toBeNull();
  });

  it('separates fatal errors from notices, and a fatal error freezes the status', () => {
    const full = roomClientReducer(initialRoomClient, msg({ type: 'error', code: 'room_full', message: 'x' }));
    expect(full.fatal?.code).toBe('room_full');
    expect(roomClientReducer(full, { kind: 'status', status: 'open' }).status).toBe('connecting');
    const noisy = roomClientReducer(initialRoomClient, msg({ type: 'error', code: 'rate_limited', message: 'Too many messages. Slow down.' }));
    expect(noisy).toMatchObject({ fatal: null, notice: 'Too many messages. Slow down.' });
    expect(roomClientReducer(noisy, { kind: 'clear_notice' }).notice).toBeNull();
  });

  it('parses only JSON objects with a type', () => {
    expect(parseServerMessage('{"type":"pong","serverNow":1}')).toEqual({ type: 'pong', serverNow: 1 });
    expect(parseServerMessage('nope')).toBeNull();
    expect(parseServerMessage('{"x":1}')).toBeNull();
    expect(parseServerMessage(new ArrayBuffer(2))).toBeNull();
  });
});
