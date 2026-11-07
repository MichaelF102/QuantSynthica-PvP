'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChartPanel } from '@/components/chart/ChartPanel';
import { RulesCard } from '@/components/setup/RulesCard';
import { ChallengeModal } from '@/components/setup/ChallengeModal';
import { SetupModal } from '@/components/setup/SetupModal';
import { PositionsTable } from '@/components/trade/PositionsTable';
import { TradePanel } from '@/components/trade/TradePanel';
import { Banner, PanelSkeleton } from '@/components/ui';
import { PanelErrorBoundary } from '@/components/ui/PanelErrorBoundary';
import { Toaster } from '@/components/ui/Toaster';
import { fillMarkers } from '@/lib/chartData';
import { CHALLENGE_PARAM, challengeConfig, decodeChallenge, sessionAt, type Challenge } from '@/lib/challenge';
import { DataError, loadCandles, loadIndex } from '@/lib/data';
import { currentCandle, drawdownPct, positionFor } from '@/lib/engine';
import { fmtPct, priceDecimalsFor } from '@/lib/format';
import { chooseSession, loadLastSetup, saveLastSetup, setupFromQuery, toMatchConfig, type LastSetup, type SetupForm } from '@/lib/setup';
import { getResult } from '@/lib/storage';
import type { SymbolInfo } from '@/lib/types';
import { useMatchStore } from '@/store/matchStore';
import { useBeforeUnloadGuard, useIsMatchLive } from '@/store/useLeaveGuard';
import { useHotkeys } from '@/store/useHotkeys';
import { useReplayLoop } from '@/store/useReplayLoop';
import { MatchEndDialog } from './MatchEndDialog';
import { MatchHeader } from './MatchHeader';
import { ReplayControls } from './ReplayControls';
import { ShortcutsDialog } from './ShortcutsDialog';

const message = (e: unknown) => (e instanceof DataError ? e.message : 'Something went wrong while loading market data.');

/**
 * The practice page: setup modal -> loading -> rules card with countdown -> match
 * (CLAUDE.md §6 Layout, plan M9). Each panel handles its own loading and error states.
 */
