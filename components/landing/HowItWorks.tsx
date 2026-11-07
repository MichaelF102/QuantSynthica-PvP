'use client';

import { STEPS } from '@/lib/landing/content';
import { cn } from '@/lib/utils';
import { CandleAnatomy } from './CandleAnatomy';
import { FillPlayground } from './FillPlayground';
import { Section } from './Section';
import { SectionHead } from './SectionHead';
import { SliceChart } from './SliceChart';
import { useHighlight } from './useHighlight';

// Blue family only: emerald and rose mean up and down, purple is reserved (DESIGN.md §1.3).
const STEP_COLORS = ['#2563EB', '#0EA5E9', '#1E40AF', '#64748B'] as const;

export function HowItWorks() {
  const { active, hoverProps, itemProps } = useHighlight();

  return (
    <Section id="how" glow="sky" labelledBy="how-title">
      <SectionHead id="how-title" eyebrow="How it works" title="Four steps, one chart." />

      <div className="flex flex-col lg:flex-row gap-10 items-center">
        <SliceChart
          count={STEPS.length}
          colors={STEP_COLORS}
          active={active}
          hoverProps={hoverProps}
          label="Four steps of a match, one equal slice each"
          center={
            <>
              <circle cx={130} cy={130} r={42} fill="#0b1222" />
              <text x={130} y={135} textAnchor="middle" className="font-mono fill-slate-200" fontSize={active === null ? 13 : 18}>
                {active === null ? '4 steps' : `0${active + 1}`}
              </text>
            </>
          }
        />

        <ol className="flex-1 min-w-0 w-full grid">
          {STEPS.map((s, i) => (
            <li key={s.title} className="border-b border-slate-800 last:border-b-0">
              <button
                type="button"
                {...itemProps(i)}
                className={cn(
                  'w-full grid grid-cols-[3rem_1fr] gap-3 text-left rounded-lg px-4 py-4 transition-colors duration-200',
                  'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500/70',
                  active === i ? 'bg-blue-600/10' : 'hover:bg-slate-800/30',
                )}
              >
                <span className="font-mono text-sm pt-0.5 text-blue-400">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span>
                  <span className="flex items-center gap-2 text-[1rem] font-semibold text-white">
                    <span aria-hidden className="w-2 h-2 rounded-full shrink-0" style={{ background: STEP_COLORS[i] }} />
                    {s.title}
                  </span>
                  <span className="block mt-1 text-sm text-slate-400 leading-relaxed">{s.body}</span>
                </span>
              </button>
            </li>
          ))}
        </ol>
      </div>
      <p className="mt-4 text-[11px] text-faint">Equal slices show the order of the steps, not the time each one takes.</p>

      <CandleAnatomy />
      <FillPlayground />
    </Section>
  );
}
