import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Candle, SymbolInfo } from '@/lib/types';
import { matchStore } from '@/store/matchStore';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => '/practice' }));

// The page renders the real chart wrapper; lightweight-charts needs canvas and matchMedia, which jsdom lacks.
vi.mock('lightweight-charts', () => {
  const series = () => ({ setData: vi.fn(), update: vi.fn(), applyOptions: vi.fn(), setMarkers: vi.fn(), createPriceLine: vi.fn(), removePriceLine: vi.fn() });
  return {
    createChart: () => ({
      addCandlestickSeries: series,
      addHistogramSeries: series,
      priceScale: () => ({ applyOptions: vi.fn() }),
      timeScale: () => ({ scrollToRealTime: vi.fn(), fitContent: vi.fn() }),
      applyOptions: vi.fn(),
      subscribeCrosshairMove: vi.fn(),
      unsubscribeCrosshairMove: vi.fn(),
      remove: vi.fn(),
    }),
    ColorType: { Solid: 'solid' },
    CrosshairMode: { Normal: 0 },
    LineStyle: { Dashed: 2 },
  };
});

const data = vi.hoisted(() => ({ loadIndex: vi.fn(), loadCandles: vi.fn() }));
vi.mock('@/lib/data', async (orig) => ({ ...(await orig<typeof import('@/lib/data')>()), loadIndex: data.loadIndex, loadCandles: data.loadCandles }));

import { MatchView } from '@/components/match/MatchView';
import { COUNTDOWN_FROM, RulesCard } from './RulesCard';
import { SetupModal } from './SetupModal';

const info = (symbol: string, name: string, currency: string, assetClass: SymbolInfo['assetClass']): SymbolInfo => ({ symbol, name, assetClass, currency, dataFile: 'x.csv', barsAvailable: 0, firstTime: 0, lastTime: 0, lotStep: 0.01, priceDecimals: 2 });
const INDEX = [info('NQ=F', 'Nasdaq 100 E-mini Futures', 'USD', 'futures'), info('^NSEI', 'Nifty 50', 'INR', 'index'), info('^GSPC', 'S&P 500', 'USD', 'index')];
const candles: Candle[] = Array.from({ length: 5000 }, (_, i) => ({ time: 1_791_293_400 + 60 * i, open: 100, high: 101, low: 99, close: 100, volume: 1 }));

const balanceInput = () => screen.getByLabelText(/Starting balance/);
const startBtn = () => screen.getByRole('button', { name: /Start match/ });

beforeEach(() => {
  localStorage.clear();
  act(() => matchStore.getState().reset());
});
afterEach(() => vi.useRealTimers());

describe('SetupModal', () => {
  const setup = (onStart = vi.fn()) => {
    render(<SetupModal index={INDEX} last={null} busy={false} error={null} onRetry={vi.fn()} onStart={onStart} />);
    return onStart;
  };

  it('groups symbols and switches the default balance to INR for an INR symbol', async () => {
    setup();
    const group = screen.getByRole('radiogroup', { name: 'Symbol' });
    expect(within(group).getByText('Indices')).toBeInTheDocument(); // futures and indices both group as Indices
    expect(balanceInput()).toHaveValue('100000');
    await userEvent.click(screen.getByRole('radio', { name: /NSEI/ }));
    expect(balanceInput()).toHaveValue('1000000');
    expect(screen.getByText('₹10,00,000.00')).toBeInTheDocument();
    // The balance and the commission field both take the INR prefix.
    expect(screen.getAllByText('₹')).toHaveLength(2);
  });

  it('keeps a balance the player typed when the symbol changes', async () => {
    setup();
    await userEvent.clear(balanceInput());
    await userEvent.type(balanceInput(), '50,000');
    await userEvent.click(screen.getByRole('radio', { name: /NSEI/ }));
    expect(balanceInput()).toHaveValue('50,000');
  });

  it('disables Start with a message for an out-of-range drawdown or balance', async () => {
    setup();
    const dd = screen.getByLabelText('Max drawdown');
    await userEvent.clear(dd);
    await userEvent.type(dd, '75');
    expect(startBtn()).toBeDisabled();
    expect(screen.getByText('Enter between 1% and 50%.')).toBeInTheDocument();
    await userEvent.clear(dd);
    await userEvent.type(dd, '3');
    await userEvent.clear(balanceInput());
    await userEvent.type(balanceInput(), '10');
    expect(startBtn()).toBeDisabled();
    expect(balanceInput()).toHaveAttribute('aria-invalid', 'true');
  });

  it('works with the keyboard: arrows pick a symbol, search filters, Enter starts', async () => {
    const onStart = setup();
    screen.getByRole('radio', { name: /NQ/ }).focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('radio', { name: /NSEI/ })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: /NSEI/ })).toHaveFocus();
    await userEvent.type(screen.getByLabelText('Search symbols'), 's&p');
    expect(screen.getAllByRole('radio')).toHaveLength(1);
    // The search hid NSEI, so the selection moved to the one visible match (and its USD balance).
    expect(screen.getByRole('radio', { name: /GSPC/ })).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(screen.getByRole('button', { name: '15 min' }));
    balanceInput().focus();
    await userEvent.keyboard('{Enter}');
    expect(onStart).toHaveBeenCalledWith(expect.objectContaining({ symbol: '^GSPC', durationMin: 15, balanceText: '100000' }));
  });

  it('Esc does not close it (there is nothing behind it); Back home leaves', async () => {
    setup();
    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('dialog', { name: 'New practice match' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back home' })).toHaveAttribute('href', '/');
  });
});

