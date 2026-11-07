import type { ChallengeRef } from './challenge';
import { computeStats, type Stats } from './stats';
import type { EndReason, EquityPoint, MatchConfig, MatchState, SymbolInfo, Trade } from './types';

/** What is kept after a match. No candles, so a saved result stays small. */
export type MatchResult = {
  version: 1;
  id: string;
  symbol: string;
  symbolName: string;
  currency: string;
  priceDecimals: number;
  lotStep: number;
  config: MatchConfig;
  endReason: EndReason;
  /** Wall-clock ms when the match started. */
  playedAt: number;
  /** UNIX seconds of the candle the player started on and the last candle revealed. */
  sessionStart: number;
  sessionEnd: number;
  stats: Stats;
  trades: Trade[];
  equityCurve: EquityPoint[];
  /** The player's own note about the match (added on the results page). */
  note?: string;
  /** Plan M14 A4: when the note last changed (ms), to settle a sync conflict. */
  noteUpdatedAt?: number;
  /** Plan M13 C5: the challenge this match answered, with the score from the link. */
  challenge?: ChallengeRef;
};

export const MAX_NOTE_LENGTH = 500;

export const MAX_EQUITY_POINTS = 500;

/**
 * Shrinks the curve to at most `max` points. Each bucket keeps its lowest and highest point (in
 * time order), so peaks and troughs, and with them the worst drawdown, survive. The first and
 * last points are always kept.
 */
export function downsampleEquity(curve: EquityPoint[], max = MAX_EQUITY_POINTS): EquityPoint[] {
  if (curve.length <= max) return curve;
  const inner = curve.slice(1, -1);
  const buckets = Math.max(1, Math.floor((max - 2) / 2));
  const size = inner.length / buckets;
  const out: EquityPoint[] = [curve[0]];
  for (let b = 0; b < buckets; b++) {
    const chunk = inner.slice(Math.floor(b * size), Math.floor((b + 1) * size));
    if (chunk.length === 0) continue;
    let lo = chunk[0];
    let hi = chunk[0];
    for (const p of chunk) {
      if (p.equity < lo.equity) lo = p;
      if (p.equity > hi.equity) hi = p;
    }
    if (lo === hi) out.push(lo);
    else out.push(...(lo.t <= hi.t ? [lo, hi] : [hi, lo]));
  }
  out.push(curve[curve.length - 1]);
  return out;
}

/** Builds the saved record of a finished match. Stats come from the full curve, before downsampling. */
export function buildResult(state: MatchState, info: SymbolInfo, id: string, now: number, challenge?: ChallengeRef): MatchResult {
  if (state.status !== 'ended' || !state.endReason) throw new Error('buildResult needs an ended match');
  return {
    version: 1,
    id,
    symbol: info.symbol,
    symbolName: info.name,
    currency: info.currency,
    priceDecimals: info.priceDecimals,
    lotStep: info.lotStep,
    config: state.config,
    endReason: state.endReason,
    playedAt: state.startedAt ?? now,
    // The player starts on the last history candle and may trade there, so that is the start.
    sessionStart: state.candles[state.startCursor].time,
    sessionEnd: state.candles[state.cursor].time,
    stats: computeStats(state),
    trades: state.trades,
    equityCurve: downsampleEquity(state.equityCurve),
    ...(challenge ? { challenge } : {}),
  };
}

export const END_REASON_TEXT: Record<EndReason, string> = {
  timer: "Time's up",
  drawdown: 'Max drawdown reached',
  data_end: 'End of session data',
  user: 'Ended by you',
};
