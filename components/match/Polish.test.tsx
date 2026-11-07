import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TradePanel } from '@/components/trade/TradePanel';
import { Dialog } from '@/components/ui/Dialog';
import { PanelErrorBoundary } from '@/components/ui/PanelErrorBoundary';
import type { Candle, MatchConfig, SymbolInfo } from '@/lib/types';
import { matchStore } from '@/store/matchStore';
import { useHotkeys } from '@/store/useHotkeys';

const CONFIG: MatchConfig = { symbol: 'NQ=F', currency: 'USD', interval: '1m', durationMs: 600_000, startingBalance: 100_000, maxDrawdownPct: 5, lotStep: 0.01 };
const INFO: SymbolInfo = { symbol: 'NQ=F', name: 'Nasdaq', assetClass: 'futures', currency: 'USD', dataFile: 'x.csv', barsAvailable: 0, firstTime: 0, lastTime: 0, lotStep: 0.01, priceDecimals: 2 };
const candles: Candle[] = Array.from({ length: 20 }, (_, i) => ({ time: 60 * (i + 1), open: 20_000, high: 20_010, low: 19_990, close: 20_000, volume: 1 }));

function Harness({ onHelp = () => {}, modal = false }: { onHelp?: () => void; modal?: boolean }) {
  useHotkeys(onHelp);
  return (
    <>
      <TradePanel />
      <input aria-label="notes" />
      <Dialog open={modal} title="Some dialog">
        <button>ok</button>
      </Dialog>
    </>
  );
}

beforeEach(() => {
  act(() => {
    matchStore.getState().reset();
    matchStore.getState().start({ config: CONFIG, session: { candles, startCursor: 0, limitedData: false }, info: INFO });
  });
  (document.activeElement as HTMLElement | null)?.blur();
});

describe('keyboard shortcuts on the match screen', () => {
  it('Space plays and pauses; → steps one candle', async () => {
    render(<Harness />);
    await userEvent.keyboard(' ');
    expect(matchStore.getState().match?.status).toBe('running');
    await userEvent.keyboard(' ');
    expect(matchStore.getState().match?.status).toBe('paused');
    await userEvent.keyboard('{ArrowRight}');
    expect(matchStore.getState().match?.cursor).toBe(1);
  });

  it('B focuses the size box ready to buy; Enter there places the order', async () => {
    render(<Harness />);
    act(() => matchStore.getState().play());
    await userEvent.keyboard('b');
    const size = screen.getByLabelText(/^Size \(/);
    expect(size).toHaveFocus();
    expect(screen.getByText('Press Enter in the size box to buy.')).toBeInTheDocument();
    await userEvent.keyboard('{Enter}');
    expect(matchStore.getState().match?.positions[0]?.units).toBe(0.5); // 10% at 20,000
  });

  it('S then Enter sells', async () => {
    render(<Harness />);
    act(() => matchStore.getState().play());
    await userEvent.keyboard('s');
    await userEvent.keyboard('{Enter}');
    expect(matchStore.getState().match?.positions[0]?.units).toBe(-0.5);
  });

  it('typing in another field never triggers shortcuts', async () => {
    render(<Harness />);
    await userEvent.type(screen.getByLabelText('notes'), 'b s ');
    expect(matchStore.getState().match?.status).toBe('idle');
    expect(screen.getByLabelText('notes')).toHaveValue('b s ');
  });

  it('shortcuts are off while a modal is open', async () => {
    render(<Harness modal />);
    await userEvent.keyboard(' ');
    expect(matchStore.getState().match?.status).toBe('idle');
  });

  it('? opens the shortcut list', async () => {
    const onHelp = vi.fn();
    render(<Harness onHelp={onHelp} />);
    await userEvent.keyboard('?');
    expect(onHelp).toHaveBeenCalledTimes(1);
  });
});

describe('PanelErrorBoundary', () => {
  it('contains a crashing card and can retry', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    let crash = true;
    const Boom = () => {
      if (crash) throw new Error('boom');
      return <p>fine now</p>;
    };
    render(
      <>
        <PanelErrorBoundary name="chart">
          <Boom />
        </PanelErrorBoundary>
        <p>other card</p>
      </>,
    );
    expect(screen.getByText('The chart could not be shown.')).toBeInTheDocument();
    expect(screen.getByText('other card')).toBeInTheDocument();
    crash = false;
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(screen.getByText('fine now')).toBeInTheDocument();
    spy.mockRestore();
  });
});
