'use client';

import type { CSSProperties } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { buttonClasses } from '@/components/ui';
import { HERO_PHRASES } from '@/lib/landing/content';
import { HeroPriceLine } from './HeroPriceLine';
import { HexGrid } from './HexGrid';
import { useTypingHeadline } from './useTypingHeadline';

const d = (s: number) => ({ '--d': `${s}s` }) as CSSProperties;

export function Hero() {
  const { text, done } = useTypingHeadline(HERO_PHRASES);

  return (
    <section aria-labelledby="hero-title" className="relative overflow-hidden min-h-[calc(100svh-4rem)] flex items-center justify-center text-center px-4 py-20 bg-[#080d1a]">
      <HexGrid />
      <div aria-hidden className="absolute inset-0 pointer-events-none bg-[radial-gradient(55%_45%_at_50%_38%,rgba(59,130,246,0.22),transparent_70%)]" />
      <HeroPriceLine />

      {/* pointer-events-none lets the hexagons under the text react; the controls turn it back on. */}
      <div className="relative max-w-5xl mx-auto pointer-events-none">
        <h1 id="hero-title" className="text-[clamp(2.4rem,6.4vw,5rem)] font-extrabold tracking-tight leading-[1.05] text-slate-100">
          <span className="sr-only">Trade the past. {HERO_PHRASES.join(' ')}</span>
          <span aria-hidden className="block">
            <span className="lp-word" style={d(0.2)}>Trade</span> <span className="lp-word" style={d(0.32)}>the</span>{' '}
            <span className="lp-word" style={d(0.44)}>past.</span>
          </span>
          <span aria-hidden className="block lp-word" style={d(0.6)}>
            <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-cyan-400 bg-clip-text text-transparent">{text || ' '}</span>
            {!done && <span className="lp-caret" />}
          </span>
        </h1>
        <p className="lp-in mt-6 max-w-2xl mx-auto text-[1rem] sm:text-lg leading-relaxed text-slate-300" style={d(0.9)}>
          Ten minutes, a virtual $100,000 and a stretch of real market data. Replay it one candle at a time, then find out what your decisions were worth.
        </p>
        <div className="lp-in mt-8 flex flex-wrap justify-center gap-3 pointer-events-auto" style={d(1.1)}>
          <Link href="/practice" className={buttonClasses('primary', 'px-5 py-2.5 text-sm group')}>
            Start practice <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Link>
          <a href="#how" className={buttonClasses('secondary', 'px-5 py-2.5 text-sm')}>
            How it works
          </a>
        </div>
        <p className="lp-in mt-6 inline-flex items-center gap-2 text-xs text-faint" style={d(1.3)}>
          <kbd className="font-mono text-[11px] border border-slate-700 border-b-2 rounded px-1.5 py-px text-slate-300 bg-[#0b1222]">Space</kbd>
          plays and pauses the replay once a match starts
        </p>
      </div>
    </section>
  );
}
