import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { MatchResult } from '@/lib/results';
import type { Candle, Trade } from '@/lib/types';

// Plan M15 Part 1. TEST FIXTURE: hand-built candles and trades, not market data.

const chart = vi.hoisted(() => ({ setData: vi.fn(), setMarkers: vi.fn() }));
vi.mock('lightweight-charts', () => {
  const series = () => ({ setData: chart.setData, update: vi.fn(), applyOptions: vi.fn(), setMarkers: chart.setMarkers, createPriceLine: vi.fn(), removePriceLine: vi.fn() });
  return {
    createChart: () => ({
      addCandlestickSeries: series,
      addHistogramSeries: () => ({ setData: vi.fn(), update: vi.fn(), applyOptions: vi.fn(), setMarkers: vi.fn() }),
      priceScale: () => ({ applyOptions: vi.fn() }),
      timeScale: () => ({ scrollToRealTime: vi.fn(), fitContent: vi.fn() }),
      applyOptions: vi.fn(),
      subscribeCrosshairMove: vi.fn(),
      unsubscribeCrosshairMove: vi.fn(),
      remove: vi.fn(),
    }),
    ColorType: { Solid: 'solid' },
    CrosshairMode: { Normal: 0 },
    LineStyle: { Dashed: 2, Dotted: 1 },
  };
});

import { SessionChart } from './SessionChart';

const T0 = 1_791_293_400;
const candles: Candle[] = Array.from({ length: 10 }, (_, i) => ({ time: T0 + 60 * i, open: 100 + i, high: 101 + i, low: 99 + i, close: 100 + i, volume: 1 }));
const trades: Trade[] = [{ id: 't1', symbol: 'NQ=F', side: 'buy', units: 2, entry: 102, exit: 106, pnl: 8, openedAt: T0 + 120, closedAt: T0 + 360 }];
const result = {
  symbol: 'NQ=F',
  currency: 'USD',
  priceDecimals: 2,
  lotStep: 1,
  trades,
  equityCurve: candles.map((c, i) => ({ t: c.time, equity: 1000 + (i >= 2 && i <= 6 ? (c.close - 102) * 2 : i > 6 ? 8 : 0) })),
} as unknown as MatchResult;

const slider = () => screen.getByRole('slider', { name: 'Replay position' });
const lastBars = () => (chart.setData.mock.calls.at(-1)?.[0] as unknown[]).length;

afterEach(() => vi.useRealTimers());

describe('session replay', () => {
  it('starts on the full session, then scrubs back without drawing the future', () => {
    render(<SessionChart result={result} candles={candles} status="ready" onRetry={vi.fn()} activeTradeId={null} />);
    expect(slider()).toHaveValue('9');
    expect(lastBars()).toBe(10);

    fireEvent.change(slider(), { target: { value: '3' } });
    expect(lastBars()).toBe(4);
    expect(screen.getByText('Long 2 NQ')).toBeInTheDocument();
    const markers = chart.setMarkers.mock.calls.at(-1)?.[0] as { text: string }[];
    expect(markers.map((m) => m.text)).toEqual(['#1 L']); // the exit at candle 6 is not drawn yet

    fireEvent.change(slider(), { target: { value: '0' } });
    expect(screen.getByText('Flat')).toBeInTheDocument();
  });

  it('jumps between trades and plays forward to the end', () => {
    vi.useFakeTimers();
    render(<SessionChart result={result} candles={candles} status="ready" onRetry={vi.fn()} activeTradeId={null} />);
    fireEvent.click(screen.getByRole('button', { name: 'Go to the start' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next trade' }));
    expect(slider()).toHaveValue('2');
    fireEvent.click(screen.getByRole('button', { name: 'Next trade' }));
    expect(slider()).toHaveValue('6');
    expect(screen.getByText(/\+\$8\.00 · 1 trade/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next trade' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Play replay' }));
    act(() => void vi.advanceTimersByTime(2_000));
    expect(slider()).toHaveValue('9');
    expect(screen.getByRole('button', { name: 'Replay from the start' })).toBeInTheDocument();
  });
});
