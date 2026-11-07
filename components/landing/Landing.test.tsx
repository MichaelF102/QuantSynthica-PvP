import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SymbolInfo } from '@/lib/types';

const loadIndex = vi.fn<() => Promise<SymbolInfo[]>>();
vi.mock('@/lib/data', () => ({ loadIndex: () => loadIndex() }));

const { Markets } = await import('./Markets');
const { Questions } = await import('./Questions');
const { SampleResult } = await import('./SampleResult');
const { RulesCarousel } = await import('./RulesCarousel');
const { LandingFooter } = await import('./LandingFooter');
const { FillPlayground } = await import('./FillPlayground');

const info = (symbol: string, name: string, assetClass: SymbolInfo['assetClass'], currency: string): SymbolInfo => ({
  symbol, name, assetClass, currency, dataFile: 'x.csv', barsAvailable: 100, firstTime: 1_790_000_000, lastTime: 1_790_086_400, lotStep: 0.01, priceDecimals: 2,
});

describe('Markets', () => {
  beforeEach(() => loadIndex.mockReset());

  it('shows a loading state, then the markets from index.json', async () => {
    loadIndex.mockResolvedValue([info('NQ=F', 'Nasdaq 100 E-mini Futures', 'futures', 'USD'), info('^NSEI', 'Nifty 50', 'index', 'INR')]);
    render(<Markets />);
    expect(screen.getByRole('status', { name: 'Loading markets' })).toBeInTheDocument();
    expect(await screen.findByText('Nifty 50')).toBeInTheDocument();
    expect(screen.queryByText('Apple Inc.')).not.toBeInTheDocument();
  });

  it('falls back to the curated list with a warning when index.json fails, and retries', async () => {
    loadIndex.mockRejectedValueOnce(new Error('network'));
    render(<Markets />);
    expect(await screen.findByText(/could not be loaded/)).toBeInTheDocument();
    expect(screen.getByText('Apple Inc.')).toBeInTheDocument();
    loadIndex.mockResolvedValueOnce([info('NQ=F', 'Nasdaq 100 E-mini Futures', 'futures', 'USD')]);
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Nasdaq 100 E-mini Futures')).toBeInTheDocument();
    expect(screen.queryByText(/could not be loaded/)).not.toBeInTheDocument();
  });

  it('labels the curated fallback when index.json is empty', async () => {
    loadIndex.mockResolvedValue([]);
    render(<Markets />);
    expect(await screen.findByText(/No markets have data yet/)).toBeInTheDocument();
  });

  it('filters, shows an empty state, and links the selected market to practice', async () => {
    loadIndex.mockResolvedValue([info('NQ=F', 'Nasdaq 100 E-mini Futures', 'futures', 'USD'), info('^NSEI', 'Nifty 50', 'index', 'INR')]);
    const user = userEvent.setup();
    render(<Markets />);
    await screen.findByText('Nifty 50');

    await user.click(within(screen.getByRole('group', { name: 'Filter by market' })).getByRole('button', { name: 'India' }));
    expect(screen.getByText('Showing 1 of 2 markets')).toBeInTheDocument();
    expect(screen.queryByText('Nasdaq 100 E-mini Futures')).not.toBeInTheDocument();

    await user.type(screen.getByRole('searchbox', { name: 'Search markets' }), 'zzz');
    expect(screen.getByText('No markets match')).toBeInTheDocument();

    await user.clear(screen.getByRole('searchbox', { name: 'Search markets' }));
    expect(screen.getByText('Nifty 50')).toBeInTheDocument();
    expect(screen.getByText('Choose a market first')).toHaveAttribute('aria-disabled', 'true');
    expect(screen.queryByRole('link', { name: /Start practice with/ })).not.toBeInTheDocument();
  });

  it('shows the selected market with balance, lot step and a practice link', async () => {
    loadIndex.mockResolvedValue([info('^NSEI', 'Nifty 50', 'index', 'INR')]);
    render(<Markets />);
    await userEvent.click(await screen.findByRole('button', { name: /Nifty 50/ }));
    expect(screen.getByText('₹10,00,000')).toBeInTheDocument();
    expect(screen.getByText('0.01')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Start practice with Nifty 50/ })).toHaveAttribute('href', '/practice?symbol=%5ENSEI');
  });
});

describe('Questions', () => {
  it('opens the first item by default and keeps one open at a time', async () => {
    render(<Questions />);
    const first = screen.getByRole('button', { name: /Is this real money/ });
    const second = screen.getByRole('button', { name: /Is it free/ });
    expect(first).toHaveAttribute('aria-expanded', 'true');
    expect(second).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(second);
    expect(first).toHaveAttribute('aria-expanded', 'false');
    expect(second).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(second);
    expect(second).toHaveAttribute('aria-expanded', 'false');
  });
});

describe('SampleResult', () => {
  it('is labelled as a test fixture', () => {
    render(<SampleResult />);
    expect(screen.getByText('TEST FIXTURE')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /test fixture/i })).toBeInTheDocument();
  });
});

describe('RulesCarousel', () => {
  it('shows the card for the rule that is clicked', async () => {
    render(<RulesCarousel />);
    const btn = screen.getByRole('button', { name: /Leverage/ });
    await userEvent.click(btn);
    expect(btn).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('heading', { name: 'No leverage' }).closest('[aria-hidden]')).toHaveAttribute('aria-hidden', 'false');
  });
});

describe('FillPlayground', () => {
  it('disables Buy and Sell after a fill and resets', async () => {
    const user = userEvent.setup();
    render(<FillPlayground />);
    await user.click(screen.getByRole('button', { name: 'Buy' }));
    expect(screen.getByRole('button', { name: 'Buy' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Sell' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Next candle' }));
    expect(screen.getByText(/than your fill|unchanged/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reset' }));
    expect(screen.getByRole('button', { name: 'Buy' })).toBeEnabled();
  });
});

describe('LandingFooter', () => {
  it('has the legal links, contact placeholder and disclaimer, and no vendor names', () => {
    const { container } = render(<LandingFooter />);
    expect(screen.getByRole('link', { name: 'Privacy policy' })).toHaveAttribute('href', '/privacy');
    expect(screen.getByRole('link', { name: 'Terms of use' })).toHaveAttribute('href', '/terms');
    expect(screen.getByRole('link', { name: 'contact@example.com' })).toHaveAttribute('href', 'mailto:contact@example.com');
    expect(screen.getByText('Practice only. Nothing on this site is investment advice.')).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/yahoo|yfinance/i);
  });
});