describe('RulesCard', () => {
  const config = { symbol: '^NSEI', currency: 'INR', interval: '1m' as const, durationMs: 600_000, startingBalance: 1_000_000, maxDrawdownPct: 5, lotStep: 0.01 };

  it(`counts down from ${COUNTDOWN_FROM} and then starts`, () => {
    vi.useFakeTimers();
    const onGo = vi.fn();
    render(<RulesCard config={config} startTime={1_791_293_400} limitedData onGo={onGo} />);
    expect(screen.getByText('₹10,00,000.00')).toBeInTheDocument();
    expect(screen.getByText(/Limited data/)).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    // Each tick is scheduled after the previous render, so advance one second at a time.
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByText('2')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(onGo).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1000));
    expect(onGo).toHaveBeenCalledTimes(1);
  });

  it('Skip starts at once', async () => {
    const onGo = vi.fn();
    render(<RulesCard config={config} startTime={0} limitedData={false} onGo={onGo} />);
    await userEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(onGo).toHaveBeenCalledTimes(1);
  });
});

describe('practice page flow', () => {
  it('setup -> rules card (timer not running) -> match running; remembers the setup', async () => {
    data.loadIndex.mockResolvedValue(INDEX);
    data.loadCandles.mockResolvedValue(candles);
    render(<MatchView />);
    await userEvent.click(await screen.findByRole('radio', { name: /GSPC/ }));
    await userEvent.click(startBtn());

    expect(await screen.findByRole('dialog', { name: 'Match rules' })).toBeInTheDocument();
    expect(matchStore.getState().match?.status).toBe('idle');
    expect(matchStore.getState().match?.elapsedMs).toBe(0);

    await userEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(matchStore.getState().match?.status).toBe('running');
    expect(screen.queryByRole('dialog', { name: 'Match rules' })).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('qs-pvp:last-config')!)).toMatchObject({ symbol: '^GSPC', durationMin: 10 });
  });

  it('shows the load error in the setup modal with Retry', async () => {
    data.loadIndex.mockResolvedValue(INDEX);
    data.loadCandles.mockRejectedValueOnce(new (await import('@/lib/data')).DataError('not_found', '/data/x.csv was not found')).mockResolvedValueOnce(candles);
    render(<MatchView />);
    await userEvent.click(await screen.findByRole('button', { name: /Start match/ }));
    expect(await screen.findByText(/was not found/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('dialog', { name: 'Match rules' })).toBeInTheDocument();
  });
});

describe('challenge links (plan M13 Part C)', () => {
  const challenge = async (over: Record<string, unknown> = {}) => {
    const { encodeChallenge } = await import('@/lib/challenge');
    const c = { v: 1, symbol: '^GSPC', start: candles[600].time, durationMin: 5, balance: 50_000, maxDrawdownPct: 3, from: 'Ann', score: { returnPct: 0.8, trades: 2, winRate: 50, maxDrawdownPct: 0.4 }, ...over };
    window.history.replaceState(null, '', `/practice?challenge=${encodeChallenge(c as never)}`);
  };
  afterEach(() => window.history.replaceState(null, '', '/'));

  it('shows the score to beat, then starts the same session with the same rules', async () => {
    await challenge();
    data.loadIndex.mockResolvedValue(INDEX);
    data.loadCandles.mockResolvedValue(candles);
    render(<MatchView />);
    expect(await screen.findByRole('dialog', { name: 'Ann challenged you' })).toBeInTheDocument();
    expect(screen.getByText('+0.80%')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Accept challenge' }));
    expect(await screen.findByRole('dialog', { name: 'Match rules' })).toBeInTheDocument();
    const s = matchStore.getState();
    expect(s.match?.candles[s.match.startCursor].time).toBe(candles[600].time);
    expect(s.match?.config).toMatchObject({ symbol: '^GSPC', durationMs: 300_000, startingBalance: 50_000, maxDrawdownPct: 3 });
    expect(s.challenge).toEqual({ from: 'Ann', score: { returnPct: 0.8, trades: 2, winRate: 50, maxDrawdownPct: 0.4 } });
  });

  it('says when the data no longer covers the session and offers a normal match', async () => {
    await challenge({ start: 12345 });
    data.loadIndex.mockResolvedValue(INDEX);
    data.loadCandles.mockResolvedValue(candles);
    render(<MatchView />);
    await userEvent.click(await screen.findByRole('button', { name: 'Accept challenge' }));
    expect(await screen.findByText(/no longer covers this challenge session/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Play a random session instead' }));
    expect(await screen.findByRole('dialog', { name: 'New practice match' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /GSPC/ })).toBeChecked();
  });

  it('flags a broken link and falls back to the normal setup', async () => {
    window.history.replaceState(null, '', '/practice?challenge=broken');
    data.loadIndex.mockResolvedValue(INDEX);
    render(<MatchView />);
    expect(await screen.findByText(/This challenge link is not valid/)).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'New practice match' })).toBeInTheDocument();
  });
});
