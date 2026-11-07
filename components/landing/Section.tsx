import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Reveal } from './Reveal';

/** Soft corner glows, blue family only (DESIGN.md §4.5). */
const GLOWS = {
  blue: 'rgba(37, 99, 235, 0.14)',
  sky: 'rgba(14, 165, 233, 0.10)',
  indigo: 'rgba(79, 70, 229, 0.10)',
  slate: 'rgba(148, 163, 184, 0.08)',
} as const;

export type Glow = keyof typeof GLOWS;

/** A full-height landing section on the navy canvas: faint grid, optional corner glow, reveal on scroll. */
export function Section({ id, glow, labelledBy, className, children }: { id?: string; glow?: Glow; labelledBy?: string; className?: string; children: ReactNode }) {
  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      className={cn('lp-section relative overflow-hidden min-h-screen flex items-start pt-24 pb-16 sm:pt-28 border-t border-slate-800/60 bg-[#080d1a]', className)}
    >
      <div aria-hidden className="lp-grid-layer absolute inset-0 pointer-events-none" />
      {glow && (
        <div aria-hidden className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(circle at 85% 15%, ${GLOWS[glow]}, transparent 55%)` }} />
      )}
      <div className="relative w-full">
        <Reveal className="app-container">{children}</Reveal>
      </div>
    </section>
  );
}
