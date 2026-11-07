import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { MatchResult } from '@/lib/results';
import { getResult, listResults, saveResult } from '@/lib/storage';
import type { Candle, SymbolInfo } from '@/lib/types';

const nav = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => nav, usePathname: () => '/results/x' }));
const data = vi.hoisted(() => ({ loadIndex: vi.fn(async (): Promise<SymbolInfo[]> => []), loadCandles: vi.fn(async (): Promise<Candle[]> => []) }));
vi.mock('@/lib/data', async (orig) => ({ ...(await orig<typeof import('@/lib/data')>()), loadIndex: data.loadIndex, loadCandles: data.loadCandles }));
vi.mock('lightweight-charts', () => {
  const series = { setData: vi.fn(), update: vi.fn(), setMarkers: vi.fn(), applyOptions: vi.fn(), createPriceLine: vi.fn(() => ({})), removePriceLine: vi.fn() };
  const chart = { addCandlestickSeries: () => series, addHistogramSeries: () => series, priceScale: () => ({ applyOptions: vi.fn() }), timeScale: () => ({ fitContent: vi.fn(), scrollToRealTime: vi.fn() }), applyOptions: vi.fn(), subscribeCrosshairMove: vi.fn(), unsubscribeCrosshairMove: vi.fn(), remove: vi.fn() };
  return { createChart: () => chart, ColorType: { Solid: 'solid' }, CrosshairMode: { Normal: 0 }, LineStyle: { Dashed: 2 } };
});

const { ResultsReport } = await import('./ResultsReport');

const S0 = 1_791_293_400;
const TRADES: MatchResult['trades'] = [
  { id: 't1', symbol: 'NQ=F', side: 'buy', units: 2.62, entry: 26_228.36, exit: 26_172.89, pnl: -145.33, openedAt: S0 + 60, closedAt: S0 + 600 },
  { id: 't2', symbol: 'NQ=F', side: 'sell', units: 0.01, entry: 26_172.89, exit: 26_154.73, pnl: 0.18, openedAt: S0 + 600, closedAt: S0 + 900 },
];
const make = (id: string, over: Partial<MatchResult> = {}, stats: Partial<MatchResult['stats']> = {}): MatchResult => ({
  version: 1, id, symbol: 'NQ=F', symbolName: 'Nasdaq 100 E-mini Futures', currency: 'USD', priceDecimals: 2, lotStep: 0.01,
  config: { symbol: 'NQ=F', currency: 'USD', interval: '1m', durationMs: 600_000, startingBalance: 100_000, maxDrawdownPct: 5, lotStep: 0.01 },
  endReason: 'user', playedAt: 1, sessionStart: S0, sessionEnd: S0 + 1200,
  stats: {
    startingBalance: 100_000, finalEquity: 99_854.85, pnl: -145.15, returnPct: -0.14515, trades: 2, wins: 1, losses: 1, winRate: 50,
    profitFactor: 0.18 / 145.33, grossProfit: 0.18, grossLoss: 145.33, maxDrawdownPct: 0.2, avgWin: 0.18, avgLoss: -145.33, largestWin: 0.18, largestLoss: -145.33, durationMs: 54_000, ...stats,
  },
  trades: TRADES,
  equityCurve: [{ t: S0, equity: 100_000 }, { t: S0 + 600, equity: 99_854.67 }, { t: S0 + 1200, equity: 99_854.85 }],
  ...over,
});
const info: SymbolInfo = { symbol: 'NQ=F', name: 'NQ', assetClass: 'futures', currency: 'USD', dataFile: 'NQ_F.csv', barsAvailable: 3, firstTime: S0, lastTime: S0 + 1200, lotStep: 0.01, priceDecimals: 2 };
const c = (time: number, close: number): Candle => ({ time, open: close, high: close, low: close, close, volume: 1 });
const tile = (label: string) => screen.getByText(label, { selector: 'div' }).parentElement!;

beforeEach(() => {
  localStorage.clear();
  nav.push.mockReset();
  data.loadIndex.mockReset().mockResolvedValue([]);
  data.loadCandles.mockReset().mockResolvedValue([]);
});

