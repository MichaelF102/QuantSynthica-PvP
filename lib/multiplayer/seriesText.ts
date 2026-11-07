import type { SeriesView } from './series';

// Labels for a best-of-3 series (plan M13 R3). Pure.

type Seat = { id: string; nickname: string };

/** "Game 2 of 3 · Ann 1–0 Bo", or from one player's side "Game 2 of 3 · You lead 1–0". */
export function seriesText(s: SeriesView, players: readonly Seat[], you: string | null): string {
  const game = `Game ${s.game} of ${s.of}`;
  const [a, b] = you ? [players.find((p) => p.id === you), players.find((p) => p.id !== you)] : players;
  const wa = a ? (s.wins[a.id] ?? 0) : 0;
  const wb = b ? (s.wins[b.id] ?? 0) : 0;
  if (!you) return a && b ? `${game} · ${a.nickname} ${wa}–${wb} ${b.nickname}` : game;
  if (s.done) {
    const verdict = s.winner === 'draw' ? 'Series drawn' : s.winner === you ? 'You won the series' : 'You lost the series';
    return `${verdict} ${wa}–${wb}`;
  }
  const lead = wa > wb ? 'You lead' : wa < wb ? 'You trail' : 'Level';
  return `${game} · ${lead} ${wa}–${wb}`;
}
