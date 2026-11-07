'use client';

import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ListChecks } from 'lucide-react';
import { pnlClass } from '@/components/trade/PositionsTable';
import { Badge, EmptyState, TBody, THead, Table, Td, Th } from '@/components/ui';
import { fmtMoney, fmtPct, fmtPrice, fmtSignedMoney, fmtSignedPrice, fmtSpan, fmtUnits } from '@/lib/format';
import { nextSort, sortRows, tableTime, tradeRows, type SortDir, type SortKey } from '@/lib/tradeTable';
import type { Trade } from '@/lib/types';
import { cn } from '@/lib/utils';

type Col = { key: SortKey; label: string; numeric?: boolean };
const COLS: Col[] = [
  { key: 'n', label: '#' },
  { key: 'side', label: 'Side' },
  { key: 'units', label: 'Units', numeric: true },
  { key: 'notional', label: 'Notional', numeric: true },
  { key: 'entry', label: 'Entry', numeric: true },
  { key: 'exit', label: 'Exit', numeric: true },
  { key: 'move', label: 'Move', numeric: true },
  { key: 'pnl', label: 'P&L', numeric: true },
  { key: 'pnlPct', label: 'P&L %', numeric: true },
  { key: 'openedAt', label: 'Opened' },
  { key: 'closedAt', label: 'Closed' },
  { key: 'heldSec', label: 'Held', numeric: true },
];

type Props = {
  trades: Trade[];
  currency: string;
  priceDecimals: number;
  lotStep: number;
  sessionStart: number;
  activeId: string | null;
  onActivate: (id: string | null) => void;
};

/** Closed trades (DESIGN.md §7.7). Sortable; hovering or choosing a row highlights it on both charts. */
export function TradeList({ trades, currency, priceDecimals, lotStep, sessionStart, activeId, onActivate }: Props) {
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: 'n', dir: 'asc' });
  const [pinned, setPinned] = useState<string | null>(null);
  const rows = useMemo(() => sortRows(tradeRows(trades), sort.key, sort.dir), [trades, sort]);
  if (trades.length === 0) return <EmptyState icon={ListChecks} title="No trades this match" hint="Closed trades are listed here with their entry, exit and P&L." />;

  const pin = (id: string) => {
    const next = pinned === id ? null : id;
    setPinned(next);
    onActivate(next);
  };

  return (
    <Table caption="Closed trades. Times are UTC; the date is shown only when it differs from the session start.">
      <THead>
        {COLS.map((c) => {
          const on = sort.key === c.key;
          return (
            <Th key={c.key} numeric={c.numeric} aria-sort={on ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'} className="whitespace-nowrap">
              <button
                type="button"
                onClick={() => setSort((s) => nextSort(s, c.key))}
                className={cn('inline-flex items-center gap-0.5 uppercase tracking-wider rounded hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500/70', on && 'text-slate-200')}
              >
                {c.label}
                {on && (sort.dir === 'asc' ? <ArrowUp className="w-3 h-3" aria-hidden /> : <ArrowDown className="w-3 h-3" aria-hidden />)}
              </button>
            </Th>
          );
        })}
      </THead>
      <TBody>
        {rows.map((t) => {
          const on = activeId === t.id;
          return (
            <tr
              key={t.id}
              onMouseEnter={() => onActivate(t.id)}
              onMouseLeave={() => onActivate(pinned)}
              className={cn('transition-colors', on ? 'bg-blue-500/10' : 'hover:bg-slate-800/30')}
            >
              <Td className="text-center">
                <button
                  type="button"
                  aria-pressed={pinned === t.id}
                  aria-label={`Show trade ${t.n} on the charts`}
                  onClick={() => pin(t.id)}
                  onFocus={() => onActivate(t.id)}
                  onBlur={() => onActivate(pinned)}
                  className={cn('min-w-6 rounded px-1 font-mono text-[11px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500/70', pinned === t.id ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white')}
                >
                  {t.n}
                </button>
              </Td>
              <Td>
                <Badge tone={t.side === 'buy' ? 'emerald' : 'rose'}>{t.side === 'buy' ? 'Long' : 'Short'}</Badge>
              </Td>
              <Td numeric>{fmtUnits(t.units, lotStep)}</Td>
              <Td numeric className="text-slate-300">{fmtMoney(t.notional, currency)}</Td>
              <Td numeric>{fmtPrice(t.entry, priceDecimals)}</Td>
              <Td numeric>{fmtPrice(t.exit, priceDecimals)}</Td>
              <Td numeric className="text-slate-300">{fmtSignedPrice(t.move, priceDecimals)}</Td>
              <Td numeric className={cn('font-bold', pnlClass(t.pnl))}>{fmtSignedMoney(t.pnl, currency)}</Td>
              <Td numeric className={pnlClass(t.pnl)}>{fmtPct(t.pnlPct, 2)}</Td>
              <Td className="font-mono text-slate-400 whitespace-nowrap">{tableTime(t.openedAt, sessionStart)}</Td>
              <Td className="font-mono text-slate-400 whitespace-nowrap">{tableTime(t.closedAt, sessionStart)}</Td>
              <Td numeric className="text-slate-300">{fmtSpan(t.heldSec)}</Td>
            </tr>
          );
        })}
      </TBody>
    </Table>
  );
}
