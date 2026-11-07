import { DEFAULT_MAX_DRAWDOWN_PCT } from '@/lib/config';
import { DASH, fmtPct, isNum } from '@/lib/format';

// TEST FIXTURE: the sample match report on the landing page. These are not real match results.
// The UI that shows them must carry the "TEST FIXTURE" label.

export type ProfileAxis = {
  label: string;
  /** Position on the axis scale, 0 to 1 (clamped). */
  value: number;
  display: string;
  range: string;
  note?: string;
};

export const clamp01 = (v: number): number => (isNum(v) ? Math.min(1, Math.max(0, v)) : 0);

/** Where `v` sits between `min` and `max`, clamped to 0..1. Non-numbers and empty ranges give 0. */
export function scaleTo(v: unknown, min: number, max: number): number {
  if (!isNum(v) || !(max > min)) return 0;
  return clamp01((v - min) / (max - min));
}

/** Drawdown is "lower is better", so the axis runs from the limit (0) to no drawdown (1). */
export function drawdownScore(ddPct: unknown, limitPct: number): number {
  if (!isNum(ddPct) || !(limitPct > 0)) return 0;
  return clamp01(1 - ddPct / limitPct);
}

export type SampleStats = {
  returnPct: number;
  winRatePct: number;
  profitFactor: number;
  maxDrawdownPct: number;
  payoffRatio: number;
  trades: number;
};

export const SAMPLE_STATS: SampleStats = {
  returnPct: 1.84,
  winRatePct: 57,
  profitFactor: 1.32,
  maxDrawdownPct: 2.1,
  payoffRatio: 1.5,
  trades: 7,
};

const fmt2 = (v: unknown) => (isNum(v) ? v.toFixed(2) : DASH);
const fmtX = (v: unknown) => (isNum(v) ? `${v.toFixed(1)}×` : DASH);
const fmtInt = (v: unknown) => (isNum(v) ? String(Math.round(v)) : DASH);

export function buildProfile(s: SampleStats, limitPct = DEFAULT_MAX_DRAWDOWN_PCT): ProfileAxis[] {
  return [
    { label: 'Return', value: scaleTo(s.returnPct, -10, 10), display: fmtPct(s.returnPct), range: '−10% to +10%' },
    { label: 'Win rate', value: scaleTo(s.winRatePct, 0, 100), display: fmtPct(s.winRatePct, 0, false), range: '0% to 100%' },
    { label: 'Profit factor', value: scaleTo(s.profitFactor, 0, 3), display: fmt2(s.profitFactor), range: '0 to 3.0' },
    {
      label: 'Drawdown',
      value: drawdownScore(s.maxDrawdownPct, limitPct),
      display: fmtPct(s.maxDrawdownPct, 2, false),
      range: `0% to ${limitPct}% limit`,
      note: `Lower is better. The match ends at ${limitPct}%.`,
    },
    { label: 'Payoff ratio', value: scaleTo(s.payoffRatio, 0, 3), display: fmtX(s.payoffRatio), range: '0 to 3.0', note: 'Average win ÷ average loss.' },
    { label: 'Trades', value: scaleTo(s.trades, 0, 20), display: fmtInt(s.trades), range: '0 to 20' },
  ];
}

export function buildHeadline(s: SampleStats): [string, string][] {
  return [
    ['Return', fmtPct(s.returnPct)],
    ['Win rate', fmtPct(s.winRatePct, 0, false)],
    ['Max drawdown', fmtPct(s.maxDrawdownPct, 2, false)],
    ['Trades', fmtInt(s.trades)],
  ];
}

export const SAMPLE_PROFILE = buildProfile(SAMPLE_STATS);
export const SAMPLE_HEADLINE = buildHeadline(SAMPLE_STATS);
