import type { SymbolInfo } from './types';

// All numbers in the UI go through these helpers (CLAUDE.md §9). Non-numeric values return '—'.

export const DASH = '—';

export const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Rounds to `digits` and turns -0 into 0, so tiny negatives never print as "-0.00". */
const clean = (v: number, digits: number) => {
  const r = Number(v.toFixed(digits));
  return r === 0 ? 0 : r;
};

/** Money in the symbol's currency. Negative values put the sign before the symbol: -$1,234.00. */
export const fmtMoney = (v: unknown, currency: string): string => {
  if (!isNum(v)) return DASH;
  const n = clean(v, 2);
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  if (currency === 'INR') return `${sign}₹${abs.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `${sign}$${abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

/** Money with an explicit + for gains (P&L). */
export const fmtSignedMoney = (v: unknown, currency: string): string => {
  if (!isNum(v)) return DASH;
  return `${clean(v, 2) > 0 ? '+' : ''}${fmtMoney(v, currency)}`;
};

export const fmtPrice = (v: unknown, decimals = 2): string =>
  isNum(v) ? clean(v, decimals).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : DASH;

/** Price change with an explicit + (chart readout). */
export const fmtSignedPrice = (v: unknown, decimals = 2): string => {
  if (!isNum(v)) return DASH;
  return `${clean(v, decimals) > 0 ? '+' : ''}${fmtPrice(v, decimals)}`;
};

export const fmtPct = (v: unknown, digits = 2, signed = true): string => {
  if (!isNum(v)) return DASH;
  const n = clean(v, digits);
  return `${signed && n > 0 ? '+' : ''}${n.toFixed(digits)}%`;
};

export const fmtUnits = (v: unknown, lotStep: number): string =>
  isNum(v) ? v.toLocaleString('en-US', { maximumFractionDigits: lotStep < 1 ? 2 : 0 }) : DASH;

export const fmtTime = (unixSec: unknown): string =>
  isNum(unixSec) ? `${new Date(unixSec * 1000).toLocaleTimeString('en-GB', { timeZone: 'UTC', hour12: false })} UTC` : DASH;

/** "2026-10-06 13:30 UTC". Times are never shown without their zone (CLAUDE.md §9). */
export const fmtDateTime = (unixSec: unknown): string => {
  if (!isNum(unixSec)) return DASH;
  const iso = new Date(unixSec * 1000).toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
};

/** Timer as mm:ss. Negative clamps to 00:00. */
export const fmtDuration = (ms: unknown): string => {
  if (!isNum(ms)) return DASH;
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

/** Volume as a compact number: 12.7M, 154K, 980. */
export const fmtVolume = (v: unknown): string => {
  if (!isNum(v) || v < 0) return DASH;
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(v);
};

/** Short ticker for messages and badges: "NQ=F" -> "NQ", "^NSEI" -> "NSEI", "EURUSD=X" -> "EURUSD", "RELIANCE.NS" -> "RELIANCE". */
export const shortSymbol = (symbol: string): string => symbol.replace(/^\^/, '').replace(/=[FX]$/, '').replace(/\.(NS|BO)$/, '') || symbol;

export const priceDecimalsFor = (info: Pick<SymbolInfo, 'priceDecimals'> | null | undefined): number =>
  info && Number.isInteger(info.priceDecimals) && info.priceDecimals >= 0 ? info.priceDecimals : 2;

/** Plain ratio with 2 decimals (profit factor): 1.85. */
export const fmtRatio = (v: unknown): string => (isNum(v) ? clean(v, 2).toFixed(2) : DASH);

/** Profit factor: like fmtRatio, but a tiny positive value reads "<0.01" instead of a misleading "0.00". */
export const fmtProfitFactor = (v: unknown): string => (isNum(v) && v > 0 && v < 0.005 ? '<0.01' : fmtRatio(v));

/** Played-at time in UTC plus the viewer's local time: "2026-11-07 10:19 UTC (15:49 local)". */
export const fmtPlayedAtBoth = (ms: unknown): string => {
  if (!isNum(ms)) return DASH;
  const local = new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${fmtDateTime(Math.floor(ms / 1000))} (${local} local)`;
};

/** Market-time span in seconds: "45m", "2h 05m", "3d 4h". */
export const fmtSpan = (sec: unknown): string => {
  if (!isNum(sec) || sec < 0) return DASH;
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${String(m % 60).padStart(2, '0')}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
};

/** "4 Nov 2026, 10:42 GMT+5:30": when a match was played, in the viewer's local time with its zone. */
export const fmtPlayedAt = (ms: unknown): string =>
  isNum(ms) ? new Date(ms).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZoneName: 'short' }) : DASH;
