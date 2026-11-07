import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Candle, MatchConfig, SymbolInfo } from '@/lib/types';
import { matchStore } from '@/store/matchStore';
import { useBeforeUnloadGuard } from '@/store/useLeaveGuard';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

const nav = vi.hoisted(() => ({ push: vi.fn(), pathname: '/practice' }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: nav.push }), usePathname: () => nav.pathname }));

import { Navbar } from '@/components/layout/Navbar';
import { END_DIALOG_MS, MatchEndDialog } from './MatchEndDialog';
import { EndMatchButton } from './EndMatchButton';

const CONFIG: MatchConfig = { symbol: 'NQ=F', currency: 'USD', interval: '1m', durationMs: 600_000, startingBalance: 100_000, maxDrawdownPct: 5, lotStep: 1 };
const INFO: SymbolInfo = { symbol: 'NQ=F', name: 'Nasdaq', assetClass: 'futures', currency: 'USD', dataFile: 'x.csv', barsAvailable: 0, firstTime: 0, lastTime: 0, lotStep: 1, priceDecimals: 2 };
const candles: Candle[] = [100, 101, 102, 103].map((close, i) => ({ time: 60 * (i + 1), open: close, high: close + 1, low: close - 1, close, volume: 0 }));

function startMatch(playIt = true) {
  act(() => {
    matchStore.getState().reset();
    matchStore.getState().start({ config: CONFIG, session: { candles, startCursor: 0, limitedData: false }, info: INFO });
    if (playIt) matchStore.getState().play();
  });
}

beforeEach(() => {
  nav.push.mockClear();
  startMatch();
});
afterEach(() => vi.useRealTimers());

describe('ConfirmDialog', () => {
  it('focuses Cancel first, cancels on Esc and traps Tab', async () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog open title="Sure?" confirmLabel="Yes" onCancel={onCancel} onConfirm={onConfirm}>
        Body
      </ConfirmDialog>,
    );
    expect(screen.getByRole('alertdialog', { name: 'Sure?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Yes' })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus(); // wrapped
    await userEvent.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

describe('EndMatchButton', () => {
  it('opening the dialog pauses; Cancel keeps the match paused', async () => {
    render(<EndMatchButton />);
    await userEvent.click(screen.getByRole('button', { name: 'End match' }));
    expect(matchStore.getState().match?.status).toBe('paused');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(matchStore.getState().match?.status).toBe('paused');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('confirming ends the match with "user" and closes open positions', async () => {
    act(() => void matchStore.getState().buy({ mode: 'units', value: 5 }));
    render(<EndMatchButton />);
    await userEvent.click(screen.getByRole('button', { name: 'End match' }));
    expect(screen.getByRole('alertdialog')).toHaveTextContent('close at the last revealed price, 100.00');
    await userEvent.click(screen.getAllByRole('button', { name: 'End match' }).at(-1)!);
    expect(matchStore.getState().match).toMatchObject({ status: 'ended', endReason: 'user', positions: [] });
  });

  it('is hidden before the match starts', () => {
    startMatch(false);
    render(<EndMatchButton />);
    expect(screen.queryByRole('button', { name: 'End match' })).not.toBeInTheDocument();
  });
});

describe('MatchEndDialog', () => {
  it('shows the reason and P&L, then opens the report', () => {
    vi.useFakeTimers();
    act(() => matchStore.getState().endEarly());
    render(<MatchEndDialog />);
    expect(screen.getByRole('dialog', { name: 'Ended by you' })).toHaveTextContent('$0.00');
    act(() => vi.advanceTimersByTime(END_DIALOG_MS));
    expect(nav.push).toHaveBeenCalledWith(`/results/${matchStore.getState().result?.id}`);
  });

  it('renders nothing while the match is live', () => {
    render(<MatchEndDialog />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('leave guards', () => {
  it('beforeunload is only guarded while active', () => {
    const add = vi.spyOn(window, 'addEventListener');
    const remove = vi.spyOn(window, 'removeEventListener');
    const { rerender, unmount } = renderHook(({ on }) => useBeforeUnloadGuard(on), { initialProps: { on: false } });
    expect(add).not.toHaveBeenCalledWith('beforeunload', expect.any(Function));
    rerender({ on: true });
    expect(add).toHaveBeenCalledWith('beforeunload', expect.any(Function));
    const ev = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
    unmount();
    expect(remove).toHaveBeenCalledWith('beforeunload', expect.any(Function));
    add.mockRestore();
    remove.mockRestore();
  });

  it('navbar links ask before leaving a live match', async () => {
    render(<Navbar />);
    await userEvent.click(screen.getByRole('link', { name: 'History' }));
    expect(screen.getByRole('alertdialog', { name: 'Leave the match?' })).toBeInTheDocument();
    expect(matchStore.getState().match?.status).toBe('paused');
    await userEvent.click(screen.getByRole('button', { name: 'Stay' }));
    expect(nav.push).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('link', { name: 'History' }));
    await userEvent.click(screen.getByRole('button', { name: 'Leave' }));
    expect(nav.push).toHaveBeenCalledWith('/history');
  });

  it('navbar links do not ask when no match is live', async () => {
    act(() => matchStore.getState().endEarly());
    render(<Navbar />);
    await userEvent.click(screen.getByRole('link', { name: 'History' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
});
