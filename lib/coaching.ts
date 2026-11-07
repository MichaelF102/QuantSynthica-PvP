import { tradeExtras } from './analysis';
import { fmtDuration, fmtMoney, fmtPct, fmtSignedMoney, fmtSpan } from './format';
import type { MatchResult } from './results';

// Rule-based notes for the results page. Each rule reads only the saved result (and the buy &
// hold return when the session candles loaded). No advice, just what the numbers say.

export type CoachTone = 'positive' | 'negative' | 'neutral';
export type CoachNote = { id: string; tone: CoachTone; text: string };

export const MAX_NOTES = 4;

export function coachingNotes(r: MatchResult, buyHoldPct: number | null = null): CoachNote[] {
  const { stats, trades, currency, config } = r;
  const money = (v: number) => fmtMoney(Math.abs(v), currency);
  const notes: CoachNote[] = [];
  const x = tradeExtras(trades, r.sessionStart, r.sessionEnd, stats.startingBalance);

  if (trades.length === 0) {
    notes.push({ id: 'no-trades', tone: 'neutral', text: 'No trades this match. The report fills in once you close at least one trade.' });
  }

  if (buyHoldPct !== null) {
    const edge = stats.returnPct - buyHoldPct;
    const market = `The market moved ${fmtPct(buyHoldPct)} over your session`;
    if (Math.abs(edge) < 0.005) notes.push({ id: 'bench', tone: 'neutral', text: `${market}; you matched it.` });
    else notes.push({ id: 'bench', tone: edge > 0 ? 'positive' : 'negative', text: `${market}; you ${edge > 0 ? 'beat' : 'trailed'} it by ${Math.abs(edge).toFixed(2)} points.` });
  }

  if (stats.losses >= 2 && stats.largestLoss !== null && stats.grossLoss > 0) {
    const share = (Math.abs(stats.largestLoss) / stats.grossLoss) * 100;
    if (share >= 40) notes.push({ id: 'big-loss', tone: 'negative', text: `Your largest loss (${money(stats.largestLoss)}) was ${share.toFixed(0)}% of all losses.` });
  }

  if (trades.length >= 3) {
    for (const [side, s] of [['long', x.longs], ['short', x.shorts]] as const) {
      if (s.count / trades.length >= 0.75) {
        notes.push({ id: 'side', tone: s.pnl >= 0 ? 'positive' : 'negative', text: `${s.count} of ${trades.length} trades were ${side}s; ${side}s ${s.pnl >= 0 ? 'made' : 'lost'} ${money(s.pnl)}.` });
      }
    }
  }

  const winners = trades.filter((t) => t.pnl > 0);
  const losers = trades.filter((t) => t.pnl < 0);
  if (winners.length && losers.length) {
    const avgN = (ts: typeof trades) => ts.reduce((a, t) => a + Math.abs(t.entry * t.units), 0) / ts.length;
    const w = avgN(winners);
    const l = avgN(losers);
    if (l >= 2 * w) notes.push({ id: 'size', tone: 'negative', text: `Losing positions were ${(l / w).toFixed(1)}× the size of winning ones on average (${money(l)} vs ${money(w)}).` });
    else if (w >= 2 * l) notes.push({ id: 'size', tone: 'positive', text: `Winning positions were ${(w / l).toFixed(1)}× the size of losing ones on average.` });
  }

  if (x.avgHoldWin !== null && x.avgHoldLoss !== null && x.avgHoldWin > 0 && x.avgHoldLoss >= 1.5 * x.avgHoldWin) {
    notes.push({ id: 'hold', tone: 'negative', text: `You held losers longer than winners (${fmtSpan(x.avgHoldLoss)} vs ${fmtSpan(x.avgHoldWin)} on average).` });
  }

  if (config.maxDrawdownPct > 0 && r.endReason !== 'drawdown') {
    const used = (stats.maxDrawdownPct / config.maxDrawdownPct) * 100;
    if (used >= 70) notes.push({ id: 'dd', tone: 'negative', text: `Your worst drawdown used ${used.toFixed(0)}% of the ${fmtPct(config.maxDrawdownPct, 0, false)} limit.` });
  }

  const left = config.durationMs - stats.durationMs;
  if (r.endReason === 'user' && left >= config.durationMs / 2) {
    notes.push({ id: 'early', tone: 'neutral', text: `You ended the match with ${fmtDuration(left)} still on the clock.` });
  }

  if (stats.pnl > 0 && notes.every((n) => n.tone !== 'positive')) {
    notes.push({ id: 'profit', tone: 'positive', text: `A profitable match: ${fmtSignedMoney(stats.pnl, currency)} on ${stats.trades} trade${stats.trades === 1 ? '' : 's'}.` });
  }

  return notes.slice(0, MAX_NOTES);
}
