import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_SYMBOLS, addSymbols, dataAgeHours, decide, findPython, main, readSidecars, symbolsFor } from './dev-data.mjs';

const tmpData = (files = {}) => {
  const root = mkdtempSync(join(tmpdir(), 'qs-dev-data-'));
  const dir = join(root, 'public', 'data');
  mkdirSync(dir, { recursive: true });
  for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), typeof body === 'string' ? body : JSON.stringify(body));
  return { root, dir };
};

describe('dev-data helpers', () => {
  it('reads sidecars and skips broken ones', () => {
    const { dir } = tmpData({ 'NQ_F.meta.json': { symbol: 'NQ=F', updatedAt: 100 }, 'bad.meta.json': '{nope', 'x.csv': 'time' });
    expect(readSidecars(dir)).toEqual([{ symbol: 'NQ=F', updatedAt: 100 }]);
    expect(readSidecars(join(dir, 'missing'))).toEqual([]);
  });

  it('refreshes the symbols already present, or the v1 set on a fresh checkout', () => {
    expect(symbolsFor([{ symbol: '^NSEI' }, { symbol: 'NQ=F' }, { symbol: 'NQ=F' }])).toEqual(['^NSEI', 'NQ=F']);
    expect(symbolsFor([])).toEqual(DEFAULT_SYMBOLS);
  });

  it('measures the age of the stalest symbol', () => {
    const now = 100 * 3600 * 1000;
    expect(dataAgeHours([{ updatedAt: 99 * 3600 }, { updatedAt: 90 * 3600 }], now)).toBe(10);
    expect(dataAgeHours([], now)).toBe(Infinity);
  });

  it('decides what to do', () => {
    expect(decide({ ageHours: 1, indexExists: true })).toBe('skip');
    expect(decide({ ageHours: 13, indexExists: true })).toBe('fetch');
    expect(decide({ ageHours: Infinity, indexExists: false })).toBe('fetch');
    expect(decide({ ageHours: 1, indexExists: false })).toBe('index');
    expect(decide({ ageHours: 1, indexExists: true, force: true })).toBe('fetch');
    expect(decide({ ageHours: 99, indexExists: true, skip: true })).toBe('skip');
    expect(decide({ ageHours: 5, indexExists: true, maxAgeHours: 4 })).toBe('fetch');
  });

  it('finds a Python that has the packages, preferring the venv', () => {
    const { root } = tmpData();
    const run = vi.fn((py) => ({ status: py === 'python3' ? 0 : 1 }));
    expect(findPython(root, run)).toBe('python3');
    expect(findPython(root, () => ({ status: 1 }))).toBeNull();
  });

  it('starts without touching anything when the data is fresh or skipped', () => {
    const { root } = tmpData({ 'index.json': '[]', 'catalog.json': '[]', 'NQ_F.meta.json': { symbol: 'NQ=F', updatedAt: Date.now() / 1000 } });
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(main({ root, argv: [], env: {} })).toBe(0);
    expect(main({ root, argv: [], env: { QS_SKIP_DATA: '1' } })).toBe(0);
    expect(log.mock.calls.flat().join(' ')).toMatch(/fresh.*Skipping/s);
    log.mockRestore();
  });
});

describe('addSymbols', () => {
  it('reads the symbols after --add, up to the next flag', () => {
    expect(addSymbols([])).toEqual([]);
    expect(addSymbols(['--add'])).toEqual([]);
    expect(addSymbols(['--add', 'RELIANCE.NS', 'AAPL'])).toEqual(['RELIANCE.NS', 'AAPL']);
    expect(addSymbols(['--add', 'AAPL', '--force', 'X'])).toEqual(['AAPL']);
  });
});
