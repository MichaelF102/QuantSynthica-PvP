// Keyboard shortcuts (CLAUDE.md §10), decided by a pure function so the rules are testable.

export type HotkeyAction = 'focus-buy' | 'focus-sell' | 'toggle-play' | 'step' | 'submit-intent' | 'show-help';

export type HotkeyEvent = {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  target: EventTarget | null;
};

export type HotkeyContext = {
  /** A modal dialog is open: it owns the keyboard. */
  modalOpen: boolean;
};

export const SHORTCUTS: { keys: string; action: string }[] = [
  { keys: 'B', action: 'Focus the size, ready to buy' },
  { keys: 'S', action: 'Focus the size, ready to sell' },
  { keys: 'Enter', action: 'In the size box: place the chosen order' },
  { keys: 'Space', action: 'Play / pause' },
  { keys: '→', action: 'Step one candle' },
  { keys: 'Esc', action: 'Close a dialog or menu' },
  { keys: '?', action: 'Show these shortcuts' },
];

const TEXT_INPUT_TYPES = new Set(['text', 'number', 'search', 'email', 'password', 'tel', 'url', 'datetime-local', 'date', 'time']);

function isEditable(el: Element): boolean {
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return true;
  if (el instanceof HTMLInputElement) return TEXT_INPUT_TYPES.has(el.type) || el.type === 'range';
  return el instanceof HTMLElement && el.isContentEditable;
}

const isTradeSize = (el: Element) => el instanceof HTMLInputElement && el.hasAttribute('data-trade-size');

/** Elements that already use Space/Enter (buttons, links) or arrows (tabs, radio groups). */
const ownsActivation = (el: Element) => Boolean(el.closest('button, a[href], [role="button"], summary'));
const ownsArrows = (el: Element) => Boolean(el.closest('[role="tablist"], [role="radiogroup"], [role="listbox"], [role="menu"]'));

export function resolveHotkey(e: HotkeyEvent, ctx: HotkeyContext): HotkeyAction | null {
  if (ctx.modalOpen || e.ctrlKey || e.metaKey || e.altKey) return null;
  const el = e.target instanceof Element ? e.target : null;

  if (el && isEditable(el)) {
    // While typing, only Enter in the order-size box does anything.
    return e.key === 'Enter' && isTradeSize(el) ? 'submit-intent' : null;
  }

  switch (e.key) {
    case 'b':
    case 'B':
      return 'focus-buy';
    case 's':
    case 'S':
      return 'focus-sell';
    case ' ':
    case 'Spacebar':
      return el && ownsActivation(el) ? null : 'toggle-play';
    case 'ArrowRight':
      return el && ownsArrows(el) ? null : 'step';
    case '?':
      return 'show-help';
    default:
      return null;
  }
}

/** The order-entry intent the trade panel listens for (B / S / Enter, and the phone action bar). */
export const TRADE_INTENT_EVENT = 'qs:trade-intent';
export type TradeIntentDetail = { intent: 'buy' | 'sell' } | { submit: true } | { place: 'buy' | 'sell' };

/** Asks the trade panel to place an order of its current size (the phone action bar). */
export function placeFromTicket(side: 'buy' | 'sell') {
  window.dispatchEvent(new CustomEvent<TradeIntentDetail>(TRADE_INTENT_EVENT, { detail: { place: side } }));
}
