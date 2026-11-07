'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { DOWN, UP } from './CandleGlyphs';

// Each rule pinned to the part of the chart it governs. Figures are illustrative, not market data.
type PinId = 'balance' | 'clock' | 'limit' | 'fill' | 'lev';

const PINS: { id: PinId; title: string; text: string }[] = [
  { id: 'balance', title: 'Balance', text: 'You start with $100,000 virtual, or ₹10,00,000 for INR markets.' },
  { id: 'clock', title: 'Clock', text: 'Ten minutes of real time. The clock pauses when you pause replay.' },
  { id: 'limit', title: 'Loss limit', text: 'Equity can fall 5% from its peak. Go past it and the match ends.' },
  { id: 'fill', title: 'Fills', text: 'Orders fill at the close of the candle you are looking at.' },
  { id: 'lev', title: 'No leverage', text: 'An order larger than your balance is rejected.' },
];

const CLOSES = [100, 103, 101, 106, 104, 108, 105, 102, 104, 99, 101, 97, 100, 103, 107, 110, 108, 112];
const PEAK = Math.max(...CLOSES);
const LIMIT = PEAK * 0.95;
const xOf = (i: number) => 40 + i * 32;
const yOf = (v: number) => 250 - ((v - 94) / 20) * 210;
const FILL_IDX = 9;
const CLOCK_SHARE = 0.65;
const SMALL = 'font-mono text-[10px] fill-slate-400';

export function RulesChart() {
  const [active, setActive] = useState<PinId | null>(null);
  const shown = (id: PinId) => active === null || active === id;
  const el = (id: PinId) => cn('transition-opacity duration-200', !shown(id) && 'opacity-20');
  const current = PINS.find((p) => p.id === active);

  return (
    <div className="grid gap-5 mb-12">
      {/* Below ~560px the labels get too small to read, so the chart scrolls inside its own box. */}
      <div className="overflow-x-auto no-scrollbar max-w-4xl">
        <svg
          viewBox="0 0 620 320"
          className="w-full min-w-[560px] h-auto"
          role="img"
          aria-label="Illustrative chart: starting balance, ten-minute clock, a 5% loss limit below the peak, a fill at a candle close, and a rejected oversized order."
        >
          <g className={el('balance')}>
            <text x={40} y={22} className="font-mono text-[16px] font-semibold fill-white">
              $100,000
            </text>
            <text x={40} y={38} className={SMALL}>
              starting balance
            </text>
          </g>

          {CLOSES.map((c, i) => {
            const o = i === 0 ? c : CLOSES[i - 1];
            const color = c >= o ? UP : DOWN;
            const top = yOf(Math.max(o, c));
            const bot = yOf(Math.min(o, c));
            return (
              <g key={i}>
                <line x1={xOf(i)} x2={xOf(i)} y1={yOf(Math.max(o, c) + 1.2)} y2={yOf(Math.min(o, c) - 1.2)} stroke={color} strokeWidth={1.5} />
                <rect x={xOf(i) - 6} y={top} width={12} height={Math.max(2, bot - top)} rx={1.5} fill={color} />
              </g>
            );
          })}

          <g className={el('limit')}>
            <line x1={40} x2={584} y1={yOf(PEAK)} y2={yOf(PEAK)} stroke="#64748b" strokeDasharray="2 4" />
            <text x={44} y={yOf(PEAK) - 6} className={SMALL}>
              Peak
            </text>
            <line x1={40} x2={584} y1={yOf(LIMIT)} y2={yOf(LIMIT)} stroke="#fb7185" strokeWidth={1.2} strokeDasharray="5 4" />
            <text x={44} y={yOf(LIMIT) - 6} className="font-mono text-[10px] fill-rose-400">
              Loss limit: 5% below peak
            </text>
          </g>

          <g className={el('fill')}>
            <line x1={xOf(FILL_IDX)} x2={xOf(FILL_IDX)} y1={yOf(CLOSES[FILL_IDX])} y2={266} stroke="#60a5fa" strokeDasharray="2 3" />
            <circle cx={xOf(FILL_IDX)} cy={yOf(CLOSES[FILL_IDX])} r={5} fill="#60a5fa" stroke="#080d1a" strokeWidth={2} />
            <text x={xOf(FILL_IDX)} y={280} textAnchor="middle" className="font-mono text-[10px] fill-blue-300">
              Fill at close
            </text>
          </g>

          <g className={el('lev')}>
            <rect x={xOf(12)} y={30} width={150} height={26} rx={6} fill="rgba(244,63,94,0.1)" stroke="#f43f5e" strokeDasharray="4 3" />
            <text x={xOf(12) + 75} y={47} textAnchor="middle" className="font-mono text-[10px] fill-rose-400">
              Order 150%: rejected
            </text>
          </g>

          <g className={el('clock')}>
            <rect x={40} y={300} width={544} height={6} rx={3} fill="#1e293b" />
            <rect className="lp-progress" x={40} y={300} width={544 * CLOCK_SHARE} height={6} rx={3} fill="#3b82f6" />
            <text x={40} y={318} className={SMALL}>
              00:00
            </text>
            <text x={584} y={318} textAnchor="end" className={SMALL}>
              10:00
            </text>
          </g>
        </svg>
      </div>

      <div className="flex flex-wrap gap-2">
        {PINS.map((p, i) => (
          <button
            key={p.id}
            type="button"
            aria-pressed={active === p.id}
            onMouseEnter={() => setActive(p.id)}
            onMouseLeave={() => setActive(null)}
            onFocus={() => setActive(p.id)}
            onBlur={() => setActive(null)}
            onClick={() => setActive(p.id)}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs transition-colors duration-200',
              'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500/70',
              active === p.id ? 'border-blue-600 bg-blue-600/15 text-white' : 'border-slate-700 text-slate-300 hover:text-white',
            )}
          >
            <span className="font-mono text-[11px] text-blue-400">{String(i + 1).padStart(2, '0')}</span>
            {p.title}
          </button>
        ))}
      </div>
      <p className="text-sm text-slate-400 leading-relaxed min-h-[3em]" aria-live="polite">
        {current ? current.text : 'Hover or tap a rule to see where it applies on the chart.'}
      </p>
    </div>
  );
}
