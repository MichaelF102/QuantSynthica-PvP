'use client';

import { useEffect, useMemo, useRef } from 'react';
import {
  ColorType,
  CrosshairMode,
  createChart,
  LineStyle,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type SeriesMarker,
  type Time,
  type MouseEventParams,
  type UTCTimestamp,
} from 'lightweight-charts';
import { CANDLE_DOWN, CANDLE_UP, hasVolume, planChartUpdate, summarizeBar, toVolumePoint, type FillMarker } from '@/lib/chartData';
import { fmtPct, fmtPrice } from '@/lib/format';
import type { Candle, Timeframe } from '@/lib/types';
import { cn } from '@/lib/utils';

// Canvas cannot read CSS variables, so the font is passed as a literal (CLAUDE.md §6).
const CHART_FONT = 'IBM Plex Mono, monospace';
/** Below this many bars the chart fits them to the width instead of leaving most of it empty. */
const FIT_BELOW_BARS = 150;

type CandleChartProps = {
  /** Bars to draw: already aggregated and cut at the cursor. Never the full session. */
  bars: Candle[];
  symbol: string;
  timeframe: Timeframe;
  priceDecimals: number;
  /** Called with the hovered bar's time, or null when the crosshair leaves the chart. */
  onHover?: (time: number | null) => void;
  /** Buy/sell arrows for the player's fills, already mapped to this timeframe's bars. */
  markers?: FillMarker[];
  /** Average entry of the open position, drawn as a dashed line; null when flat. */
  entryPrice?: number | null;
  /** Plan M12: the position's stop-loss and take-profit, drawn as dotted lines. */
  stopLoss?: number | null;
  takeProfit?: number | null;
  /** Always fit every bar to the width (results view) instead of following the latest bar. */
  fitAll?: boolean;
  /** Axis and crosshair time labels; default is UTC wall-clock time. 1v1 uses session time (MP9). */
  timeFormatter?: (t: number) => string;
  className?: string;
};

const NO_MARKERS: FillMarker[] = [];

const asTime = (t: number) => t as UTCTimestamp;
const toBar = (c: Candle) => ({ time: asTime(c.time), open: c.open, high: c.high, low: c.low, close: c.close });
const toVol = (c: Candle) => {
  const v = toVolumePoint(c);
  return { time: asTime(v.time), value: v.value, color: v.color };
};

