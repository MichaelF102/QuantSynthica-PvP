import { describe, expect, it } from 'vitest';
import { TYPING_DELAYS, finalTyping, initialTyping, nextTyping, type TypingState } from './typing';

const PHRASES = ['Beat the clock.', 'Survive the drawdown.', 'Read the tape.'];

function run(phrases: readonly string[]) {
  let s: TypingState = initialTyping(phrases);
  const seen: string[] = [s.text];
  for (let i = 0; i < 10_000; i++) {
    const n = nextTyping(s, phrases);
    if (!n) break;
    s = n.state;
    seen.push(s.text);
  }
  return { s, seen };
}

describe('typing headline', () => {
  it('starts on the first phrase in full', () => {
    expect(initialTyping(PHRASES)).toEqual({ index: 0, text: 'Beat the clock.', deleting: false, done: false });
  });

  it('holds, then deletes one character at a time', () => {
    const s0 = initialTyping(PHRASES);
    const hold = nextTyping(s0, PHRASES)!;
    expect(hold.delay).toBe(TYPING_DELAYS.hold);
    expect(hold.state.deleting).toBe(true);
    const erase = nextTyping(hold.state, PHRASES)!;
    expect(erase.state.text).toBe('Beat the clock');
    expect(erase.delay).toBe(TYPING_DELAYS.erase);
  });

  it('types every phrase and stops on the last one', () => {
    const { s, seen } = run(PHRASES);
    expect(s).toEqual({ index: 2, text: 'Read the tape.', deleting: false, done: true });
    expect(seen).toContain('Survive the drawdown.');
    expect(seen).toContain('');
    expect(nextTyping(s, PHRASES)).toBeNull();
  });

  it('never shows anything but a prefix of a phrase', () => {
    const { seen } = run(PHRASES);
    for (const t of seen) expect(PHRASES.some((p) => p.startsWith(t))).toBe(true);
  });

  it('is done straight away with one phrase or none', () => {
    expect(initialTyping(['Only']).done).toBe(true);
    expect(initialTyping([])).toEqual({ index: 0, text: '', deleting: false, done: true });
  });

  it('final state is the last phrase', () => {
    expect(finalTyping(PHRASES)).toEqual({ index: 2, text: 'Read the tape.', deleting: false, done: true });
    expect(finalTyping([]).text).toBe('');
  });
});
