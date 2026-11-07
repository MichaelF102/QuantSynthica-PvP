import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { DataError, fetchText, loadCandles, loadIndex, parseCandlesCsv, parseIndex, pickRandomSession } from './data';
import type { Candle } from './types';

const HEADER = 'time,open,high,low,close,volume';
const csv = (...rows: string[]) => [HEADER, ...rows].join('\n');
// TEST FIXTURE (generated random walk, see fixtures/README.md)
const FIXTURE = readFileSync(join(__dirname, '..', 'fixtures', 'candles.sample.csv'), 'utf8');

function expectDataError(fn: () => unknown, code: DataError['code']) {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(DataError);
    expect((e as DataError).code).toBe(code);
    return;
  }
  throw new Error(`expected DataError(${code})`);
}

/** Evenly spaced 1m candles; `gapAt` inserts a jump of `gapSec` before that index. */
function series(n: number, gapAt?: number, gapSec = 0): Candle[] {
  let t = 1_000_000_020;
  return Array.from({ length: n }, (_, i) => {
    if (i === gapAt) t += gapSec;
    const c = { time: t, open: 10, high: 11, low: 9, close: 10, volume: 1 };
    t += 60;
    return c;
  });
}

describe('parseCandlesCsv', () => {
  it('parses the TEST FIXTURE file', () => {
    const candles = parseCandlesCsv(FIXTURE);
    expect(candles).toHaveLength(500);
    expect(candles[0]).toEqual({ time: 1_700_000_040, open: 100, high: expect.any(Number), low: expect.any(Number), close: expect.any(Number), volume: expect.any(Number) });
  });

  it('accepts CRLF, header whitespace/case and a trailing blank line', () => {
    const text = ' Time, open ,HIGH,low,close,volume\r\n60,1,2,0.5,1.5,0\r\n120,1.5,2,1,1,10\r\n\r\n';
    expect(parseCandlesCsv(text)).toEqual([
      { time: 60, open: 1, high: 2, low: 0.5, close: 1.5, volume: 0 },
      { time: 120, open: 1.5, high: 2, low: 1, close: 1, volume: 10 },
    ]);
  });

  it('rejects a missing column', () => {
    expectDataError(() => parseCandlesCsv('time,open,high,low,close\n60,1,2,0.5,1.5'), 'bad_header');
  });

  it('rejects columns in the wrong order', () => {
    expectDataError(() => parseCandlesCsv('time,high,open,low,close,volume\n60,2,1,0.5,1.5,0'), 'bad_header');
  });

  it('rejects a row with the wrong number of values', () => {
    expectDataError(() => parseCandlesCsv(csv('60,1,2,0.5,1.5')), 'bad_row');
  });

  it.each([
    ['NaN', '60,NaN,2,0.5,1.5,0'],
    ['empty value', '60,,2,0.5,1.5,0'],
    ['text', '60,abc,2,0.5,1.5,0'],
    ['Infinity', '60,1,Infinity,0.5,1.5,0'],
  ])('rejects %s', (_label, row) => {
    expectDataError(() => parseCandlesCsv(csv(row)), 'not_finite');
  });

  it('rejects unsorted rows', () => {
    expectDataError(() => parseCandlesCsv(csv('120,1,2,0.5,1.5,0', '60,1,2,0.5,1.5,0')), 'unsorted');
  });

  it('rejects duplicate timestamps', () => {
    expectDataError(() => parseCandlesCsv(csv('60,1,2,0.5,1.5,0', '60,1,2,0.5,1.5,0')), 'duplicate_time');
  });

  it('rejects a bar whose high/low do not contain open and close', () => {
    expectDataError(() => parseCandlesCsv(csv('60,1,1.2,0.5,1.5,0')), 'inconsistent_bar');
    expectDataError(() => parseCandlesCsv(csv('60,1,2,1.1,1.5,0')), 'inconsistent_bar');
    expectDataError(() => parseCandlesCsv(csv('60,0,0,0,0,0')), 'inconsistent_bar');
  });

  it('rejects fractional time and negative volume', () => {
    expectDataError(() => parseCandlesCsv(csv('60.5,1,2,0.5,1.5,0')), 'bad_row');
    expectDataError(() => parseCandlesCsv(csv('60,1,2,0.5,1.5,-1')), 'bad_row');
  });

  it('rejects an empty file and a header-only file', () => {
    expectDataError(() => parseCandlesCsv(''), 'bad_header');
    expectDataError(() => parseCandlesCsv(`${HEADER}\n`), 'empty');
  });
});

describe('parseIndex', () => {
  const entry = {
    symbol: 'NQ=F',
    name: 'Nasdaq 100 E-mini Futures',
    assetClass: 'futures',
    currency: 'USD',
    dataFile: 'NQ_F.csv',
    barsAvailable: 10,
    firstTime: 1,
    lastTime: 2,
    lotStep: 0.01,
    priceDecimals: 2,
  };

  it('accepts a valid list', () => {
    expect(parseIndex([entry])).toEqual([entry]);
  });

  it.each([
    ['not an array', { a: 1 }],
    ['missing field', [{ ...entry, lotStep: undefined }]],
    ['unknown asset class', [{ ...entry, assetClass: 'bond' }]],
    ['path in dataFile', [{ ...entry, dataFile: '../secret.csv' }]],
    ['zero lot step', [{ ...entry, lotStep: 0 }]],
    ['fractional decimals', [{ ...entry, priceDecimals: 1.5 }]],
  ])('rejects %s', (_label, json) => {
    expectDataError(() => parseIndex(json), 'bad_index');
  });
});

