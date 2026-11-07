'use client';

import { ANATOMY } from '@/lib/landing/content';
import { cn } from '@/lib/utils';
import { UP } from './CandleGlyphs';
import { useHighlight } from './useHighlight';

/** Names the parts of one rising candle. Hover, focus or tap a part to highlight it. */
export function CandleAnatomy() {
  const { active, hoverProps, itemProps } = useHighlight();
  const activeId = active === null ? null : ANATOMY[active].id;
  const lit = (...ids: string[]) => activeId === null || ids.includes(activeId);

  return (
    <div className="mt-14 flex flex-col md:flex-row gap-8 items-center">
      <svg viewBox="0 0 200 260" role="img" aria-label="Anatomy of a rising candle: high, close, open and low" className="w-full max-w-[220px] h-auto shrink-0">
        {ANATOMY.map((a, i) => (
          <g key={a.id} {...hoverProps(i)}>
            <line
              x1={10}
              x2={190}
              y1={a.y}
              y2={a.y}
              stroke="#60a5fa"
              strokeWidth={activeId === a.id ? 2 : 1}
              strokeDasharray="4 4"
              opacity={activeId === null || activeId === a.id ? 0.95 : 0.15}
              style={{ transition: 'opacity 0.2s ease, stroke-width 0.2s ease' }}
            />
            <line x1={10} x2={190} y1={a.y} y2={a.y} stroke="transparent" strokeWidth={12} />
          </g>
        ))}
        <line x1={100} x2={100} y1={30} y2={230} stroke={UP} strokeWidth={2} opacity={lit('high', 'low') ? 1 : 0.4} />
        <rect x={80} y={70} width={40} height={120} rx={3} fill={UP} opacity={lit('close', 'open') ? 1 : 0.4} />
      </svg>

      <div className="flex-1 min-w-0 w-full grid gap-2">
        {ANATOMY.map((a, i) => (
          <button
            key={a.id}
            type="button"
            {...itemProps(i)}
            className={cn(
              'text-left rounded-lg border px-4 py-3 transition-colors duration-200',
              'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500/70',
              active === i ? 'border-blue-600 bg-blue-600/10' : 'border-slate-800 hover:border-slate-700',
            )}
          >
            <span className="font-mono text-xs text-blue-400 mr-2.5">{a.label}</span>
            <span className="text-sm text-slate-300">{a.text}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
