import { beforeEach, describe, expect, it } from 'vitest';
import { DataError } from './data';
import { LAST_SETUP_KEY, chooseSession, defaultForm, loadLastSetup, parseAmount, saveLastSetup, toMatchConfig, validateSetup, withSymbol, type SetupForm } from './setup';
import type { Candle, SymbolInfo } from './types';

const info = (symbol: string, currency: string, lotStep = 0.01): SymbolInfo => ({ symbol, name: symbol, assetClass: 'index', currency, dataFile: 'x.csv', barsAvailable: 0, firstTime: 0, lastTime: 0, lotStep, priceDecimals: 2 });
const INDEX = [info('NQ=F', 'USD'), info('^NSEI', 'INR')];
const series = (n: number): Candle[] => Array.from({ length: n }, (_, i) => ({ time: 60 * (i + 1), open: 1, high: 2, low: 0.5, close: 1, volume: 0 }));

beforeEach(() => localStorage.clear());

describe('parseAmount', () => {
  it.each([
    ['100000', 100_000],
    ['1,00,000', 100_000],
    ['100 000', 100_000],
    ['2500.50', 2500.5],
  ])('%s -> %d', (t, v) => expect(parseAmount(t)).toBe(v));

  it.each(['', 'abc', '-5', '1e5', '$100', '1.2.3'])('rejects %j', (t) => expect(parseAmount(t)).toBeNaN());
});

describe('defaultForm', () => {
  it('starts from the first symbol and CLAUDE.md defaults', () => {
    expect(defaultForm(INDEX)).toEqual({ symbol: 'NQ=F', durationMin: 10, balanceText: '100000', balanceEdited: false, drawdownText: '5', fillModel: 'close', commissionText: '0', slippageText: '0' });
  });

  it('restores the last setup, including a custom balance in the same currency', () => {
    const f = defaultForm(INDEX, { symbol: '^NSEI', durationMin: 15, balance: 500_000, balanceCurrency: 'INR', maxDrawdownPct: 3 });
    expect(f).toEqual({ symbol: '^NSEI', durationMin: 15, balanceText: '500000', balanceEdited: true, drawdownText: '3', fillModel: 'close', commissionText: '0', slippageText: '0' });
  });

  it('ignores a remembered balance in another currency and an unknown symbol', () => {
    const f = defaultForm(INDEX, { symbol: 'GONE', durationMin: 5, balance: 500_000, balanceCurrency: 'INR', maxDrawdownPct: 3 });
    expect(f).toMatchObject({ symbol: 'NQ=F', balanceText: '100000', balanceEdited: false });
  });
});

describe('withSymbol', () => {
  const base = defaultForm(INDEX);
  it('a default balance follows the new currency', () => {
    expect(withSymbol(base, INDEX[1])).toMatchObject({ symbol: '^NSEI', balanceText: '1000000' });
  });
  it('a typed balance is kept', () => {
    expect(withSymbol({ ...base, balanceText: '42000', balanceEdited: true }, INDEX[1]).balanceText).toBe('42000');
  });
});

describe('validateSetup', () => {
  const ok = defaultForm(INDEX);
  const v = (f: Partial<SetupForm>) => validateSetup({ ...ok, ...f }, INDEX);
  it('accepts the defaults', () => expect(v({})).toEqual({}));
  it('checks the symbol', () => expect(v({ symbol: 'X' }).symbol).toBeDefined());
  it.each(['', 'abc', '999', '10000001'])('rejects balance %j', (b) => expect(v({ balanceText: b }).balance).toBeDefined());
  it.each(['', 'x', '0', '0.5', '51'])('rejects drawdown %j', (d) => expect(v({ drawdownText: d }).drawdown).toBeDefined());
  it.each(['1', '2.5', '50'])('accepts drawdown %j', (d) => expect(v({ drawdownText: d }).drawdown).toBeUndefined());
});

describe('toMatchConfig', () => {
  it('builds the engine config', () => {
    const f = { ...withSymbol(defaultForm(INDEX), INDEX[1]), durationMin: 5 as const, balanceText: '2,50,000', drawdownText: '2.5' };
    expect(toMatchConfig(f, INDEX[1])).toEqual({ symbol: '^NSEI', currency: 'INR', interval: '1m', durationMs: 300_000, startingBalance: 250_000, maxDrawdownPct: 2.5, lotStep: 0.01 });
  });
});

describe('chooseSession', () => {
  const config = toMatchConfig(defaultForm(INDEX), INDEX[0]); // 10 min: 3,600 playable + 300 history

  it('gives a full session when the file is long enough', () => {
    const s = chooseSession(series(10_000), config, () => 0.5);
    expect(s).toMatchObject({ startCursor: 299, limitedData: false });
    expect(s.candles).toHaveLength(3900);
  });

  it('caps a short file and flags limited data, if the timer can still be filled at 1x', () => {
    const s = chooseSession(series(1000), config);
    expect(s.limitedData).toBe(true);
    expect(s.candles).toHaveLength(1000);
  });

  it('refuses a file too short to fill the timer at 1x', () => {
    expect(() => chooseSession(series(800), config)).toThrow(DataError);
  });
});

