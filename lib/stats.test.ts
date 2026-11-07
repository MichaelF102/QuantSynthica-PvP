import { describe, expect, it } from 'vitest';
import { advance, createMatch, endMatch, placeMarketOrder, play } from './engine';
import { DASH, fmtPct } from './format';
import { computeStats, maxDrawdownPct, tradeStats } from './stats';
import type { Candle, MatchConfig, Trade } from './types';

const trade = (pnl: number): Trade => ({ id: String(pnl), symbol: 'X', side: 'buy', units: 1, entry: 1, exit: 1, pnl, openedAt: 0, closedAt: 0 });
const curve = (...equity: number[]) => equity.map((e, t) => ({ t, equity: e }));

describe('tradeStats', () => {
  it('0 trades: win rate and profit factor are undefined (shown as —)', () => {
    const s = tradeStats([]);
    expect(s).toMatchObject({ trades: 0, wins: 0, losses: 0, winRate: null, profitFactor: null, avgWin: null, avgLoss: null, largestWin: null, largestLoss: null });
    expect(fmtPct(s.winRate)).toBe(DASH);
  });

  it('no losing trades: profit factor is undefined', () => {
    const s = tradeStats([trade(100), trade(50)]);
    expect(s.winRate).toBe(100);
    expect(s.profitFactor).toBeNull();
  });

  it('mixed trades', () => {
    const s = tradeStats([trade(300), trade(-100), trade(100), trade(-50), trade(0)]);
    expect(s).toMatchObject({ trades: 5, wins: 2, losses: 2, grossProfit: 400, grossLoss: 150, avgWin: 200, avgLoss: -75, largestWin: 300, largestLoss: -100 });
    expect(s.winRate).toBe(40); // a break-even trade counts in the total but is not a win
    expect(s.profitFactor).toBeCloseTo(400 / 150);
  });

  it('only losses: profit factor is 0', () => {
    expect(tradeStats([trade(-10)]).profitFactor).toBe(0);
  });
});

describe('maxDrawdownPct', () => {
  it('finds the largest peak-to-trough drop', () => {
    expect(maxDrawdownPct(curve(100, 110, 99, 120, 108, 130))).toBeCloseTo(10);
    expect(maxDrawdownPct(curve(100, 101, 102))).toBe(0);
    expect(maxDrawdownPct(curve(100))).toBe(0);
    expect(maxDrawdownPct([])).toBe(0);
  });
});

describe('computeStats', () => {
  const CONFIG: MatchConfig = { symbol: 'X', currency: 'USD', interval: '1m', durationMs: 600_000, startingBalance: 100_000, maxDrawdownPct: 50, lotStep: 1 };
  const candles: Candle[] = [100, 110, 105, 108].map((close, i) => ({ time: 60 * (i + 1), open: close, high: close + 1, low: close - 1, close, volume: 0 }));

  it('summarises a finished match', () => {
    let m = play(createMatch(CONFIG, candles), 0);
    m = placeMarketOrder(m, { side: 'buy', units: 100 });
    m = advance(m); // 110
    m = placeMarketOrder(m, { side: 'sell', units: 100 }); // +1,000
    m = placeMarketOrder(m, { side: 'sell', units: 100 }); // short at 110
    m = advance(m); // 105
    m = endMatch(m, 'user'); // cover at 105: +500
    const s = computeStats(m);
    expect(s).toMatchObject({ startingBalance: 100_000, finalEquity: 101_500, pnl: 1_500, trades: 2, wins: 2, winRate: 100, profitFactor: null });
    expect(s.returnPct).toBeCloseTo(1.5);
    expect(s.maxDrawdownPct).toBe(0);
  });

  it('a match with no trades returns 0% with undefined ratios', () => {
    const s = computeStats(endMatch(play(createMatch(CONFIG, candles), 0), 'user'));
    expect(s).toMatchObject({ pnl: 0, returnPct: 0, trades: 0, winRate: null, profitFactor: null });
  });
});
