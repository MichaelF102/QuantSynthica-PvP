import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Candle } from '@/lib/types';

// lightweight-charts draws on canvas, which jsdom lacks, so the library is mocked.
const mocks = vi.hoisted(() => {
  const series = () => ({ setData: vi.fn(), update: vi.fn(), applyOptions: vi.fn(), setMarkers: vi.fn(), createPriceLine: vi.fn((o: unknown) => ({ o })), removePriceLine: vi.fn() });
  const state = {
    candles: series(),
    volume: series(),
    chart: null as null | Record<string, ReturnType<typeof vi.fn>>,
    createChart: vi.fn(),
  };
  state.createChart.mockImplementation(() => {
    state.candles = series();
    state.volume = series();
    state.chart = {
      addCandlestickSeries: vi.fn(() => state.candles),
      addHistogramSeries: vi.fn(() => state.volume),
      priceScale: vi.fn(() => ({ applyOptions: vi.fn() })),
      timeScale: vi.fn(() => ({ scrollToRealTime: vi.fn(), fitContent: vi.fn() })),
      applyOptions: vi.fn(),
      subscribeCrosshairMove: vi.fn(),
      unsubscribeCrosshairMove: vi.fn(),
      remove: vi.fn(),
    };
    return state.chart;
  });
  return state;
});

vi.mock('lightweight-charts', () => ({
  createChart: mocks.createChart,
  ColorType: { Solid: 'solid' },
  CrosshairMode: { Normal: 0 },
  LineStyle: { Dashed: 2 },
}));

import { CandleChart } from './CandleChart';

const bar = (time: number, close: number, volume = 0): Candle => ({ time, open: 100, high: Math.max(100, close) + 1, low: Math.min(100, close) - 1, close, volume });
const BARS = [bar(60, 100), bar(120, 102)];

describe('CandleChart', () => {
  beforeEach(() => mocks.createChart.mockClear());

  it('creates the chart once and draws exactly the bars it is given', () => {
    const { rerender } = render(<CandleChart bars={BARS} symbol="NQ=F" timeframe="1m" priceDecimals={2} />);
    expect(mocks.createChart).toHaveBeenCalledTimes(1);
    expect(mocks.candles.setData).toHaveBeenCalledTimes(1);
    expect(mocks.candles.setData.mock.calls[0][0]).toHaveLength(2);

    // Revealing one more candle updates the tail instead of redrawing.
    rerender(<CandleChart bars={[...BARS, bar(180, 101)]} symbol="NQ=F" timeframe="1m" priceDecimals={2} />);
    expect(mocks.createChart).toHaveBeenCalledTimes(1);
    expect(mocks.candles.setData).toHaveBeenCalledTimes(1);
    expect(mocks.candles.update.mock.calls.map((c) => c[0].time)).toEqual([120, 180]);
  });

  it('redraws from scratch when the timeframe changes', () => {
    const { rerender } = render(<CandleChart bars={BARS} symbol="NQ=F" timeframe="1m" priceDecimals={2} />);
    rerender(<CandleChart bars={[bar(0, 102)]} symbol="NQ=F" timeframe="5m" priceDecimals={2} />);
    expect(mocks.candles.setData).toHaveBeenCalledTimes(2);
  });

  it('sets price precision from the symbol and hides volume when there is none', () => {
    render(<CandleChart bars={BARS} symbol="6E=F" timeframe="1m" priceDecimals={5} />);
    expect(mocks.candles.applyOptions).toHaveBeenCalledWith({ priceFormat: { type: 'price', precision: 5, minMove: 0.00001 } });
    expect(mocks.volume.applyOptions).toHaveBeenCalledWith({ visible: false });
  });

  it('formats the price axis like the rest of the UI', () => {
    render(<CandleChart bars={BARS} symbol="NQ=F" timeframe="1m" priceDecimals={2} />);
    const opts = mocks.chart!.applyOptions.mock.calls[0][0] as { localization: { priceFormatter: (p: number) => string } };
    expect(opts.localization.priceFormatter(28179.5)).toBe('28,179.50');
  });

  it('shows volume when the data has it', () => {
    render(<CandleChart bars={[bar(60, 100, 5)]} symbol="NQ=F" timeframe="1m" priceDecimals={2} />);
    expect(mocks.volume.applyOptions).toHaveBeenCalledWith({ visible: true });
  });

  it('describes the last bar in its aria-label', () => {
    render(<CandleChart bars={BARS} symbol="NQ=F" timeframe="1m" priceDecimals={2} />);
    expect(screen.getByRole('img')).toHaveAttribute('aria-label', 'NQ=F 1m candlestick chart. Last 102.00, +2.00% on the previous bar.');
  });

  it('places fill markers and an entry line, and moves the line when the entry changes', () => {
    const markers = [{ time: 120, position: 'belowBar' as const, color: '#10b981', shape: 'arrowUp' as const, text: 'B 2' }];
    const { rerender } = render(<CandleChart bars={BARS} symbol="NQ=F" timeframe="1m" priceDecimals={2} markers={markers} entryPrice={101} />);
    expect(mocks.candles.setMarkers).toHaveBeenLastCalledWith([{ ...markers[0], time: 120 }]);
    expect(mocks.candles.createPriceLine).toHaveBeenCalledWith(expect.objectContaining({ price: 101, title: 'Entry' }));
    rerender(<CandleChart bars={BARS} symbol="NQ=F" timeframe="1m" priceDecimals={2} markers={markers} entryPrice={null} />);
    expect(mocks.candles.removePriceLine).toHaveBeenCalledTimes(1);
    expect(mocks.candles.createPriceLine).toHaveBeenCalledTimes(1);
  });

  it('removes the chart on unmount', () => {
    const { unmount } = render(<CandleChart bars={BARS} symbol="NQ=F" timeframe="1m" priceDecimals={2} />);
    const chart = mocks.chart!;
    unmount();
    expect(chart.remove).toHaveBeenCalledTimes(1);
  });
});
