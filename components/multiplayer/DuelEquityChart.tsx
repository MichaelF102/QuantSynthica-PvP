'use client';

import { useMemo } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { LineChart as LineChartIcon } from 'lucide-react';
import { axisMoney } from '@/components/results/EquityChart';
import { EmptyState } from '@/components/ui';
import { niceTicks } from '@/lib/equitySeries';
import { fmtDateTime, fmtMoney } from '@/lib/format';
import type { EquityPoint } from '@/lib/types';

// Blue marks you (selection), slate the opponent: emerald and rose stay reserved for up/down.
const YOU = '#60a5fa';
const OPP = '#94a3b8';
const TICK = { fontSize: 10, fill: '#64748b' };
const hhmm = (t: number) => new Date(t * 1000).toISOString().slice(11, 16);

type Row = { t: number; you?: number; opp?: number };

/** Both curves on one time axis; a player knocked out early simply has a shorter line. */
export function mergeCurves(you: EquityPoint[], opp: EquityPoint[]): Row[] {
  const rows = new Map<number, Row>();
  for (const p of you) rows.set(p.t, { ...rows.get(p.t), t: p.t, you: p.equity });
  for (const p of opp) rows.set(p.t, { ...rows.get(p.t), t: p.t, opp: p.equity });
  return [...rows.values()].sort((a, b) => a.t - b.t);
}

function DuelTooltip({ active, payload, currency, names }: { active?: boolean; payload?: { payload: Row }[]; currency: string; names: [string, string] }) {
  const row = active ? payload?.[0]?.payload : undefined;
  if (!row) return null;
  return (
    <div className="rounded-md border border-slate-800 bg-[#0b1222] px-2.5 py-2 text-[11px] font-mono space-y-0.5 shadow-lg">
      <p className="text-slate-400">{fmtDateTime(row.t)}</p>
      {row.you !== undefined && <p style={{ color: YOU }}>{names[0]}: {fmtMoney(row.you, currency)}</p>}
      {row.opp !== undefined && <p style={{ color: OPP }}>{names[1]}: {fmtMoney(row.opp, currency)}</p>}
    </div>
  );
}

type Props = { you: EquityPoint[]; opponent: EquityPoint[]; names: [string, string]; startingBalance: number; currency: string };

export function DuelEquityChart({ you, opponent, names, startingBalance, currency }: Props) {
  const rows = useMemo(() => mergeCurves(you, opponent), [you, opponent]);
  const values = rows.flatMap((r) => [r.you, r.opp]).filter((v): v is number => v !== undefined);
  if (values.length === 0) return <EmptyState icon={LineChartIcon} title="No equity points" hint="The match ended before any candle was revealed." />;
  const lo = Math.min(startingBalance, ...values);
  const hi = Math.max(startingBalance, ...values);
  const pad = Math.max((hi - lo) * 0.1, startingBalance * 0.001);
  const { ticks, domain } = niceTicks(lo - pad, hi + pad, 5);
  const lastOf = (k: 'you' | 'opp') => [...rows].reverse().find((r) => r[k] !== undefined)?.[k];

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-faint">
        <span className="inline-flex items-center gap-1.5"><span className="w-3 border-t-2" style={{ borderColor: YOU }} aria-hidden /> {names[0]}</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-3 border-t-2" style={{ borderColor: OPP }} aria-hidden /> {names[1]}</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-3 border-t border-dashed border-slate-500" aria-hidden /> Start</span>
      </div>
      <div className="h-64 w-full" role="img" aria-label={`Equity curves. ${names[0]} ended at ${fmtMoney(lastOf('you'), currency)}, ${names[1]} at ${fmtMoney(lastOf('opp'), currency)}.`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="var(--border-color)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="t" type="number" domain={['dataMin', 'dataMax']} tickFormatter={hhmm} tick={TICK} axisLine={false} tickLine={false} minTickGap={40} />
            <YAxis domain={domain} ticks={ticks} tickFormatter={(v: number) => axisMoney(v, currency, domain[1] - domain[0])} tick={TICK} axisLine={false} tickLine={false} width={72} allowDataOverflow />
            <Tooltip content={<DuelTooltip currency={currency} names={names} />} />
            <ReferenceLine y={startingBalance} stroke="#64748b" strokeDasharray="4 4" />
            <Line type="monotone" dataKey="opp" stroke={OPP} strokeWidth={1.75} dot={false} connectNulls isAnimationActive={false} />
            <Line type="monotone" dataKey="you" stroke={YOU} strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
