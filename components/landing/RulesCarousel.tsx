'use client';

import { useEffect, useState } from 'react';
import { Ban, CalendarRange, Crosshair, Timer, TrendingDown, Wallet, type LucideIcon } from 'lucide-react';
import { RULES, type RuleId } from '@/lib/landing/content';
import { cn } from '@/lib/utils';
import { RuleVisual } from './RuleVisual';
import { useReducedMotion } from './useReducedMotion';

const ICONS: Record<RuleId, LucideIcon> = { balance: Wallet, time: Timer, drawdown: TrendingDown, leverage: Ban, fills: Crosshair, sessions: CalendarRange };
const AUTOPLAY_MS = 5000;
const n2 = (i: number) => String(i + 1).padStart(2, '0');

/**
 * Six rules as a list and a stack of cards. Hover, focus or click a rule to show its card.
 * Autoplay pauses while the pointer or focus is on the carousel, and is off under reduced motion.
 */
export function RulesCarousel() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduce = useReducedMotion();
  const count = RULES.length;

  useEffect(() => {
    if (paused || reduce) return;
    const t = window.setInterval(() => setIndex((i) => (i + 1) % count), AUTOPLAY_MS);
    return () => window.clearInterval(t);
  }, [paused, reduce, count]);

  return (
    <div
      className="flex flex-col lg:flex-row gap-5 items-stretch"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-1.5 lg:w-60 shrink-0" aria-label="Match rules">
        {RULES.map((r, i) => {
          const Icon = ICONS[r.id];
          const on = i === index;
          return (
            <li key={r.id} className="flex">
              <button
                type="button"
                aria-pressed={on}
                aria-controls="lp-rule-stage"
                onMouseEnter={() => setIndex(i)}
                onFocus={() => setIndex(i)}
                onClick={() => setIndex(i)}
                className={cn(
                  'flex-1 flex items-center gap-3 rounded-lg border px-3.5 py-3 text-sm text-left transition-colors duration-200',
                  'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500/70',
                  on ? 'border-blue-600 bg-blue-600/15 text-white' : 'border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white',
                )}
              >
                <span className="font-mono text-[11px] text-blue-400">{n2(i)}</span>
                <Icon className="w-4 h-4 shrink-0" aria-hidden />
                <span>{r.label}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="relative flex-1 min-w-0">
        {/* Two offset back cards make the stack visible. */}
        <div aria-hidden className="absolute inset-0 translate-x-3 translate-y-3 rounded-xl border border-slate-800/60 bg-[#0b1222]/50" />
        <div aria-hidden className="absolute inset-0 translate-x-1.5 translate-y-1.5 rounded-xl border border-slate-800/80 bg-[#0b1222]/70" />
        <div id="lp-rule-stage" className="relative min-h-[460px] sm:min-h-[480px] overflow-hidden rounded-xl border border-slate-800/90 bg-[#0b1222] shadow-lg shadow-black/20">
          {RULES.map((r, i) => (
            <div
              key={r.id}
              aria-hidden={i !== index}
              className={cn('lp-rule-card absolute inset-0 flex flex-col gap-3 p-5 sm:p-6', i === index ? 'is-on' : i < index && 'is-left')}
            >
              <span className="self-start rounded-full border border-slate-700 bg-[#080d1a] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-slate-300">
                {n2(i)} · {r.label}
              </span>
              <div className="flex-1 flex items-center justify-center">
                <RuleVisual id={r.id} label={r.headline} />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-white">{r.headline}</h3>
              <p className="text-sm text-slate-300 leading-relaxed">{r.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
