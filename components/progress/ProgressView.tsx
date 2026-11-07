'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Activity, BarChart3, Hash, Percent, ShieldAlert, Swords, Table2, TrendingDown, TrendingUp, Trophy } from 'lucide-react';
import { Banner, EmptyState, Panel, PanelSkeleton, StatTile, buttonClasses } from '@/components/ui';
import { PanelErrorBoundary } from '@/components/ui/PanelErrorBoundary';
import { fmtPct, shortSymbol } from '@/lib/format';
import { listDuels, type DuelResult } from '@/lib/multiplayer/duelResult';
import { ROLLING_WINDOW, bySymbol, duelRecord, summarize, trend } from '@/lib/progress';
import type { MatchResult } from '@/lib/results';
import { onStoredDataChange } from '@/lib/localChanges';
import { listResults } from '@/lib/storage';
import { ReturnTrendChart, WinRateTrendChart } from './ProgressCharts';
import { SymbolTable } from './SymbolTable';

type Loaded = { status: 'loading' } | { status: 'ready'; results: MatchResult[]; duels: DuelResult[]; error: boolean };
const tone = (v: number | null) => (v === null ? 'neutral' : v > 0 ? 'positive' : v < 0 ? 'negative' : 'neutral');

/** Trends across the results saved in this browser (plan M13 Part A). */
export function ProgressView() {
  const [data, setData] = useState<Loaded>({ status: 'loading' });
  const refresh = useCallback(() => {
    const practice = listResults();
    const duels = listDuels();
    setData({ status: 'ready', results: practice.results, duels: duels.duels, error: practice.error || duels.error });
  }, []);
  useEffect(() => {
    refresh();
    return onStoredDataChange(refresh);
  }, [refresh]);

  const results = data.status === 'ready' ? data.results : null;
  const summary = useMemo(() => (results ? summarize(results) : null), [results]);
  const points = useMemo(() => (results ? trend(results) : []), [results]);
  const symbols = useMemo(() => (results ? bySymbol(results) : []), [results]);

  if (data.status === 'loading' || !summary) return <PanelSkeleton rows={6} label="Loading your progress" />;

  const record = duelRecord(data.duels);
  if (summary.matches === 0 && record.played === 0) {
    return (
      <Panel title="Your progress" icon={Activity}>
        <EmptyState
          icon={Activity}
          title="No finished matches yet"
          hint="Finish a practice match and your trends show up here. Everything stays in this browser."
          action={
            <Link href="/practice" className={buttonClasses('secondary')}>
              Start practice
            </Link>
          }
        />
      </Panel>
    );
  }

  return (
    <div className="space-y-4">
      {data.error && <Banner kind="warning">Some saved results could not be read in this browser and are left out.</Banner>}

      <section aria-label="Practice summary" className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        <StatTile label="Matches" icon={Hash} value={String(summary.matches)} delta={`${summary.trades} closed trades`} info="Finished practice matches saved in this browser." />
        <StatTile
          label="Avg return"
          icon={Percent}
          value={fmtPct(summary.avgReturn)}
          valueTone={tone(summary.avgReturn)}
          delta={`Median ${fmtPct(summary.medianReturn)}`}
          info="Mean return % per match. Money is not added across matches because accounts can be in different currencies."
        />
        <StatTile label="Trade win rate" icon={Trophy} value={fmtPct(summary.tradeWinRate, 1, false)} info="Winning closed trades / all closed trades, across every match. — with no trades." />
        <StatTile
          label="Best match"
          icon={TrendingUp}
          value={fmtPct(summary.best?.returnPct)}
          valueTone={tone(summary.best?.returnPct ?? null)}
          delta={summary.best ? shortSymbol(summary.best.symbol) : undefined}
        />
        <StatTile
          label="Worst match"
          icon={TrendingDown}
          value={fmtPct(summary.worst?.returnPct)}
          valueTone={tone(summary.worst?.returnPct ?? null)}
          delta={summary.worst ? shortSymbol(summary.worst.symbol) : undefined}
        />
        <StatTile
          label="Stop-outs"
          icon={ShieldAlert}
          value={String(summary.stopOuts)}
          delta={summary.matches ? `${fmtPct((summary.stopOuts / summary.matches) * 100, 0, false)} of matches` : undefined}
          deltaTone={summary.stopOuts ? 'negative' : 'neutral'}
          info="Matches ended by the max drawdown limit."
        />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PanelErrorBoundary name="return trend">
          <Panel title="Return per match" description={`Oldest left · blue line: ${ROLLING_WINDOW}-match average`} icon={BarChart3}>
            {points.length < 2 ? <EmptyState icon={BarChart3} title="Not enough matches yet" hint="Play at least 2 matches to see a trend." /> : <ReturnTrendChart points={points} />}
          </Panel>
        </PanelErrorBoundary>
        <PanelErrorBoundary name="win rate trend">
          <Panel title="Trade win rate" description={`Winning trades over the last ${ROLLING_WINDOW} matches · gaps where no trade closed`} icon={Trophy}>
            {points.length < 2 ? <EmptyState icon={Trophy} title="Not enough matches yet" hint="Play at least 2 matches to see a trend." /> : <WinRateTrendChart points={points} />}
          </Panel>
        </PanelErrorBoundary>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-8 min-w-0">
          <PanelErrorBoundary name="symbols">
            <Panel title="By symbol" description="Where you do best and worst" icon={Table2}>
              {symbols.length === 0 ? <EmptyState icon={Table2} title="No practice matches yet" hint="Symbols appear here after your first practice match." /> : <SymbolTable rows={symbols} />}
            </Panel>
          </PanelErrorBoundary>
        </div>
        <div className="lg:col-span-4 min-w-0">
          <PanelErrorBoundary name="1v1 record">
            <Panel title="1v1 record" description="Saved head-to-head matches" icon={Swords}>
              {record.played === 0 ? (
                <EmptyState icon={Swords} title="No 1v1 matches yet" hint="Create a room and share the code to play a friend." />
              ) : (
                <dl className="grid grid-cols-3 gap-2 text-center">
                  {(
                    [
                      ['Wins', record.wins, 'text-emerald-400'],
                      ['Losses', record.losses, 'text-rose-400'],
                      ['Draws', record.draws, 'text-slate-200'],
                    ] as const
                  ).map(([k, v, c]) => (
                    <div key={k} className="rounded-lg border border-slate-800 bg-[#0b1120]/60 py-2">
                      <dt className="text-[10px] uppercase tracking-wider text-slate-400">{k}</dt>
                      <dd className={`text-lg font-bold font-mono ${c}`}>{v}</dd>
                    </div>
                  ))}
                  <div className="col-span-3 flex justify-between text-[11px] font-mono text-slate-400 pt-1">
                    <span>Win rate {fmtPct(record.winPct, 0, false)}</span>
                    <span>Avg return {fmtPct(record.avgReturn)}</span>
                  </div>
                </dl>
              )}
            </Panel>
          </PanelErrorBoundary>
        </div>
      </div>
    </div>
  );
}
