// MP7: the higher final equity wins; a player knocked out (drawdown or forfeit) loses to one who
// was not; equal equity to the cent is a draw.

export type Standing = { id: string; out: boolean; equity: number };

export function decideWinner(players: readonly Standing[]): string | 'draw' | null {
  if (players.length === 0) return null;
  if (players.length === 1) return players[0].id;
  const [a, b] = players;
  if (a.out !== b.out) return a.out ? b.id : a.id;
  const ca = Math.round(a.equity * 100);
  const cb = Math.round(b.equity * 100);
  if (ca === cb) return 'draw';
  return ca > cb ? a.id : b.id;
}
