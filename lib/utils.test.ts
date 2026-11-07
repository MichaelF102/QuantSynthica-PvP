import { describe, expect, it } from 'vitest';
import { cn } from './utils';

describe('cn', () => {
  it('joins class names and drops falsy values', () => {
    expect(cn('a', false && 'b', null, undefined, 'c')).toBe('a c');
  });

  it('lets the later class win when Tailwind classes conflict', () => {
    expect(cn('px-2 text-xs', 'px-4')).toBe('text-xs px-4');
    expect(cn('bg-blue-600', 'bg-rose-600')).toBe('bg-rose-600');
  });
});
