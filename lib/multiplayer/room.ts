import type { Session } from '../types';
import { applyOrder, advanceClock, catchUp, forfeit, roomMessage, seriesOf, startMatch } from './roomMatch';
import { newSeries, nextGame } from './series';
import type { RoomSettings, RoomSymbol } from './settings';
import { tickMsFor } from './settings';
import {
  COUNTDOWN_MS,
  ENDED_TTL_MS,
  MAX_PLAYERS,
  RECONNECT_GRACE_MS,
  WAITING_TTL_MS,
  errorMsg,
  findPlayer,
  send,
  type Player,
  type Reduced,
  type RoomEffect,
  type RoomEvent,
  type RoomState,
} from './roomTypes';

export * from './roomTypes';

// Room state machine (plan M11 §4):
//   waiting ─join→ lobby ─both ready→ countdown (3 s) → running ─nobody live→ ended
// A player who leaves or drops before the match frees the seat. During the match a drop starts
// the 30 s reconnect grace (MP10); leaving forfeits at once. Rooms expire per MP12.

export function createRoom(args: { code: string; settings: RoomSettings; symbol: RoomSymbol; session: Session; now: number }): RoomState {
  const { code, settings, symbol, session, now } = args;
  return {
    code,
    phase: 'waiting',
    settings,
    symbol,
    session,
    cursor: session.startCursor,
    players: [],
    createdAt: now,
    countdownEndsAt: null,
    startedAt: null,
    endedAt: null,
    endReason: null,
    winner: null,
    rematch: [],
    lastOpponentAt: 0,
    series: newSeries(),
  };
}

const PRE_MATCH = new Set(['waiting', 'lobby', 'countdown']);
const unchanged = (s: RoomState, effects: RoomEffect[] = []): Reduced => ({ state: s, effects });
const withRoom = (s: RoomState, now: number, effects: RoomEffect[] = []): Reduced => ({ state: s, effects: [...effects, send('*', roomMessage(s, now))] });
const mapPlayer = (s: RoomState, id: string, f: (p: Player) => Player): RoomState => ({ ...s, players: s.players.map((p) => (p.id === id ? f(p) : p)) });

function hello(s: RoomState, e: Extract<RoomEvent, { type: 'hello' }>, now: number): Reduced {
  const id = e.clientId;
  if (s.phase === 'expired') return unchanged(s, [send(id, errorMsg('expired'))]);
  const seat = findPlayer(s, id);
  if (seat) {
    if (seat.token !== e.token) return unchanged(s, [send(id, errorMsg('bad_token'))]);
    const renamed = PRE_MATCH.has(s.phase) ? e.nickname : seat.nickname;
    const next = mapPlayer(s, id, (p) => ({ ...p, connected: true, disconnectedAt: null, nickname: renamed }));
    return { state: next, effects: [send(id, { type: 'welcome', you: id, token: seat.token }), send('*', roomMessage(next, now)), ...catchUp(next, id, now)] };
  }
  if (!PRE_MATCH.has(s.phase) || s.phase === 'countdown') return unchanged(s, [send(id, errorMsg('room_full', 'This match has already started.'))]);
  if (s.players.length >= MAX_PLAYERS) return unchanged(s, [send(id, errorMsg('room_full'))]);
  const player: Player = { id, token: e.newToken, nickname: e.nickname, ready: false, connected: true, disconnectedAt: null, status: 'live', match: null, lastSeq: -1 };
  const players = [...s.players, player];
  const next: RoomState = { ...s, players, phase: players.length === MAX_PLAYERS ? 'lobby' : 'waiting' };
  return withRoom(next, now, [send(id, { type: 'welcome', you: id, token: e.newToken })]);
}

function setReady(s: RoomState, id: string, ready: boolean, now: number): Reduced {
  if ((s.phase !== 'lobby' && s.phase !== 'countdown') || !findPlayer(s, id)) return unchanged(s);
  let next = mapPlayer(s, id, (p) => ({ ...p, ready }));
  const allReady = next.players.length === MAX_PLAYERS && next.players.every((p) => p.ready && p.connected);
  if (allReady && next.phase === 'lobby') next = { ...next, phase: 'countdown', countdownEndsAt: now + COUNTDOWN_MS };
  if (!allReady && next.phase === 'countdown') next = { ...next, phase: 'lobby', countdownEndsAt: null };
  return withRoom(next, now);
}

/** Leaving (or dropping) before the match frees the seat and cancels any countdown. */
function vacate(s: RoomState, id: string, now: number): Reduced {
  const players = s.players.filter((p) => p.id !== id).map((p) => ({ ...p, ready: false }));
  return withRoom({ ...s, players, phase: 'waiting', countdownEndsAt: null }, now);
}

