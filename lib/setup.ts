import { BALANCE_LIMITS, CANDLES_PER_SEC_1X, COMMISSION_LIMITS, DEFAULT_DURATION_MS, DEFAULT_MAX_DRAWDOWN_PCT, DURATION_OPTIONS_MIN, MAX_DRAWDOWN_LIMITS, SLIPPAGE_BPS_LIMITS } from './config';
import { pickRandomSession } from './data';
import { emitLocalChange } from './localChanges';
import { defaultBalanceFor, defaultMatchConfig, sessionSpecFor } from './session';
import type { Candle, FillModel, MatchConfig, Session, SymbolInfo } from './types';

// Match setup (plan M9): form defaults, validation and the remembered last setup. Pure except
// for the small localStorage wrappers at the end, which never throw.

export type DurationMin = (typeof DURATION_OPTIONS_MIN)[number];

export type SetupForm = {
  symbol: string;
  durationMin: DurationMin;
  /** Raw text from the balance input, e.g. "10,00,000". */
  balanceText: string;
  /** True once the player typed a balance; otherwise it follows the symbol's currency. */
  balanceEdited: boolean;
  /** Raw text from the drawdown input. */
  drawdownText: string;
  /** Plan M12 C1. */
  fillModel: FillModel;
  /** Plan M12 C6, C7: raw text; empty means 0. */
  commissionText: string;
  slippageText: string;
};

export type SetupErrors = Partial<Record<'symbol' | 'balance' | 'drawdown' | 'commission' | 'slippage', string>>;

const DEFAULT_DURATION_MIN = (DEFAULT_DURATION_MS / 60_000) as DurationMin;

/** "10,00,000", "100 000" or "100000.50" -> number; anything else -> NaN. */
export function parseAmount(text: string): number {
  const cleaned = text.replace(/[\s,_]/g, '');
  return /^\d+(\.\d+)?$/.test(cleaned) ? Number(cleaned) : Number.NaN;
}

export function defaultForm(index: SymbolInfo[], last: LastSetup | null = null): SetupForm {
  const info = index.find((i) => i.symbol === last?.symbol) ?? index[0];
  const sameCurrency = last && info && last.balanceCurrency === info.currency;
  return {
    symbol: info?.symbol ?? '',
    durationMin: last && (DURATION_OPTIONS_MIN as readonly number[]).includes(last.durationMin) ? last.durationMin : DEFAULT_DURATION_MIN,
    balanceText: String(sameCurrency ? last.balance : info ? defaultBalanceFor(info.currency) : ''),
    balanceEdited: Boolean(sameCurrency && last.balance !== defaultBalanceFor(info.currency)),
    drawdownText: String(last?.maxDrawdownPct ?? DEFAULT_MAX_DRAWDOWN_PCT),
    fillModel: last?.fillModel === 'next_open' ? 'next_open' : 'close',
    // A remembered commission is in the old symbol's currency, so it is kept only for the same currency.
    commissionText: sameCurrency && last.commission ? String(last.commission) : '0',
    slippageText: String(last?.slippageBps ?? 0),
  };
}

/** Empty text counts as 0 for the optional cost fields. */
const costValue = (text: string) => (text.trim() === '' ? 0 : parseAmount(text));

/** Switching symbol keeps a typed balance, but a default balance follows the new currency. */
export function withSymbol(form: SetupForm, info: SymbolInfo): SetupForm {
  return { ...form, symbol: info.symbol, balanceText: form.balanceEdited ? form.balanceText : String(defaultBalanceFor(info.currency)) };
}

export function validateSetup(form: SetupForm, index: SymbolInfo[]): SetupErrors {
  const errors: SetupErrors = {};
  if (!index.some((i) => i.symbol === form.symbol)) errors.symbol = 'Choose a symbol.';
  const balance = parseAmount(form.balanceText);
  if (!Number.isFinite(balance)) errors.balance = 'Enter an amount using digits only.';
  else if (balance < BALANCE_LIMITS.min || balance > BALANCE_LIMITS.max)
    errors.balance = `Enter between ${BALANCE_LIMITS.min.toLocaleString('en-US')} and ${BALANCE_LIMITS.max.toLocaleString('en-US')}.`;
  const dd = Number(form.drawdownText.trim());
  if (form.drawdownText.trim() === '' || !Number.isFinite(dd)) errors.drawdown = 'Enter a percentage.';
  else if (dd < MAX_DRAWDOWN_LIMITS.min || dd > MAX_DRAWDOWN_LIMITS.max) errors.drawdown = `Enter between ${MAX_DRAWDOWN_LIMITS.min}% and ${MAX_DRAWDOWN_LIMITS.max}%.`;
  const fee = costValue(form.commissionText);
  if (!Number.isFinite(fee)) errors.commission = 'Enter an amount using digits only.';
  else if (fee > COMMISSION_LIMITS.max) errors.commission = `Enter between ${COMMISSION_LIMITS.min} and ${COMMISSION_LIMITS.max.toLocaleString('en-US')}.`;
  else if (Number.isFinite(balance) && fee >= balance) errors.commission = 'The fee must be smaller than the balance.';
  const slip = costValue(form.slippageText);
  if (!Number.isFinite(slip)) errors.slippage = 'Enter a number of basis points.';
  else if (slip > SLIPPAGE_BPS_LIMITS.max) errors.slippage = `Enter between ${SLIPPAGE_BPS_LIMITS.min} and ${SLIPPAGE_BPS_LIMITS.max} bps.`;
  return errors;
}

