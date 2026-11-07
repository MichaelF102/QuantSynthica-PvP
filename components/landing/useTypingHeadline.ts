'use client';

import { useEffect, useState } from 'react';
import { finalTyping, initialTyping, nextTyping } from '@/lib/landing/typing';
import { useReducedMotion } from './useReducedMotion';

/** Types through `phrases` once and stops on the last. Reduced motion shows the last phrase at once. */
export function useTypingHeadline(phrases: readonly string[]): { text: string; done: boolean } {
  const reduce = useReducedMotion();
  const [state, setState] = useState(() => initialTyping(phrases));

  useEffect(() => {
    if (reduce) {
      setState(finalTyping(phrases));
      return;
    }
    const next = nextTyping(state, phrases);
    if (!next) return;
    const t = window.setTimeout(() => setState(next.state), next.delay);
    return () => window.clearTimeout(t);
  }, [state, phrases, reduce]);

  return { text: state.text, done: state.done };
}
