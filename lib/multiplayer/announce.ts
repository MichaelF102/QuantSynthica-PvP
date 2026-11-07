import type { OpponentView, PlayerStatus } from './protocol';

// Screen-reader announcements during a duel (plan M11.7). Only changes that matter are spoken;
// the scoreboard itself is not a live region, so equity ticks do not flood the reader.

export type AnnounceSnapshot = { you: PlayerStatus | null; opponent: Pick<OpponentView, 'nickname' | 'status' | 'connected'> | null; remainingMs: number };

export const ONE_MINUTE = 60_000;

export function duelAnnouncement(prev: AnnounceSnapshot, next: AnnounceSnapshot): string | null {
  const parts: string[] = [];
  if (prev.you === 'live' && next.you === 'out_drawdown') parts.push('You hit the max drawdown and are out.');
  const a = prev.opponent;
  const b = next.opponent;
  if (a && b) {
    if (a.status === 'live' && b.status === 'out_drawdown') parts.push(`${b.nickname} hit the max drawdown and is out.`);
    else if (a.status === 'live' && b.status === 'out_disconnect') parts.push(`${b.nickname} forfeited.`);
    else if (b.status === 'live' && a.connected && !b.connected) parts.push(`${b.nickname} lost connection.`);
    else if (b.status === 'live' && !a.connected && b.connected) parts.push(`${b.nickname} is back.`);
  }
  if (prev.remainingMs > ONE_MINUTE && next.remainingMs <= ONE_MINUTE && next.remainingMs > 0) parts.push('One minute left.');
  return parts.length ? parts.join(' ') : null;
}
