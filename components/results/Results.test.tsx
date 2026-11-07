import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { MatchResult } from '@/lib/results';
import type { Candle, SymbolInfo } from '@/lib/types';

const nav = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => nav, usePathname: () => '/results/x' }));
// Session candles: by default the symbol is not in the data, so the chart and buy & hold show "unavailable".
const data = vi.hoisted(() => ({ loadIndex: vi.fn(async (): Promise<SymbolInfo[]> => []), loadCandles: vi.fn(async (): Promise<Candle[]> => []) }));
vi.mock('@/lib/data', async (orig) => ({ ...(await orig<typeof import('@/lib/data')>()), loadIndex: data.loadIndex, loadCandles: data.loadCandles }));
vi.mock('lightweight-charts', () => {
  const series = { setData: vi.fn(), update: vi.fn(), setMarkers: vi.fn(), applyOptions: vi.fn(), createPriceLine: vi.fn(() => ({})), removePriceLine: vi.fn() };
  const chart = { addCandlestickSeries: () => series, addHistogramSeries: () => series, priceScale: () => ({ applyOptions: vi.fn() }), timeScale: () => ({ fitContent: vi.fn(), scrollToRealTime: vi.fn() }), applyOptions: vi.fn(), subscribeCrosshairMove: vi.fn(), unsubscribeCrosshairMove: vi.fn(), remove: vi.fn() };
  return { createChart: () => chart, ColorType: { Solid: 'solid' }, CrosshairMode: { Normal: 0 }, LineStyle: { Dashed: 2 } };
});
import { listResults, saveResult } from '@/lib/storage';
import { HistoryView } from './HistoryView';
import { RECENT_COUNT, RecentResults } from './RecentResults';
import { ResultView } from './ResultView';
import { ResultsReport } from './ResultsReport';

const result = (id: string, playedAt: number, over: Partial<MatchResult> = {}, stats: Partial<MatchResult['stats']> = {}): MatchResult => ({
  version: 1,
  id,
  symbol: 'NQ=F',
  symbolName: 'Nasdaq 100 E-mini Futures',
  currency: 'USD',
  priceDecimals: 2,
  lotStep: 0.01,
  config: { symbol: 'NQ=F', currency: 'USD', interval: '1m', durationMs: 600_000, startingBalance: 100_000, maxDrawdownPct: 5, lotStep: 0.01 },
  endReason: 'timer',
  playedAt,
  sessionStart: 1_791_293_400,
  sessionEnd: 1_791_294_000,
  stats: {
    startingBalance: 100_000,
    finalEquity: 100_000,
    pnl: 0,
    returnPct: 0,
    trades: 0,
    wins: 0,
    losses: 0,
    winRate: null,
    profitFactor: null,
    grossProfit: 0,
    grossLoss: 0,
    maxDrawdownPct: 0,
    avgWin: null,
    avgLoss: null,
    largestWin: null,
    largestLoss: null,
    durationMs: 600_000,
    ...stats,
  },
  trades: [],
  equityCurve: [],
  ...over,
});

const withTrades = result(
  'w',
  2,
  {
    trades: [
      { id: 't1', symbol: 'NQ=F', side: 'buy', units: 1.5, entry: 20_000, exit: 20_100, pnl: 150, openedAt: 1_791_293_460, closedAt: 1_791_293_460 + 2700 },
      { id: 't2', symbol: 'NQ=F', side: 'sell', units: 1, entry: 20_100, exit: 20_150, pnl: -50, openedAt: 1_791_293_600, closedAt: 1_791_293_660 },
    ],
  },
  { pnl: 100, returnPct: 0.1, finalEquity: 100_100, trades: 2, wins: 1, losses: 1, winRate: 50, profitFactor: 3, grossProfit: 150, grossLoss: 50, maxDrawdownPct: 0.75, avgWin: 150, avgLoss: -50, largestWin: 150, largestLoss: -50 },
);

beforeEach(() => {
  localStorage.clear();
  nav.push.mockReset();
  data.loadIndex.mockClear();
});

const tile = (label: string) => screen.getByText(label, { selector: 'div' }).parentElement!;

