import { describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { parseClientMessage } from '@/lib/multiplayer/protocol';
import type { Candle, MatchConfig, SymbolInfo } from '@/lib/types';
import { createMatchStore, matchStore } from '@/store/matchStore';
import { toastStore } from '@/store/toastStore';
import { levelsFrom } from './OrderLevels';
import { TradePanel } from './TradePanel';

// Plan M15: a stop and target on the order ticket. TEST FIXTURE: hand-built candles.

const CONFIG: MatchConfig = { symbol: 'NQ=F', currency: 'USD', interval: '1m', durationMs: 600_000, startingBalance: 100_000, maxDrawdownPct: 50, lotStep: 1 };
const INFO: SymbolInfo = { symbol: 'NQ=F', name: 'Nasdaq', assetClass: 'futures', currency: 'USD', dataFile: 'x.csv', barsAvailable: 0, firstTime: 0, lastTime: 0, lotStep: 1, priceDecimals: 2 };
const candles: Candle[] = [100, 100, 100].map((close, i) => ({ time: 1_791_293_400 + 60 * i, open: close, high: close, low: close, close, volume: 1 }));

function start() {
  act(() => {
    matchStore.getState().reset();
    toastStore.getState().clear();
    matchStore.getState().start({ config: CONFIG, session: { candles, startCursor: 0, limitedData: false }, info: INFO });
    matchStore.getState().play();
    matchStore.getState().pause();
  });
}

describe('levelsFrom', () => {
  it('is null when off or empty, invalid for junk', () => {
    expect(levelsFrom({ on: false, stopText: '95', targetText: '' })).toBeNull();
    expect(levelsFrom({ on: true, stopText: ' ', targetText: '' })).toBeNull();
    expect(levelsFrom({ on: true, stopText: '9x', targetText: '' })).toBe('invalid');
    expect(levelsFrom({ on: true, stopText: '1,000.5', targetText: '' })).toEqual({ stopLoss: 1000.5, takeProfit: null });
  });
});

describe('ticket levels', () => {
  it('shows risk and reward, blocks the side the levels do not fit, and sends them with the order', async () => {
    start();
    render(<TradePanel />);
    await userEvent.clear(screen.getByLabelText(/^Size \(/));
    await userEvent.click(screen.getByRole('button', { name: 'Units' }));
    await userEvent.type(screen.getByLabelText(/^Size \(/), '10');
    await userEvent.click(screen.getByLabelText('Attach stop / target to this order'));
    await userEvent.type(screen.getByLabelText('Stop loss'), '95');
    await userEvent.type(screen.getByLabelText('Take profit'), '110');
    expect(screen.getByText(/Buy: risk \$50\.00 \(0\.05% of balance\) · reward \$100\.00 · 1 : 2\.0/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sell' })).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: 'Buy' }));
    expect(matchStore.getState().match?.positions[0]).toMatchObject({ units: 10, stopLoss: 95, takeProfit: 110 });
    expect(toastStore.getState().toasts.at(-1)?.message).toBe('Bought 10 NQ @ 100.00 · SL 95.00 · TP 110.00');
    // The levels went with that order only.
    expect(screen.getByLabelText('Attach stop / target to this order')).not.toBeChecked();
  });

  it('blocks both sides while a level is not a number', async () => {
    start();
    render(<TradePanel />);
    await userEvent.click(screen.getByLabelText('Attach stop / target to this order'));
    await userEvent.type(screen.getByLabelText('Stop loss'), 'abc');
    expect(screen.getByRole('button', { name: 'Buy' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Sell' })).toBeDisabled();
  });
});

describe('store and rooms', () => {
  it('a queued next-open order announces its levels', () => {
    const notify = vi.fn();
    const store = createMatchStore({ now: () => 0, notify, persist: () => true });
    store.getState().start({ config: { ...CONFIG, fillModel: 'next_open' }, session: { candles, startCursor: 0, limitedData: false }, info: INFO });
    store.getState().play();
    store.getState().buy({ mode: 'units', value: 2 }, { stopLoss: 95, takeProfit: null });
    expect(notify).toHaveBeenLastCalledWith('info', 'Buy 2 NQ queued for the next open · SL 95.00');
  });

  it('the room protocol carries levels on an order and refuses bad ones', () => {
    const msg = (order: object) => parseClientMessage(JSON.stringify({ type: 'order', seq: 1, order }));
    expect(msg({ side: 'buy', units: 2, stopLoss: 95, takeProfit: null })).toEqual({ type: 'order', seq: 1, order: { side: 'buy', units: 2, stopLoss: 95, takeProfit: null } });
    expect(msg({ side: 'buy', units: 2 })).toEqual({ type: 'order', seq: 1, order: { side: 'buy', units: 2 } });
    expect(msg({ side: 'buy', units: 2, stopLoss: -5 })).toBeNull();
    expect(msg({ side: 'buy', units: 2, takeProfit: 'x' })).toBeNull();
  });
});
