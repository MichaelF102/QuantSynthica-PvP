import { DEFAULT_DURATION_MS, DEFAULT_MAX_DRAWDOWN_PCT } from '@/lib/config';
import { DASH, isNum } from '@/lib/format';
import { defaultBalanceFor } from '@/lib/session';
import type { AssetClass, SymbolInfo } from '@/lib/types';

// Landing-page market list: classification, filtering and labels. Pure, no React.

export type MarketType = 'Currency' | 'Equity' | 'Indices';
export type MarketRegion = 'India' | 'US' | 'Global';

/** A market as the landing page shows it. Data fields exist only when it came from index.json. */
export type Market = {
  symbol: string;
  name: string;
  currency: string;
  assetClass?: AssetClass;
  firstTime?: number;
  lastTime?: number;
  lotStep?: number;
};

export type MarketFilter = { type: 'All' | MarketType; region: 'All' | MarketRegion; query: string };

export const TYPE_FILTERS = ['All', 'Currency', 'Equity', 'Indices'] as const;
export const REGION_FILTERS = ['All', 'India', 'US', 'Global'] as const;
/** Order of the groups in the unfiltered preview and the counts legend. */
export const PREVIEW_ORDER: readonly MarketType[] = ['Currency', 'Indices', 'Equity'];
export const PREVIEW_PER_TYPE = 5;

// Currency futures on CME (6E = Euro FX, 6B = British pound, ...). They trade as futures but track a currency.
const CURRENCY_FUTURES = /^6[ABCEJMNS]=F$/;

const BY_ASSET: Record<AssetClass, MarketType> = { forex: 'Currency', futures: 'Indices', index: 'Indices', stock: 'Equity', crypto: 'Equity' };

/**
 * Type comes from assetClass when index.json gives it, otherwise from the symbol suffix.
 * Region: currencies are Global; otherwise INR markets are India, USD markets are US, the rest Global.
 */
export function classifyMarket(m: Pick<Market, 'symbol' | 'currency' | 'assetClass'>): { type: MarketType; region: MarketRegion } {
  const s = m.symbol;
  let type: MarketType;
  if (CURRENCY_FUTURES.test(s)) type = 'Currency';
  else if (m.assetClass && BY_ASSET[m.assetClass]) type = BY_ASSET[m.assetClass];
  else if (s.endsWith('=X')) type = 'Currency';
  else if (s.startsWith('^') || s.endsWith('=F')) type = 'Indices';
  else type = 'Equity';

  let region: MarketRegion;
  if (type === 'Currency') region = 'Global';
  else if (m.currency === 'INR' || s.endsWith('.NS') || s.endsWith('.BO')) region = 'India';
  else if (m.currency === 'USD') region = 'US';
  else region = 'Global';
  return { type, region };
}

export function marketsFromIndex(index: readonly SymbolInfo[]): Market[] {
  return index.map(({ symbol, name, currency, assetClass, firstTime, lastTime, lotStep }) => ({
    symbol,
    name,
    currency,
    assetClass,
    firstTime,
    lastTime,
    lotStep,
  }));
}

export function isFilterActive(f: MarketFilter): boolean {
  return f.type !== 'All' || f.region !== 'All' || f.query.trim().length > 0;
}

export function filterMarkets(list: readonly Market[], f: MarketFilter): Market[] {
  const q = f.query.trim().toLowerCase();
  return list.filter((m) => {
    const c = classifyMarket(m);
    if (f.type !== 'All' && c.type !== f.type) return false;
    if (f.region !== 'All' && c.region !== f.region) return false;
    return !q || m.symbol.toLowerCase().includes(q) || m.name.toLowerCase().includes(q);
  });
}

/** The first `perType` markets of each type, grouped in PREVIEW_ORDER. */
export function previewMarkets(list: readonly Market[], perType = PREVIEW_PER_TYPE): Market[] {
  return PREVIEW_ORDER.flatMap((t) => list.filter((m) => classifyMarket(m).type === t).slice(0, perType));
}

/** What the grid shows: the filtered list when a filter is set, the preview otherwise. */
export function visibleMarkets(list: readonly Market[], f: MarketFilter): Market[] {
  return isFilterActive(f) ? filterMarkets(list, f) : previewMarkets(list);
}

export function countByType(list: readonly Market[]): Record<MarketType, number> {
  const counts: Record<MarketType, number> = { Currency: 0, Indices: 0, Equity: 0 };
  for (const m of list) counts[classifyMarket(m).type] += 1;
  return counts;
}

/** Whole-unit starting balance, the same default setup uses: "₹10,00,000" or "$100,000". */
export function startingBalanceLabel(currency: string): string {
  const v = defaultBalanceFor(currency);
  return currency === 'INR' ? `₹${v.toLocaleString('en-IN')}` : `$${v.toLocaleString('en-US')}`;
}

export function sessionLabel(): string {
  return `${DEFAULT_DURATION_MS / 60_000} minutes, max drawdown ${DEFAULT_MAX_DRAWDOWN_PCT}%`;
}

/** Lot step from index.json; the curated fallback has none, so it shows "—". */
export function lotStepLabel(m: Pick<Market, 'lotStep'>): string {
  return isNum(m.lotStep) && m.lotStep > 0 ? String(m.lotStep) : DASH;
}

const isoDate = (sec: number) => new Date(sec * 1000).toISOString().slice(0, 10);

/** "2026-10-06 to 2026-11-04 (UTC)", or "—" when the market has no data range. */
export function dataRangeLabel(m: Pick<Market, 'firstTime' | 'lastTime'>): string {
  if (!isNum(m.firstTime) || !isNum(m.lastTime) || m.lastTime < m.firstTime) return DASH;
  return `${isoDate(m.firstTime)} to ${isoDate(m.lastTime)} (UTC)`;
}

export function practiceHref(symbol: string): string {
  return `/practice?symbol=${encodeURIComponent(symbol)}`;
}
