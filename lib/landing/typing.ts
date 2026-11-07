// Typing headline as a pure state machine: type phrase 0, hold, delete, type phrase 1, ...
// and stop for good once the last phrase is fully typed.

export type TypingState = { index: number; text: string; deleting: boolean; done: boolean };

export const TYPING_DELAYS = { type: 130, erase: 75, hold: 3800 } as const;

/** Starts with the first phrase fully shown, so the server render and no-JS view read correctly. */
export function initialTyping(phrases: readonly string[]): TypingState {
  return { index: 0, text: phrases[0] ?? '', deleting: false, done: phrases.length <= 1 };
}

/** The next state, and how long to wait before applying it. `null` once the animation is done. */
export function nextTyping(s: TypingState, phrases: readonly string[]): { state: TypingState; delay: number } | null {
  if (s.done) return null;
  const target = phrases[s.index] ?? '';
  const last = s.index >= phrases.length - 1;

  if (!s.deleting && s.text === target) {
    if (last) return { state: { ...s, done: true }, delay: 0 };
    return { state: { ...s, deleting: true }, delay: TYPING_DELAYS.hold };
  }
  if (s.deleting) {
    if (s.text.length > 0) return { state: { ...s, text: s.text.slice(0, -1) }, delay: TYPING_DELAYS.erase };
    return { state: { ...s, deleting: false, index: s.index + 1 }, delay: TYPING_DELAYS.erase };
  }
  return { state: { ...s, text: target.slice(0, s.text.length + 1) }, delay: TYPING_DELAYS.type };
}

/** The final state, for reduced motion: the last phrase, shown at once. */
export function finalTyping(phrases: readonly string[]): TypingState {
  return { index: Math.max(0, phrases.length - 1), text: phrases[phrases.length - 1] ?? '', deleting: false, done: true };
}
