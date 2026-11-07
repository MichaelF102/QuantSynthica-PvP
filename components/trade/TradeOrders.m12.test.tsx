import { describe, expect, it } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Candle, MatchConfig, SymbolInfo } from '@/lib/types';
import { matchStore } from '@/store/matchStore';
import { toastStore } from '@/store/toastStore';
import { PositionsTable } from './PositionsTable';
import { TradePanel } from './TradePanel';

// Plan M12: the stop / target editor and the queued order in the trade panel and account table.
// TEST FIXTURE: hand-built candles, not market data.

const CONFIG: MatchConfig = { symbol: 'NQ=F', currency: 'USD', interval: '1m', durationMs: 600_000, startingBalance: 100_000, maxDrawdownPct: 50, lotStep: 1 };
const INFO: SymbolInfo = { symbol: 'NQ=F', name: 'Nasdaq', assetClass: 'futures', currency: 'USD', dataFile: 'x.csv', barsAvailable: 0, firstTime: 0, lastTime: 0, lotStep: 1, priceDecimals: 2 };
const candles: Candle[] = [100, 101, 102, 103].map((close, i) => ({ time: 1_791_293_400 + 60 * i, open: close, high: close, low: close, close, volume: 1 }));

function start(config: Partial<MatchConfig> = {}) {
  act(() => {
    matchStore.getState().reset();
    toastStore.getState().clear();
    matchStore.getState().start({ config: { ...CONFIG, ...config }, session: { candles, startCursor: 0, limitedData: false }, info: INFO });
    matchStore.getState().play();
    matchStore.getState().pause();
  });
}

describe('stop-loss / take-profit editor', () => {
  it('appears with a position and sets the levels', async () => {
    start();
    render(<TradePanel />);
    expect(screen.queryByLabelText('Stop loss')).not.toBeInTheDocument();
    act(() => void matchStore.getState().buy({ mode: 'units', value: 5 }));
    await userEvent.type(screen.getByLabelText('Stop loss'), '95');
    await userEvent.type(screen.getByLabelText('Take profit'), '110');
    await userEvent.click(screen.getByRole('button', { name: 'Set levels' }));
    expect(matchStore.getState().match?.positions[0]).toMatchObject({ stopLoss: 95, takeProfit: 110 });
    expect(screen.getByText('SL 95.00 · TP 110.00')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(matchStore.getState().match?.positions[0]).not.toHaveProperty('stopLoss');
  });

  it('flags a level that is not a number', async () => {
    start();
    render(<TradePanel />);
    act(() => void matchStore.getState().buy({ mode: 'units', value: 5 }));
    await userEvent.type(screen.getByLabelText('Stop loss'), '9x');
    expect(screen.getByText(/digits only/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Set levels' })).toBeDisabled();
  });
});

describe('queued order (next-open fills)', () => {
  it('shows the waiting order in the panel and the Orders tab, and cancels it', async () => {
    start({ fillModel: 'next_open' });
    render(
      <>
        <TradePanel />
        <PositionsTable />
      </>,
    );
    expect(screen.getByText(/next candle open/)).toBeInTheDocument();
    act(() => void matchStore.getState().buy({ mode: 'units', value: 5 }));
    expect(screen.getByRole('status')).toHaveTextContent('Buy 5 NQ fills at the next open');
    expect(screen.getByRole('button', { name: 'Buy' })).toBeDisabled();

    await userEvent.click(screen.getByRole('tab', { name: /Orders/ }));
    expect(screen.getByText('Market at next open')).toBeInTheDocument();

    await userEvent.click(screen.getAllByRole('button', { name: 'Cancel' })[0]);
    expect(matchStore.getState().match?.queued).toBeNull();
    expect(screen.getByText('No pending orders')).toBeInTheDocument();
  });
});
