import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseCandlesCsv, parseIndex } from './data';

// Checks that the committed pipeline output in public/data passes the app's own validation.
const DATA_DIR = join(__dirname, '..', 'public', 'data');
const INDEX = join(DATA_DIR, 'index.json');

describe.skipIf(!existsSync(INDEX))('public/data pipeline output', () => {
  const index = parseIndex(JSON.parse(readFileSync(INDEX, 'utf8')));

  it('lists at least one symbol', () => {
    expect(index.length).toBeGreaterThan(0);
  });

  it.each(index.map((i) => [i.symbol, i] as const))('%s: CSV parses and matches its index entry', (_sym, info) => {
    const candles = parseCandlesCsv(readFileSync(join(DATA_DIR, info.dataFile), 'utf8'));
    expect(candles.length).toBe(info.barsAvailable);
    expect(candles[0].time).toBe(info.firstTime);
    expect(candles[candles.length - 1].time).toBe(info.lastTime);
  });
});
