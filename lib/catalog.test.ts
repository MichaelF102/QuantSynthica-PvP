import { describe, expect, it } from 'vitest';
import { NO_PICKER_FILTER, addDataCommand, matchRank, parseCatalog, pickerResults, rankMatches, type CatalogEntry } from './catalog';
import { DataError } from './data';
import type { SymbolInfo } from './types';

const row = (s: string, n: string, a: string, c: string, e = 'X') => ({ s, n, a, c, e });
const info = (symbol: string, name: string, assetClass: SymbolInfo['assetClass'], currency: string): SymbolInfo => ({
  symbol, name, assetClass, currency, dataFile: 'x.csv', barsAvailable: 1, firstTime: 0, lastTime: 1, lotStep: 1, priceDecimals: 2,
});

const CATALOG: CatalogEntry[] = parseCatalog([
  row('AAPL', 'Apple Inc.', 'stock', 'USD', 'NASDAQ'),
  row('RELIANCE.NS', 'Reliance Industries Limited', 'stock', 'INR', 'NSE'),
  row('RELINFRA.NS', 'Reliance Infrastructure Limited', 'stock', 'INR', 'NSE'),
  row('TCS.NS', 'Tata Consultancy Services Limited', 'stock', 'INR', 'NSE'),
  row('^NSEI', 'Nifty 50', 'index', 'INR', 'NSE'),
  row('^GSPC', 'S&P 500', 'index', 'USD', 'S&P DJI'),
  row('EURUSD=X', 'EUR/USD', 'forex', 'USD', 'FX'),
  row('MAPPLE', 'Maple Leaf', 'stock', 'USD', 'NYSE'),
]);
const INDEX = [info('^NSEI', 'Nifty 50', 'index', 'INR'), info('AAPL', 'Apple Inc.', 'stock', 'USD')];

describe('parseCatalog', () => {
  it('maps short keys and keeps valid rows', () => {
    expect(CATALOG[0]).toEqual({ symbol: 'AAPL', name: 'Apple Inc.', assetClass: 'stock', currency: 'USD', exchange: 'NASDAQ' });
    expect(CATALOG).toHaveLength(8);
  });
  it('skips malformed and duplicate rows', () => {
    const r = parseCatalog([null, 5, { s: 'A' }, row('B', '', 'stock', 'USD'), row('C', 'C', 'bond', 'USD'), row('D', 'D', 'stock', 'USD'), row('D', 'D2', 'stock', 'USD'), { s: 'E', n: 'E', a: 'index', c: 'USD' }]);
    expect(r.map((e) => e.symbol)).toEqual(['D', 'E']);
    expect(r[1].exchange).toBe('');
  });
  it('throws on a non-array', () => {
    expect(() => parseCatalog({})).toThrow(DataError);
  });
});

describe('matchRank', () => {
  const e = { symbol: 'RELIANCE.NS', name: 'Reliance Industries Limited' };
  it('ranks exact, prefix, name prefix, word prefix, contains', () => {
    expect(matchRank(e, 'reliance')).toBe(0); // short symbol
    expect(matchRank(e, 'reli')).toBe(1);
    expect(matchRank({ symbol: 'X1', name: 'Reliance' }, 'rel')).toBe(2);
    expect(matchRank(e, 'indus')).toBe(3);
    expect(matchRank(e, 'dustr')).toBe(4);
    expect(matchRank(e, 'zzz')).toBeNull();
    expect(matchRank({ symbol: '^NSEI', name: 'Nifty 50' }, 'nsei')).toBe(0);
  });
});

describe('rankMatches', () => {
  it('puts better matches first and keeps catalog order on ties', () => {
    expect(rankMatches(CATALOG, { ...NO_PICKER_FILTER, query: 'apple' }).map((e) => e.symbol)).toEqual(['AAPL', 'MAPPLE']);
    expect(rankMatches(CATALOG, { ...NO_PICKER_FILTER, query: 'reliance' }).map((e) => e.symbol)).toEqual(['RELIANCE.NS', 'RELINFRA.NS']);
  });
  it('filters by market and type', () => {
    expect(rankMatches(CATALOG, { region: 'India', type: 'Equity', query: '' }).map((e) => e.symbol)).toEqual(['RELIANCE.NS', 'RELINFRA.NS', 'TCS.NS']);
    expect(rankMatches(CATALOG, { region: 'US', type: 'Indices', query: '' }).map((e) => e.symbol)).toEqual(['^GSPC']);
    expect(rankMatches(CATALOG, { region: 'Global', type: 'All', query: '' }).map((e) => e.symbol)).toEqual(['EURUSD=X']);
  });
});

describe('pickerResults', () => {
  it('shows only ready symbols until a filter or search is set', () => {
    const r = pickerResults(INDEX, CATALOG, NO_PICKER_FILTER);
    expect(r.ready.map((i) => i.symbol)).toEqual(['^NSEI', 'AAPL']);
    expect(r.noData).toEqual([]);
    expect(r.noDataTotal).toBe(0);
  });
  it('separates playable and no-data tickers without duplicates', () => {
    const r = pickerResults(INDEX, CATALOG, { region: 'India', type: 'All', query: '' });
    expect(r.ready.map((i) => i.symbol)).toEqual(['^NSEI']);
    expect(r.noData.map((e) => e.symbol)).toEqual(['RELIANCE.NS', 'RELINFRA.NS', 'TCS.NS']);
  });
  it('caps the no-data list and reports the total', () => {
    const r = pickerResults(INDEX, CATALOG, { ...NO_PICKER_FILTER, type: 'Equity' }, 2);
    expect(r.noData).toHaveLength(2);
    expect(r.noDataTotal).toBe(4);
    expect(pickerResults(INDEX, CATALOG, { ...NO_PICKER_FILTER, query: 'a' }, -1).noData).toEqual([]);
  });
  it('works with an empty catalog', () => {
    expect(pickerResults(INDEX, [], { ...NO_PICKER_FILTER, query: 'app' })).toEqual({ ready: [INDEX[1]], noData: [], noDataTotal: 0 });
  });
});

describe('addDataCommand', () => {
  it('builds the npm command, quoting odd symbols', () => {
    expect(addDataCommand('RELIANCE.NS')).toBe('npm run data:add -- RELIANCE.NS');
    expect(addDataCommand('NQ=F')).toBe('npm run data:add -- NQ=F');
    expect(addDataCommand('^NSEBANK')).toBe("npm run data:add -- '^NSEBANK'");
    expect(addDataCommand('M&M.NS')).toBe("npm run data:add -- 'M&M.NS'");
    expect(addDataCommand("A'B")).toBe("npm run data:add -- 'A'\\''B'");
  });
});
