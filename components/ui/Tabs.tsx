'use client';

import { useRef, type KeyboardEvent } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type TabItem<T extends string> = { value: T; label: string; icon?: LucideIcon; count?: number };

type TabsProps<T extends string> = {
  items: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  /** id prefix used to link tabs to their panels: `${idPrefix}-tab-${value}` / `${idPrefix}-panel-${value}` */
  idPrefix: string;
  className?: string;
};

const ACTIVE = 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 font-semibold';
const IDLE = 'font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/50';

/** Pill tab bar from DESIGN.md §7.3, with WAI-ARIA tab keyboard support. */
export function Tabs<T extends string>({ items, value, onChange, label, idPrefix, className }: TabsProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const idx = items.findIndex((i) => i.value === value);
    let next = -1;
    if (e.key === 'ArrowRight') next = (idx + 1) % items.length;
    else if (e.key === 'ArrowLeft') next = (idx - 1 + items.length) % items.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = items.length - 1;
    if (next < 0) return;
    e.preventDefault();
    onChange(items[next].value);
    refs.current[next]?.focus();
  };

  return (
    <div className={cn('relative w-full overflow-x-auto no-scrollbar py-2', className)}>
      <div
        role="tablist"
        aria-label={label}
        onKeyDown={onKeyDown}
        className="flex items-center gap-1.5 p-1 rounded-xl bg-[#0b1120]/80 border border-slate-800/80 backdrop-blur-md min-w-max w-fit"
      >
        {items.map((item, i) => {
          const selected = item.value === value;
          const Icon = item.icon;
          return (
            <button
              key={item.value}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`${idPrefix}-tab-${item.value}`}
              aria-controls={`${idPrefix}-panel-${item.value}`}
              aria-selected={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(item.value)}
              className={cn(
                'flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs transition-colors duration-150 touch:min-h-10',
                'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500/70',
                selected ? ACTIVE : IDLE,
              )}
            >
              {Icon && <Icon className="w-3.5 h-3.5" aria-hidden />}
              {item.label}
              {item.count !== undefined && <span className="font-mono">({item.count})</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