/** The match config for a valid form. Call validateSetup first. */
export function toMatchConfig(form: SetupForm, info: SymbolInfo): MatchConfig {
  return defaultMatchConfig(info, {
    durationMs: form.durationMin * 60_000,
    startingBalance: parseAmount(form.balanceText),
    maxDrawdownPct: Number(form.drawdownText.trim()),
    fillModel: form.fillModel,
    commission: costValue(form.commissionText),
    slippageBps: costValue(form.slippageText),
  });
}

/**
 * Cuts a random session for the config (plan D2). If the file is too short for a full match at
 * top speed, the playable span is capped and the session is flagged as limited, as long as it
 * can still fill the timer at 1x.
 */
export function chooseSession(candles: Candle[], config: MatchConfig, rng?: () => number): Session {
  const spec = sessionSpecFor(config.durationMs);
  const minPlayable = Math.min(spec.playable, Math.ceil((config.durationMs / 1000) * CANDLES_PER_SEC_1X));
  return pickRandomSession(candles, { ...spec, minPlayable }, rng);
}

// ---------------------------------------------------------------------------------------------
// The last setup, remembered in this browser
// ---------------------------------------------------------------------------------------------

export const LAST_SETUP_KEY = 'qs-pvp:last-config';

export type LastSetup = {
  symbol: string;
  durationMin: DurationMin;
  balance: number;
  balanceCurrency: string;
  maxDrawdownPct: number;
  /** Plan M12; missing in setups saved before it. */
  fillModel?: FillModel;
  commission?: number;
  slippageBps?: number;
};

/** The execution part of a config, for LastSetup. */
const lastExecution = (config: MatchConfig): Pick<LastSetup, 'fillModel' | 'commission' | 'slippageBps'> => ({
  fillModel: config.fillModel ?? 'close',
  commission: config.commission ?? 0,
  slippageBps: config.slippageBps ?? 0,
});

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

function browserStorage(): StorageLike | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function loadLastSetup(storage: StorageLike | null = browserStorage()): LastSetup | null {
  try {
    const v: unknown = JSON.parse(storage?.getItem(LAST_SETUP_KEY) ?? 'null');
    if (typeof v !== 'object' || v === null) return null;
    const o = v as Record<string, unknown>;
    const ok =
      typeof o.symbol === 'string' &&
      typeof o.balanceCurrency === 'string' &&
      Number.isFinite(o.balance) &&
      Number.isFinite(o.maxDrawdownPct) &&
      (DURATION_OPTIONS_MIN as readonly unknown[]).includes(o.durationMin);
    if (!ok) return null;
    const last = o as unknown as LastSetup;
    // Optional M12 fields: anything malformed falls back to the default.
    return {
      ...last,
      fillModel: o.fillModel === 'next_open' ? 'next_open' : 'close',
      commission: Number.isFinite(o.commission) && (o.commission as number) >= 0 ? (o.commission as number) : 0,
      slippageBps: Number.isFinite(o.slippageBps) && (o.slippageBps as number) >= 0 ? (o.slippageBps as number) : 0,
    };
  } catch {
    return null;
  }
}

export function saveLastSetup(config: MatchConfig, storage: StorageLike | null = browserStorage()): boolean {
  const last: LastSetup = {
    symbol: config.symbol,
    durationMin: (config.durationMs / 60_000) as DurationMin,
    balance: config.startingBalance,
    balanceCurrency: config.currency,
    maxDrawdownPct: config.maxDrawdownPct,
    ...lastExecution(config),
  };
  try {
    storage?.setItem(LAST_SETUP_KEY, JSON.stringify(last));
  } catch {
    return false;
  }
  if (storage) emitLocalChange({ kind: 'profile' });
  return Boolean(storage);
}

/**
 * Setup defaults from the /practice query string: `?from=<result id>` repeats a saved match's
 * settings, `?symbol=` only picks the symbol (keeping the remembered settings). Anything unknown
 * falls back to `last`. `config` is the saved result's config, looked up by the caller.
 */
export function setupFromQuery(search: string, last: LastSetup | null, findConfig: (id: string) => MatchConfig | null): LastSetup | null {
  const q = new URLSearchParams(search);
  const from = q.get('from');
  const config = from ? findConfig(from) : null;
  if (config) {
    const minutes = config.durationMs / 60_000;
    return {
      symbol: config.symbol,
      durationMin: ((DURATION_OPTIONS_MIN as readonly number[]).includes(minutes) ? minutes : DEFAULT_DURATION_MIN) as DurationMin,
      balance: config.startingBalance,
      balanceCurrency: config.currency,
      maxDrawdownPct: config.maxDrawdownPct,
      ...lastExecution(config),
    };
  }
  const symbol = q.get('symbol')?.trim();
  if (!symbol) return last;
  // A different symbol keeps the remembered time and drawdown; the balance follows the new
  // symbol's currency unless it is the same currency as before (defaultForm checks that).
  if (last) return { ...last, symbol, balanceCurrency: last.symbol === symbol ? last.balanceCurrency : '' };
  return { symbol, durationMin: DEFAULT_DURATION_MIN, balance: 0, balanceCurrency: '', maxDrawdownPct: DEFAULT_MAX_DRAWDOWN_PCT };
}