export function CandleChart({ bars, symbol, timeframe, priceDecimals, onHover, markers = NO_MARKERS, entryPrice = null, stopLoss = null, takeProfit = null, fitAll = false, timeFormatter, className }: CandleChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const shownRef = useRef<Candle[]>([]);
  const entryLineRef = useRef<IPriceLine | null>(null);
  const stopLineRef = useRef<IPriceLine | null>(null);
  const targetLineRef = useRef<IPriceLine | null>(null);
  const onHoverRef = useRef(onHover);
  onHoverRef.current = onHover;

  // Create the chart once.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const chart = createChart(el, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: '#94a3b8', fontFamily: CHART_FONT, fontSize: 11 },
      grid: { vertLines: { color: '#1e293b' }, horzLines: { color: '#1e293b' } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: '#1e293b' },
      timeScale: { borderColor: '#1e293b', timeVisible: true, secondsVisible: false, rightOffset: 6 },
      // Phones: a vertical swipe over the chart scrolls the page; a sideways one still pans the chart.
      handleScroll: { vertTouchDrag: false },
      // Timestamps are UTC and the chart shows them in UTC; the panel labels the zone.
    });
    const candles = chart.addCandlestickSeries({
      upColor: CANDLE_UP,
      downColor: CANDLE_DOWN,
      borderUpColor: CANDLE_UP,
      borderDownColor: CANDLE_DOWN,
      wickUpColor: CANDLE_UP,
      wickDownColor: CANDLE_DOWN,
    });
    const volume = chart.addHistogramSeries({ priceScaleId: 'volume', priceFormat: { type: 'volume' }, lastValueVisible: false, priceLineVisible: false });
    chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });

    const onMove = (p: MouseEventParams) => onHoverRef.current?.(typeof p.time === 'number' ? p.time : null);
    chart.subscribeCrosshairMove(onMove);

    chartRef.current = chart;
    candleRef.current = candles;
    volumeRef.current = volume;
    return () => {
      chart.unsubscribeCrosshairMove(onMove);
      chart.remove();
      chartRef.current = null;
      candleRef.current = null;
      volumeRef.current = null;
      entryLineRef.current = null;
      stopLineRef.current = null;
      targetLineRef.current = null;
      shownRef.current = [];
    };
  }, []);

  // Price precision follows the symbol; the axis uses the same grouping as the rest of the UI.
  useEffect(() => {
    candleRef.current?.applyOptions({ priceFormat: { type: 'price', precision: priceDecimals, minMove: 1 / 10 ** priceDecimals } });
    chartRef.current?.applyOptions({ localization: { priceFormatter: (p: number) => fmtPrice(p, priceDecimals) } });
  }, [priceDecimals]);

  useEffect(() => {
    if (!timeFormatter) return;
    const f = (t: Time) => (typeof t === 'number' ? timeFormatter(t) : '');
    chartRef.current?.applyOptions({ localization: { timeFormatter: f }, timeScale: { tickMarkFormatter: f } });
  }, [timeFormatter]);

  const showVolume = useMemo(() => hasVolume(bars), [bars]);
  useEffect(() => {
    volumeRef.current?.applyOptions({ visible: showVolume });
  }, [showVolume]);

  // A new symbol or timeframe always redraws from scratch.
  useEffect(() => {
    shownRef.current = [];
  }, [symbol, timeframe]);

  // Push data: update() when only the tail changed, setData() otherwise.
  useEffect(() => {
    const candles = candleRef.current;
    const volume = volumeRef.current;
    const chart = chartRef.current;
    if (!candles || !volume || !chart) return;
    const plan = planChartUpdate(shownRef.current, bars);
    if (plan.kind === 'set') {
      candles.setData(bars.map(toBar));
      volume.setData(bars.map(toVol));
      if (fitAll || bars.length < FIT_BELOW_BARS) chart.timeScale().fitContent();
      else chart.timeScale().scrollToRealTime();
    } else {
      for (let i = plan.from; i < bars.length; i++) {
        candles.update(toBar(bars[i]));
        volume.update(toVol(bars[i]));
      }
    }
    shownRef.current = bars;
  }, [bars, symbol, timeframe, fitAll]);

  // Fill markers go on after the data, since they must sit on existing bars.
  useEffect(() => {
    candleRef.current?.setMarkers(markers.map((m) => ({ ...m, time: asTime(m.time) }) as SeriesMarker<Time>));
  }, [markers, bars]);

  useEffect(() => {
    const series = candleRef.current;
    if (!series) return;
    if (entryLineRef.current) series.removePriceLine(entryLineRef.current);
    entryLineRef.current =
      entryPrice === null ? null : series.createPriceLine({ price: entryPrice, color: '#60a5fa', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: 'Entry' });
  }, [entryPrice]);

  useEffect(() => {
    const series = candleRef.current;
    if (!series) return;
    for (const ref of [stopLineRef, targetLineRef]) {
      if (ref.current) series.removePriceLine(ref.current);
      ref.current = null;
    }
    if (stopLoss !== null) stopLineRef.current = series.createPriceLine({ price: stopLoss, color: CANDLE_DOWN, lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: true, title: 'SL' });
    if (takeProfit !== null) targetLineRef.current = series.createPriceLine({ price: takeProfit, color: CANDLE_UP, lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: true, title: 'TP' });
  }, [stopLoss, takeProfit]);

  // A canvas is not readable by screen readers, so describe the latest bar in text.
  const last = summarizeBar(bars, bars.length - 1);
  const label = last
    ? `${symbol} ${timeframe} candlestick chart. Last ${fmtPrice(last.bar.close, priceDecimals)}, ${fmtPct(last.changePct)} on the previous bar.`
    : `${symbol} ${timeframe} candlestick chart. No candles yet.`;

  return <div ref={containerRef} role="img" aria-label={label} className={cn('relative w-full min-h-[60vh] lg:min-h-[480px]', className)} />;
}
