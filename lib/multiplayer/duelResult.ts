import { addTombstones, emitLocalChange } from '../localChanges';
import type { Stats } from '../stats';
import type { EquityPoint, Trade } from '../types';
import type { PlayerStatus, RoomEndReason, ServerMessage } from './protocol';
import type { RoomInfo } from './roomClient';
import type { RoomSettings } from './settings';

// Head-to-head results (plan M11.6, MP11): built from the server's `end` message and saved in
// this browser only, like practice results. Real times: the session date is revealed at the end.

export type DuelSide = { nickname: string; status: PlayerStatus; stats: Stats; trades: Trade[]; equityCurve: EquityPoint[] };

export type DuelResult = {
  version: 1;
  mode: 'duel';
  /** Same for both reloads of one match, so a reconnect does not save it twice. */
  id: string;
  roomCode: string;
  playedAt: number;
  symbol: string;
  symbolName: string;
  currency: string;
  priceDecimals: number;
  lotStep: number;
  settings: RoomSettings;
  reason: RoomEndReason;
  /** From this browser's point of view. */
  outcome: 'win' | 'loss' | 'draw';
  sessionStart: number;
  sessionEnd: number;
  you: DuelSide;
  opponent: DuelSide;
  /** Plan M13 R3: in a best of 3, this game's place in the series (after it was counted). */
  series?: { game: number; of: number; youWins: number; opponentWins: number; done: boolean; outcome: 'win' | 'loss' | 'draw' | null };
};

export type EndMessage = Extract<ServerMessage, { type: 'end' }>;

const side = (p: EndMessage['players'][number]): DuelSide => ({ nickname: p.nickname, status: p.status, stats: p.stats, trades: p.trades, equityCurve: p.equityCurve });

export const duelResultId = (code: string, end: Pick<EndMessage, 'sessionStart' | 'sessionEnd'>) => `duel-${code}-${end.sessionStart}-${end.sessionEnd}`;

/** null when this browser was not one of the two players. */
export function buildDuelResult(end: EndMessage, room: RoomInfo, youId: string, playedAt: number): DuelResult | null {
  const mine = end.players.find((p) => p.id === youId);
  const theirs = end.players.find((p) => p.id !== youId);
  if (!mine || !theirs) return null;
  return {
    version: 1,
    mode: 'duel',
    id: duelResultId(room.code, end),
    roomCode: room.code,
    playedAt,
    symbol: room.symbol.symbol,
    symbolName: room.symbol.name,
    currency: room.symbol.currency,
    priceDecimals: room.symbol.priceDecimals,
    lotStep: room.symbol.lotStep,
    settings: room.settings,
    reason: end.reason,
    outcome: end.winner === 'draw' || end.winner === null ? 'draw' : end.winner === youId ? 'win' : 'loss',
    sessionStart: end.sessionStart,
    sessionEnd: end.sessionEnd,
    you: side(mine),
    opponent: side(theirs),
    ...(end.series && end.series.of > 1
      ? {
          series: {
            game: end.series.game,
            of: end.series.of,
            youWins: end.series.wins[youId] ?? 0,
            opponentWins: end.series.wins[theirs.id] ?? 0,
            done: end.series.done,
            outcome: !end.series.done ? null : end.series.winner === 'draw' ? 'draw' : end.series.winner === youId ? 'win' : 'loss',
          },
        }
      : {}),
  };
}

export const OUTCOME_TEXT: Record<DuelResult['outcome'], string> = { win: 'You won', loss: 'You lost', draw: 'Draw' };

export function reasonText(r: DuelResult): string {
  const knocked = (s: DuelSide) => (s.status === 'out_drawdown' ? `${s.nickname} hit the max drawdown` : s.status === 'out_disconnect' ? `${s.nickname} forfeited` : null);
  const why = [knocked(r.you), knocked(r.opponent)].filter(Boolean).join(' · ');
  const end = r.reason === 'timer' ? 'Time ran out' : r.reason === 'data_end' ? 'The session data ran out' : 'Both players are out';
  return why ? `${end} · ${why}` : end;
}

// ---------- storage ----------

export const DUELS_KEY = 'qs-pvp:duels:v1';
export const MAX_DUELS = 50;
type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

function local(): StorageLike | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isSide = (v: unknown): v is DuelSide => {
  const s = v as DuelSide | null;
  return Boolean(s && typeof s.nickname === 'string' && s.stats && isNum(s.stats.finalEquity) && Array.isArray(s.trades) && Array.isArray(s.equityCurve));
};

export function isDuelResult(v: unknown): v is DuelResult {
  const r = v as DuelResult | null;
  return Boolean(
    r && r.version === 1 && r.mode === 'duel' && typeof r.id === 'string' && typeof r.symbol === 'string' && typeof r.currency === 'string' &&
      isNum(r.playedAt) && isNum(r.sessionStart) && isNum(r.sessionEnd) && ['win', 'loss', 'draw'].includes(r.outcome) && isSide(r.you) && isSide(r.opponent),
  );
}

export type DuelsRead = { duels: DuelResult[]; error: boolean };

/** Newest first. Invalid entries are skipped; unreadable storage reports an error. */
export function listDuels(storage: StorageLike | null = local()): DuelsRead {
  if (!storage) return { duels: [], error: true };
  try {
    const v: unknown = JSON.parse(storage.getItem(DUELS_KEY) ?? '[]');
    const duels = Array.isArray(v) ? v.filter(isDuelResult) : [];
    return { duels: duels.sort((a, b) => b.playedAt - a.playedAt), error: !Array.isArray(v) };
  } catch {
    return { duels: [], error: true };
  }
}

/** Saves or replaces (same id), keeping the newest MAX_DUELS. */
export function saveDuel(r: DuelResult, storage: StorageLike | null = local()): boolean {
  if (!storage) return false;
  const { duels } = listDuels(storage);
  const kept = [r, ...duels.filter((d) => d.id !== r.id)].sort((a, b) => b.playedAt - a.playedAt).slice(0, MAX_DUELS);
  try {
    storage.setItem(DUELS_KEY, JSON.stringify(kept));
  } catch {
    return false;
  }
  emitLocalChange({ kind: 'duel', op: 'put', id: r.id });
  return true;
}

/** Plan M14: replaces every saved duel (after a cloud merge). Announces nothing. */
export function replaceDuels(list: DuelResult[], storage: StorageLike | null = local()): boolean {
  if (!storage) return false;
  try {
    storage.setItem(DUELS_KEY, JSON.stringify([...list].sort((a, b) => b.playedAt - a.playedAt).slice(0, MAX_DUELS)));
    return true;
  } catch {
    return false;
  }
}

export const getDuel = (id: string, storage: StorageLike | null = local()): DuelResult | null => listDuels(storage).duels.find((d) => d.id === id) ?? null;

export function deleteDuel(id: string, storage: StorageLike | null = local()): boolean {
  if (!storage) return false;
  try {
    storage.setItem(DUELS_KEY, JSON.stringify(listDuels(storage).duels.filter((d) => d.id !== id)));
  } catch {
    return false;
  }
  addTombstones('duel', [id]);
  emitLocalChange({ kind: 'duel', op: 'delete', ids: [id] });
  return true;
}
