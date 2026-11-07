import { OrderError, advance, cancelQueued, closePosition, createMatch, endMatch, equity, placeMarketOrder, play, setBrackets, tick } from '../engine';
import type { MatchState } from '../types';
import type { RoomEndReason, ServerMessage } from './protocol';
import { newSeries, recordGame, seriesView, type SeriesView } from './series';
import { roomMatchConfig, seriesLengthOf, tickMsFor } from './settings';
import { OPPONENT_THROTTLE_MS, RECONNECT_GRACE_MS, durationMsOf, isOut, otherPlayer, send, type Player, type PlayerAction, type Reduced, type RoomEffect, type RoomState } from './roomTypes';
import { opponentView, playerResult, revealedCandles, sessionBase, shiftCandle, shiftFill, shiftQueued, summary, youView } from './views';
import { decideWinner } from './winner';

// The running phase: one shared clock reveals candles to both players (MP5), each player trades
// their own engine account, and the room ends when nobody is still live.

/** Player status follows their engine match: drawdown → out, forfeit → out, timer/data end → done. */
export function withMatch(p: Player, m: MatchState): Player {
  if (m.status !== 'ended') return { ...p, match: m, status: 'live' };
  const status = m.endReason === 'drawdown' ? 'out_drawdown' : m.endReason === 'user' ? 'out_disconnect' : 'done';
  return { ...p, match: m, status };
}

export const forfeit = (p: Player): Player => (p.match && p.status === 'live' ? withMatch(p, endMatch(p.match, 'user')) : p);

/** M13 R3: the series as players see it. */
export function seriesOf(s: RoomState): SeriesView {
  return seriesView(seriesLengthOf(s.settings), s.series ?? newSeries(), s.players.map((p) => p.id), s.phase === 'ended');
}

export function roomMessage(s: RoomState, now: number): ServerMessage {
  return { type: 'room', code: s.code, phase: s.phase, settings: s.settings, symbol: s.symbol, players: s.players.map(summary), countdownEndsAt: s.countdownEndsAt, serverNow: now, series: seriesOf(s) };
}

export function startMessage(s: RoomState, now: number): ServerMessage {
  return {
    type: 'start',
    history: revealedCandles(s),
    cursor: s.cursor,
    startCursor: s.session.startCursor,
    tickMs: tickMsFor(s.settings.speed),
    durationMs: durationMsOf(s),
    startedAt: s.startedAt ?? now,
    serverNow: now,
  };
}

export function endMessage(s: RoomState): ServerMessage {
  const { candles, startCursor } = s.session;
  return {
    type: 'end',
    reason: s.endReason ?? 'all_out',
    winner: s.winner,
    sessionStart: candles[startCursor].time,
    sessionEnd: candles[s.cursor].time,
    players: s.players.map(playerResult).filter((r): r is NonNullable<typeof r> => r !== null),
    series: seriesOf(s),
  };
}

const youEffects = (s: RoomState): RoomEffect[] =>
  s.players.flatMap((p) => {
    const you = p.connected ? youView(s, p) : null;
    return you ? [send(p.id, { type: 'you', you })] : [];
  });

const opponentEffects = (s: RoomState): RoomEffect[] =>
  s.players.flatMap((p) => {
    const o = otherPlayer(s, p.id);
    const opponent = o && p.connected ? opponentView(o, s) : null;
    return opponent ? [send(p.id, { type: 'opponent', opponent })] : [];
  });

/** What a player who (re)joins mid-match or after the end needs to rebuild the screen. */
export function catchUp(s: RoomState, id: string, now: number): RoomEffect[] {
  if (s.phase === 'ended') return [send(id, endMessage(s))];
  if (s.phase !== 'running') return [];
  const me = s.players.find((p) => p.id === id);
  const o = otherPlayer(s, id);
  const you = me ? youView(s, me) : null;
  const opponent = o ? opponentView(o, s) : null;
  return [send(id, startMessage(s, now)), ...(you ? [send(id, { type: 'you', you } as const)] : []), ...(opponent ? [send(id, { type: 'opponent', opponent } as const)] : [])];
}

/** Countdown over: both accounts open on the same session and the clock starts. */
export function startMatch(s: RoomState, now: number): Reduced {
  const startedAt = s.countdownEndsAt ?? now;
  const config = roomMatchConfig(s.settings, s.symbol);
  const players = s.players.map((p) => ({ ...p, status: 'live' as const, lastSeq: -1, match: play(createMatch(config, s.session.candles, s.session.startCursor), startedAt) }));
  const next: RoomState = { ...s, phase: 'running', players, cursor: s.session.startCursor, startedAt, countdownEndsAt: null, lastOpponentAt: now };
  return { state: next, effects: [send('*', roomMessage(next, now)), send('*', startMessage(next, now)), ...youEffects(next), ...opponentEffects(next)] };
}

/** Ends the room once nobody is live. Winner per MP7. */
function maybeFinish(s: RoomState, now: number, effects: RoomEffect[]): Reduced {
  if (s.phase !== 'running' || s.players.some((p) => p.status === 'live')) return { state: s, effects };
  const timerDone = s.startedAt !== null && now >= s.startedAt + durationMsOf(s);
  const reason: RoomEndReason = timerDone ? 'timer' : s.cursor >= s.session.candles.length - 1 ? 'data_end' : 'all_out';
  const winner = decideWinner(s.players.filter((p) => p.match).map((p) => ({ id: p.id, out: isOut(p), equity: equity(p.match as MatchState) })));
  const next: RoomState = { ...s, phase: 'ended', endedAt: now, endReason: reason, winner, rematch: [], series: recordGame(s.series ?? newSeries(), winner) };
  return { state: next, effects: [...effects, send('*', roomMessage(next, now)), send('*', endMessage(next))] };
}

