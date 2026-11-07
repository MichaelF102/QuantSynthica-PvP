import { describe, expect, it } from 'vitest';
import {
  DASH,
  fmtDateTime,
  fmtDuration,
  fmtMoney,
  fmtPct,
  fmtPlayedAt,
  fmtPrice,
  fmtRatio,
  fmtSignedMoney,
  fmtSignedPrice,
  fmtSpan,
  fmtTime,
  fmtUnits,
  fmtVolume,
  isNum,
  priceDecimalsFor,
} from './format';

const BAD = [Number.NaN, null, undefined, '12', Infinity, -Infinity, {}];

describe('isNum', () => {
  it('accepts finite numbers only', () => {
    expect(isNum(0)).toBe(true);
    expect(isNum(-1.5)).toBe(true);
    for (const v of BAD) expect(isNum(v)).toBe(false);
  });
});

describe.each([
  ['fmtMoney', (v: unknown) => fmtMoney(v, 'USD')],
  ['fmtSignedMoney', (v: unknown) => fmtSignedMoney(v, 'USD')],
  ['fmtPrice', (v: unknown) => fmtPrice(v)],
  ['fmtSignedPrice', (v: unknown) => fmtSignedPrice(v)],
  ['fmtPct', (v: unknown) => fmtPct(v)],
  ['fmtUnits', (v: unknown) => fmtUnits(v, 1)],
  ['fmtTime', (v: unknown) => fmtTime(v)],
  ['fmtDateTime', (v: unknown) => fmtDateTime(v)],
  ['fmtDuration', (v: unknown) => fmtDuration(v)],
  ['fmtVolume', (v: unknown) => fmtVolume(v)],
])('%s', (_name, fn) => {
  it.each(BAD.map((v) => [String(v), v]))('returns a dash for %s', (_l, v) => {
    expect(fn(v)).toBe(DASH);
  });
});

describe('fmtMoney', () => {
  it('formats USD with en-US grouping', () => {
    expect(fmtMoney(100000, 'USD')).toBe('$100,000.00');
    expect(fmtMoney(0, 'USD')).toBe('$0.00');
    expect(fmtMoney(1234.567, 'USD')).toBe('$1,234.57');
  });

  it('formats INR with en-IN (lakh/crore) grouping', () => {
    expect(fmtMoney(1000000, 'INR')).toBe('₹10,00,000.00');
    expect(fmtMoney(12345678.9, 'INR')).toBe('₹1,23,45,678.90');
  });

  it('puts the minus sign before the currency symbol', () => {
    expect(fmtMoney(-1234.5, 'USD')).toBe('-$1,234.50');
    expect(fmtMoney(-100000, 'INR')).toBe('-₹1,00,000.00');
  });

  it('never prints negative zero', () => {
    expect(fmtMoney(-0, 'USD')).toBe('$0.00');
    expect(fmtMoney(-0.001, 'USD')).toBe('$0.00');
  });
});

describe('fmtSignedMoney', () => {
  it('adds + for gains only', () => {
    expect(fmtSignedMoney(412.5, 'USD')).toBe('+$412.50');
    expect(fmtSignedMoney(-412.5, 'USD')).toBe('-$412.50');
    expect(fmtSignedMoney(0, 'USD')).toBe('$0.00');
    expect(fmtSignedMoney(0.001, 'USD')).toBe('$0.00');
  });
});

describe('fmtPrice', () => {
  it('uses the given decimals and en-US grouping', () => {
    expect(fmtPrice(27909.75)).toBe('27,909.75');
    expect(fmtPrice(1.12605, 5)).toBe('1.12605');
    expect(fmtPrice(158.274, 3)).toBe('158.274');
    expect(fmtPrice(0)).toBe('0.00');
    expect(fmtPrice(-3)).toBe('-3.00');
  });

  it('signed version adds + only for rises', () => {
    expect(fmtSignedPrice(3)).toBe('+3.00');
    expect(fmtSignedPrice(-3)).toBe('-3.00');
    expect(fmtSignedPrice(0)).toBe('0.00');
    expect(fmtSignedPrice(-0.0001)).toBe('0.00');
  });
});

describe('fmtPct', () => {
  it('signs positives, keeps negatives, no sign on zero', () => {
    expect(fmtPct(1.2549)).toBe('+1.25%');
    expect(fmtPct(-0.5)).toBe('-0.50%');
    expect(fmtPct(0)).toBe('0.00%');
    expect(fmtPct(-0.001)).toBe('0.00%');
    expect(fmtPct(1.5, 1, false)).toBe('1.5%');
  });
});

