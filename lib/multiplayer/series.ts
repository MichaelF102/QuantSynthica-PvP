// Best-of-3 series (plan M13 R1–R3). Pure.

export type SeriesLength = 1 | 3;
/** Kept on the room: the current game number and game wins per player id. */
export type SeriesState = { game: number; wins: Record<string, number> };
/** What players see. `done` and `winner` are only meaningful once the current game has ended. */
export type SeriesView = { of: SeriesLength; game: number; wins: Record<string, number>; done: boolean; winner: string | 'draw' | null };

export const newSeries = (): SeriesState => ({ game: 1, wins: {} });

/** R1: a game's winner adds a win; a draw counts for nobody. */
export function recordGame(s: SeriesState, winner: string | 'draw' | null): SeriesState {
  if (!winner || winner === 'draw') return s;
  return { ...s, wins: { ...s.wins, [winner]: (s.wins[winner] ?? 0) + 1 } };
}

const NEED = 2;

/**
 * R1: after a game ends, is the series over and who took it? Best of 1 ends after one game. Best
 * of 3 ends at 2 wins or after game 3, when the player with more wins takes it (equal = draw).
 */
export function seriesView(of: SeriesLength, s: SeriesState, playerIds: readonly string[], gameEnded: boolean): SeriesView {
  const wins = s.wins;
  const counts = playerIds.map((id) => [id, wins[id] ?? 0] as const);
  const leader = counts.find(([, w]) => w >= NEED)?.[0] ?? null;
  const done = gameEnded && (of === 1 || leader !== null || s.game >= of);
  let winner: SeriesView['winner'] = null;
  if (done) {
    const [a, b] = counts;
    if (!a) winner = null;
    else if (!b || a[1] !== b[1]) winner = !b || a[1] > b[1] ? a[0] : b[0];
    else winner = 'draw';
  }
  return { of, game: s.game, wins, done, winner };
}

/** R2: the next game of an unfinished series, or a fresh series once it is over. */
export const nextGame = (s: SeriesState, finished: boolean): SeriesState => (finished ? newSeries() : { ...s, game: s.game + 1 });
