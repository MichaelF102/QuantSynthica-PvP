'use client';

import { useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { buttonClasses } from '@/components/ui';
import { DOWN, UP } from './CandleGlyphs';
import { Reveal } from './Reveal';
import { useReducedMotion } from './useReducedMotion';

// Illustrative candle field (a sum of sine waves, not market data) in a 1000 x 600 box.
const wave = (i: number) => 300 + 110 * Math.sin(i * 0.42) + 45 * Math.sin(i * 1.3);
const CANDLES = Array.from({ length: 44 }, (_, i) => {
  const c = wave(i);
  const o = i === 0 ? c : wave(i - 1);
  return { x: 12 + i * 22.7, o, c, h: Math.max(o, c) + 14 + (i % 4) * 4, l: Math.min(o, c) - 14 - (i % 3) * 4 };
});
const GRID_Y = [100, 200, 300, 400, 500];
const Y = (v: number) => 600 - v;

/** Closing call to action. Candles near the pointer brighten, and a crosshair follows it. */
export function ClosingCta() {
  const [pt, setPt] = useState({ x: 0.5, y: 0.5 });
  const [hover, setHover] = useState(false);
  const reduce = useReducedMotion();

  return (
    <Reveal>
      <section
        aria-labelledby="cta-head"
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setPt({ x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) });
        }}
        onPointerEnter={(e) => e.pointerType === 'mouse' && setHover(true)}
        onPointerLeave={() => setHover(false)}
        className="relative overflow-hidden min-h-screen flex items-center justify-center text-center px-4 py-28 border-t border-slate-800/60 bg-gradient-to-b from-[#080d1a] to-[#0b1424] cursor-crosshair"
      >
        <svg aria-hidden viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 w-full h-full pointer-events-none">
          {GRID_Y.map((y) => (
            <line key={y} x1={0} x2={1000} y1={y} y2={y} stroke="#1e293b" />
          ))}
          <g style={{ transform: `translate(${(pt.x - 0.5) * -18}px, ${(pt.y - 0.5) * -10}px)`, transition: reduce ? 'none' : 'transform 0.5s ease-out' }}>
            {CANDLES.map((k, i) => {
              const t = hover ? Math.max(0, 1 - Math.abs(k.x / 1000 - pt.x) * 7) : 0;
              const col = k.c >= k.o ? UP : DOWN;
              const top = Y(Math.max(k.o, k.c));
              const bot = Y(Math.min(k.o, k.c));
              return (
                <g
                  key={i}
                  className="lp-cta-candle"
                  opacity={0.18 + 0.75 * t}
                  style={{ '--i': i, transition: reduce ? 'none' : 'opacity 0.3s ease' } as CSSProperties}
                >
                  <line x1={k.x} x2={k.x} y1={Y(k.h)} y2={Y(k.l)} stroke={col} strokeWidth={1.4} />
                  <rect x={k.x - 5} y={top} width={10} height={Math.max(2, bot - top)} rx={1.5} fill={col} />
                </g>
              );
            })}
          </g>
        </svg>

        {hover && (
          <div aria-hidden className="pointer-events-none">
            <div className="absolute inset-y-0 w-px bg-slate-400/35" style={{ left: `${pt.x * 100}%` }} />
            <div className="absolute inset-x-0 h-px bg-slate-400/35" style={{ top: `${pt.y * 100}%` }} />
            <div className="absolute w-2 h-2 -ml-1 -mt-1 rounded-full border border-blue-400" style={{ left: `${pt.x * 100}%`, top: `${pt.y * 100}%` }} />
          </div>
        )}

        <div className="relative max-w-5xl pointer-events-none">
          <h2 id="cta-head" className="text-[clamp(2.4rem,6.4vw,5rem)] font-extrabold tracking-tight leading-[1.05] text-slate-100">
            Ten minutes is enough to find out{' '}
            <span className="lp-wipe bg-gradient-to-r from-blue-400 via-indigo-400 to-cyan-400 bg-clip-text text-transparent">what you would have done.</span>
          </h2>
          <p className="mt-6 mx-auto max-w-2xl text-[1rem] sm:text-lg leading-relaxed text-slate-300">
            A virtual $100,000, a random stretch of real market history and a loss limit you cannot ignore.
          </p>
          <Link href="/practice" className={buttonClasses('primary', 'lp-pulse pointer-events-auto mt-8 rounded-full pl-6 pr-2 py-2 text-sm gap-3')}>
            Start practice
            <span aria-hidden className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white/15">
              <ArrowUpRight className="w-4 h-4" />
            </span>
          </Link>
        </div>
      </section>
    </Reveal>
  );
}
