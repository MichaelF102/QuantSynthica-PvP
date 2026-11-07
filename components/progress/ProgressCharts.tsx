'use client';

import { Bar, CartesianGrid, Cell, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { fmtPct, fmtPlayedAt, shortSymbol } from '@/lib/format';
import { ROLLING_WINDOW, type TrendPoint } from '@/lib/progress';

const UP = '#10b981';
const DOWN = '#f43f5e';
const LINE = '#60a5fa';
const TICK = { fontSize: 10, fill: '#64748b' };
const GRID = <CartesianGrid stroke="var(--border-color)" strokeDasharray="3 3" vertical={false} />;

function TrendTooltip({ active, payload, kind }: { active?: boolean; payload?: { payload: TrendPoint }[]; kind: 'return' | 'winRate' }) {
  const p = active ? payload?.[0]?.payload : undefined;
  if (!p) return null;
  return (
    <div className="rounded-md border border-slate-800 bg-[#0b1222] px-2.5 py-2 text-[11px] font-mono space-y-0.5 shadow-lg">
      <div className="text-slate-400">
        #{p.n} · {shortSymbol(p.symbol)} · {fmtPlayedAt(p.playedAt)}
      </div>
      {kind === 'return' ? (
        <>
          <div className={p.returnPct > 0 ? 'text-emerald-400' : p.returnPct < 0 ? 'text-rose-400' : 'text-slate-300'}>Return {fmtPct(p.returnPct)}</div>
          <div className="text-blue-300">
            {ROLLING_WINDOW}-match avg {fmtPct(p.rollingReturn)}
          </div>
        </>
      ) : (
        <div className="text-blue-300">
          {ROLLING_WINDOW}-match win rate {fmtPct(p.rollingWinRate, 1, false)}
        </div>
      )}
    </div>
  );
}

/** Return per match with a rolling average (plan M13 P4). */
export function ReturnTrendChart({ points }: { points: TrendPoint[] }) {
  const last = points[points.length - 1];
  return (
    <div className="h-64" role="img" aria-label={`Return per match for ${points.length} matches. Latest ${fmtPct(last?.returnPct)}, ${ROLLING_WINDOW}-match average ${fmtPct(last?.rollingReturn)}.`}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          {GRID}
          <XAxis dataKey="n" tick={TICK} axisLine={false} tickLine={false} />
          <YAxis tick={TICK} axisLine={false} tickLine={false} width={48} tickFormatter={(v: number) => `${v.toFixed(1)}%`} />
          <ReferenceLine y={0} stroke="#475569" />
          <Tooltip content={<TrendTooltip kind="return" />} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
          <Bar dataKey="returnPct" isAnimationActive={false} maxBarSize={28}>
            {points.map((p) => (
              <Cell key={p.id} fill={p.returnPct >= 0 ? UP : DOWN} fillOpacity={0.75} />
            ))}
          </Bar>
          <Line dataKey="rollingReturn" stroke={LINE} strokeWidth={2} dot={false} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Rolling trade win rate. A window with no closed trades is a gap (plan M13 P4). */
export function WinRateTrendChart({ points }: { points: TrendPoint[] }) {
  const last = points[points.length - 1];
  return (
    <div className="h-64" role="img" aria-label={`${ROLLING_WINDOW}-match trade win rate. Latest ${fmtPct(last?.rollingWinRate, 1, false)}.`}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          {GRID}
          <XAxis dataKey="n" tick={TICK} axisLine={false} tickLine={false} />
          <YAxis tick={TICK} axisLine={false} tickLine={false} width={40} domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(v: number) => `${v}%`} />
          <ReferenceLine y={50} stroke="#475569" strokeDasharray="3 3" />
          <Tooltip content={<TrendTooltip kind="winRate" />} />
          <Line dataKey="rollingWinRate" stroke={LINE} strokeWidth={2} dot={{ r: 2, fill: LINE }} connectNulls={false} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