export function MatchView() {
  useReplayLoop();
  useBeforeUnloadGuard(useIsMatchLive());
  const [index, setIndex] = useState<SymbolInfo[] | null>(null);
  const [indexError, setIndexError] = useState<string | null>(null);
  const [last, setLast] = useState<LastSetup | null>(null);
  const [lastForm, setLastForm] = useState<SetupForm | null>(null);
  const [loading, setLoading] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  /** Plan M13 C2: a valid challenge from the link; 'invalid' when the link is malformed (C4). */
  const [challenge, setChallenge] = useState<Challenge | 'invalid' | null>(null);

  const match = useMatchStore((s) => s.match);
  const info = useMatchStore((s) => s.info);
  const bars = useMatchStore((s) => s.bars);
  const timeframe = useMatchStore((s) => s.timeframe);
  const limitedData = useMatchStore((s) => s.limitedData);
  const setTimeframe = useMatchStore((s) => s.setTimeframe);
  const start = useMatchStore((s) => s.start);
  const play = useMatchStore((s) => s.play);
  const reset = useMatchStore((s) => s.reset);
  const matchId = useMatchStore((s) => s.matchId);
  const drawdownWarned = useMatchStore((s) => s.drawdownWarned);
  const [warningClosedFor, setWarningClosedFor] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const openHelp = useCallback(() => setHelpOpen(true), []);
  useHotkeys(openHelp);

  const fetchIndex = useCallback(() => {
    setIndexError(null);
    // ?from=<result id> repeats a saved match's settings; ?symbol= preselects a symbol.
    setLast(setupFromQuery(window.location.search, loadLastSetup(), (id) => getResult(id)?.config ?? null));
    const code = new URLSearchParams(window.location.search).get(CHALLENGE_PARAM);
    if (code !== null) setChallenge(decodeChallenge(code) ?? 'invalid');
    loadIndex()
      .then(setIndex)
      .catch((e) => setIndexError(message(e)));
  }, []);
  useEffect(fetchIndex, [fetchIndex]);
  useEffect(() => reset, [reset]); // leaving the page drops the match (no resume in v1)

  const begin = useCallback(
    async (form: SetupForm) => {
      const chosen = index?.find((i) => i.symbol === form.symbol);
      if (!chosen) return;
      setLastForm(form);
      setLoading(true);
      setSessionError(null);
      try {
        const config = toMatchConfig(form, chosen);
        const session = chooseSession(await loadCandles(chosen), config);
        saveLastSetup(config);
        start({ config, session, info: chosen });
      } catch (e) {
        setSessionError(message(e));
      } finally {
        setLoading(false);
      }
    },
    [index, start],
  );

  const acceptChallenge = useCallback(async () => {
    if (!challenge || challenge === 'invalid') return;
    const chosen = index?.find((i) => i.symbol === challenge.symbol);
    if (!chosen) return;
    setLoading(true);
    setSessionError(null);
    try {
      const config = challengeConfig(challenge, chosen);
      const session = sessionAt(await loadCandles(chosen), challenge.start, config);
      start({ config, session, info: chosen, challenge: { from: challenge.from, score: challenge.score } });
    } catch (e) {
      setSessionError(message(e));
    } finally {
      setLoading(false);
    }
  }, [challenge, index, start]);

  const declineChallenge = () => {
    // A normal setup, with the challenge's symbol picked when it is playable.
    if (challenge && challenge !== 'invalid') setLast(setupFromQuery(`?symbol=${encodeURIComponent(challenge.symbol)}`, loadLastSetup(), () => null));
    setChallenge(null);
    setSessionError(null);
    window.history.replaceState(null, '', '/practice');
  };

  const fills = match?.fills;
  const markers = useMemo(() => (fills && info ? fillMarkers(fills, timeframe, info.lotStep) : []), [fills, timeframe, info]);
  const position = match ? positionFor(match) : null;
  const entryPrice = position?.avgEntry ?? null;

  if (indexError) return <Banner kind="error" onRetry={fetchIndex}>{indexError}</Banner>;
  if (!index) return <PanelSkeleton rows={8} label="Loading symbols" />;
  if (index.length === 0) return <Banner kind="warning">No symbols are available yet. The market data files have not been generated.</Banner>;

  if (!match || !info) {
    if (challenge && challenge !== 'invalid') {
      return (
        <>
          <PanelSkeleton rows={8} label={loading ? 'Loading session' : 'Waiting for the challenge'} />
          <ChallengeModal challenge={challenge} info={index.find((i) => i.symbol === challenge.symbol) ?? null} busy={loading} error={sessionError} onAccept={acceptChallenge} onDecline={declineChallenge} />
        </>
      );
    }
    return (
      <>
        {challenge === 'invalid' && <Banner kind="warning">This challenge link is not valid. It may have been cut off when it was copied. You can set up a normal match below.</Banner>}
        <PanelSkeleton rows={8} label={loading ? 'Loading session' : 'Waiting for match settings'} />
        <SetupModal index={index} last={last} busy={loading} error={sessionError} onRetry={() => lastForm && begin(lastForm)} onStart={begin} />
      </>
    );
  }

  return (
    <div className="space-y-4">
      {limitedData && <Banner kind="warning">Limited data for this symbol: the session may end before the timer.</Banner>}
      {drawdownWarned && match.status !== 'ended' && warningClosedFor !== matchId && (
        <Banner kind="warning" onDismiss={() => setWarningClosedFor(matchId)}>
          Drawdown {fmtPct(drawdownPct(match), 2, false)} of the {fmtPct(match.config.maxDrawdownPct, 0, false)} limit. The match ends if it reaches the limit.
        </Banner>
      )}

      <PanelErrorBoundary name="match summary">
        <MatchHeader onShowShortcuts={openHelp} />
      </PanelErrorBoundary>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-8 min-w-0">
          <PanelErrorBoundary name="chart">
            <ChartPanel
              status="ready"
              bars={bars}
              symbol={info.symbol}
              symbolName={info.name}
              timeframe={timeframe}
              onTimeframeChange={setTimeframe}
              priceDecimals={priceDecimalsFor(info)}
              actions={<ReplayControls />}
              markers={markers}
              entryPrice={entryPrice}
              stopLoss={position?.stopLoss ?? null}
              takeProfit={position?.takeProfit ?? null}
              hideTimeframeSwitch
            />
          </PanelErrorBoundary>
        </div>
        <div className="lg:col-span-4 min-w-0">
          <PanelErrorBoundary name="trade panel">
            <TradePanel />
          </PanelErrorBoundary>
        </div>
      </div>
      <PanelErrorBoundary name="account tables">
        <PositionsTable />
      </PanelErrorBoundary>

      {match.status === 'idle' && <RulesCard config={match.config} startTime={currentCandle(match).time} limitedData={limitedData} onGo={play} />}
      <MatchEndDialog />
      <ShortcutsDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
      <Toaster />
    </div>
  );
}
