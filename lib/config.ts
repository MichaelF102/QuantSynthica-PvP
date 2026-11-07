export const APP_NAME = 'QuantSynthica PvP';
export const APP_SUBTITLE = 'PRACTICE ARENA';

export const DEFAULT_DURATION_MS = 10 * 60 * 1000;
export const DURATION_OPTIONS_MIN = [5, 10, 15, 30] as const;
export const DEFAULT_MAX_DRAWDOWN_PCT = 5;
export const MAX_DRAWDOWN_LIMITS = { min: 1, max: 50 } as const;

export const DEFAULT_BALANCE: Record<string, number> = { USD: 100_000, INR: 1_000_000 };
export const BALANCE_LIMITS = { min: 1_000, max: 10_000_000 } as const;

/** Plan M12 C6, C7: execution costs, off by default. */
export const COMMISSION_LIMITS = { min: 0, max: 10_000 } as const;
export const SLIPPAGE_BPS_LIMITS = { min: 0, max: 100 } as const;

export const SPEEDS = [1, 2, 5] as const;
export const TIMEFRAMES = ['1m', '5m', '15m', '1h', '1d'] as const;
export const DEFAULT_TIMEFRAME = '1m';

/** Replay rate: base (1m) candles revealed per real second at 1x. Plan decision D1, pending confirmation. */
export const CANDLES_PER_SEC_1X = 1;
/** Candles of chart history shown before trading starts. Plan decision D2, pending confirmation. */
export const HISTORY_CANDLES = 300;

/** PLACEHOLDER: support address shown in the landing footer. Replace before launch. */
export const CONTACT_EMAIL = 'contact@example.com';
