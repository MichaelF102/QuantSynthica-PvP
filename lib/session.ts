import { CANDLES_PER_SEC_1X, DEFAULT_BALANCE, DEFAULT_DURATION_MS, DEFAULT_MAX_DRAWDOWN_PCT, HISTORY_CANDLES, SPEEDS } from './config';
import type { SessionSpec } from './data';
import type { MatchConfig, SymbolInfo } from './types';

/** Room for stepping and jumping on top of a full match played at top speed (plan D2). */
const HEADROOM = 1.2;

/** Candles a session needs so the timer, not the data, normally ends the match (plan D2). */
export function sessionSpecFor(durationMs: number): SessionSpec {
  const topSpeed = Math.max(...SPEEDS);
  return { playable: Math.ceil((durationMs / 1000) * CANDLES_PER_SEC_1X * topSpeed * HEADROOM), history: HISTORY_CANDLES };
}

export function defaultBalanceFor(currency: string): number {
  return DEFAULT_BALANCE[currency] ?? DEFAULT_BALANCE.USD;
}

type ConfigOverrides = Partial<Pick<MatchConfig, 'durationMs' | 'startingBalance' | 'maxDrawdownPct' | 'fillModel' | 'commission' | 'slippageBps'>>;

/** Execution fields, left out when they equal today's rules so old and new configs match (plan M12 C9). */
export function executionFields(o: ConfigOverrides): Pick<MatchConfig, 'fillModel' | 'commission' | 'slippageBps'> {
  return {
    ...(o.fillModel === 'next_open' ? { fillModel: 'next_open' as const } : {}),
    ...(o.commission && o.commission > 0 ? { commission: o.commission } : {}),
    ...(o.slippageBps && o.slippageBps > 0 ? { slippageBps: o.slippageBps } : {}),
  };
}

export function defaultMatchConfig(info: SymbolInfo, overrides: ConfigOverrides = {}): MatchConfig {
  return {
    symbol: info.symbol,
    currency: info.currency,
    interval: '1m',
    durationMs: overrides.durationMs ?? DEFAULT_DURATION_MS,
    startingBalance: overrides.startingBalance ?? defaultBalanceFor(info.currency),
    maxDrawdownPct: overrides.maxDrawdownPct ?? DEFAULT_MAX_DRAWDOWN_PCT,
    lotStep: info.lotStep,
    ...executionFields(overrides),
  };
}

/** UNIX seconds -> value for <input type="datetime-local">, read as UTC ("2026-10-06T13:30"). */
export function toUtcInputValue(unixSec: number): string {
  return new Date(unixSec * 1000).toISOString().slice(0, 16);
}

/** <input type="datetime-local"> value read as UTC -> UNIX seconds, or null if invalid. */
export function fromUtcInputValue(value: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number);
  const ms = Date.UTC(y, mo - 1, d, h, mi);
  const back = new Date(ms);
  // Reject impossible dates such as 2026-02-31 that Date.UTC would roll over.
  if (back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d || h > 23 || mi > 59) return null;
  return ms / 1000;
}