describe('ResultsReport improvements', () => {
  it('shows a tiny profit factor as <0.01 and says how the match ended', async () => {
    render(<ResultsReport result={make('a')} />);
    expect(within(tile('Profit factor')).getByText('<0.01')).toHaveClass('text-rose-400');
    expect(screen.getByText('Ended by you')).toBeInTheDocument();
    expect(screen.getByText('09:06 left of 10:00')).toBeInTheDocument();
    expect(await screen.findByText('Session data not available')).toBeInTheDocument();
    expect(within(tile('Buy & hold')).getByText('—')).toBeInTheDocument();
  });

  it('compares the return with buy & hold from the session candles', async () => {
    data.loadIndex.mockResolvedValue([info]);
    data.loadCandles.mockResolvedValue([c(S0 - 60, 1), c(S0, 26_000), c(S0 + 600, 26_100), c(S0 + 1200, 26_260), c(S0 + 1800, 1)]);
    render(<ResultsReport result={make('a')} />);
    expect(screen.getByRole('status', { name: 'Loading buy and hold' })).toBeInTheDocument();
    await screen.findByText('Same session, full balance');
    expect(within(tile('Buy & hold')).getByText('+1.00%')).toBeInTheDocument();
    expect(within(tile('Return')).getByText('Trailed market by 1.15 pts')).toBeInTheDocument();
    expect(screen.getByText(/The market moved \+1\.00% over your session; you trailed it by 1\.15 points\./)).toBeInTheDocument();
  });

  it('sorts the trade table and pins a trade on the charts', async () => {
    data.loadIndex.mockResolvedValue([info]);
    data.loadCandles.mockResolvedValue([c(S0, 1), c(S0 + 600, 1), c(S0 + 1200, 1)]);
    render(<ResultsReport result={make('a')} />);
    const table = screen.getByRole('table');
    await userEvent.click(within(table).getByRole('button', { name: 'P&L' }));
    let rows = within(table).getAllByRole('row').slice(1);
    expect(rows[0]).toHaveTextContent('+$0.18'); // biggest first
    await userEvent.click(within(table).getByRole('button', { name: /P&L$/ }));
    rows = within(table).getAllByRole('row').slice(1);
    expect(rows[0]).toHaveTextContent('-$145.33');
    await userEvent.click(screen.getByRole('button', { name: 'Show trade 1 on the charts' }));
    expect(screen.getByRole('button', { name: 'Show trade 1 on the charts' })).toHaveAttribute('aria-pressed', 'true');
    expect(await screen.findByText('Trade #1: 26,228.36 → 26,172.89')).toBeInTheDocument();
  });

  it('saves a note with the result', async () => {
    saveResult(make('a'));
    render(<ResultsReport result={make('a')} />);
    const field = screen.getByLabelText('Notes on this match');
    await userEvent.type(field, 'Cut the long sooner.');
    await userEvent.click(screen.getByRole('button', { name: 'Save note' }));
    expect(getResult('a')?.note).toBe('Cut the long sooner.');
    expect(screen.getByText('Saved')).toBeInTheDocument();
  });

  it('deletes the result after confirming and goes to history', async () => {
    saveResult(make('a'));
    render(<ResultsReport result={make('a')} />);
    await userEvent.click(screen.getByRole('button', { name: 'Delete result' }));
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(listResults().results).toEqual([]);
    expect(nav.push).toHaveBeenCalledWith('/history');
  });

  it('offers to play the same setup again and ranks the match on its symbol', async () => {
    saveResult(make('a', { playedAt: 1 }, { returnPct: 0.5 }));
    saveResult(make('b', { playedAt: 2 }));
    render(<ResultsReport result={make('b', { playedAt: 2 })} />);
    expect(screen.getByRole('link', { name: 'Play NQ again' })).toHaveAttribute('href', '/practice?from=b');
    expect(screen.getByRole('link', { name: 'New setup' })).toHaveAttribute('href', '/practice');
    expect(await screen.findByText(/best of/)).toHaveTextContent('2nd best of 2 matches on NQ · best +0.50% · average +0.18%');
  });

  it('has an enabled CSV export with trades and a disabled one without', () => {
    const { unmount } = render(<ResultsReport result={make('a')} />);
    expect(screen.getByRole('button', { name: 'Export CSV' })).toBeEnabled();
    unmount();
    render(<ResultsReport result={make('z', { trades: [] }, { trades: 0, wins: 0, losses: 0, winRate: null, profitFactor: null })} />);
    expect(screen.getByRole('button', { name: 'Export CSV' })).toBeDisabled();
  });
});

describe('tone follows the shown value', () => {
  it('a return that rounds to 0.00% is not coloured', () => {
    render(<ResultsReport result={make('a', {}, { returnPct: -0.0005 })} />);
    expect(within(tile('Return')).getByText('0.00%')).toHaveClass('text-white');
  });
});
