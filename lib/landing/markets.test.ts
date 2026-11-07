import { describe, expect, it } from 'vitest';
import { CURATED_MARKETS } from './curatedMarkets';
import {
  classifyMarket,
  countByType,
  dataRangeLabel,
  filterMarkets,
  isFilterActive,
  lotStepLabel,
  marketsFromIndex,
  practiceHref,
  previewMarkets,
  sessionLabel,
  startingBalanceLabel,
  visibleMarkets,
  type Market,
  type MarketFilter,
} from './markets';
import type { SymbolInfo } from '@/lib/types';

const NONE: MarketFilter = { type: 'All', region: 'All', query: '' };

describe('classifyMarket', () => {
  it.each([
    ['EURUSD=X', 'USD', undefined, 'Currency', 'Global'],
    ['INR=X', 'INR', undefined, 'Currency', 'Global'],
    ['^GSPC', 'USD', undefined, 'Indices', 'US'],
    ['NQ=F', 'USD', undefined, 'Indices', 'US'],
    ['^NSEI', 'INR', undefined, 'Indices', 'India'],
    ['^BSESN', 'INR', undefined, 'Indices', 'India'],
    ['^FTSE', 'GBP', undefined, 'Indices', 'Global'],
    ['AAPL', 'USD', undefined, 'Equity', 'US'],
    ['RELIANCE.NS', 'INR', undefined, 'Equity', 'India'],
    ['TCS.BO', 'INR', undefined, 'Equity', 'India'],
  ] as const)('%s -> %s / %s', (symbol, currency, assetClass, type, region) => {
    expect(classifyMarket({ symbol, currency, assetClass })).toEqual({ type, region });
  });

  it('prefers assetClass from index.json over the symbol', () => {
    expect(classifyMarket({ symbol: 'XYZ', currency: 'USD', assetClass: 'index' }).type).toBe('Indices');
    expect(classifyMarket({ symbol: 'BTC-USD', currency: 'USD', assetClass: 'crypto' }).type).toBe('Equity');
    expect(classifyMarket({ symbol: 'ABC', currency: 'USD', assetClass: 'forex' })).toEqual({ type: 'Currency', region: 'Global' });
  });

  it('treats currency futures (6E=F) as currency, not an index', () => {
    expect(classifyMarket({ symbol: '6E=F', currency: 'USD', assetClass: 'futures' })).toEqual({ type: 'Currency', region: 'Global' });
    expect(classifyMarket({ symbol: 'NQ=F', currency: 'USD', assetClass: 'futures' }).type).toBe('Indices');
  });
});

describe('filters', () => {
  it('isFilterActive ignores a whitespace-only query', () => {
    expect(isFilterActive(NONE)).toBe(false);
    expect(isFilterActive({ ...NONE, query: '   ' })).toBe(false);
    expect(isFilterActive({ ...NONE, query: 'n' })).toBe(true);
    expect(isFilterActive({ ...NONE, type: 'Equity' })).toBe(true);
    expect(isFilterActive({ ...NONE, region: 'US' })).toBe(true);
  });

  it('combines type, region and query', () => {
    const r = filterMarkets(CURATED_MARKETS, { type: 'Indices', region: 'India', query: '' });
    expect(r.map((m) => m.symbol)).toEqual(['^NSEI', '^NSEBANK', '^BSESN']);
    expect(filterMarkets(CURATED_MARKETS, { ...NONE, query: '  nifty ' }).map((m) => m.symbol)).toEqual(['^NSEI', '^NSEBANK']);
  });

  it('search matches symbol or name, case-insensitively', () => {
    expect(filterMarkets(CURATED_MARKETS, { ...NONE, query: 'aapl' }).map((m) => m.symbol)).toEqual(['AAPL']);
    expect(filterMarkets(CURATED_MARKETS, { ...NONE, query: 'TATA' }).map((m) => m.symbol)).toEqual(['TCS.NS']);
  });

  it('returns an empty list when nothing matches', () => {
    expect(filterMarkets(CURATED_MARKETS, { ...NONE, query: 'zzzz' })).toEqual([]);
    expect(filterMarkets([], NONE)).toEqual([]);
  });
});

