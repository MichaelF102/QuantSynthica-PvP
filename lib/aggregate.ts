import type { Candle, Timeframe } from './types';

export const TIMEFRAME_SECONDS: Record<Timeframe, number> = {
  '1m': 60,
  '5m': 300,
  '15m': 900,
  '1h': 3600,
  '1d': 86400,
};

/** Start of the UTC bucket that `time` falls in. */
export function bucketStart(time: number, tf: Timeframe): number {
  const size = TIMEFRAME_SECONDS[tf];
  return time - (((time % size) + size) % size);
}

function merge(bar: Candle, c: Candle): Candle {
  return {
    time: bar.time,
    open: bar.open,
    high: Math.max(bar.high, c.high),
    low: Math.min(bar.low, c.low),
    close: c.close,
    volume: bar.volume + c.volume,
  };
}

/**
 * Aggregates base candles into `tf` bars using ONLY candles[0..cursor] (no look-ahead).
 * The last bar may be partial: it reflects just the revealed base candles in its bucket.
 * Empty buckets are not created (gaps stay gaps). The input is never mutated.
 */
export function aggregate(candles: Candle[], tf: Timeframe, cursor: number = candles.length - 1): Candle[] {
  const end = Math.min(cursor, candles.length - 1);
  if (end < 0) return [];
  if (tf === '1m') return candles.slice(0, end + 1);
  const out: Candle[] = [];
  for (let i = 0; i <= end; i++) {
    const c = candles[i];
    const start = bucketStart(c.time, tf);
    const last = out[out.length - 1];
    if (last && last.time === start) out[out.length - 1] = merge(last, c);
    else out.push({ ...c, time: start });
  }
  return out;
}

/**
 * Adds one newly revealed base candle to an existing aggregation. Returns a new array
 * (the last bar replaced, or a bar appended). Equivalent to re-running `aggregate`.
 */
export function appendToAggregate(bars: Candle[], c: Candle, tf: Timeframe): Candle[] {
  const start = tf === '1m' ? c.time : bucketStart(c.time, tf);
  const last = bars[bars.length - 1];
  if (last && c.time <= last.time && tf === '1m') throw new RangeError('candles must be appended in time order');
  if (last && start < last.time) throw new RangeError('candles must be appended in time order');
  if (last && last.time === start) return [...bars.slice(0, -1), merge(last, c)];
  return [...bars, tf === '1m' ? c : { ...c, time: start }];
}
