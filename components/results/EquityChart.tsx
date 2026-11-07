'use client';

import { useId, useMemo, useState } from 'react';
import { Area, CartesianGrid, ComposedChart, Line, ReferenceArea, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { LineChart as LineChartIcon } from 'lucide-react';
import { EmptyState } from '@/components/ui';
import { equityRows, niceTicks, tradeDots, worstDrawdown, type EquityRow } from '@/lib/equitySeries';
import { fmtDateTime, fmtMoney, fmtPct, fmtSignedMoney } from '@/lib/format';
import type { EquityPoint, Trade } from '@/lib/types';
import { cn } from '@/lib/utils';

const UP = '#10b981';
const DOWN = '#f43f5e';
const TICK = { fontSize: 10, fill: '#64748b' };

const hhmm = (t: number) => new Date(t * 1000).toISOString().slice(11, 16);

/** Axis money: whole units on a narrow range (so ticks stay distinct), compact on a wide one. */
export function axisMoney(v: number, currency: string, range: number): string {
  const symbol = currency === 'INR' ? '₹' : '$';
  const locale = currency === 'INR' ? 'en-IN' : 'en-US';
  if (range < Math.abs(v) * 0.1) return `${symbol}${Math.round(v).toLocaleString(locale)}`;
  return `${symbol}${new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(v)}`;
}

type Props = { curve: EquityPoint[]; startingBalance: number; currency: string; limitPct: number; trades: Trade[]; activeTradeId: string | null };

function EquityTooltip({ active, payload, currency }: { active?: boolean; payload?: { payload: EquityRow }[]; currency: string }) {
  const row = active ? payload?.[0]?.payload : undefined;
  if (!row) return null;
  return (
    <div className="rounded-md border border-slate-800 bg-[#0b1222] px-2.5 py-2 text-[11px] font-mono space-y-0.5 shadow-lg">
      <div className="text-slate-400">{fmtDateTime(row.t)}</div>
      <div className="text-white">Equity {fmtMoney(row.equity, currency)}</div>
      <div className={row.change > 0 ? 'text-emerald-400' : row.change < 0 ? 'text-rose-400' : 'text-slate-300'}>
        vs start {fmtSignedMoney(row.change, currency)} ({fmtPct(row.changePct)})
      </div>
      <div className="text-slate-400">Drawdown {fmtPct(row.ddPct, 2, false)}</div>
    </div>
  );
}

/** Equity over the match (DESIGN.md §8), with trade dots, the worst drawdown shaded and an optional loss-limit line. */
export function EquityChart({ curve, startingBalance, currency, limitPct, trades, activeTradeId }: Props) {
  const gradientId = useId().replace(/:/g, '');
  const [showLimit, setShowLimit] = useState(false);
  const rows = useMemo(() => equityRows(curve, startingBalance, limitPct), [curve, startingBalance, limitPct]);
  const dd = useMemo(() => worstDrawdown(curve), [curve]);
  const dots = useMemo(() => tradeDots(trades, curve), [trades, curve]);

  if (curve.length < 2) {
    return <EmptyState icon={LineChartIcon} title="Not enough data for a curve" hint="The match ended before a second candle was revealed." />;
  }
  const last = curve[curve.length - 1].equity;
  const color = last >= startingBalance ? UP : DOWN;
  const values = curve.map((p) => p.equity);
  const lo = Math.min(...values, startingBalance, ...(showLimit ? rows.map((r) => r.limit) : []));
  const hi = Math.max(...values, startingBalance);
  const { ticks, domain } = niceTicks(lo, hi, 4);
  const range = domain[1] - domain[0];

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-faint">
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="inline-flex items-center gap-1"><span className="w-3 border-t border-dashed border-slate-500" aria-hidden /> Start</span>
          {dd && <span className="inline-flex items-center gap-1"><span className="w-3 h-2 bg-rose-500/20" aria-hidden /> Worst drawdown {fmtPct(dd.ddPct, 2, false)}</span>}
          <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400" aria-hidden /> Trade entry/exit</span>
        </span>
        <button
          type="button"
          aria-pressed={showLimit}
          onClick={() => setShowLimit((s) => !s)}
          className={cn(
            'rounded-lg border px-2 py-1 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500/70',
            showLimit ? 'border-rose-500/40 bg-rose-500/10 text-rose-300' : 'border-slate-700 text-slate-300 hover:text-white',
          )}
        >
          {showLimit ? 'Hide' : 'Show'} {fmtPct(limitPct, 0, false)} loss limit
        </button>
      </div>
      <div
        className="h-64 w-full"
        role="img"
        aria-label={`Equity curve from ${fmtMoney(curve[0].equity, currency)} to ${fmtMoney(last, currency)}${dd ? `, worst drawdown ${fmtPct(dd.ddPct, 2, false)}` : ''}`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--border-color)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="t" type="number" domain={['dataMin', 'dataMax']} tickFormatter={hhmm} tick={TICK} axisLine={false} tickLine={false} minTickGap={40} />
            <YAxis domain={domain} ticks={ticks} tickFormatter={(v: number) => axisMoney(v, currency, range)} tick={TICK} axisLine={false} tickLine={false} width={72} allowDataOverflow />
            <Tooltip content={<EquityTooltip currency={currency} />} />
            {dd && <ReferenceArea x1={dd.peakT} x2={dd.troughT} fill="#f43f5e" fillOpacity={0.08} stroke="none" ifOverflow="hidden" />}
            <ReferenceLine y={startingBalance} stroke="#64748b" strokeDasharray="4 4" />
            <Area type="monotone" dataKey="equity" stroke={color} strokeWidth={2} fill={`url(#${gradientId})`} dot={false} isAnimationActive={false} />
            {showLimit && <Line type="stepAfter" dataKey="limit" stroke="#fb7185" strokeWidth={1.25} strokeDasharray="5 4" dot={false} isAnimationActive={false} />}
            {dots.map((d) => {
              const on = activeTradeId === d.id;
              const dim = activeTradeId !== null && !on;
              return (
                <ReferenceDot
                  key={`${d.id}-${d.kind}`}
                  x={d.t}
                  y={d.equity}
                  r={on ? 5 : 3}
                  fill={d.kind === 'entry' ? '#60a5fa' : '#0b1222'}
                  stroke={dim ? '#475569' : '#60a5fa'}
                  strokeWidth={1.5}
                  fillOpacity={dim ? 0.4 : 1}
                  ifOverflow="hidden"
                />
              );
            })}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
