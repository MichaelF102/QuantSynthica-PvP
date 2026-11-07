'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { CandlestickChart } from 'lucide-react';
import { Banner, EmptyState, Panel, PanelSkeleton } from '@/components/ui';
import { hasVolume, indexOfTime, summarizeBar, type FillMarker } from '@/lib/chartData';
import type { Candle, Timeframe } from '@/lib/types';
import { CandleChart } from './CandleChart';
import { OhlcReadout } from './OhlcReadout';
import { TimeframeSwitch } from './TimeframeSwitch';

type ChartPanelProps = {
  status: 'loading' | 'error' | 'ready';
  error?: string;
  onRetry?: () => void;
  /** Already aggregated bars up to the cursor. */
  bars: Candle[];
  symbol: string;
  symbolName?: string;
  timeframe: Timeframe;
  onTimeframeChange: (tf: Timeframe) => void;
  priceDecimals: number;
  /** Controls shown above the chart (replay controls). */
  actions?: ReactNode;
  markers?: FillMarker[];
  entryPrice?: number | null;
  stopLoss?: number | null;
  takeProfit?: number | null;
  /** Hide the timeframe switch when the page shows it elsewhere (the match header). */
  hideTimeframeSwitch?: boolean;
  /** 1v1: session-time labels, the note shown instead of "Times in UTC", and the allowed timeframes. */
  timeFormatter?: (t: number) => string;
  timeNote?: string;
  timeframes?: readonly Timeframe[];
};

/** Candle chart card with its loading, error and empty states (CLAUDE.md §6 rule 7). */
export function ChartPanel({ status, error, onRetry, bars, symbol, symbolName, timeframe, onTimeframeChange, priceDecimals, actions, markers, entryPrice, stopLoss, takeProfit, hideTimeframeSwitch, timeFormatter, timeNote = 'Times in UTC', timeframes }: ChartPanelProps) {
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const showVolume = useMemo(() => hasVolume(bars), [bars]);
  const hoverIndex = hoverTime === null ? -1 : indexOfTime(bars, hoverTime);
  const summary = summarizeBar(bars, hoverIndex >= 0 ? hoverIndex : bars.length - 1);

  if (status === 'loading') return <PanelSkeleton rows={8} label="Loading chart" />;

  return (
    <Panel
      title={symbolName ? `${symbol} · ${symbolName}` : symbol}
      description={`${timeframe} candles · ${timeNote} · Market data`}
      icon={CandlestickChart}
      info="Candles are built from 1-minute market data. Higher timeframes are aggregated in your browser and only from candles already revealed."
      actions={hideTimeframeSwitch ? undefined : <TimeframeSwitch value={timeframe} onChange={onTimeframeChange} disabled={status !== 'ready'} only={timeframes} />}
      bodyClassName="space-y-2"
    >
      {status === 'error' ? (
        <Banner kind="error" onRetry={onRetry}>
          {error ?? 'The chart could not be loaded.'}
        </Banner>
      ) : bars.length === 0 ? (
        <EmptyState icon={CandlestickChart} title="No candles to show" hint="This session has no market data yet." />
      ) : (
        <>
          {actions}
          <OhlcReadout summary={summary} priceDecimals={priceDecimals} showVolume={showVolume} timeFormatter={timeFormatter} />
          <CandleChart bars={bars} symbol={symbol} timeframe={timeframe} priceDecimals={priceDecimals} onHover={setHoverTime} markers={markers} entryPrice={entryPrice} stopLoss={stopLoss} takeProfit={takeProfit} timeFormatter={timeFormatter} />
        </>
      )}
    </Panel>
  );
}
