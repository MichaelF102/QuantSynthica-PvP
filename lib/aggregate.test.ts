import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { aggregate, appendToAggregate, bucketStart } from './aggregate';
import { parseCandlesCsv } from './data';
import type { Candle, Timeframe } from './types';

const T0 = 1_791_293_400; // 2026-10-06 13:30:00 UTC (a 5m, 15m and 30m boundary)
const c = (minute: number, o: number, h: number, l: number, cl: number, v = 1): Candle => ({ time: T0 + minute * 60, open: o, high: h, low: l, close: cl, volume: v });
// TEST FIXTURE (generated random walk, see fixtures/README.md)
const FIXTURE = parseCandlesCsv(readFileSync(join(__dirname, '..', 'fixtures', 'candles.sample.csv'), 'utf8'));
const TFS: Timeframe[] = ['1m', '5m', '15m', '1h', '1d'];

describe('bucketStart', () => {
  it('floors to UTC boundaries', () => {
    expect(bucketStart(T0 + 4 * 60, '5m')).toBe(T0);
    expect(bucketStart(T0 + 5 * 60, '5m')).toBe(T0 + 300);
    expect(bucketStart(T0 + 29 * 60, '1h')).toBe(T0 - 30 * 60); // 13:59 -> 13:00
    expect(bucketStart(T0, '1d')).toBe(Date.UTC(2026, 9, 6) / 1000);
    expect(bucketStart(T0 + 7 * 60, '1m')).toBe(T0 + 7 * 60);
  });
});

describe('aggregate', () => {
  const five = [c(0, 10, 12, 9, 11, 5), c(1, 11, 13, 10, 12, 3), c(2, 12, 12, 8, 9, 2), c(3, 9, 10, 9, 10, 4), c(4, 10, 11, 10, 10.5, 6)];

  it('builds one 5m bar from five 1m candles', () => {
    expect(aggregate(five, '5m')).toEqual([{ time: T0, open: 10, high: 13, low: 8, close: 10.5, volume: 20 }]);
  });

  it('returns a partial last bar from only the revealed candles', () => {
    expect(aggregate(five, '5m', 1)).toEqual([{ time: T0, open: 10, high: 13, low: 9, close: 12, volume: 8 }]);
  });

  it('starts a new bucket on the boundary', () => {
    const bars = aggregate([...five, c(5, 10.5, 11, 10, 10.8, 1)], '5m');
    expect(bars.map((b) => b.time)).toEqual([T0, T0 + 300]);
  });

  it('keeps gaps as gaps (no empty buckets)', () => {
    const bars = aggregate([c(0, 1, 2, 0.5, 1.5), c(60, 1.5, 2, 1, 1.8)], '5m');
    expect(bars.map((b) => b.time)).toEqual([T0, T0 + 3600]);
  });

  it('uses UTC midnight for 1d', () => {
    const lateDay = { time: Date.UTC(2026, 9, 6, 23, 59) / 1000, open: 1, high: 2, low: 1, close: 2, volume: 1 };
    const nextDay = { time: Date.UTC(2026, 9, 7, 0, 0) / 1000, open: 2, high: 3, low: 2, close: 3, volume: 1 };
    expect(aggregate([lateDay, nextDay], '1d').map((b) => b.time)).toEqual([Date.UTC(2026, 9, 6) / 1000, Date.UTC(2026, 9, 7) / 1000]);
  });

  it('1m returns the revealed slice; an empty or negative cursor returns nothing', () => {
    expect(aggregate(five, '1m', 2)).toEqual(five.slice(0, 3));
    expect(aggregate(five, '1m', -1)).toEqual([]);
    expect(aggregate([], '5m')).toEqual([]);
  });

  it('does not mutate its input', () => {
    const copy = structuredClone(five);
    aggregate(five, '5m');
    expect(five).toEqual(copy);
  });

  it.each(TFS)('no look-ahead (%s): changing candles after the cursor never changes the output', (tf) => {
    const cursor = 237;
    const before = aggregate(FIXTURE, tf, cursor);
    const tampered = FIXTURE.map((k, i) => (i > cursor ? { ...k, high: k.high + 1000, low: 0.01, close: k.close * 3, volume: 1e9 } : k));
    expect(aggregate(tampered, tf, cursor)).toEqual(before);
  });
});

describe('appendToAggregate', () => {
  it.each(TFS)('matches a full aggregation at every step (%s)', (tf) => {
    let bars: Candle[] = [];
    for (let i = 0; i < FIXTURE.length; i++) {
      bars = appendToAggregate(bars, FIXTURE[i], tf);
      if (i % 37 === 0 || i === FIXTURE.length - 1) expect(bars).toEqual(aggregate(FIXTURE, tf, i));
    }
  });

  it('returns a new array and leaves the old one untouched', () => {
    const a = [c(0, 1, 2, 0.5, 1.5)];
    const b = appendToAggregate(a, c(1, 1.5, 3, 1, 2), '5m');
    expect(b).not.toBe(a);
    expect(a).toEqual([c(0, 1, 2, 0.5, 1.5)]);
  });

  it('rejects candles that go back in time', () => {
    expect(() => appendToAggregate([c(5, 1, 2, 0.5, 1.5)], c(4, 1, 2, 0.5, 1.5), '1m')).toThrow(RangeError);
    expect(() => appendToAggregate([c(5, 1, 2, 0.5, 1.5)], c(5, 1, 2, 0.5, 1.5), '1m')).toThrow(RangeError);
    expect(() => appendToAggregate(aggregate([c(5, 1, 2, 0.5, 1.5)], '5m'), c(4, 1, 2, 0.5, 1.5), '5m')).toThrow(RangeError);
  });
});
