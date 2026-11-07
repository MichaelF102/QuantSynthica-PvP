import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { MatchResult } from '@/lib/results';
import { saveResult } from '@/lib/storage';
import { ProgressView } from './ProgressView';

// Plan M13 Part A. TEST FIXTURE: hand-written saved results, not real matches.

const result = (id: string, symbol: string, playedAt: number, returnPct: number, trades = 2, wins = 1): MatchResult => ({
  version: 1,
  id,
  symbol,
  symbolName: `${symbol} test fixture`,
  currency: 'USD',
  priceDecimals: 2,
  lotStep: 1,
  config: { symbol, currency: 'USD', interval: '1m', durationMs: 600_000, startingBalance: 100_000, maxDrawdownPct: 5, lotStep: 1 },
  endReason: 'timer',
  playedAt,
  sessionStart: 1_791_293_400,
  sessionEnd: 1_791_294_000,
  stats: {
    startingBalance: 100_000,
    finalEquity: 100_000 * (1 + returnPct / 100),
    pnl: 1000 * returnPct,
    returnPct,
    trades,
    wins,
    losses: trades - wins,
    winRate: trades ? (wins / trades) * 100 : null,
    profitFactor: null,
    grossProfit: 0,
    grossLoss: 0,
    maxDrawdownPct: 1,
    avgWin: null,
    avgLoss: null,
    largestWin: null,
    largestLoss: null,
    durationMs: 600_000,
  },
  trades: [],
  equityCurve: [],
});

beforeEach(() => localStorage.clear());

describe('ProgressView', () => {
  it('shows an empty state with nothing saved', async () => {
    render(<ProgressView />);
    expect(await screen.findByText('No finished matches yet')).toBeInTheDocument();
  });

  it('summarises saved matches and ranks symbols', async () => {
    saveResult(result('a', 'NQ=F', 1, 2));
    saveResult(result('b', 'NQ=F', 2, 1));
    saveResult(result('c', 'AAPL', 3, -1.5, 4, 1));
    render(<ProgressView />);
    const summary = await screen.findByRole('region', { name: 'Practice summary' });
    expect(within(summary).getByText('+0.50%')).toBeInTheDocument(); // average of 2, 1, −1.5
    expect(within(summary).getByText('37.5%')).toBeInTheDocument(); // 3 wins / 8 trades
    const table = screen.getByRole('table', { name: /by symbol/ });
    const rows = within(table).getAllByRole('row');
    expect(within(rows[1]).getByText('NQ')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Best')).toBeInTheDocument();
    expect(within(rows[2]).getByText('Worst')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Return per match for 3 matches/ })).toBeInTheDocument();
  });

  it('asks for a second match before drawing a trend', async () => {
    saveResult(result('a', 'NQ=F', 1, 2));
    render(<ProgressView />);
    expect(await screen.findAllByText('Play at least 2 matches to see a trend.')).toHaveLength(2);
  });
});
