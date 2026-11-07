import { beforeEach, describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Candle, MatchConfig, SymbolInfo } from '@/lib/types';
import { matchStore } from '@/store/matchStore';
import { ReplayControls } from './ReplayControls';
import { MatchTimer, timerTone } from './MatchTimer';

const CONFIG: MatchConfig = { symbol: 'TEST', currency: 'USD', interval: '1m', durationMs: 600_000, startingBalance: 100_000, maxDrawdownPct: 5, lotStep: 0.01 };
const INFO: SymbolInfo = { symbol: 'TEST', name: 'Test', assetClass: 'index', currency: 'USD', dataFile: 't.csv', barsAvailable: 0, firstTime: 0, lastTime: 0, lotStep: 0.01, priceDecimals: 2 };
const T0 = 1_791_293_400;
const candles: Candle[] = Array.from({ length: 200 }, (_, i) => ({ time: T0 + 60 * i, open: 100, high: 101, low: 99, close: 100, volume: 0 }));

beforeEach(() => {
  act(() => {
    matchStore.getState().reset();
    matchStore.getState().start({ config: CONFIG, session: { candles, startCursor: 49, limitedData: false }, info: INFO });
  });
});

describe('ReplayControls', () => {
  it('shows Start, the full timer and progress over playable candles', () => {
    render(
      <>
        <ReplayControls />
        <MatchTimer />
      </>,
    );
    expect(screen.getByRole('button', { name: 'Start replay' })).toBeEnabled();
    expect(screen.getByRole('timer')).toHaveTextContent('10:00');
    expect(screen.getByText(/Candle/)).toHaveTextContent('Candle 0 / 150');
    expect(screen.getByText('2026-10-06 14:19 UTC')).toBeInTheDocument();
  });

  it('play toggles to pause', async () => {
    render(<ReplayControls />);
    await userEvent.click(screen.getByRole('button', { name: 'Start replay' }));
    expect(matchStore.getState().match?.status).toBe('running');
    await userEvent.click(screen.getByRole('button', { name: 'Pause replay' }));
    expect(matchStore.getState().match?.status).toBe('paused');
    expect(screen.getByRole('button', { name: 'Resume replay' })).toBeInTheDocument();
  });

  it('step reveals one candle; speed buttons set the speed', async () => {
    render(<ReplayControls />);
    await userEvent.click(screen.getByRole('button', { name: 'Step one candle' }));
    expect(screen.getByText(/Candle/)).toHaveTextContent('Candle 1 / 150');
    await userEvent.click(screen.getByRole('button', { name: '5x' }));
    expect(matchStore.getState().speed).toBe(5);
    expect(screen.getByRole('button', { name: '5x' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('jump menu skips candles and validates the time input', async () => {
    render(<ReplayControls />);
    await userEvent.click(screen.getByRole('button', { name: /Jump/ }));
    await userEvent.click(screen.getByRole('button', { name: '+15' }));
    expect(matchStore.getState().match?.cursor).toBe(64);

    await userEvent.click(screen.getByRole('button', { name: /Jump/ }));
    const input = screen.getByLabelText('Jump to time (UTC)');
    // jsdom cannot type into datetime-local inputs, so set the value directly.
    fireEvent.change(input, { target: { value: '2026-10-06T13:00' } });
    await userEvent.click(screen.getByRole('button', { name: 'Go' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/after the current candle/);
    expect(matchStore.getState().match?.cursor).toBe(64);

    fireEvent.change(input, { target: { value: '2026-10-06T15:00' } });
    await userEvent.click(screen.getByRole('button', { name: 'Go' }));
    expect(matchStore.getState().match?.cursor).toBe(90); // 13:30 + 90 min
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('disables everything once the match has ended', () => {
    act(() => matchStore.getState().jumpBy(1000));
    render(<ReplayControls />);
    expect(screen.getByRole('button', { name: /replay/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Step one candle' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Jump/ })).toBeDisabled();
  });
});

describe('timerTone', () => {
  it('turns amber under a minute and rose under 10 seconds', () => {
    expect(timerTone(61_000)).toMatch(/text-white/);
    expect(timerTone(59_000)).toMatch(/amber/);
    expect(timerTone(9_000)).toMatch(/rose/);
  });
});
