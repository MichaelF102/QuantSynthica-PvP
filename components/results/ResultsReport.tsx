'use client';

import { useEffect, useMemo, useState } from 'react';
import { Hash, LineChart } from 'lucide-react';
import { Panel } from '@/components/ui';
import { PanelErrorBoundary } from '@/components/ui/PanelErrorBoundary';
import { buyAndHoldPct, symbolContext, type SymbolContext } from '@/lib/analysis';
import { coachingNotes } from '@/lib/coaching';
import type { MatchResult } from '@/lib/results';
import { listResults } from '@/lib/storage';
import { CoachingNotes } from './CoachingNotes';
import { EquityChart } from './EquityChart';
import { ExportCsvButton } from './ExportCsvButton';
import { KeyNumbers } from './KeyNumbers';
import { ChallengeCompare } from './ChallengeCompare';
import { ResultActions } from './ResultActions';
import { ResultHeader } from './ResultHeader';
import { ResultNote } from './ResultNote';
import { SessionChart } from './SessionChart';
import { TradeDetail } from './TradeDetail';
import { TradeList } from './TradeList';
import { useSessionCandles } from './useSessionCandles';

/**
 * The results report for one finished match (CLAUDE.md §1 Results). The saved result drives
 * everything; the session candles are reloaded only for the buy & hold benchmark and the replay
 * chart, and each of those handles its own loading and error states.
 */
export function ResultsReport({ result }: { result: MatchResult }) {
  const { stats, currency } = result;
  const session = useSessionCandles(result);
  const buyHold = session.status === 'ready' ? buyAndHoldPct(session.candles) : null;
  const notes = useMemo(() => coachingNotes(result, buyHold), [result, buyHold]);
  const [activeTrade, setActiveTrade] = useState<string | null>(null);
  const [context, setContext] = useState<SymbolContext | null>(null);
  useEffect(() => setContext(symbolContext(listResults().results, result)), [result]);

  return (
    <div className="space-y-6">
      <ResultHeader result={result} context={context} />
      <KeyNumbers result={result} buyHold={buyHold} sessionStatus={session.status} />
      {result.challenge && (
        <PanelErrorBoundary name="challenge">
          <ChallengeCompare result={result} />
        </PanelErrorBoundary>
      )}

      <PanelErrorBoundary name="notes on this match">
        <CoachingNotes notes={notes} />
      </PanelErrorBoundary>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-8 min-w-0">
          <Panel title="Equity curve" description="Equity at each revealed candle, times in UTC" icon={LineChart} info="Dots mark trade entries (filled) and exits (hollow). The shaded band is the worst drawdown.">
            <PanelErrorBoundary name="equity curve">
              <EquityChart curve={result.equityCurve} startingBalance={stats.startingBalance} currency={currency} limitPct={result.config.maxDrawdownPct} trades={result.trades} activeTradeId={activeTrade} />
            </PanelErrorBoundary>
          </Panel>
        </div>
        <div className="lg:col-span-4 min-w-0">
          <PanelErrorBoundary name="trade detail">
            <TradeDetail result={result} />
          </PanelErrorBoundary>
        </div>
      </div>

      <PanelErrorBoundary name="session chart">
        <SessionChart result={result} candles={session.candles} status={session.status} onRetry={session.retry} activeTradeId={activeTrade} />
      </PanelErrorBoundary>

      <Panel
        title="Trades"
        description={`${stats.trades} closed trade${stats.trades === 1 ? '' : 's'} · times in UTC · click a column to sort, a # to pin a trade on the charts`}
        icon={Hash}
        actions={<ExportCsvButton result={result} />}
      >
        <PanelErrorBoundary name="trade list">
          <TradeList
            trades={result.trades}
            currency={currency}
            priceDecimals={result.priceDecimals}
            lotStep={result.lotStep}
            sessionStart={result.sessionStart}
            activeId={activeTrade}
            onActivate={setActiveTrade}
          />
        </PanelErrorBoundary>
      </Panel>

      <PanelErrorBoundary name="notes">
        <ResultNote id={result.id} initial={result.note ?? ''} />
      </PanelErrorBoundary>

      <ResultActions result={result} />
    </div>
  );
}
