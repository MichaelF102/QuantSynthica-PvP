import { beforeEach, describe, expect, it } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Candle, MatchConfig, SymbolInfo } from '@/lib/types';
import { matchStore } from '@/store/matchStore';
import { toastStore } from '@/store/toastStore';
import { PositionsTable } from './PositionsTable';
import { TradePanel } from './TradePanel';

const CONFIG: MatchConfig = { symbol: 'NQ=F', currency: 'USD', interval: '1m', durationMs: 600_000, startingBalance: 100_000, maxDrawdownPct: 5, lotStep: 0.01 };
const INFO: SymbolInfo = { symbol: 'NQ=F', name: 'Nasdaq', assetClass: 'futures', currency: 'USD', dataFile: 'x.csv', barsAvailable: 0, firstTime: 0, lastTime: 0, lotStep: 0.01, priceDecimals: 2 };
const T0 = 1_791_293_400;
const candles: Candle[] = [20_000, 20_100, 19_900, 20_000].map((close, i) => ({ time: T0 + 60 * i, open: close, high: close + 5, low: close - 5, close, volume: 1 }));

function start(play = true) {
  act(() => {
    matchStore.getState().reset();
    toastStore.getState().clear();
    matchStore.getState().start({ config: CONFIG, session: { candles, startCursor: 0, limitedData: false }, info: INFO });
    if (play) {
      matchStore.getState().play();
      matchStore.getState().pause();
    }
  });
}

const buyBtn = () => screen.getByRole('button', { name: 'Buy' });
const sellBtn = () => screen.getByRole('button', { name: 'Sell' });
const sizeInput = () => screen.getByLabelText(/^Size \(/);

describe('TradePanel (CLAUDE.md §12)', () => {
  beforeEach(() => start());

  it('disables Buy and Sell when the size is 0, with the reason', async () => {
    render(<TradePanel />);
    await userEvent.clear(sizeInput());
    await userEvent.type(sizeInput(), '0');
    expect(buyBtn()).toBeDisabled();
    expect(sellBtn()).toBeDisabled();
    expect(screen.getByText(/below the minimum lot/)).toBeInTheDocument();
  });

  it('disables both when the empty size is invalid', async () => {
    render(<TradePanel />);
    await userEvent.clear(sizeInput());
    expect(buyBtn()).toBeDisabled();
    expect(buyBtn()).toHaveAccessibleDescription('Enter a positive size');
  });

  it('disables Buy when the balance is insufficient', async () => {
    render(<TradePanel />);
    await userEvent.click(screen.getByRole('button', { name: 'Units' }));
    await userEvent.clear(sizeInput());
    await userEvent.type(sizeInput(), '6'); // 6 x 20,000 = 120,000 > 100,000
    expect(buyBtn()).toBeDisabled();
    expect(buyBtn()).toHaveAccessibleDescription('Insufficient balance');
  });

  it('enables both for a valid size and previews the order', () => {
    render(<TradePanel />);
    expect(buyBtn()).toBeEnabled();
    expect(sellBtn()).toBeEnabled();
    expect(screen.getByText('0.5')).toBeInTheDocument(); // 10% of 100,000 at 20,000
    expect(screen.getByText('$10,000.00')).toBeInTheDocument();
  });

  it('disables trading before the match starts', () => {
    start(false);
    render(<TradePanel />);
    expect(buyBtn()).toBeDisabled();
    expect(buyBtn()).toHaveAccessibleDescription('Start the replay to trade');
  });

  it('Buy fills through the store, shows the position and a toast', async () => {
    render(<TradePanel />);
    await userEvent.click(screen.getByRole('button', { name: '25%' }));
    await userEvent.click(buyBtn());
    expect(matchStore.getState().match?.positions[0]).toMatchObject({ units: 1.25 });
    expect(screen.getByText('Long')).toBeInTheDocument();
    expect(toastStore.getState().toasts.at(-1)?.message).toBe('Bought 1.25 NQ @ 20,000.00');
  });

  it('keeps the same order size when switching between % and units', async () => {
    render(<TradePanel />);
    await userEvent.click(screen.getByRole('button', { name: 'Units' }));
    expect(sizeInput()).toHaveValue(0.5);
    await userEvent.click(screen.getByRole('button', { name: '% of balance' }));
    expect(sizeInput()).toHaveValue(10);
  });
});

describe('PositionsTable', () => {
  beforeEach(() => start());

  it('shows empty states for each tab', async () => {
    render(<PositionsTable />);
    expect(screen.getByText('No open positions')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: /Orders/ }));
    expect(screen.getByText('No pending orders')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: /History/ }));
    expect(screen.getByText('No closed trades yet')).toBeInTheDocument();
  });

  it('lists the open position with signed, coloured P&L and closes it', async () => {
    act(() => {
      matchStore.getState().buy({ mode: 'units', value: 1 });
      matchStore.getState().step(); // 20,100
    });
    render(<PositionsTable />);
    const pnl = screen.getByText('+$100.00');
    expect(pnl).toHaveClass('text-emerald-400');
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(matchStore.getState().match?.positions).toEqual([]);
  });

  it('history lists closed trades newest first', async () => {
    act(() => {
      const s = matchStore.getState();
      s.buy({ mode: 'units', value: 1 });
      s.step(); // 20,100
      s.sell({ mode: 'units', value: 1 }); // +100
      s.sell({ mode: 'units', value: 1 });
      s.step(); // 19,900
      s.buy({ mode: 'units', value: 1 }); // short +200
    });
    render(<PositionsTable />);
    await userEvent.click(screen.getByRole('tab', { name: /History/ }));
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows[0]).toHaveTextContent('+$200.00');
    expect(rows[1]).toHaveTextContent('+$100.00');
  });
});
