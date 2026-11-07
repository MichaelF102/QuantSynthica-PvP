import { describe, expect, it } from 'vitest';
import { resolveHotkey, type HotkeyEvent } from './hotkeys';

function el(html: string, select: string): Element {
  document.body.innerHTML = html;
  return document.querySelector(select)!;
}
const ev = (key: string, target: EventTarget | null = document.body, mods: Partial<HotkeyEvent> = {}): HotkeyEvent => ({ key, ctrlKey: false, metaKey: false, altKey: false, target, ...mods });
const free = { modalOpen: false };

describe('resolveHotkey', () => {
  it.each([
    ['b', 'focus-buy'],
    ['B', 'focus-buy'],
    ['s', 'focus-sell'],
    ['S', 'focus-sell'],
    [' ', 'toggle-play'],
    ['ArrowRight', 'step'],
    ['?', 'show-help'],
    ['x', null],
    ['Enter', null],
  ])('%j -> %s', (key, action) => expect(resolveHotkey(ev(key), free)).toBe(action));

  it('ignores everything while a modal is open', () => {
    expect(resolveHotkey(ev(' '), { modalOpen: true })).toBeNull();
    expect(resolveHotkey(ev('b'), { modalOpen: true })).toBeNull();
  });

  it('ignores keys with Ctrl, Cmd or Alt', () => {
    expect(resolveHotkey(ev('s', document.body, { ctrlKey: true }), free)).toBeNull();
    expect(resolveHotkey(ev('b', document.body, { metaKey: true }), free)).toBeNull();
    expect(resolveHotkey(ev('ArrowRight', document.body, { altKey: true }), free)).toBeNull();
  });

  it('ignores shortcuts while typing in a field', () => {
    for (const html of ['<input type="text">', '<input type="number">', '<input type="range">', '<textarea></textarea>', '<select></select>']) {
      const t = el(html, 'input, textarea, select');
      expect(resolveHotkey(ev('b', t), free)).toBeNull();
      expect(resolveHotkey(ev(' ', t), free)).toBeNull();
      expect(resolveHotkey(ev('ArrowRight', t), free)).toBeNull();
    }
  });

  it('Enter in the order-size box submits; Enter elsewhere does not', () => {
    expect(resolveHotkey(ev('Enter', el('<input type="number" data-trade-size>', 'input')), free)).toBe('submit-intent');
    expect(resolveHotkey(ev('Enter', el('<input type="text">', 'input')), free)).toBeNull();
  });

  it('leaves Space to a focused button and arrows to tabs and radio groups', () => {
    expect(resolveHotkey(ev(' ', el('<button><span>Buy</span></button>', 'span')), free)).toBeNull();
    expect(resolveHotkey(ev('b', el('<button>x</button>', 'button')), free)).toBe('focus-buy');
    expect(resolveHotkey(ev('ArrowRight', el('<div role="tablist"><button role="tab">a</button></div>', 'button')), free)).toBeNull();
    expect(resolveHotkey(ev('ArrowRight', el('<div role="radiogroup"><button role="radio">a</button></div>', 'button')), free)).toBeNull();
    expect(resolveHotkey(ev('ArrowRight', el('<button>Step</button>', 'button')), free)).toBe('step');
  });
});
