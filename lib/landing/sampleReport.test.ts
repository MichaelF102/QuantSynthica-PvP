import { describe, expect, it } from 'vitest';
import { SAMPLE_HEADLINE, SAMPLE_PROFILE, SAMPLE_STATS, buildHeadline, buildProfile, clamp01, drawdownScore, scaleTo } from './sampleReport';

describe('scaleTo', () => {
  it('maps the range to 0..1', () => {
    expect(scaleTo(0, -10, 10)).toBe(0.5);
    expect(scaleTo(-10, -10, 10)).toBe(0);
    expect(scaleTo(10, -10, 10)).toBe(1);
  });
  it('clamps values outside the range', () => {
    expect(scaleTo(-50, -10, 10)).toBe(0);
    expect(scaleTo(50, -10, 10)).toBe(1);
  });
  it('gives 0 for non-numbers and empty ranges', () => {
    for (const v of [Number.NaN, null, undefined, '5', Infinity]) expect(scaleTo(v, 0, 1)).toBe(0);
    expect(scaleTo(1, 5, 5)).toBe(0);
    expect(scaleTo(1, 5, 1)).toBe(0);
  });
});

describe('clamp01', () => {
  it('clamps and treats NaN as 0', () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(2)).toBe(1);
    expect(clamp01(0.3)).toBe(0.3);
    expect(clamp01(Number.NaN)).toBe(0);
  });
});

describe('drawdownScore', () => {
  it('is 1 with no drawdown and 0 at the limit', () => {
    expect(drawdownScore(0, 5)).toBe(1);
    expect(drawdownScore(5, 5)).toBe(0);
    expect(drawdownScore(8, 5)).toBe(0);
    expect(drawdownScore(2.1, 5)).toBeCloseTo(0.58);
  });
  it('is 0 for bad input', () => {
    expect(drawdownScore(Number.NaN, 5)).toBe(0);
    expect(drawdownScore(1, 0)).toBe(0);
    expect(drawdownScore(1, -5)).toBe(0);
  });
});

describe('sample profile (TEST FIXTURE)', () => {
  it('has six axes with the expected display values', () => {
    expect(SAMPLE_PROFILE.map((a) => [a.label, a.display])).toEqual([
      ['Return', '+1.84%'],
      ['Win rate', '57%'],
      ['Profit factor', '1.32'],
      ['Drawdown', '2.10%'],
      ['Payoff ratio', '1.5×'],
      ['Trades', '7'],
    ]);
    for (const a of SAMPLE_PROFILE) {
      expect(a.value).toBeGreaterThanOrEqual(0);
      expect(a.value).toBeLessThanOrEqual(1);
    }
  });

  it('scales each axis against its range', () => {
    const v = Object.fromEntries(SAMPLE_PROFILE.map((a) => [a.label, a.value]));
    expect(v.Return).toBeCloseTo(0.592);
    expect(v['Win rate']).toBeCloseTo(0.57);
    expect(v['Profit factor']).toBeCloseTo(0.44);
    expect(v.Drawdown).toBeCloseTo(0.58);
    expect(v['Payoff ratio']).toBeCloseTo(0.5);
    expect(v.Trades).toBeCloseTo(0.35);
  });

  it('uses the drawdown limit in the range and note', () => {
    const dd = buildProfile(SAMPLE_STATS, 8).find((a) => a.label === 'Drawdown')!;
    expect(dd.range).toBe('0% to 8% limit');
    expect(dd.note).toContain('8%');
  });

  it('shows dashes for missing values', () => {
    const p = buildProfile({ returnPct: Number.NaN, winRatePct: Number.NaN, profitFactor: Number.NaN, maxDrawdownPct: Number.NaN, payoffRatio: Number.NaN, trades: Number.NaN });
    expect(p.every((a) => a.display === '—' && a.value === 0)).toBe(true);
  });

  it('headline has four signed or plain values', () => {
    expect(SAMPLE_HEADLINE).toEqual([
      ['Return', '+1.84%'],
      ['Win rate', '57%'],
      ['Max drawdown', '2.10%'],
      ['Trades', '7'],
    ]);
    expect(buildHeadline({ ...SAMPLE_STATS, returnPct: -0.5 })[0][1]).toBe('-0.50%');
  });
});
