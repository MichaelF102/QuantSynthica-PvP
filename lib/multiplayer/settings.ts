import { BALANCE_LIMITS, CANDLES_PER_SEC_1X, COMMISSION_LIMITS, DURATION_OPTIONS_MIN, HISTORY_CANDLES, MAX_DRAWDOWN_LIMITS, SLIPPAGE_BPS_LIMITS } from '../config';
import type { SessionSpec } from '../data';
import { defaultMatchConfig, executionFields } from '../session';
import type { FillModel, MatchConfig, SymbolInfo } from '../types';
import type { SeriesLength } from './series';

// Room settings, chosen by the creator and shared by both players (MP5: fixed speed per room).

export const ROOM_SPEEDS = [1, 2, 5] as const;
export type RoomSpeed = (typeof ROOM_SPEEDS)[number];
export type RoomDurationMin = (typeof DURATION_OPTIONS_MIN)[number];

export type RoomSettings = {
  symbol: string;
  durationMin: RoomDurationMin;
  speed: RoomSpeed;
  startingBalance: number;
  maxDrawdownPct: number;
  /** Plan M12 C10: the same fills and costs for both players. Missing = today's rules. */
  fillModel?: FillModel;
  commission?: number;
  slippageBps?: number;
  /** Plan M13 R1: 1 (default) or best of 3. */
  series?: SeriesLength;
  /** Plan M13 R4: show each player the other's position and fills. Default false (MP8). */
  openPositions?: boolean;
};

/** What the room tells players about the symbol. The data file name stays on the server. */
export type RoomSymbol = Pick<SymbolInfo, 'symbol' | 'name' | 'currency' | 'lotStep' | 'priceDecimals' | 'assetClass'>;

export type SettingsCheck = { ok: true; settings: RoomSettings } | { ok: false; error: string };

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Validates untrusted settings (from the create request) against the symbol index. */
export function validateRoomSettings(raw: unknown, index: readonly SymbolInfo[]): SettingsCheck {
  if (typeof raw !== 'object' || raw === null) return { ok: false, error: 'Settings are missing.' };
  const r = raw as Record<string, unknown>;
  if (typeof r.symbol !== 'string' || !index.some((i) => i.symbol === r.symbol)) return { ok: false, error: 'Choose a symbol that has market data.' };
  if (!(DURATION_OPTIONS_MIN as readonly unknown[]).includes(r.durationMin)) return { ok: false, error: 'Choose a time limit of 5, 10, 15 or 30 minutes.' };
  if (!(ROOM_SPEEDS as readonly unknown[]).includes(r.speed)) return { ok: false, error: 'Choose a speed of 1x, 2x or 5x.' };
  if (!isNum(r.startingBalance) || r.startingBalance < BALANCE_LIMITS.min || r.startingBalance > BALANCE_LIMITS.max) {
    return { ok: false, error: `Starting balance must be between ${BALANCE_LIMITS.min.toLocaleString('en-US')} and ${BALANCE_LIMITS.max.toLocaleString('en-US')}.` };
  }
  if (!isNum(r.maxDrawdownPct) || r.maxDrawdownPct < MAX_DRAWDOWN_LIMITS.min || r.maxDrawdownPct > MAX_DRAWDOWN_LIMITS.max) {
    return { ok: false, error: `Max drawdown must be between ${MAX_DRAWDOWN_LIMITS.min}% and ${MAX_DRAWDOWN_LIMITS.max}%.` };
  }
  if (r.fillModel !== undefined && r.fillModel !== 'close' && r.fillModel !== 'next_open') return { ok: false, error: 'Choose how market orders fill.' };
  if (r.commission !== undefined && (!isNum(r.commission) || r.commission < COMMISSION_LIMITS.min || r.commission > COMMISSION_LIMITS.max || r.commission >= r.startingBalance)) {
    return { ok: false, error: `Commission must be between ${COMMISSION_LIMITS.min} and ${COMMISSION_LIMITS.max.toLocaleString('en-US')}, and below the balance.` };
  }
  if (r.slippageBps !== undefined && (!isNum(r.slippageBps) || r.slippageBps < SLIPPAGE_BPS_LIMITS.min || r.slippageBps > SLIPPAGE_BPS_LIMITS.max)) {
    return { ok: false, error: `Slippage must be between ${SLIPPAGE_BPS_LIMITS.min} and ${SLIPPAGE_BPS_LIMITS.max} bps.` };
  }
  if (r.series !== undefined && r.series !== 1 && r.series !== 3) return { ok: false, error: 'Choose a single game or best of 3.' };
  if (r.openPositions !== undefined && typeof r.openPositions !== 'boolean') return { ok: false, error: 'Choose whether positions are visible.' };
  return {
    ok: true,
    settings: {
      symbol: r.symbol,
      durationMin: r.durationMin as RoomDurationMin,
      speed: r.speed as RoomSpeed,
      startingBalance: r.startingBalance,
      maxDrawdownPct: r.maxDrawdownPct,
      ...executionFields({ fillModel: r.fillModel as FillModel | undefined, commission: r.commission as number | undefined, slippageBps: r.slippageBps as number | undefined }),
      ...roomOptionFields({ series: r.series as SeriesLength | undefined, openPositions: r.openPositions as boolean | undefined }),
    },
  };
}

/** M13 options, left out at their defaults so old and new settings compare equal. */
export function roomOptionFields(o: Pick<RoomSettings, 'series' | 'openPositions'>): Pick<RoomSettings, 'series' | 'openPositions'> {
  return { ...(o.series === 3 ? { series: 3 as const } : {}), ...(o.openPositions ? { openPositions: true } : {}) };
}

export const seriesLengthOf = (s: Pick<RoomSettings, 'series'>): SeriesLength => (s.series === 3 ? 3 : 1);

export function roomSymbol(info: SymbolInfo): RoomSymbol {
  const { symbol, name, currency, lotStep, priceDecimals, assetClass } = info;
  return { symbol, name, currency, lotStep, priceDecimals, assetClass };
}

/** The engine config each player's account uses. */
export function roomMatchConfig(settings: RoomSettings, info: Pick<SymbolInfo, 'symbol' | 'currency' | 'lotStep'>): MatchConfig {
  return defaultMatchConfig(info as SymbolInfo, {
    durationMs: settings.durationMin * 60_000,
    startingBalance: settings.startingBalance,
    maxDrawdownPct: settings.maxDrawdownPct,
    fillModel: settings.fillModel,
    commission: settings.commission,
    slippageBps: settings.slippageBps,
  });
}

/** Wall-clock ms between candles at the room's speed (plan D1: 1 candle/s at 1x). */
export const tickMsFor = (speed: RoomSpeed) => 1000 / (CANDLES_PER_SEC_1X * speed);

/**
 * Candles a room session needs. The speed is fixed and there is no step or jump (MP5), so the
 * timer needs exactly durationSec × candles/s, plus the first candle after the history.
 */
export function roomSessionSpec(settings: Pick<RoomSettings, 'durationMin' | 'speed'>): SessionSpec {
  return { playable: Math.ceil(settings.durationMin * 60 * CANDLES_PER_SEC_1X * settings.speed) + 1, history: HISTORY_CANDLES };
}
