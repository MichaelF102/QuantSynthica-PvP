import { describe, expect, it } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import type { Candle, MatchConfig, SymbolInfo } from '@/lib/types';
import { matchStore } from '@/store/matchStore';
import { MatchHeader, drawdownTone } from './MatchHeader';

const INFO: SymbolInfo = { symbol: '^NSEI', name: 'Nifty 50', assetClass: 'index', currency: 'INR', dataFile: 'x.csv', barsAvailable: 0, firstTime: 0, lastTime: 0, lotStep: 0.01, priceDecimals: 2 };
const CONFIG: MatchConfig = { symbol: '^NSEI', currency: 'INR', interval: '1m', durationMs: 600_000, startingBalance: 1_000_000, maxDrawdownPct: 5, lotStep: 0.01 };
const candles: Candle[] = [25_000, 24_000, 24_500].map((close, i) => ({ time: 60 * (i + 1), open: close, high: close + 5, low: close - 5, close, volume: 0 }));

describe('MatchHeader', () => {
  it('formats INR with en-IN grouping and shows engine numbers', () => {
    act(() => {
      matchStore.getState().reset();
      matchStore.getState().start({ config: CONFIG, session: { candles, startCursor: 0, limitedData: false }, info: INFO });
      matchStore.getState().play();
      matchStore.getState().pause();
      matchStore.getState().buy({ mode: 'units', value: 20 });
      matchStore.getState().step(); // -20,000 unrealized, 2% drawdown
    });
    render(<MatchHeader />);
    expect(screen.getByText('NSEI')).toBeInTheDocument();
    expect(screen.getByText('₹10,00,000.00')).toBeInTheDocument(); // balance
    expect(screen.getByText('-₹20,000.00')).toHaveClass('text-rose-400'); // unrealized
    expect(screen.getByText('₹9,80,000.00')).toBeInTheDocument(); // equity
    expect(screen.getByText('2.00% / 5%')).toBeInTheDocument();
  });
});

describe('drawdownTone', () => {
  it('turns amber at 70% of the limit and rose at 90%', () => {
    expect(drawdownTone(3.4, 5)).toBe('text-slate-200');
    expect(drawdownTone(3.5, 5)).toBe('text-amber-400');
    expect(drawdownTone(4.5, 5)).toBe('text-rose-400');
  });
});
