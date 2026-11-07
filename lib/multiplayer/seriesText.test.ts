import { describe, expect, it } from 'vitest';
import { seriesText } from './seriesText';

const players = [
  { id: 'a', nickname: 'Ann' },
  { id: 'b', nickname: 'Bo' },
];
const view = (wins: Record<string, number>, game = 2, done = false, winner: string | null = null) => ({ of: 3 as const, game, wins, done, winner });

describe('seriesText', () => {
  it('names both players for the rules card', () => {
    expect(seriesText(view({ a: 1 }), players, null)).toBe('Game 2 of 3 · Ann 1–0 Bo');
  });
  it('speaks from your side during and after the series', () => {
    expect(seriesText(view({ a: 1 }), players, 'b')).toBe('Game 2 of 3 · You trail 0–1');
    expect(seriesText(view({ a: 1, b: 1 }, 3), players, 'a')).toBe('Game 3 of 3 · Level 1–1');
    expect(seriesText(view({ a: 2 }, 2, true, 'a'), players, 'a')).toBe('You won the series 2–0');
    expect(seriesText(view({}, 3, true, 'draw'), players, 'b')).toBe('Series drawn 0–0');
  });
});
