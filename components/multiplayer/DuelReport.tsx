'use client';

import { useState, type ReactNode } from 'react';
import { ListChecks, LineChart, Swords, Trophy } from 'lucide-react';
import { TradeList } from '@/components/results/TradeList';
import { Panel, Tabs, PANEL_SHELL } from '@/components/ui';
import { fmtDateTime, fmtMoney, fmtPct, fmtProfitFactor, fmtSignedMoney, shortSymbol } from '@/lib/format';
import { OUTCOME_TEXT, reasonText, type DuelResult, type DuelSide } from '@/lib/multiplayer/duelResult';
import { cn } from '@/lib/utils';
import { StatusBadge } from './DuelScoreboard';
import { DuelEquityChart } from './DuelEquityChart';

/** Colour follows the value as shown (2 decimals), so a return that rounds to 0.00% stays neutral. */
const tone = (v: number | null | undefined) => {
  const shown = v === null || v === undefined ? 0 : Math.round(v * 100) / 100;
  return shown === 0 ? 'text-slate-200' : shown > 0 ? 'text-emerald-400' : 'text-rose-400';
};

type Row = { label: string; value: (s: DuelSide) => string; tone?: (s: DuelSide) => string };

/** The head-to-head report (plan M11.6). `actions` holds rematch / leave in the room. */
export function DuelReport({ result: r, actions }: { result: DuelResult; actions?: ReactNode }) {
  const [tab, setTab] = useState<'you' | 'opponent'>('you');
  const [active, setActive] = useState<string | null>(null);
  const rows: Row[] = [
    { label: 'Final equity', value: (x) => fmtMoney(x.stats.finalEquity, r.currency) },
    { label: 'P&L', value: (x) => fmtSignedMoney(x.stats.pnl, r.currency), tone: (x) => tone(x.stats.pnl) },
    { label: 'Return', value: (x) => fmtPct(x.stats.returnPct), tone: (x) => tone(x.stats.returnPct) },
    { label: 'Trades', value: (x) => String(x.stats.trades) },
    { label: 'Win rate', value: (x) => fmtPct(x.stats.winRate, 0, false) },
    { label: 'Profit factor', value: (x) => fmtProfitFactor(x.stats.profitFactor) },
    { label: 'Max drawdown', value: (x) => fmtPct(x.stats.maxDrawdownPct, 2, false) },
  ];
  const names: [string, string] = [r.you.nickname, r.opponent.nickname];
  const shown = tab === 'you' ? r.you : r.opponent;

  return (
    <div className="space-y-4">
      <section
        aria-label="Match result"
        className={cn(
          PANEL_SHELL,
          'p-5 flex flex-wrap items-center justify-between gap-4',
          r.outcome === 'win' && 'border-emerald-500/40 bg-emerald-500/[0.06]',
          r.outcome === 'loss' && 'border-rose-500/30',
        )}
      >
        <div className="flex items-center gap-3 min-w-0">
          {r.outcome === 'win' ? <Trophy className="w-7 h-7 text-emerald-400 shrink-0" aria-hidden /> : <Swords className="w-7 h-7 text-slate-400 shrink-0" aria-hidden />}
          <div className="min-w-0">
            <h2 className={cn('text-2xl font-extrabold tracking-tight', r.outcome === 'win' ? 'text-emerald-300' : r.outcome === 'loss' ? 'text-rose-300' : 'text-white')}>
              {OUTCOME_TEXT[r.outcome]}{' '}
              <span className="text-slate-400 font-semibold text-sm ml-2">
                vs {r.opponent.nickname}
              </span>
            </h2>
            <p className="text-[11px] text-slate-400">{reasonText(r)}</p>
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-5">
          <Panel title="Head to head" description={`${shortSymbol(r.symbol)} · ${r.symbolName}`}>
            <table className="w-full text-xs">
              <caption className="sr-only">Both players&apos; results</caption>
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-slate-400">
                  <th scope="col" className="text-left font-medium pb-2" />
                  <th scope="col" className="text-right font-medium pb-2 text-blue-300 truncate max-w-[8rem]">{r.you.nickname} (you)</th>
                  <th scope="col" className="text-right font-medium pb-2 truncate max-w-[8rem]">{r.opponent.nickname}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                <tr>
                  <th scope="row" className="text-left font-normal text-slate-400 py-1.5">Status</th>
                  <td className="text-right py-1.5"><StatusBadge status={r.you.status} connected /></td>
                  <td className="text-right py-1.5"><StatusBadge status={r.opponent.status} connected /></td>
                </tr>
                {rows.map((row) => (
                  <tr key={row.label}>
                    <th scope="row" className="text-left font-normal text-slate-400 py-1.5">{row.label}</th>
                    {[r.you, r.opponent].map((s, i) => (
                      <td key={i} className={cn('text-right font-mono font-semibold py-1.5 whitespace-nowrap', row.tone?.(s) ?? 'text-slate-200')}>
                        {row.value(s)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <dl className="mt-4 grid grid-cols-2 gap-2 text-[11px]">
              <div><dt className="text-faint">Session</dt><dd className="font-mono text-slate-200">{fmtDateTime(r.sessionStart)}</dd></div>
              <div><dt className="text-faint">Ended</dt><dd className="font-mono text-slate-200">{fmtDateTime(r.sessionEnd)}</dd></div>
              <div><dt className="text-faint">Rules</dt><dd className="font-mono text-slate-200">{r.settings.durationMin} min · {r.settings.speed}x · DD {fmtPct(r.settings.maxDrawdownPct, 0, false)}</dd></div>
              <div><dt className="text-faint">Room</dt><dd className="font-mono text-slate-200">{r.roomCode}</dd></div>
            </dl>
          </Panel>
        </div>
        <div className="lg:col-span-7">
          <Panel title="Equity" description="Both accounts over the session" icon={LineChart}>
            <DuelEquityChart you={r.you.equityCurve} opponent={r.opponent.equityCurve} names={names} startingBalance={r.settings.startingBalance} currency={r.currency} />
          </Panel>
        </div>
      </div>

      <Panel title="Trades" description="Revealed now that the match is over" icon={ListChecks}>
        <Tabs<'you' | 'opponent'>
          label="Whose trades"
          idPrefix="duel-trades"
          value={tab}
          onChange={(t) => (setTab(t), setActive(null))}
          items={[
            { value: 'you', label: 'Yours', count: r.you.trades.length },
            { value: 'opponent', label: r.opponent.nickname, count: r.opponent.trades.length },
          ]}
        />
        <div role="tabpanel" id={`duel-trades-panel-${tab}`} aria-labelledby={`duel-trades-tab-${tab}`} className="mt-2">
          <TradeList trades={shown.trades} currency={r.currency} priceDecimals={r.priceDecimals} lotStep={r.lotStep} sessionStart={r.sessionStart} activeId={active} onActivate={setActive} />
        </div>
      </Panel>
    </div>
  );
}
