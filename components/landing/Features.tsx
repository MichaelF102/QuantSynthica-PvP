'use client';

import { FEATURES } from '@/lib/landing/content';
import { cn } from '@/lib/utils';
import { Section } from './Section';
import { SectionHead } from './SectionHead';
import { SliceChart } from './SliceChart';
import { useHighlight } from './useHighlight';

// Blue family only: emerald and rose mean up and down, purple is reserved (DESIGN.md §1.3).
const RING_COLORS = ['#2563EB', '#0EA5E9', '#1E40AF', '#38BDF8', '#475569', '#94A3B8'] as const;

export function Features() {
  const { active, hoverProps, itemProps } = useHighlight();
  const n = FEATURES.length;

  return (
    <Section id="features" glow="indigo" labelledBy="features-title">
      <SectionHead id="features-title" eyebrow="Features" title="What you get in a match." />

      <div className="flex flex-col lg:flex-row gap-10 items-center">
        <SliceChart
          count={n}
          inner={70}
          colors={RING_COLORS}
          active={active}
          hoverProps={hoverProps}
          label="Six features of a match, one equal segment each"
          center={
            <>
              <text x={130} y={126} textAnchor="middle" className="font-mono fill-slate-200" fontSize={active === null ? 14 : 12}>
                {active === null ? `${n} features` : `0${active + 1}`}
              </text>
              {active !== null && (
                <text x={130} y={144} textAnchor="middle" className="fill-slate-400" fontSize={10}>
                  {FEATURES[active].title}
                </text>
              )}
            </>
          }
        />

        <ul className="flex-1 min-w-0 w-full grid sm:grid-cols-2 gap-2.5">
          {FEATURES.map((f, i) => (
            <li key={f.title} className="flex">
              <button
                type="button"
                {...itemProps(i)}
                className={cn(
                  'flex-1 text-left rounded-xl border px-4 py-3.5 transition-colors duration-200',
                  'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500/70',
                  active === i ? 'bg-blue-600/10' : 'border-slate-800 hover:border-slate-700',
                )}
                style={active === i ? { borderColor: RING_COLORS[i] } : undefined}
              >
                <span className="flex items-center gap-2 text-[1rem] font-semibold text-white">
                  <span aria-hidden className="w-2 h-2 rounded-full shrink-0" style={{ background: RING_COLORS[i] }} />
                  {f.title}
                </span>
                <span className="block mt-1 text-sm text-slate-400 leading-relaxed">{f.body}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}