describe('last setup', () => {
  const config = toMatchConfig({ ...defaultForm(INDEX), durationMin: 15, drawdownText: '4' }, INDEX[0]);

  it('round-trips', () => {
    expect(saveLastSetup(config)).toBe(true);
    expect(loadLastSetup()).toEqual({ symbol: 'NQ=F', durationMin: 15, balance: 100_000, balanceCurrency: 'USD', maxDrawdownPct: 4, fillModel: 'close', commission: 0, slippageBps: 0 });
  });

  it('ignores junk and never throws', () => {
    localStorage.setItem(LAST_SETUP_KEY, '{bad');
    expect(loadLastSetup()).toBeNull();
    localStorage.setItem(LAST_SETUP_KEY, JSON.stringify({ symbol: 'NQ=F', durationMin: 7, balance: 1, balanceCurrency: 'USD', maxDrawdownPct: 5 }));
    expect(loadLastSetup()).toBeNull();
    const broken = { getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('x'); } };
    expect(loadLastSetup(broken)).toBeNull();
    expect(saveLastSetup(config, broken)).toBe(false);
    expect(saveLastSetup(config, null)).toBe(false);
  });
});

describe('setupFromQuery', async () => {
  const { setupFromQuery } = await import('./setup');
  const last = { symbol: 'NQ=F', durationMin: 15, balance: 50_000, balanceCurrency: 'USD', maxDrawdownPct: 3 } as const;
  const cfg = { symbol: '^NSEI', currency: 'INR', interval: '1m' as const, durationMs: 5 * 60_000, startingBalance: 2_000_000, maxDrawdownPct: 8, lotStep: 0.01 };
  const find = (id: string) => (id === 'r1' ? cfg : null);

  it('repeats a saved match with ?from=', () => {
    expect(setupFromQuery('?from=r1', last, find)).toEqual({ symbol: '^NSEI', durationMin: 5, balance: 2_000_000, balanceCurrency: 'INR', maxDrawdownPct: 8, fillModel: 'close', commission: 0, slippageBps: 0 });
  });
  it('falls back to the default time for an unusual saved duration', () => {
    expect(setupFromQuery('?from=r1', null, () => ({ ...cfg, durationMs: 7 * 60_000 }))?.durationMin).toBe(10);
  });
  it('picks only the symbol with ?symbol=, resetting a mismatched balance currency', () => {
    expect(setupFromQuery('?symbol=%5ENSEI', last, find)).toEqual({ ...last, symbol: '^NSEI', balanceCurrency: '' });
    expect(setupFromQuery('?symbol=NQ%3DF', last, find)).toEqual(last);
    expect(setupFromQuery('?symbol=AAPL', null, find)).toMatchObject({ symbol: 'AAPL', durationMin: 10, maxDrawdownPct: 5 });
  });
  it('ignores an unknown result or an empty query', () => {
    expect(setupFromQuery('?from=nope', last, find)).toEqual(last);
    expect(setupFromQuery('', last, find)).toBe(last);
    expect(setupFromQuery('?symbol=', null, find)).toBeNull();
  });
});

describe('execution settings (plan M12)', () => {
  const base = defaultForm(INDEX);
  const info = INDEX[0];

  it('defaults to close fills and no costs, which leave the config unchanged', () => {
    expect(toMatchConfig(base, info)).not.toHaveProperty('fillModel');
    expect(toMatchConfig(base, info)).not.toHaveProperty('commission');
    expect(toMatchConfig(base, info)).not.toHaveProperty('slippageBps');
  });

  it('carries the fill model and costs into the config', () => {
    const c = toMatchConfig({ ...base, fillModel: 'next_open', commissionText: '2.5', slippageText: '3' }, info);
    expect(c).toMatchObject({ fillModel: 'next_open', commission: 2.5, slippageBps: 3 });
  });

  it('validates commission and slippage, with empty meaning 0', () => {
    expect(validateSetup({ ...base, commissionText: '', slippageText: '' }, INDEX)).toEqual({});
    expect(validateSetup({ ...base, commissionText: 'abc' }, INDEX).commission).toBeDefined();
    expect(validateSetup({ ...base, commissionText: '20000' }, INDEX).commission).toBeDefined();
    expect(validateSetup({ ...base, balanceText: '5000', commissionText: '5000' }, INDEX).commission).toMatch(/smaller than the balance/);
    expect(validateSetup({ ...base, slippageText: '-1' }, INDEX).slippage).toBeDefined();
    expect(validateSetup({ ...base, slippageText: '101' }, INDEX).slippage).toBeDefined();
  });

  it('remembers them, keeping a commission only for the same currency', () => {
    const c = toMatchConfig({ ...base, fillModel: 'next_open', commissionText: '4', slippageText: '2' }, info);
    expect(saveLastSetup(c)).toBe(true);
    const last = loadLastSetup();
    expect(last).toMatchObject({ fillModel: 'next_open', commission: 4, slippageBps: 2 });
    expect(defaultForm(INDEX, last)).toMatchObject({ fillModel: 'next_open', commissionText: '4', slippageText: '2' });
    expect(defaultForm(INDEX, { ...last!, balanceCurrency: 'INR' })).toMatchObject({ commissionText: '0', slippageText: '2' });
  });
});
