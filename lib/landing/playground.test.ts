import { describe, expect, it } from 'vitest';
import { ILLUSTRATIVE_CLOSES, PLAYGROUND_START, canReveal, initialPlayground, placeFill, playgroundFeedback, revealNext } from './playground';

const CLOSES = [100, 103, 101, 101];

describe('fill playground', () => {
  it('starts with three candles and no fill', () => {
    expect(initialPlayground()).toEqual({ shown: PLAYGROUND_START, fill: null });
    expect(playgroundFeedback(initialPlayground())).toMatch(/^Reveal a candle/);
  });

  it('never reveals past the last candle', () => {
    let p = initialPlayground();
    for (let i = 0; i < 50; i++) p = revealNext(p);
    expect(p.shown).toBe(ILLUSTRATIVE_CLOSES.length);
    expect(canReveal(p)).toBe(false);
  });

  it('fills at the last revealed candle, only once', () => {
    const p = placeFill({ shown: 2, fill: null }, 'Buy');
    expect(p.fill).toEqual({ side: 'Buy', index: 1 });
    expect(placeFill(p, 'Sell')).toBe(p);
    expect(placeFill({ shown: 0, fill: null }, 'Buy').fill).toBeNull();
    expect(playgroundFeedback(p, CLOSES)).toMatch(/^Filled at this candle/);
  });

  it('a buy profits when price rises, a sell when it falls', () => {
    // Fill at index 0 (100), then index 1 closes at 103.
    expect(playgroundFeedback({ shown: 2, fill: { side: 'Buy', index: 0 } }, CLOSES)).toBe('Price is higher than your fill. For a buy, that is in profit right now.');
    expect(playgroundFeedback({ shown: 2, fill: { side: 'Sell', index: 0 } }, CLOSES)).toBe('Price is higher than your fill. For a sell, that is a loss right now.');
    // Fill at index 1 (103), then index 2 closes at 101.
    expect(playgroundFeedback({ shown: 3, fill: { side: 'Sell', index: 1 } }, CLOSES)).toBe('Price is lower than your fill. For a sell, that is in profit right now.');
  });

  it('reports flat when price is unchanged', () => {
    expect(playgroundFeedback({ shown: 4, fill: { side: 'Buy', index: 2 } }, CLOSES)).toBe('Price is unchanged from your fill. For a buy, that is flat right now.');
  });
});
