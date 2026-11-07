'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChartPanel } from '@/components/chart/ChartPanel';
import { PositionsTableView } from '@/components/trade/PositionsTable';
import { TradePanelView } from '@/components/trade/TradePanel';
import { Banner, PanelSkeleton } from '@/components/ui';
import { Toaster } from '@/components/ui/Toaster';
import { aggregate } from '@/lib/aggregate';
import { fillMarkers, mergeMarkers, opponentMarkers } from '@/lib/chartData';
import { positionFor } from '@/lib/engine';
import { fmtPrice, fmtUnits, priceDecimalsFor } from '@/lib/format';
import { seriesText } from '@/lib/multiplayer/seriesText';
import { duelRemainingMs, fmtSessionTime, mirrorMatch, sessionZero } from '@/lib/multiplayer/duelClient';
import type { RoomClientState, RoomInfo } from '@/lib/multiplayer/roomClient';
import { cancelMessage, fillMessage, orderErrorText, toOrderRequest, type SizeInput } from '@/lib/orders';
import { costsOf, type OrderErrorCode } from '@/lib/engine';
import type { PlayerAction } from '@/lib/multiplayer/roomTypes';
import type { Brackets, Timeframe } from '@/lib/types';
import { useBeforeUnloadGuard } from '@/store/useLeaveGuard';
import { useNow } from '@/store/useNow';
import { toastStore } from '@/store/toastStore';
import { DuelAnnouncer } from './DuelAnnouncer';
import { DuelScoreboard } from './DuelScoreboard';

/** 1d candles need real dates, which stay hidden during a duel (MP9). */
export const DUEL_TIMEFRAMES: readonly Timeframe[] = ['1m', '5m', '15m', '1h'];
const ENGINE_CODES = new Set(['insufficient_balance', 'size_zero', 'invalid_size', 'match_not_running', 'order_queued', 'no_position', 'invalid_stop', 'invalid_target']);

type DuelViewProps = {
  room: RoomInfo;
  state: RoomClientState;
  placeOrder: (action: PlayerAction) => boolean;
  onForfeit: () => void;
};

