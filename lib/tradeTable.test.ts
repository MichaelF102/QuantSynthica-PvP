import { describe, expect, it } from 'vitest';
import { csvFileName, nextSort, sortRows, tableTime, tradeRows, tradesCsv } from './tradeTable';
import type { Trade } from './types';

const T0 = Date.UTC(2026, 9, 16) / 1000; // 2026-10-16 00:00 UTC
const tr = (id: string, side: Trade['side'], units: number, entry: number, exit: number, pnl: number, openedAt: number, closedAt: number): Trade => ({ id, symbol: 'NQ=F', side, units, entry, exit, pnl, openedAt, closedAt });
const TRADES = [tr('a', 'buy', 2, 100, 98, -4, T0 + 60, T0 + 660), tr('b', 'sell', 1, 50, 45, 5, T0 + 700, T0 + 900), tr('c', 'buy', 1, 10, 11, 1, T0 + 1000, T0 + 1060)];

describe('tradeRows', () => {
  it('adds number, notional, move, P&L % and hold', () => {
    expect(tradeRows(TRADES)[0]).toMatchObject({ n: 1, notional: 200, move: -2, pnlPct: -2, heldSec: 600 });
    expect(tradeRows([tr('z', 'buy', 0, 1, 1, 0, 0, 0)])[0].pnlPct).toBeNull();
  });
});

describe('sorting', () => {
  const rows = tradeRows(TRADES);
  it('sorts by a column in either direction, ties by trade number', () => {
    expect(sortRows(rows, 'pnl', 'desc').map((r) => r.id)).toEqual(['b', 'c', 'a']);
    expect(sortRows(rows, 'pnl', 'asc').map((r) => r.id)).toEqual(['a', 'c', 'b']);
    expect(sortRows(rows, 'side', 'asc').map((r) => r.id)).toEqual(['a', 'c', 'b']);
    expect(sortRows(rows, 'heldSec', 'desc')[0].id).toBe('a');
  });
  it('toggles the same column and starts new columns sensibly', () => {
    expect(nextSort({ key: 'n', dir: 'asc' }, 'n')).toEqual({ key: 'n', dir: 'desc' });
    expect(nextSort({ key: 'n', dir: 'asc' }, 'pnl')).toEqual({ key: 'pnl', dir: 'desc' });
    expect(nextSort({ key: 'pnl', dir: 'desc' }, 'openedAt')).toEqual({ key: 'openedAt', dir: 'asc' });
  });
});

describe('tableTime', () => {
  it('drops the date on the session day and keeps it otherwise', () => {
    expect(tableTime(T0 + 16 * 3600 + 14 * 60, T0)).toBe('16:14');
    expect(tableTime(T0 + 86_400 + 60, T0)).toBe('10-17 00:01');
  });
});

describe('CSV', () => {
  it('writes a header and one row per trade, in UTC', () => {
    const csv = tradesCsv(TRADES, { symbol: 'NQ=F', currency: 'USD' });
    const lines = csv.trim().split('\n');
    expect(lines[0]).toBe('#,symbol,side,units,entry,exit,notional,pnl_usd,pnl_pct,opened_utc,closed_utc,held_minutes');
    expect(lines[1]).toBe('1,NQ=F,long,2,100,98,200.00,-4.00,-2.0000,2026-10-16T00:01:00Z,2026-10-16T00:11:00Z,10');
    expect(lines).toHaveLength(4);
  });
  it('quotes cells with commas and is just a header with no trades', () => {
    expect(tradesCsv([{ ...TRADES[0], symbol: 'x' }], { symbol: 'A,B', currency: 'INR' }).split('\n')[1]).toContain('"A,B"');
    expect(tradesCsv([], { symbol: 'X', currency: 'USD' }).trim().split('\n')).toHaveLength(1);
  });
  it('builds a safe file name', () => {
    expect(csvFileName('^NSEI', T0)).toBe('_NSEI_2026-10-16_trades.csv');
    expect(csvFileName('NQ=F', T0)).toBe('NQ_F_2026-10-16_trades.csv');
  });
});
