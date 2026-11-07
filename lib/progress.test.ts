import { describe, expect, it } from 'vitest';
import { bySymbol, duelRecord, median, summarize, trend } from './progress';

// Plan M13 Part A. TEST FIXTURE: hand-written result summaries, not real matches.

type R = Parameters<typeof summarize>[0][number];
const r = (id: string, symbol: string, playedAt: number, returnPct: number, trades: number, wins: number, endReason: R['endReason'] = 'timer'): R => ({
  id,
  symbol,
  symbolName: `${symbol} name`,
  playedAt,
  endReason,
  stats: { returnPct, trades, wins } as R['stats'],
});

const RESULTS = [r('a', 'NQ=F', 3, 2, 4, 3), r('b', 'NQ=F', 1, -1, 1, 0, 'drawdown'), r('c', '^NSEI', 2, 0.5, 0, 0), r('d', 'AAPL', 4, -3, 5, 1, 'drawdown')];

describe('summarize', () => {
  it('averages returns and pools trade win rate across matches', () => {
    const s = summarize(RESULTS);
    expect(s).toMatchObject({ matches: 4, avgReturn: -0.375, medianReturn: -0.25, trades: 10, stopOuts: 2 });
    expect(s.tradeWinRate).toBeCloseTo(40, 9); // 4 wins / 10 trades, not the mean of per-match rates
    expect(s.best).toEqual({ id: 'a', symbol: 'NQ=F', returnPct: 2 });
    expect(s.worst).toEqual({ id: 'd', symbol: 'AAPL', returnPct: -3 });
  });

  it('shows — (null) with nothing saved or no trades', () => {
    expect(summarize([])).toMatchObject({ matches: 0, avgReturn: null, medianReturn: null, tradeWinRate: null, best: null, worst: null });
    expect(summarize([r('c', 'X', 1, 1, 0, 0)]).tradeWinRate).toBeNull();
  });
});

describe('median', () => {
  it('handles odd, even and empty', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBeNull();
  });
});

describe('trend', () => {
  it('orders oldest first and rolls over the window', () => {
    const t = trend(RESULTS, 2);
    expect(t.map((p) => p.id)).toEqual(['b', 'c', 'a', 'd']);
    expect(t.map((p) => p.rollingReturn)).toEqual([-1, -0.25, 1.25, -0.5]);
  });

  it('leaves a gap (null) where the window has no closed trades', () => {
    const t = trend([r('x', 'X', 1, 1, 0, 0), r('y', 'X', 2, 1, 2, 1)], 1);
    expect(t.map((p) => p.rollingWinRate)).toEqual([null, 50]);
  });
});

describe('bySymbol', () => {
  it('groups, sorts by average return (more matches first on a tie) and tags best and worst', () => {
    const rows = bySymbol(RESULTS);
    expect(rows.map((x) => [x.symbol, x.matches, x.avgReturn, x.tag])).toEqual([
      ['NQ=F', 2, 0.5, 'best'],
      ['^NSEI', 1, 0.5, null],
      ['AAPL', 1, -3, 'worst'],
    ]);
    expect(rows[0]).toMatchObject({ bestReturn: 2, worstReturn: -1, trades: 5, stopOuts: 1, tradeWinRate: 60 });
  });

  it('does not tag a single symbol', () => {
    expect(bySymbol([RESULTS[0]])[0].tag).toBeNull();
  });
});

describe('duelRecord', () => {
  it('counts wins, losses and draws', () => {
    const d = (outcome: 'win' | 'loss' | 'draw', returnPct: number) => ({ outcome, you: { stats: { returnPct } } }) as Parameters<typeof duelRecord>[0][number];
    expect(duelRecord([d('win', 1), d('loss', -2), d('win', 3), d('draw', 0)])).toEqual({ played: 4, wins: 2, losses: 1, draws: 1, winPct: 50, avgReturn: 0.5 });
    expect(duelRecord([])).toMatchObject({ played: 0, winPct: null, avgReturn: null });
  });
});