/** The running match: scoreboard, chart, trade panel and own account (plan M11.5). */
export function DuelView({ room, state, placeOrder, onForfeit }: DuelViewProps) {
  const { duel, clockOffset } = state;
  const [timeframe, setTimeframe] = useState<Timeframe>('1m');
  const now = useNow(Boolean(duel), 250);
  const match = useMemo(() => mirrorMatch(duel, room.settings, room.symbol), [duel, room.settings, room.symbol]);
  const live = duel?.you?.status === 'live';
  // Closing the tab starts the 30 s grace, then forfeits: warn first.
  useBeforeUnloadGuard(live);

  const remaining = duel ? duelRemainingMs(duel, clockOffset, now) : 0;
  const opp = duel?.opponent ?? null;
  // Whole seconds are enough for the one-minute warning; this keeps the snapshot stable between renders.
  const remainingSec = Math.ceil(remaining / 1000);
  const announce = useMemo(
    () => ({ you: duel?.you?.status ?? null, opponent: opp && { nickname: opp.nickname, status: opp.status, connected: opp.connected }, remainingMs: remainingSec * 1000 }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [duel?.you?.status, opp?.nickname, opp?.status, opp?.connected, remainingSec],
  );
  const zero = duel ? sessionZero(duel) : 0;
  const timeFormatter = useCallback((t: number) => fmtSessionTime(t, zero), [zero]);
  const bars = useMemo(() => (duel ? aggregate(duel.candles, timeframe) : []), [duel, timeframe]);
  const lotStep = room.symbol.lotStep;
  const oppFills = duel?.opponent?.fills;
  const markers = useMemo(
    () => mergeMarkers(fillMarkers(duel?.you?.fills ?? [], timeframe, lotStep), opponentMarkers(oppFills ?? [], timeframe, lotStep)),
    [duel?.you?.fills, oppFills, timeframe, lotStep],
  );
  const decimals = priceDecimalsFor(room.symbol);

  // Toasts for answers to this page's orders (CLAUDE.md §10).
  const seen = useRef<{ fill: unknown; reject: unknown; cancel: unknown }>({ fill: null, reject: null, cancel: null });
  useEffect(() => {
    if (!duel) return;
    if (duel.lastFill && duel.lastFill !== seen.current.fill) {
      seen.current.fill = duel.lastFill;
      const { fill } = duel.lastFill;
      toastStore.getState().push(fill.trigger === 'stop_loss' ? 'error' : 'success', fillMessage(fill, { lotStep, priceDecimals: decimals, currency: room.symbol.currency }));
    }
    if (duel.lastCancel && duel.lastCancel !== seen.current.cancel) {
      seen.current.cancel = duel.lastCancel;
      toastStore.getState().push('error', cancelMessage(duel.lastCancel));
    }
    if (duel.lastReject && duel.lastReject !== seen.current.reject) {
      seen.current.reject = duel.lastReject;
      const { code, message } = duel.lastReject;
      const text = match && ENGINE_CODES.has(code) ? orderErrorText(code as OrderErrorCode, match) : message;
      toastStore.getState().push('error', text);
    }
  }, [duel, lotStep, decimals, room.symbol.currency, match]);

  if (!duel || !match) return <PanelSkeleton rows={8} label="Loading the match" />;

  const sending = duel.pending.length > 0;
  const act = (action: PlayerAction) => {
    const sent = placeOrder(action);
    if (!sent) toastStore.getState().push('error', 'Not connected. Wait for the connection to come back.');
    return sent;
  };
  const order = (side: 'buy' | 'sell') => (size: SizeInput, brackets: Brackets | null) => void act(toOrderRequest(side, size, brackets));
  const setLevels = (brackets: Brackets) => act({ brackets });
  const nextOpen = costsOf(match.config).fillModel === 'next_open';
  const position = positionFor(match);
  const you = duel.you
    ? { nickname: room.players.find((p) => p.id === state.you)?.nickname ?? 'You', connected: state.status === 'open', ...duel.you }
    : null;
  const opponent = duel.opponent;
  const sessionNote = 'Times from the session start (date hidden until the end)';
  const series = room.series && room.series.of > 1 ? seriesText(room.series, room.players, state.you) : undefined;
  // M13 R4: the opponent's position, only in rooms that share it.
  const oppPos = opponent && opponent.position !== undefined ? (opponent.position ? `${opponent.position.units > 0 ? 'Long' : 'Short'} ${fmtUnits(Math.abs(opponent.position.units), lotStep)} @ ${fmtPrice(opponent.position.avgEntry, decimals)}` : 'Flat') : undefined;

  return (
    <div className="space-y-4">
      <DuelScoreboard
        symbol={room.symbol.symbol}
        symbolName={room.symbol.name}
        currency={room.symbol.currency}
        maxDrawdownPct={room.settings.maxDrawdownPct}
        speed={room.settings.speed}
        remainingMs={remaining}
        you={you}
        opponent={opponent}
        onForfeit={onForfeit}
        seriesLabel={series}
        opponentPosition={oppPos}
      />
      {duel.you?.status === 'out_drawdown' && <Banner kind="warning">You hit the max drawdown, so you are out. Your position was closed. The match runs on until your opponent finishes.</Banner>}
      {duel.you?.status === 'out_disconnect' && <Banner kind="warning">You forfeited this match. The result appears when it ends.</Banner>}
      {opponent && !opponent.connected && opponent.status === 'live' && <Banner>Your opponent lost connection. They have 30 seconds to come back before they forfeit.</Banner>}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-8 min-w-0">
          <ChartPanel
            status="ready"
            bars={bars}
            symbol={room.symbol.symbol}
            symbolName={room.symbol.name}
            timeframe={timeframe}
            onTimeframeChange={setTimeframe}
            priceDecimals={decimals}
            markers={markers}
            entryPrice={position?.avgEntry ?? null}
            stopLoss={position?.stopLoss ?? null}
            takeProfit={position?.takeProfit ?? null}
            timeFormatter={timeFormatter}
            timeNote={sessionNote}
            timeframes={DUEL_TIMEFRAMES}
          />
        </div>
        <div className="lg:col-span-4">
          <TradePanelView
            match={match}
            info={room.symbol}
            onBuy={order('buy')}
            onSell={order('sell')}
            onClose={() => act('close')}
            onSetBrackets={setLevels}
            onCancelQueued={() => act('cancel')}
            sending={sending}
            description={nextOpen ? 'Market orders fill at the open of the next candle after the server receives them' : 'Market orders fill at the close of the candle current when the server receives them'}
          />
        </div>
      </div>
      <PositionsTableView
        match={match}
        info={room.symbol}
        onClose={() => act('close')}
        onCancelQueued={() => act('cancel')}
        closeDisabled={sending}
        closedAt={{ header: 'Closed (session time)', format: timeFormatter }}
        ordersHint={nextOpen ? 'Market orders wait on the server until the next candle opens.' : 'Market orders fill on the server straight away. Stops and targets are on the position.'}
      />
      <DuelAnnouncer snapshot={announce} />
      <Toaster />
    </div>
  );
}
