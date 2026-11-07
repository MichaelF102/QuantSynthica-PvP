'use client';

import { FlaskConical } from 'lucide-react';
import { Badge } from '@/components/ui';
import { SAMPLE_HEADLINE, SAMPLE_PROFILE } from '@/lib/landing/sampleReport';
import { AxisTiles } from './AxisTiles';
import { HexRadar } from './HexRadar';
import { Section } from './Section';
import { SectionHead } from './SectionHead';
import { useHighlight } from './useHighlight';

/** Sample match report. Every number here is a TEST FIXTURE, labelled as such. */
export function SampleResult() {
  const { active, hoverProps, itemProps } = useHighlight();

  return (
    <Section id="results" glow="blue" labelledBy="results-title">
      <SectionHead id="results-title" eyebrow="Results" title="What the report looks like." />

      <div className="rounded-xl border border-slate-800/90 p-4 sm:p-6 shadow-lg shadow-black/20 bg-[repeating-linear-gradient(135deg,#0b1222_0_14px,#0d1528_14px_28px)]">
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <Badge tone="amber" icon={FlaskConical}>TEST FIXTURE</Badge>
          <span className="text-xs text-faint">Sample numbers, not a real match.</span>
        </div>
        <p className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Match report</p>
        <h3 className="mt-1 mb-5 text-xl font-bold text-white">Sample match</h3>

        <dl className="flex flex-wrap gap-x-10 gap-y-4 mb-8">
          {SAMPLE_HEADLINE.map(([k, v]) => (
            <div key={k}>
              <dt className="text-[10px] uppercase tracking-wider text-slate-400">{k}</dt>
              <dd className="mt-0.5 text-2xl font-bold font-mono text-white">{v}</dd>
            </div>
          ))}
        </dl>

        <div className="flex flex-col lg:flex-row gap-8 items-center">
          <div className="flex-1 min-w-0 w-full flex justify-center">
            <HexRadar axes={SAMPLE_PROFILE} active={active} hoverProps={hoverProps} />
          </div>
          <AxisTiles axes={SAMPLE_PROFILE} active={active} itemProps={itemProps} />
        </div>
      </div>
    </Section>
  );
}