describe('previewMarkets / visibleMarkets', () => {
  it('shows five per type in Currency, Indices, Equity order', () => {
    const p = previewMarkets(CURATED_MARKETS);
    expect(p).toHaveLength(15);
    expect(p.slice(0, 5).every((m) => classifyMarket(m).type === 'Currency')).toBe(true);
    expect(p.slice(5, 10).every((m) => classifyMarket(m).type === 'Indices')).toBe(true);
    expect(p.slice(10).every((m) => classifyMarket(m).type === 'Equity')).toBe(true);
  });

  it('shows fewer when a type has fewer markets', () => {
    const list: Market[] = [{ symbol: 'NQ=F', name: 'NQ', currency: 'USD' }];
    expect(previewMarkets(list)).toEqual(list);
  });

  it('uses the preview without a filter and the full match list with one', () => {
    expect(visibleMarkets(CURATED_MARKETS, NONE)).toHaveLength(15);
    expect(visibleMarkets(CURATED_MARKETS, { ...NONE, type: 'Equity' })).toHaveLength(16);
  });
});

describe('countByType', () => {
  it('counts the curated list', () => {
    expect(countByType(CURATED_MARKETS)).toEqual({ Currency: 23, Indices: 11, Equity: 16 });
  });
  it('is all zeros for an empty list', () => {
    expect(countByType([])).toEqual({ Currency: 0, Indices: 0, Equity: 0 });
  });
});

describe('labels', () => {
  it('starting balance follows the currency, in whole units', () => {
    expect(startingBalanceLabel('USD')).toBe('$100,000');
    expect(startingBalanceLabel('INR')).toBe('₹10,00,000');
    expect(startingBalanceLabel('JPY')).toBe('$100,000');
  });

  it('session label uses the configured defaults', () => {
    expect(sessionLabel()).toBe('10 minutes, max drawdown 5%');
  });

  it('lot step is a dash when unknown or invalid', () => {
    expect(lotStepLabel({ lotStep: 0.01 })).toBe('0.01');
    expect(lotStepLabel({ lotStep: 1 })).toBe('1');
    expect(lotStepLabel({})).toBe('—');
    expect(lotStepLabel({ lotStep: Number.NaN })).toBe('—');
    expect(lotStepLabel({ lotStep: 0 })).toBe('—');
    expect(lotStepLabel({ lotStep: -1 })).toBe('—');
  });

  it('data range is UTC dates, or a dash when missing or reversed', () => {
    expect(dataRangeLabel({ firstTime: 0, lastTime: 86_400 })).toBe('1970-01-01 to 1970-01-02 (UTC)');
    expect(dataRangeLabel({})).toBe('—');
    expect(dataRangeLabel({ firstTime: 10 })).toBe('—');
    expect(dataRangeLabel({ firstTime: 100, lastTime: 10 })).toBe('—');
  });

  it('practice link encodes the symbol', () => {
    expect(practiceHref('^NSEI')).toBe('/practice?symbol=%5ENSEI');
    expect(practiceHref('NQ=F')).toBe('/practice?symbol=NQ%3DF');
  });
});

describe('marketsFromIndex', () => {
  it('keeps the fields the landing page uses and nothing else', () => {
    const info: SymbolInfo = {
      symbol: 'NQ=F', name: 'Nasdaq 100', assetClass: 'futures', currency: 'USD', dataFile: 'NQ_F.csv',
      barsAvailable: 10, firstTime: 1, lastTime: 2, lotStep: 0.01, priceDecimals: 2, sector: 'x',
    };
    expect(marketsFromIndex([info])).toEqual([
      { symbol: 'NQ=F', name: 'Nasdaq 100', currency: 'USD', assetClass: 'futures', firstTime: 1, lastTime: 2, lotStep: 0.01 },
    ]);
  });
});

describe('CURATED_MARKETS', () => {
  it('has unique symbols and no price fields', () => {
    const symbols = CURATED_MARKETS.map((m) => m.symbol);
    expect(new Set(symbols).size).toBe(symbols.length);
    for (const m of CURATED_MARKETS) expect(Object.keys(m).sort()).toEqual(['currency', 'name', 'symbol']);
  });
});
