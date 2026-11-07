import { describe, expect, it } from 'vitest';
import { MAX_NOTES, coachingNotes } from './coaching';
import type { MatchResult } from './results';
import { tradeStats } from './stats';
import type { Trade } from './types';

const tr = (side: Trade['side'], units: number, entry: number, pnl: number, openedAt: number, closedAt: number): Trade => ({ id: `${openedAt}`, symbol: 'X', side, units, entry, exit: entry, pnl, openedAt, closedAt });

function result(trades: Trade[], over: Partial<MatchResult> = {}, statsOver: Partial<MatchResult['stats']> = {}): MatchResult {
  const pnl = trades.reduce((a, t) => a + t.pnl, 0);
  return {
    version: 1, id: 'r', symbol: 'X', symbolName: 'X', currency: 'USD', priceDecimals: 2, lotStep: 0.01,
    config: { symbol: 'X', currency: 'USD', interval: '1m', durationMs: 600_000, startingBalance: 100_000, maxDrawdownPct: 5, lotStep: 0.01 },
    endReason: 'timer', playedAt: 0, sessionStart: 0, sessionEnd: 20_000, trades, equityCurve: [],
    stats: { startingBalance: 100_000, finalEquity: 100_000 + pnl, pnl, returnPct: pnl / 1000, maxDrawdownPct: 0.37, durationMs: 600_000, ...tradeStats(trades), ...statsOver },
    ...over,
  };
}

// The screenshot match: three losing longs, one tiny winning short.
const SHOT = [tr('buy', 0.37, 26384.99, -28.92, 0, 2040), tr('buy', 2.62, 26228.36, -145.33, 5340, 6840), tr('sell', 0.01, 26172.89, 0.18, 6840, 7740), tr('buy', 2.63, 26107.59, -105.91, 9600, 10260)];

describe('coachingNotes', () => {
  it('describes the screenshot match', () => {
    const notes = coachingNotes(result(SHOT, { endReason: 'user' }, { durationMs: 54_000 }), -1.1);
    const ids = notes.map((n) => n.id);
    expect(notes).toHaveLength(MAX_NOTES);
    expect(ids.slice(0, 3)).toEqual(['bench', 'big-loss', 'side']);
    expect(notes[0]).toMatchObject({ tone: 'positive', text: 'The market moved -1.10% over your session; you beat it by 0.82 points.' });
    expect(notes[1].text).toBe('Your largest loss ($145.33) was 52% of all losses.');
    expect(notes[2].text).toBe('3 of 4 trades were longs; longs lost $280.16.');
    expect(notes[3].id).toBe('size');
    expect(notes[3].text).toMatch(/^Losing positions were \d+\.\d× the size of winning ones/);
  });

  it('says so when there are no trades', () => {
    expect(coachingNotes(result([]))[0]).toMatchObject({ id: 'no-trades', tone: 'neutral' });
  });

  it('flags holding losers longer, heavy drawdown use and an early end', () => {
    const trades = [tr('buy', 1, 100, 5, 0, 60), tr('sell', 1, 100, -3, 100, 400), tr('buy', 1, 100, 4, 500, 560)];
    const ids = coachingNotes(result(trades, { endReason: 'user' }, { maxDrawdownPct: 4, durationMs: 100_000 })).map((n) => n.id);
    expect(ids).toEqual(expect.arrayContaining(['hold', 'dd', 'early']));
  });

  it('adds a positive note for a profitable match with nothing else positive', () => {
    const notes = coachingNotes(result([tr('buy', 1, 100, 10, 0, 60)]));
    expect(notes.find((n) => n.id === 'profit')?.text).toBe('A profitable match: +$10.00 on 1 trade.');
  });

  it('skips the drawdown note when the drawdown ended the match, and the benchmark without candles', () => {
    const ids = coachingNotes(result([tr('buy', 1, 100, -10, 0, 60)], { endReason: 'drawdown' }, { maxDrawdownPct: 5 })).map((n) => n.id);
    expect(ids).not.toContain('dd');
    expect(ids).not.toContain('bench');
  });
});
