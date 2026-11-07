import { notional } from './analysis';
import type { Trade } from './types';

// Rows, sorting and CSV export for the results trade table.

export type TradeRow = Trade & {
  n: number;
  notional: number;
  /** Exit minus entry, in price units (not signed by side). */
  move: number;
  /** P&L as a % of the entry notional. */
  pnlPct: number | null;
  heldSec: number;
};

export function tradeRows(trades: readonly Trade[]): TradeRow[] {
  return trades.map((t, i) => {
    const n = notional(t);
    return { ...t, n: i + 1, notional: n, move: t.exit - t.entry, pnlPct: n > 0 ? (t.pnl / n) * 100 : null, heldSec: Math.max(0, t.closedAt - t.openedAt) };
  });
}

export type SortKey = 'n' | 'side' | 'units' | 'notional' | 'entry' | 'exit' | 'move' | 'pnl' | 'pnlPct' | 'openedAt' | 'closedAt' | 'heldSec';
export type SortDir = 'asc' | 'desc';

export function sortRows(rows: readonly TradeRow[], key: SortKey, dir: SortDir): TradeRow[] {
  const k = (r: TradeRow) => (key === 'side' ? (r.side === 'buy' ? 0 : 1) : (r[key] ?? -Infinity));
  const s = dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => (k(a) - k(b)) * s || a.n - b.n);
}

/** Next sort state when a header is clicked: a new column starts descending (biggest first), except # and time. */
export function nextSort(cur: { key: SortKey; dir: SortDir }, key: SortKey): { key: SortKey; dir: SortDir } {
  if (cur.key === key) return { key, dir: cur.dir === 'asc' ? 'desc' : 'asc' };
  return { key, dir: key === 'n' || key === 'openedAt' || key === 'closedAt' ? 'asc' : 'desc' };
}

/** Time of day "HH:MM", with "MM-DD " in front when the day differs from `refDay` (UNIX s). */
export function tableTime(t: number, refDay: number): string {
  const iso = new Date(t * 1000).toISOString();
  const sameDay = iso.slice(0, 10) === new Date(refDay * 1000).toISOString().slice(0, 10);
  return `${sameDay ? '' : `${iso.slice(5, 10)} `}${iso.slice(11, 16)}`;
}

const csvCell = (v: string | number) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const iso = (t: number) => new Date(t * 1000).toISOString().replace('.000Z', 'Z');

/** The trade list as CSV: one header row, then one row per trade. Times are ISO 8601 UTC. */
export function tradesCsv(trades: readonly Trade[], meta: { symbol: string; currency: string }): string {
  const head = ['#', 'symbol', 'side', 'units', 'entry', 'exit', 'notional', `pnl_${meta.currency.toLowerCase()}`, 'pnl_pct', 'opened_utc', 'closed_utc', 'held_minutes'];
  const lines = tradeRows(trades).map((r) =>
    [r.n, meta.symbol, r.side === 'buy' ? 'long' : 'short', r.units, r.entry, r.exit, r.notional.toFixed(2), r.pnl.toFixed(2), r.pnlPct === null ? '' : r.pnlPct.toFixed(4), iso(r.openedAt), iso(r.closedAt), Math.round(r.heldSec / 60)].map(csvCell).join(','),
  );
  return [head.join(','), ...lines].join('\n') + '\n';
}

/** File name for the CSV, e.g. "NQ=F_2026-10-16_trades.csv" with unsafe characters replaced. */
export const csvFileName = (symbol: string, sessionStart: number) =>
  `${symbol.replace(/[^\w.-]+/g, '_')}_${new Date(sessionStart * 1000).toISOString().slice(0, 10)}_trades.csv`;
