'use client';

import type { CSSProperties } from 'react';
import { clamp01, type ProfileAxis } from '@/lib/landing/sampleReport';
import { cn } from '@/lib/utils';
import type { HighlightItemProps } from './useHighlight';

/** One KPI tile per radar axis: value, a bar for where it sits on its scale, and the scale. */
export function AxisTiles({ axes, active, itemProps }: { axes: readonly ProfileAxis[]; active: number | null; itemProps: HighlightItemProps }) {
  return (
    <ul className="flex-1 min-w-0 w-full grid grid-cols-[repeat(auto-fill,minmax(min(100%,180px),1fr))] gap-3">
      {axes.map((a, i) => (
        <li key={a.label} className="flex">
          <button
            type="button"
            {...itemProps(i)}
            className={cn(
              'flex-1 text-left rounded-xl border p-3.5 transition-colors duration-200',
              'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500/70',
              active === i ? 'border-blue-600 bg-blue-600/10' : 'border-slate-800/90 bg-[#0b1222]/95 hover:border-slate-700',
            )}
          >
            <span className="block text-[10px] text-slate-400">{a.label}</span>
            <span className="block mt-0.5 text-2xl font-bold font-mono text-white">{a.display}</span>
            <span className="block mt-2.5 h-1.5 rounded-full bg-slate-800 overflow-hidden">
              <span className="lp-bar block h-full rounded-full bg-blue-500" style={{ width: `${clamp01(a.value) * 100}%`, '--i': i } as CSSProperties} />
            </span>
            <span className="block mt-2 font-mono text-[11px] text-faint">{a.range}</span>
            {a.note && <span className="block mt-1 text-[11px] text-faint leading-snug">{a.note}</span>}
          </button>
        </li>
      ))}
    </ul>
  );
}
