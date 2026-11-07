import { describe, expect, it } from 'vitest';
import { defaultBalanceFor, defaultMatchConfig, fromUtcInputValue, sessionSpecFor, toUtcInputValue } from './session';
import type { SymbolInfo } from './types';

const info = (currency: string, lotStep = 0.01): SymbolInfo => ({
  symbol: 'X',
  name: 'X',
  assetClass: 'index',
  currency,
  dataFile: 'X.csv',
  barsAvailable: 1,
  firstTime: 0,
  lastTime: 0,
  lotStep,
  priceDecimals: 2,
});

describe('sessionSpecFor (plan D2)', () => {
  it('sizes a 10-minute match for 5x plus 20% headroom, with 300 history candles', () => {
    expect(sessionSpecFor(10 * 60 * 1000)).toEqual({ playable: 3600, history: 300 });
    expect(sessionSpecFor(5 * 60 * 1000).playable).toBe(1800);
  });
});

describe('defaults', () => {
  it('balance follows the quote currency', () => {
    expect(defaultBalanceFor('USD')).toBe(100_000);
    expect(defaultBalanceFor('INR')).toBe(1_000_000);
    expect(defaultBalanceFor('JPY')).toBe(100_000);
  });

  it('builds a config from the symbol, with overrides', () => {
    expect(defaultMatchConfig(info('INR'))).toEqual({ symbol: 'X', currency: 'INR', interval: '1m', durationMs: 600_000, startingBalance: 1_000_000, maxDrawdownPct: 5, lotStep: 0.01 });
    expect(defaultMatchConfig(info('USD', 1), { durationMs: 300_000, maxDrawdownPct: 10 })).toMatchObject({ durationMs: 300_000, maxDrawdownPct: 10, startingBalance: 100_000, lotStep: 1 });
  });
});

describe('UTC datetime-local values', () => {
  it('round-trips', () => {
    expect(toUtcInputValue(1791293400)).toBe('2026-10-06T13:30');
    expect(fromUtcInputValue('2026-10-06T13:30')).toBe(1791293400);
  });

  it.each(['', '2026-10-06', '2026-10-06T25:00', '2026-02-31T10:00', '2026-10-06T13:60', 'nonsense'])('rejects %j', (v) => {
    expect(fromUtcInputValue(v)).toBeNull();
  });
});