function departure(s: RoomState, id: string, leaving: boolean, now: number): Reduced {
  if (!findPlayer(s, id)) return unchanged(s);
  if (PRE_MATCH.has(s.phase)) return vacate(s, id, now);
  if (s.phase === 'running') {
    const clocked = advanceClock(s, now);
    if (clocked.state.phase !== 'running') return clocked;
    const next = mapPlayer(clocked.state, id, (p) => (leaving ? forfeit({ ...p, connected: false, disconnectedAt: now }) : { ...p, connected: false, disconnectedAt: now }));
    // Re-run the clock so a forfeit that leaves nobody live ends the room now.
    const after = advanceClock(next, now);
    return { state: after.state, effects: [...clocked.effects, send('*', roomMessage(next, now)), ...after.effects] };
  }
  const next = mapPlayer(s, id, (p) => ({ ...p, connected: false }));
  return withRoom({ ...next, rematch: next.rematch.filter((r) => r !== id) }, now);
}

/** MP: forfeit mid-match, staying connected to watch the end. */
function giveUp(s: RoomState, id: string, now: number): Reduced {
  if (s.phase !== 'running' || !findPlayer(s, id)) return unchanged(s);
  const clocked = advanceClock(s, now);
  if (clocked.state.phase !== 'running') return clocked;
  const next = mapPlayer(clocked.state, id, forfeit);
  const after = advanceClock(next, now);
  return { state: after.state, effects: [...clocked.effects, send('*', roomMessage(next, now)), ...after.effects] };
}

function rematch(s: RoomState, id: string, now: number): Reduced {
  if (s.phase !== 'ended' || !findPlayer(s, id) || s.rematch.includes(id)) return unchanged(s);
  const requested = [...s.rematch, id];
  const next = { ...s, rematch: requested };
  const effects: RoomEffect[] = [send('*', { type: 'rematch', requestedBy: requested })];
  const both = next.players.length === MAX_PLAYERS && next.players.every((p) => p.connected && requested.includes(p.id));
  return { state: next, effects: both ? [...effects, { kind: 'new_session' }] : effects };
}

/**
 * Rematch accepted: the same two players, a new session, straight into the countdown. In a best
 * of 3 that is the next game; once the series is over it starts a new series (M13 R2).
 */
function restart(s: RoomState, session: Session, now: number): Reduced {
  if (s.phase !== 'ended') return unchanged(s);
  const players = s.players.map((p) => ({ ...p, ready: true, status: 'live' as const, match: null, lastSeq: -1 }));
  const series = nextGame(s.series ?? newSeries(), seriesOf(s).done);
  const next: RoomState = { ...s, session, cursor: session.startCursor, players, phase: 'countdown', countdownEndsAt: now + COUNTDOWN_MS, startedAt: null, endedAt: null, endReason: null, winner: null, rematch: [], series };
  return withRoom(next, now);
}

function expire(s: RoomState): Reduced {
  return { state: { ...s, phase: 'expired' }, effects: [send('*', errorMsg('expired')), { kind: 'shutdown' }] };
}

function onTick(s: RoomState, now: number): Reduced {
  if (s.phase === 'waiting' && now >= s.createdAt + WAITING_TTL_MS) return expire(s);
  if (s.phase === 'ended' && s.endedAt !== null && now >= s.endedAt + ENDED_TTL_MS) return expire(s);
  if (s.phase === 'countdown' && s.countdownEndsAt !== null && now >= s.countdownEndsAt) {
    const started = startMatch(s, now);
    const clocked = advanceClock(started.state, now);
    return { state: clocked.state, effects: [...started.effects, ...clocked.effects] };
  }
  return advanceClock(s, now);
}

/** The room reducer. Pure: same state, event and time → same result. */
export function roomReducer(s: RoomState, e: RoomEvent, now: number): Reduced {
  switch (e.type) {
    case 'hello':
      return hello(s, e, now);
    case 'ready':
    case 'unready':
      return setReady(s, e.playerId, e.type === 'ready', now);
    case 'leave':
    case 'disconnect':
      return departure(s, e.playerId, e.type === 'leave', now);
    case 'order':
      return applyOrder(s, e.playerId, e.seq, e.order, now);
    case 'close':
    case 'cancel':
      return applyOrder(s, e.playerId, e.seq, e.type, now);
    case 'brackets':
      return applyOrder(s, e.playerId, e.seq, { brackets: e.brackets }, now);
    case 'forfeit':
      return giveUp(s, e.playerId, now);
    case 'rematch':
      return rematch(s, e.playerId, now);
    case 'restart':
      return restart(s, e.session, now);
    case 'tick':
      return onTick(s, now);
  }
}

/** When the server should next send a `tick`, or null when nothing is time-driven. */
export function nextWakeAt(s: RoomState): number | null {
  switch (s.phase) {
    case 'waiting':
      return s.createdAt + WAITING_TTL_MS;
    case 'countdown':
      return s.countdownEndsAt;
    case 'ended':
      return s.endedAt === null ? null : s.endedAt + ENDED_TTL_MS;
    case 'running': {
      if (s.startedAt === null) return null;
      const tickMs = tickMsFor(s.settings.speed);
      const nextCandle = s.startedAt + (s.cursor - s.session.startCursor + 1) * tickMs;
      const timerEnd = s.startedAt + s.settings.durationMin * 60_000;
      const graces = s.players.filter((p) => p.status === 'live' && p.disconnectedAt !== null).map((p) => (p.disconnectedAt as number) + RECONNECT_GRACE_MS);
      return Math.min(nextCandle, timerEnd, ...graces);
    }
    default:
      return null;
  }
}
