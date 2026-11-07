'use client';

import { useEffect } from 'react';
import { TRADE_INTENT_EVENT, resolveHotkey, type HotkeyAction, type TradeIntentDetail } from '@/lib/hotkeys';
import { matchStore } from './matchStore';

const intent = (detail: TradeIntentDetail) => window.dispatchEvent(new CustomEvent<TradeIntentDetail>(TRADE_INTENT_EVENT, { detail }));

/** Wires the match-screen shortcuts. `onHelp` opens the shortcut list. */
export function useHotkeys(onHelp: () => void): void {
  useEffect(() => {
    const run: Record<HotkeyAction, () => void> = {
      'focus-buy': () => intent({ intent: 'buy' }),
      'focus-sell': () => intent({ intent: 'sell' }),
      'submit-intent': () => intent({ submit: true }),
      'toggle-play': () => matchStore.getState().togglePlay(),
      step: () => matchStore.getState().step(),
      'show-help': onHelp,
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat) return;
      const action = resolveHotkey(e, { modalOpen: document.querySelector('[aria-modal="true"]') !== null });
      if (!action) return;
      e.preventDefault(); // e.g. stop Space from scrolling the page
      run[action]();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onHelp]);
}
