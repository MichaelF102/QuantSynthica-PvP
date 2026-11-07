import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CatalogEntry } from '@/lib/catalog';
import type { SymbolInfo } from '@/lib/types';

const cat = vi.hoisted(() => ({ loadCatalog: vi.fn() }));
vi.mock('@/lib/catalog', async (orig) => ({ ...(await orig<typeof import('@/lib/catalog')>()), loadCatalog: cat.loadCatalog }));

const { SymbolPicker } = await import('./SymbolPicker');

const info = (symbol: string, name: string, assetClass: SymbolInfo['assetClass'], currency: string): SymbolInfo => ({
  symbol, name, assetClass, currency, dataFile: 'x.csv', barsAvailable: 1, firstTime: 0, lastTime: 1, lotStep: 1, priceDecimals: 2,
});
const INDEX = [info('^NSEI', 'Nifty 50', 'index', 'INR'), info('^GSPC', 'S&P 500', 'index', 'USD'), info('AAPL', 'Apple Inc.', 'stock', 'USD'), info('RELIANCE.NS', 'Reliance Industries Limited', 'stock', 'INR')];
const e = (symbol: string, name: string, assetClass: CatalogEntry['assetClass'], currency: string, exchange: string): CatalogEntry => ({ symbol, name, assetClass, currency, exchange });
const CATALOG = [e('AAPL', 'Apple Inc.', 'stock', 'USD', 'NASDAQ'), e('TCS.NS', 'Tata Consultancy Services Limited', 'stock', 'INR', 'NSE'), e('M&M.NS', 'Mahindra & Mahindra Limited', 'stock', 'INR', 'NSE'), e('MSFT', 'Microsoft Corporation', 'stock', 'USD', 'NASDAQ')];

const radios = () => within(screen.getByRole('radiogroup', { name: 'Symbol' })).queryAllByRole('radio').map((r) => r.getAttribute('data-symbol'));
const pick = (group: string, label: string) => userEvent.click(within(screen.getByRole('group', { name: group })).getByRole('button', { name: label }));

describe('SymbolPicker', () => {
  beforeEach(() => cat.loadCatalog.mockReset());

  it('filters playable symbols by market and type', async () => {
    cat.loadCatalog.mockResolvedValue(CATALOG);
    render(<SymbolPicker index={INDEX} value="^NSEI" onChange={vi.fn()} />);
    expect(radios()).toEqual(['^NSEI', '^GSPC', 'AAPL', 'RELIANCE.NS']);
    await pick('Filter by market', 'India');
    expect(radios()).toEqual(['^NSEI', 'RELIANCE.NS']);
    await pick('Filter by type', 'Equity');
    expect(radios()).toEqual(['RELIANCE.NS']);
    expect(screen.getByText(/is hidden by the filters/)).toBeInTheDocument();
    await pick('Filter by market', 'US');
    expect(radios()).toEqual(['AAPL']);
  });

  it('searches playable symbols and lists tickers without data, never as radios', async () => {
    cat.loadCatalog.mockResolvedValue(CATALOG);
    const onChange = vi.fn();
    render(<SymbolPicker index={INDEX} value="^NSEI" onChange={onChange} />);
    expect(screen.queryByText('No data yet')).not.toBeInTheDocument(); // only once a filter or search is set
    await userEvent.type(screen.getByLabelText('Search symbols'), 'm');
    expect(await screen.findByText('No data yet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /MSFT.*Microsoft/ })).toBeInTheDocument();
    expect(radios()).not.toContain('MSFT');
    // AAPL is playable, so it is not repeated in the no-data list.
    expect(screen.queryByRole('button', { name: /^AAPL.*No data/ })).not.toBeInTheDocument();
  });

  it('explains how to add data for a ticker without candles, and does not select it', async () => {
    cat.loadCatalog.mockResolvedValue(CATALOG);
    const onChange = vi.fn();
    render(<SymbolPicker index={INDEX} value="^NSEI" onChange={onChange} />);
    await userEvent.type(screen.getByLabelText('Search symbols'), 'mahindra');
    const row = await screen.findByRole('button', { name: /M&M.*Mahindra/ });
    onChange.mockClear(); // typing may move the selection; clicking a no-data row must not
    await userEvent.click(row);
    expect(row).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText("npm run data:add -- 'M&M.NS'")).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
    await userEvent.click(row);
    expect(screen.queryByText(/npm run data:add/)).not.toBeInTheDocument();
  });

  it('still offers playable symbols when the ticker list fails, with a retry', async () => {
    cat.loadCatalog.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(CATALOG);
    render(<SymbolPicker index={INDEX} value="^NSEI" onChange={vi.fn()} />);
    expect(await screen.findByText(/ticker list could not be loaded/)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Search symbols'), 'apple');
    expect(radios()).toEqual(['AAPL']);
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(screen.queryByText(/ticker list could not be loaded/)).not.toBeInTheDocument();
  });

  it('shows an empty message when nothing playable matches', async () => {
    cat.loadCatalog.mockResolvedValue([]);
    render(<SymbolPicker index={INDEX} value="^NSEI" onChange={vi.fn()} />);
    await userEvent.type(screen.getByLabelText('Search symbols'), 'zzzz');
    expect(screen.getByText(/No playable symbol matches/)).toBeInTheDocument();
  });
});

describe('SymbolPicker selection follows the filters', () => {
  it('selects the first visible playable symbol when the current one is filtered out', async () => {
    cat.loadCatalog.mockResolvedValue(CATALOG);
    const onChange = vi.fn();
    render(<SymbolPicker index={INDEX} value="^GSPC" onChange={onChange} />);
    await pick('Filter by market', 'India');
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ symbol: '^NSEI' }));
  });

  it('keeps the selection when it is still visible, or when nothing playable matches', async () => {
    cat.loadCatalog.mockResolvedValue(CATALOG);
    const onChange = vi.fn();
    render(<SymbolPicker index={INDEX} value="^NSEI" onChange={onChange} />);
    await pick('Filter by market', 'India');
    await userEvent.type(screen.getByLabelText('Search symbols'), 'zzzz');
    expect(onChange).not.toHaveBeenCalled();
  });
});
