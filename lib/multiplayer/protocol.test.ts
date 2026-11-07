import { describe, expect, it } from 'vitest';
import { generateRoomCode, isRoomCode, normalizeRoomCode, roomLink, ROOM_CODE_ALPHABET } from './code';
import { MAX_MESSAGE_BYTES, cleanNickname, parseClientMessage } from './protocol';
import { tickMsFor, validateRoomSettings } from './settings';
import { decideWinner } from './winner';
import type { SymbolInfo } from '../types';

describe('room codes', () => {
  it('uses 6 characters with no look-alikes', () => {
    expect(ROOM_CODE_ALPHABET).not.toMatch(/[01OIL]/);
    let i = 0;
    const seq = [0, 0.2, 0.4, 0.6, 0.8, 0.9999];
    const code = generateRoomCode(() => seq[i++]);
    expect(code).toHaveLength(6);
    expect(isRoomCode(code)).toBe(true);
  });

  it('normalizes typed codes and rejects invalid ones', () => {
    expect(normalizeRoomCode(' k7m-2qx ')).toBe('K7M2QX');
    expect(normalizeRoomCode('K7M2Q')).toBeNull();
    expect(normalizeRoomCode('K7M2Q0')).toBeNull();
    expect(roomLink('https://a.example/', 'K7M2QX')).toBe('https://a.example/play/K7M2QX');
  });
});

describe('parseClientMessage', () => {
  const ok = (m: unknown) => parseClientMessage(JSON.stringify(m));

  it('accepts well-formed messages', () => {
    expect(ok({ type: 'hello', clientId: 'abcd1234', nickname: '  Ann   Lee ' })).toEqual({ type: 'hello', clientId: 'abcd1234', nickname: 'Ann Lee' });
    expect(ok({ type: 'order', seq: 3, order: { side: 'buy', percent: 25 } })).toEqual({ type: 'order', seq: 3, order: { side: 'buy', percent: 25 } });
    expect(ok({ type: 'order', seq: 0, order: { side: 'sell', units: 2 } })).toEqual({ type: 'order', seq: 0, order: { side: 'sell', units: 2 } });
    expect(ok({ type: 'close', seq: 1 })).toEqual({ type: 'close', seq: 1 });
    expect(ok({ type: 'ready', extra: 1 })).toEqual({ type: 'ready' });
  });

  it('rejects malformed, oversized and unknown messages', () => {
    expect(parseClientMessage('not json')).toBeNull();
    expect(parseClientMessage('[]')).toBeNull();
    expect(parseClientMessage(123)).toBeNull();
    expect(parseClientMessage(JSON.stringify({ type: 'ready', pad: 'x'.repeat(MAX_MESSAGE_BYTES) }))).toBeNull();
    expect(ok({ type: 'nope' })).toBeNull();
    expect(ok({ type: 'hello', clientId: 'short', nickname: 'Ann' })).toBeNull();
    expect(ok({ type: 'hello', clientId: 'abcd1234', nickname: '   ' })).toBeNull();
    expect(ok({ type: 'hello', clientId: 'abcd1234', nickname: 'Ann', token: 'bad token' })).toBeNull();
    expect(ok({ type: 'order', seq: 1, order: { side: 'buy', units: 1, percent: 5 } })).toBeNull();
    expect(ok({ type: 'order', seq: 1, order: { side: 'buy', percent: 101 } })).toBeNull();
    expect(ok({ type: 'order', seq: 1, order: { side: 'buy', units: -1 } })).toBeNull();
    expect(ok({ type: 'order', seq: 1, order: { side: 'hold', units: 1 } })).toBeNull();
    expect(ok({ type: 'order', seq: 1.5, order: { side: 'buy', units: 1 } })).toBeNull();
    expect(ok({ type: 'close' })).toBeNull();
  });

  it('cleans nicknames', () => {
    expect(cleanNickname('a\u0000b\nc')).toBe('abc');
    expect(cleanNickname('Ann\tLee')).toBe('AnnLee');
    expect(cleanNickname('x'.repeat(50))).toHaveLength(20);
    expect(cleanNickname(5)).toBeNull();
  });
});

describe('validateRoomSettings', () => {
  const index = [{ symbol: 'NQ=F' }] as SymbolInfo[];
  const good = { symbol: 'NQ=F', durationMin: 10, speed: 2, startingBalance: 100_000, maxDrawdownPct: 5 };

  it('accepts valid settings and rejects each bad field', () => {
    expect(validateRoomSettings(good, index)).toEqual({ ok: true, settings: good });
    for (const bad of [{ symbol: 'XYZ' }, { durationMin: 7 }, { speed: 3 }, { startingBalance: 10 }, { maxDrawdownPct: 0 }, { startingBalance: Number.NaN }]) {
      expect(validateRoomSettings({ ...good, ...bad }, index).ok).toBe(false);
    }
    expect(validateRoomSettings(null, index).ok).toBe(false);
  });

  it('derives the tick interval from the speed (plan D1)', () => {
    expect([tickMsFor(1), tickMsFor(2), tickMsFor(5)]).toEqual([1000, 500, 200]);
  });
});

describe('decideWinner (MP7)', () => {
  it('higher equity wins, out loses to live, equal to the cent is a draw', () => {
    expect(decideWinner([{ id: 'a', out: false, equity: 101 }, { id: 'b', out: false, equity: 100 }])).toBe('a');
    expect(decideWinner([{ id: 'a', out: true, equity: 200 }, { id: 'b', out: false, equity: 50 }])).toBe('b');
    expect(decideWinner([{ id: 'a', out: false, equity: 100.001 }, { id: 'b', out: false, equity: 100.004 }])).toBe('draw');
    expect(decideWinner([{ id: 'a', out: true, equity: 90 }, { id: 'b', out: true, equity: 95 }])).toBe('b');
    expect(decideWinner([{ id: 'a', out: false, equity: 1 }])).toBe('a');
    expect(decideWinner([])).toBeNull();
  });
});