describe('fmtUnits', () => {
  it('shows 2 decimals for fractional lot steps, none for whole lots', () => {
    expect(fmtUnits(3.456, 0.01)).toBe('3.46');
    expect(fmtUnits(88888, 1)).toBe('88,888');
    expect(fmtUnits(0, 1)).toBe('0');
    expect(fmtUnits(-2.5, 0.01)).toBe('-2.5');
  });
});

describe('times', () => {
  it('fmtTime shows 24h UTC time with the zone', () => {
    expect(fmtTime(0)).toBe('00:00:00 UTC');
    expect(fmtTime(1791293400)).toBe('13:30:00 UTC');
  });

  it('fmtDateTime shows date, minutes and the zone', () => {
    expect(fmtDateTime(1791293400)).toBe('2026-10-06 13:30 UTC');
  });

  it('fmtDuration is mm:ss and clamps negatives to zero', () => {
    expect(fmtDuration(600000)).toBe('10:00');
    expect(fmtDuration(59999)).toBe('00:59');
    expect(fmtDuration(0)).toBe('00:00');
    expect(fmtDuration(-5000)).toBe('00:00');
    expect(fmtDuration(3_600_000)).toBe('60:00');
  });
});

describe('fmtVolume', () => {
  it('is compact', () => {
    expect(fmtVolume(980)).toBe('980');
    expect(fmtVolume(154_000)).toBe('154K');
    expect(fmtVolume(12_673_855)).toBe('12.7M');
    expect(fmtVolume(0)).toBe('0');
    expect(fmtVolume(-1)).toBe(DASH);
  });
});

describe('priceDecimalsFor', () => {
  it('reads the index value and falls back to 2', () => {
    expect(priceDecimalsFor({ priceDecimals: 5 })).toBe(5);
    expect(priceDecimalsFor({ priceDecimals: 0 })).toBe(0);
    expect(priceDecimalsFor(null)).toBe(2);
    expect(priceDecimalsFor({ priceDecimals: Number.NaN })).toBe(2);
  });
});

describe('results formatting', () => {
  it('fmtRatio', () => {
    expect(fmtRatio(1.8549)).toBe('1.85');
    expect(fmtRatio(0)).toBe('0.00');
    expect(fmtRatio(null)).toBe(DASH);
    expect(fmtRatio(Number.NaN)).toBe(DASH);
  });

  it('fmtSpan', () => {
    expect(fmtSpan(0)).toBe('0m');
    expect(fmtSpan(45 * 60)).toBe('45m');
    expect(fmtSpan(2 * 3600 + 5 * 60)).toBe('2h 05m');
    expect(fmtSpan(3 * 86400 + 4 * 3600)).toBe('3d 4h');
    expect(fmtSpan(-1)).toBe(DASH);
    expect(fmtSpan(undefined)).toBe(DASH);
  });

  it('fmtPlayedAt shows a date, a time and a zone', () => {
    expect(fmtPlayedAt(Date.UTC(2026, 10, 4, 10, 42))).toMatch(/2026.*\d{2}:\d{2}.*(GMT|UTC|[A-Z]{2,})/);
    expect(fmtPlayedAt(null)).toBe(DASH);
  });
});

describe('fmtProfitFactor / fmtPlayedAtBoth', async () => {
  const { fmtProfitFactor, fmtPlayedAtBoth } = await import('./format');
  it('shows tiny profit factors as <0.01, not 0.00', () => {
    expect(fmtProfitFactor(0.0006)).toBe('<0.01');
    expect(fmtProfitFactor(0)).toBe('0.00');
    expect(fmtProfitFactor(0.005)).toBe('0.01');
    expect(fmtProfitFactor(1.32)).toBe('1.32');
    expect(fmtProfitFactor(null)).toBe('—');
    expect(fmtProfitFactor(Number.NaN)).toBe('—');
  });
  it('shows the played time in UTC with the local time', () => {
    expect(fmtPlayedAtBoth(Date.UTC(2026, 10, 7, 10, 19))).toMatch(/^2026-11-07 10:19 UTC \(\d\d:\d\d local\)$/);
    expect(fmtPlayedAtBoth(undefined)).toBe('—');
  });
});
