import { drawdownPct, equity, positionFor } from '../engine';
import { downsampleEquity } from '../results';
import { computeStats } from '../stats';
import type { CancelledOrder, Candle, Fill, MatchState, Position, QueuedOrder, Trade } from '../types';
import type { OpponentView, PlayerResult, PlayerSummary, YouView } from './protocol';
import type { Player, RoomState } from './roomTypes';

// Builders for the messages players receive. Two rules live here:
// - MP9: during a match every time is in session seconds (candle time minus the first history
//   candle's time), so the date cannot be looked up in the public data files. The `end`
//   message uses real times.
// - MP8: the opponent view carries scores only, never positions, sides, sizes or fills.

export const sessionBase = (s: RoomState) => s.session.candles[0]?.time ?? 0;

export const shiftCandle = (c: Candle, base: number): Candle => ({ ...c, time: c.time - base });
/** The engine's fill id embeds the candle time, so it is shifted too. */
export const shiftFill = (f: Fill, base: number): Fill => ({ ...f, id: f.id.replace(String(f.time), String(f.time - base)), time: f.time - base });
/** Trade ids embed the closing candle's time as well. */
export const shiftTrade = (t: Trade, base: number): Trade => ({ ...t, id: t.id.replace(String(t.closedAt), String(t.closedAt - base)), openedAt: t.openedAt - base, closedAt: t.closedAt - base });
/** Queued and cancelled orders carry candle times and an id with one in it. */
export function shiftQueued<T extends QueuedOrder | CancelledOrder>(q: T, base: number): T {
  const shifted = { ...q, id: q.id.replace(String(q.placedAt), String(q.placedAt - base)), placedAt: q.placedAt - base };
  return 'cancelledAt' in q ? { ...shifted, cancelledAt: q.cancelledAt - base } : shifted;
}
export const shiftPosition = (p: Position | null, base: number): Position | null => (p ? { ...p, openedAt: p.openedAt - base } : null);

/** Candles revealed so far (index ≤ cursor), shifted. Never anything past the cursor. */
export function revealedCandles(s: RoomState): Candle[] {
  const base = sessionBase(s);
  return s.session.candles.slice(0, s.cursor + 1).map((c) => shiftCandle(c, base));
}

const returnPct = (m: MatchState, eq: number) => (m.config.startingBalance ? ((eq - m.config.startingBalance) / m.config.startingBalance) * 100 : 0);

export const summary = (p: Player): PlayerSummary => ({ id: p.id, nickname: p.nickname, ready: p.ready, connected: p.connected, status: p.status });

export function youView(s: RoomState, p: Player): YouView | null {
  const m = p.match;
  if (!m) return null;
  const base = sessionBase(s);
  const eq = equity(m);
  return {
    status: p.status,
    balance: m.balance,
    equity: eq,
    returnPct: returnPct(m, eq),
    drawdownPct: drawdownPct(m),
    position: shiftPosition(positionFor(m), base),
    fills: m.fills.map((f) => shiftFill(f, base)),
    trades: m.trades.length,
    closed: m.trades.map((t) => shiftTrade(t, base)),
    elapsedMs: m.elapsedMs,
    lastSeq: p.lastSeq,
    queued: m.queued ? shiftQueued(m.queued, base) : null,
  };
}

/**
 * The opponent's scoreboard. MP8: scores only, unless the room has open positions (M13 R4), when
 * it adds their position (without stop, target or fees) and fills. Queued orders stay private.
 */
export function opponentView(p: Player, s?: RoomState): OpponentView | null {
  const m = p.match;
  if (!m) return null;
  const eq = equity(m);
  const open = s?.settings.openPositions === true;
  const base = s ? sessionBase(s) : 0;
  const pos = positionFor(m);
  return {
    id: p.id,
    nickname: p.nickname,
    connected: p.connected,
    status: p.status,
    equity: eq,
    returnPct: returnPct(m, eq),
    drawdownPct: drawdownPct(m),
    trades: m.trades.length,
    ...(open
      ? {
          position: pos ? { symbol: pos.symbol, units: pos.units, avgEntry: pos.avgEntry, openedAt: pos.openedAt - base } : null,
          fills: m.fills.map((f) => shiftFill(f, base)),
        }
      : {}),
  };
}

/** The end-of-match report for one player, in real times (the date is revealed now). */
export function playerResult(p: Player): PlayerResult | null {
  const m: MatchState | null = p.match;
  if (!m) return null;
  return { id: p.id, nickname: p.nickname, status: p.status, stats: computeStats(m), trades: m.trades, equityCurve: downsampleEquity(m.equityCurve) };
}
