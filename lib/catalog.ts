import { DataError, fetchText } from './data';
import { shortSymbol } from './format';
import { classifyMarket, type MarketRegion, type MarketType } from './landing/markets';
import type { AssetClass, SymbolInfo } from './types';

// Ticker reference for the setup picker (public/data/catalog.json, built by scripts/build_catalog.py
// from the metadata lists in data/). It never carries prices. A ticker is playable only when it
// is also in index.json, which lists the symbols that have candles.

export type CatalogEntry = { symbol: string; name: string; assetClass: AssetClass; currency: string; exchange: string };

const CLASSES: readonly AssetClass[] = ['futures', 'forex', 'index', 'stock', 'crypto'];
const str = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;

/** Validates catalog.json. Malformed rows are skipped; a non-array throws DataError('bad_index'). */
export function parseCatalog(json: unknown): CatalogEntry[] {
  if (!Array.isArray(json)) throw new DataError('bad_index', 'Ticker list is not an array');
  const seen = new Set<string>();
  const out: CatalogEntry[] = [];
  for (const raw of json) {
    const r = raw as Record<string, unknown> | null;
    if (!r || typeof r !== 'object') continue;
    const { s, n, a, c, e } = r;
    if (!str(s) || !str(n) || !CLASSES.includes(a as AssetClass) || !str(c) || seen.has(s)) continue;
    seen.add(s);
    out.push({ symbol: s, name: n.trim(), assetClass: a as AssetClass, currency: c, exchange: str(e) ? e : '' });
  }
  return out;
}

export async function loadCatalog(): Promise<CatalogEntry[]> {
  const text = await fetchText('/data/catalog.json', { retries: 1 });
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new DataError('bad_index', 'Ticker list is not valid JSON');
  }
  return parseCatalog(json);
}

export type PickerFilter = { region: 'All' | MarketRegion; type: 'All' | MarketType; query: string };
export const NO_PICKER_FILTER: PickerFilter = { region: 'All', type: 'All', query: '' };
export const CATALOG_LIMIT = 50;

type Searchable = Pick<CatalogEntry, 'symbol' | 'name' | 'currency' | 'assetClass'>;

/**
 * Match rank for `q` (already lower-case and trimmed), lower is better; null when it does not match.
 * 0 exact symbol, 1 symbol prefix, 2 name prefix, 3 word prefix in the name, 4 anywhere.
 */
export function matchRank(e: Pick<Searchable, 'symbol' | 'name'>, q: string): number | null {
  if (!q) return 4;
  const sym = e.symbol.toLowerCase();
  const short = shortSymbol(e.symbol).toLowerCase();
  const name = e.name.toLowerCase();
  if (sym === q || short === q) return 0;
  if (sym.startsWith(q) || short.startsWith(q)) return 1;
  if (name.startsWith(q)) return 2;
  if (name.split(/[\s/&().,-]+/).some((w) => w.startsWith(q))) return 3;
  if (sym.includes(q) || name.includes(q)) return 4;
  return null;
}

function passes(e: Searchable, f: PickerFilter): boolean {
  if (f.type === 'All' && f.region === 'All') return true;
  const c = classifyMarket(e);
  return (f.type === 'All' || c.type === f.type) && (f.region === 'All' || c.region === f.region);
}

/** Filters, then sorts by match rank. Ties keep the input order (the catalog lists big names first). */
export function rankMatches<T extends Searchable>(list: readonly T[], f: PickerFilter): T[] {
  const q = f.query.trim().toLowerCase();
  const scored: { e: T; r: number; i: number }[] = [];
  list.forEach((e, i) => {
    if (!passes(e, f)) return;
    const r = matchRank(e, q);
    if (r !== null) scored.push({ e, r, i });
  });
  return scored.sort((a, b) => a.r - b.r || a.i - b.i).map((x) => x.e);
}

export const isPickerFilterActive = (f: PickerFilter) => f.type !== 'All' || f.region !== 'All' || f.query.trim().length > 0;

export type PickerResults = {
  /** Playable symbols (in index.json) that match. */
  ready: SymbolInfo[];
  /** Catalog tickers without candles that match, capped at `limit`. Empty until a filter or search is set. */
  noData: CatalogEntry[];
  noDataTotal: number;
};

export function pickerResults(index: readonly SymbolInfo[], catalog: readonly CatalogEntry[], f: PickerFilter, limit = CATALOG_LIMIT): PickerResults {
  const ready = rankMatches(index, f);
  if (!isPickerFilterActive(f)) return { ready, noData: [], noDataTotal: 0 };
  const playable = new Set(index.map((i) => i.symbol));
  const all = rankMatches(catalog.filter((c) => !playable.has(c.symbol)), f);
  return { ready, noData: all.slice(0, Math.max(0, limit)), noDataTotal: all.length };
}

/** The command that downloads candles for a ticker. Symbols with shell characters (^, &, spaces) are single-quoted. */
export const addDataCommand = (symbol: string) =>
  `npm run data:add -- ${/^[\w.=-]+$/.test(symbol) ? symbol : `'${symbol.replace(/'/g, `'\\''`)}'`}`;
