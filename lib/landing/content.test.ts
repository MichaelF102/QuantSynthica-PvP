import { describe, expect, it } from 'vitest';
import { FAQS, FEATURES, HERO_PHRASES, NAV_LINKS, RULES, STEPS, activeSection, scrollProgress } from './content';

describe('landing content', () => {
  it('has the counts the charts are drawn for', () => {
    expect(STEPS).toHaveLength(4);
    expect(FEATURES).toHaveLength(6);
    expect(RULES).toHaveLength(6);
    expect(HERO_PHRASES).toEqual(['Beat the clock.', 'Survive the drawdown.', 'Read the tape.']);
    expect(NAV_LINKS.map((l) => l.id)).toEqual(['how', 'rules', 'features', 'markets', 'faq']);
    expect(FAQS.length).toBeGreaterThan(0);
  });

  it('never names a data vendor', () => {
    const all = JSON.stringify([STEPS, FEATURES, RULES, FAQS, HERO_PHRASES]).toLowerCase();
    expect(all).not.toMatch(/yahoo|yfinance|tradingview/);
  });
});

describe('activeSection', () => {
  it('picks the last section whose top crossed the line', () => {
    expect(activeSection([500, 900, 1400], 400)).toBeNull();
    expect(activeSection([-200, 300, 1400], 400)).toBe(1);
    expect(activeSection([-900, -500, -100], 400)).toBe(2);
  });
  it('does not depend on link order matching page order', () => {
    // Nav order: how, rules. Page order: rules (above), how (current).
    expect(activeSection([20, -900], 400)).toBe(0);
    expect(activeSection([900, 50], 400)).toBe(1);
  });
  it('skips missing sections', () => {
    expect(activeSection([null, 100, null], 400)).toBe(1);
    expect(activeSection([], 400)).toBeNull();
  });
});

describe('scrollProgress', () => {
  it('runs 0 to 1 and clamps', () => {
    expect(scrollProgress(0, 2000, 1000)).toBe(0);
    expect(scrollProgress(500, 2000, 1000)).toBe(0.5);
    expect(scrollProgress(5000, 2000, 1000)).toBe(1);
    expect(scrollProgress(-10, 2000, 1000)).toBe(0);
  });
  it('is 0 when the page does not scroll', () => {
    expect(scrollProgress(0, 800, 1000)).toBe(0);
  });
});