describe('ResultsReport', () => {
  it('shows — for win rate and profit factor with no trades, and the empty trade list', () => {
    render(<ResultsReport result={result('a', 1)} />);
    expect(within(tile('Win rate')).getByText('—')).toBeInTheDocument();
    expect(within(tile('Profit factor')).getByText('—')).toBeInTheDocument();
    expect(screen.getByText('No trades this match')).toBeInTheDocument();
    expect(screen.getByText('Not enough data for a curve')).toBeInTheDocument();
    expect(screen.getByText("Time's up")).toBeInTheDocument();
  });

  it('shows stats and every trade with signed P&L', () => {
    render(<ResultsReport result={withTrades} />);
    expect(within(tile('Win rate')).getByText('50.0%')).toBeInTheDocument();
    expect(within(tile('Profit factor')).getByText('3.00')).toBeInTheDocument();
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('+$150.00');
    expect(rows[0]).toHaveTextContent('45m');
    expect(rows[1]).toHaveTextContent('-$50.00');
  });

  it('formats an INR result in rupees and names a drawdown end', () => {
    render(<ResultsReport result={result('i', 1, { currency: 'INR', symbol: '^NSEI', endReason: 'drawdown' }, { pnl: -50_000, startingBalance: 1_000_000, finalEquity: 950_000, returnPct: -5 })} />);
    expect(screen.getAllByText('-₹50,000.00').length).toBeGreaterThan(0);
    expect(screen.getByText('Max drawdown reached')).toBeInTheDocument();
    expect(screen.getByText(/₹10,00,000.00 → ₹9,50,000.00/)).toBeInTheDocument();
  });
});

describe('ResultView', () => {
  it('loads a saved result', async () => {
    saveResult(withTrades);
    render(<ResultView id="w" />);
    expect(await screen.findByText('+$100.00', { selector: '.text-3xl' })).toBeInTheDocument();
  });

  it('explains when a result is missing', async () => {
    render(<ResultView id="nope" />);
    expect(await screen.findByText('Result not found')).toBeInTheDocument();
  });
});

describe('history', () => {
  it('lists saved matches newest first and deletes one after confirming', async () => {
    saveResult(result('old', 1));
    saveResult(withTrades);
    render(<HistoryView />);
    const rows = (await screen.findAllByRole('row')).slice(1);
    expect(rows[0]).toHaveTextContent('+$100.00');
    expect(rows[1]).toHaveTextContent('$0.00');
    await userEvent.click(screen.getAllByRole('button', { name: /^Delete/ })[1]);
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(listResults().results.map((r) => r.id)).toEqual(['w']);
    expect(screen.getAllByRole('row')).toHaveLength(2);
  });

  it('clears all after confirming, and Cancel keeps them', async () => {
    saveResult(result('a', 1));
    render(<HistoryView />);
    await userEvent.click(await screen.findByRole('button', { name: 'Clear history' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(listResults().results).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', { name: 'Clear history' }));
    await userEvent.click(screen.getAllByRole('button', { name: 'Clear history' }).at(-1)!);
    expect(listResults().results).toHaveLength(0);
    expect(screen.getByText('No matches yet')).toBeInTheDocument();
  });

  it('warns when stored data could not be read', async () => {
    localStorage.setItem('qs-pvp:results:v1', '{broken');
    render(<HistoryView />);
    expect(await screen.findByText(/could not be read/)).toBeInTheDocument();
  });

  it(`landing shows the latest ${RECENT_COUNT} with a link to all`, async () => {
    for (let i = 0; i < 7; i++) saveResult(result(`r${i}`, i));
    render(<RecentResults />);
    expect((await screen.findAllByRole('row')).slice(1)).toHaveLength(RECENT_COUNT);
    expect(screen.getByRole('link', { name: /View all/ })).toHaveAttribute('href', '/history');
  });

  it('landing shows the empty state with no matches', async () => {
    render(<RecentResults />);
    expect(await screen.findByText('No matches yet')).toBeInTheDocument();
  });
});

describe('axisMoney', () => {
  it('keeps ticks distinct on a narrow range and goes compact on a wide one', async () => {
    const { axisMoney } = await import('./EquityChart');
    expect(axisMoney(100_050, 'USD', 200)).toBe('$100,050');
    expect(axisMoney(1_000_500, 'INR', 2000)).toBe('₹10,00,500');
    expect(axisMoney(150_000, 'USD', 100_000)).toBe('$150K');
  });
});
