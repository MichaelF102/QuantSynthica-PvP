import { beforeEach, describe, expect, it } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MobilePlayButton } from '@/components/match/MobilePlayButton';
import type { Candle, MatchConfig, SymbolInfo } from '@/lib/types';
import { matchStore } from '@/store/matchStore';
import { ticketStore } from '@/store/ticketStore';
import { toastStore } from '@/store/toastStore';
import { MobileTradeBar } from './MobileTradeBar';
import { TradePanel } from './TradePanel';

// The phone action bar places orders through the trade panel, so the panel's size and checks apply.

const CONFIG: MatchConfig = { symbol: 'NQ=F', currency: 'USD', interval: '1m', durationMs: 600_000, startingBalance: 100_000, maxDrawdownPct: 5, lotStep: 0.01 };
const INFO: SymbolInfo = { symbol: 'NQ=F', name: 'Nasdaq', assetClass: 'futures', currency: 'USD', dataFile: 'x.csv', barsAvailable: 0, firstTime: 0, lastTime: 0, lotStep: 0.01, priceDecimals: 2 };
const T0 = 1_791_293_400;
const candles: Candle[] = [20_000, 20_100, 19_900, 20_000].map((close, i) => ({ time: T0 + 60 * i, open: close, high: close + 5, low: close - 5, close, volume: 1 }));

beforeEach(() => {
  act(() => {
    matchStore.getState().reset();
    toastStore.getState().clear();
    matchStore.getState().start({ config: CONFIG, session: { candles, startCursor: 0, limitedData: false }, info: INFO });
    matchStore.getState().play();
    matchStore.getState().pause();
  });
});

const bar = () => within(screen.getByRole('region', { name: 'Quick trade' }));

describe('MobileTradeBar', () => {
  it('is not shown without a trade panel', () => {
    render(<MobileTradeBar />);
    expect(screen.queryByRole('region', { name: 'Quick trade' })).not.toBeInTheDocument();
  });

  it('buys and sells with the panel size and shows the open position', async () => {
    render(
      <>
        <TradePanel />
        <MobileTradeBar />
      </>,
    );
    await userEvent.click(bar().getByRole('button', { name: /^Buy 10% · 0\.5 NQ/ }));
    expect(matchStore.getState().match!.positions[0].units).toBe(0.5);
    expect(bar().getByText('Long')).toBeInTheDocument();

    await userEvent.click(bar().getByRole('button', { name: /^Sell/ }));
    expect(matchStore.getState().match!.positions).toHaveLength(0);
    expect(bar().getByText('Flat')).toBeInTheDocument();
  });

  it('is blocked with the panel reason when the size is invalid', async () => {
    render(
      <>
        <TradePanel />
        <MobileTradeBar />
      </>,
    );
    const size = screen.getByLabelText(/^Size \(/);
    await userEvent.clear(size);
    await userEvent.type(size, '0');
    expect(bar().getByRole('button', { name: /^Buy/ })).toBeDisabled();
    expect(bar().getByRole('button', { name: /^Sell/ })).toBeDisabled();
    expect(bar().getByText(/below the minimum lot/)).toBeInTheDocument();
  });

  it('clears when the trade panel goes away', () => {
    const { unmount } = render(<TradePanel />);
    expect(ticketStore.getState().ticket).not.toBeNull();
    unmount();
    expect(ticketStore.getState().ticket).toBeNull();
  });
});

describe('MobilePlayButton', () => {
  it('toggles the replay', async () => {
    render(<MobilePlayButton />);
    await userEvent.click(screen.getByRole('button', { name: 'Resume replay' }));
    expect(matchStore.getState().match!.status).toBe('running');
    await userEvent.click(screen.getByRole('button', { name: 'Pause replay' }));
    expect(matchStore.getState().match!.status).toBe('paused');
  });
});