describe('fetchText', () => {
  const ok = (body: string) => ({ ok: true, status: 200, text: async () => body }) as Response;
  const status = (s: number) => ({ ok: false, status: s, text: async () => '' }) as Response;
  const sleep = vi.fn(async () => {});

  it('retries network errors and 503, then succeeds', async () => {
    const fetchImpl = vi.fn().mockRejectedValueOnce(new TypeError('offline')).mockResolvedValueOnce(status(503)).mockResolvedValueOnce(ok('hi'));
    await expect(fetchText('/x', { fetchImpl, sleep })).resolves.toBe('hi');
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenNthCalledWith(1, 500);
    expect(sleep).toHaveBeenNthCalledWith(2, 1000);
  });

  it('does not retry a 404', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(status(404));
    await expect(fetchText('/x', { fetchImpl, sleep })).rejects.toMatchObject({ code: 'not_found' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('gives up after the retry budget', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(status(502));
    await expect(fetchText('/x', { fetchImpl, sleep, retries: 2 })).rejects.toMatchObject({ code: 'network' });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });
});

describe('loadIndex / loadCandles', () => {
  it('loads and validates the index from /data/index.json', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => '[]' } as Response);
    await expect(loadIndex({ fetchImpl })).resolves.toEqual([]);
    expect(fetchImpl).toHaveBeenCalledWith('/data/index.json');
  });

  it('reports invalid JSON as bad_index', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => '{' } as Response);
    await expect(loadIndex({ fetchImpl })).rejects.toMatchObject({ code: 'bad_index' });
  });

  it('loads candles from the file named in the index', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => csv('60,1,2,0.5,1.5,0') } as Response);
    await expect(loadCandles({ dataFile: 'NQ_F.csv' }, { fetchImpl })).resolves.toHaveLength(1);
    expect(fetchImpl).toHaveBeenCalledWith('/data/NQ_F.csv');
  });
});

describe('pickRandomSession', () => {
  const seq = (...values: number[]) => {
    let i = 0;
    return () => values[Math.min(i++, values.length - 1)];
  };

  it('returns history + playable candles with the cursor on the last history candle', () => {
    const candles = series(1000);
    const s = pickRandomSession(candles, { history: 300, playable: 200 }, () => 0);
    expect(s.candles).toHaveLength(500);
    expect(s.startCursor).toBe(299);
    expect(s.limitedData).toBe(false);
    expect(s.candles[0]).toBe(candles[0]);
  });

  it('is deterministic for a given rng and covers the last possible window', () => {
    const candles = series(1000);
    const a = pickRandomSession(candles, { history: 300, playable: 200 }, () => 0.5);
    const b = pickRandomSession(candles, { history: 300, playable: 200 }, () => 0.5);
    expect(a.candles[0].time).toBe(b.candles[0].time);
    const last = pickRandomSession(candles, { history: 300, playable: 200 }, () => 0.999999);
    expect(last.candles[last.candles.length - 1]).toBe(candles[999]);
  });

  it('never returns fewer candles than requested when data is sufficient', () => {
    const candles = series(800);
    for (let i = 0; i < 50; i++) {
      const s = pickRandomSession(candles, { history: 300, playable: 400 });
      expect(s.candles).toHaveLength(700);
    }
  });

  it('allows weekend-sized gaps (under 3 days)', () => {
    const candles = series(1000, 600, 66 * 3600);
    const s = pickRandomSession(candles, { history: 300, playable: 400 }, () => 0.5);
    expect(s.candles).toHaveLength(700);
  });

  it('retries past a window with a gap longer than 3 days', () => {
    // 4-day gap before index 700. rng 0.5 -> first playable index 450, window 450..849 contains it.
    // rng 0 -> first playable index 300, window 300..699 is clean.
    const candles = series(1000, 700, 4 * 24 * 3600);
    const s = pickRandomSession(candles, { history: 300, playable: 400 }, seq(0.5, 0));
    expect(s.candles[0]).toBe(candles[0]);
  });

  it('treats the step from the last history candle into play as part of the window', () => {
    const candles = series(1000, 500, 4 * 24 * 3600);
    // rng 0.5 -> first playable index 500, right after the gap: rejected; then rng 0 -> clean.
    // span = 1000 - 100 - 300 + 1 = 601, so rng 200.5/601 -> first playable index exactly 500.
    const s = pickRandomSession(candles, { history: 300, playable: 100 }, seq(200.5 / 601, 0));
    expect(s.candles[0]).toBe(candles[0]);
  });

  it('throws no_valid_window after 10 bad tries', () => {
    const candles = series(1000, 700, 4 * 24 * 3600);
    const rng = vi.fn(() => 0.5);
    expectDataError(() => pickRandomSession(candles, { history: 300, playable: 400 }, rng), 'no_valid_window');
    expect(rng).toHaveBeenCalledTimes(10);
  });

  it('caps the playable span for a short file and flags limitedData', () => {
    const candles = series(650);
    const s = pickRandomSession(candles, { history: 300, playable: 400, minPlayable: 300 });
    expect(s.candles).toHaveLength(650);
    expect(s.limitedData).toBe(true);
  });

  it('throws not_enough_data when too little remains after the history', () => {
    expectDataError(() => pickRandomSession(series(320), { history: 300, playable: 400 }), 'not_enough_data');
  });

  it('works on the TEST FIXTURE with its weekend gap', () => {
    const candles = parseCandlesCsv(FIXTURE);
    const s = pickRandomSession(candles, { history: 100, playable: 300 }, () => 0.5);
    expect(s.candles).toHaveLength(400);
  });
});