/**
 * Brings the room up to `now`: reveals every candle due since the last call (so a late alarm
 * catches up), runs each live player's timer, forfeits players past the reconnect grace, then
 * sends scores. Candle i is due at startedAt + (i - startCursor) × tickMs, capped at the timer.
 */
export function advanceClock(s: RoomState, now: number): Reduced {
  if (s.phase !== 'running' || s.startedAt === null) return { state: s, effects: [] };
  const durationMs = durationMsOf(s);
  const t = Math.min(now, s.startedAt + durationMs);
  const last = s.session.candles.length - 1;
  const due = Math.min(last, s.session.startCursor + Math.floor(Math.max(0, t - s.startedAt) / tickMsFor(s.settings.speed)));
  const base = sessionBase(s);
  const effects: RoomEffect[] = [];
  const before = s.players.map((p) => p.status);

  let cursor = s.cursor;
  let players = s.players;
  while (cursor < due) {
    cursor++;
    players = players.map((p) => (p.status === 'live' && p.match ? withMatch(p, advance(p.match)) : p));
    effects.push(send('*', { type: 'candle', candle: shiftCandle(s.session.candles[cursor], base), cursor, elapsedMs: t - s.startedAt }));
  }
  players = players.map((p) => {
    if (p.status !== 'live' || !p.match) return p;
    // A grace that ran out before the timer forfeits even when one late wake-up covers both.
    const graceOver = !p.connected && p.disconnectedAt !== null && p.disconnectedAt + RECONNECT_GRACE_MS <= t;
    return graceOver ? forfeit(p) : withMatch(p, tick(p.match, t - s.startedAt! - p.match.elapsedMs));
  });

  effects.push(...clockFills(s.players, players, base));

  const statusChanged = players.some((p, i) => p.status !== before[i]);
  const sendScores = statusChanged || now - s.lastOpponentAt >= OPPONENT_THROTTLE_MS;
  const next: RoomState = { ...s, cursor, players, lastOpponentAt: sendScores ? now : s.lastOpponentAt };
  if (cursor !== s.cursor || statusChanged) effects.push(...youEffects(next));
  if (sendScores) effects.push(...opponentEffects(next));
  if (statusChanged) effects.push(send('*', roomMessage(next, now)));
  return maybeFinish(next, now, effects);
}

/**
 * Plan M12: fills and cancellations the clock caused (a queued order at the open, a stop or a
 * target, a cancel at the open), sent to their owner with seq −1. Forced closes at the end are
 * reported by the `end` message instead.
 */
function clockFills(before: Player[], after: Player[], base: number): RoomEffect[] {
  return after.flatMap((p, i) => {
    const prev = before[i]?.match;
    if (!p.match || !prev || !p.connected) return [];
    const fills = p.match.fills.slice(prev.fills.length).filter((f) => f.trigger && f.trigger !== 'match_end');
    const cancels = p.match.cancelled.slice(prev.cancelled.length).filter((c) => c.reason !== 'match_end');
    return [
      ...fills.map((f) => send(p.id, { type: 'fill', seq: -1, fill: shiftFill(f, base), cursor: p.match!.cursor })),
      ...cancels.map((c) => send(p.id, { type: 'cancelled', order: shiftQueued(c, base) })),
    ];
  });
}

/**
 * A market order, close, stop/target change or cancel. The clock catches up first, so an order
 * fills at the candle current on arrival (or queues for the next open, plan M12 C2).
 */
export function applyOrder(s0: RoomState, playerId: string, seq: number, order: PlayerAction, now: number): Reduced {
  const clocked = advanceClock(s0, now);
  const s = clocked.state;
  const effects = [...clocked.effects];
  const reject = (code: Extract<ServerMessage, { type: 'reject' }>['code'], message: string): Reduced => ({ state: s, effects: [...effects, send(playerId, { type: 'reject', seq, code, message })] });

  const p = s.players.find((x) => x.id === playerId);
  if (s.phase !== 'running' || !p || !p.match) return reject('match_not_running', 'The match is not running.');
  if (p.status !== 'live') return reject('not_live', 'You are out of this match.');
  if (seq <= p.lastSeq) return reject('duplicate', 'This order was already received.');

  let m: MatchState;
  try {
    if (order === 'close') {
      m = closePosition(p.match);
      if (m === p.match) return reject('size_zero', 'No open position to close.');
    } else if (order === 'cancel') {
      if (!p.match.queued) return reject('nothing_queued', 'No order is waiting.');
      m = cancelQueued(p.match);
    } else if ('brackets' in order) {
      m = setBrackets(p.match, order.brackets);
    } else {
      m = placeMarketOrder(p.match, order);
    }
  } catch (e) {
    if (e instanceof OrderError) return { ...reject(e.code, e.message), state: { ...s, players: s.players.map((x) => (x.id === playerId ? { ...x, lastSeq: seq } : x)) } };
    throw e;
  }

  // closeAll on a drawdown end adds more fills; the order's own fill is the first new one. A
  // queued order, a stop/target change or a cancel has no fill and is acknowledged instead.
  const fill = m.fills[p.match.fills.length];
  const updated = { ...withMatch(p, m), lastSeq: seq };
  const next: RoomState = { ...s, players: s.players.map((x) => (x.id === playerId ? updated : x)), lastOpponentAt: now };
  const answer: ServerMessage = fill ? { type: 'fill', seq, fill: shiftFill(fill, sessionBase(s)), cursor: s.cursor } : { type: 'ack', seq };
  effects.push(send(playerId, answer), ...youEffects(next), ...opponentEffects(next));
  if (updated.status !== p.status) effects.push(send('*', roomMessage(next, now)));
  return maybeFinish(next, now, effects);
}
