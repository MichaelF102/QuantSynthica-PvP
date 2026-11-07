'use client';

import { useState } from 'react';
import { ClipboardList, History, Layers, ListOrdered } from 'lucide-react';
import { Badge, Button, EmptyState, Panel, TBody, THead, Table, Tabs, Td, Th, Tr } from '@/components/ui';
import { costsOf, currentPrice, positionPnl } from '@/lib/engine';
import { fmtDateTime, fmtPrice, fmtSignedMoney, fmtUnits, priceDecimalsFor, shortSymbol } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { MatchState, SymbolInfo } from '@/lib/types';
import { useMatchStore } from '@/store/matchStore';

type Tab = 'positions' | 'orders' | 'history';

export const pnlClass = (v: number) => (v > 0 ? 'text-emerald-400' : v < 0 ? 'text-rose-400' : 'text-slate-300');

type PositionsTableViewProps = {
  match: MatchState | null;
  info: Pick<SymbolInfo, 'symbol' | 'priceDecimals'> | null;
  onClose: () => void;
  /** Closing-time cell and its header; defaults to UTC wall-clock time. */
  closedAt?: { header: string; format: (t: number) => string };
  closeDisabled?: boolean;
  ordersHint?: string;
  /** Plan M12: cancel the order waiting for the next open. */
  onCancelQueued?: () => void;
};

const UTC_CLOSED = { header: 'Closed (UTC)', format: (t: number) => fmtDateTime(t).replace(' UTC', '') };

/** Practice: the table wired to the match store. */
export function PositionsTable() {
  const match = useMatchStore((s) => s.match);
  const info = useMatchStore((s) => s.info);
  const closePos = useMatchStore((s) => s.closePosition);
  const cancelQueued = useMatchStore((s) => s.cancelQueued);
  return <PositionsTableView match={match} info={info} onClose={closePos} onCancelQueued={cancelQueued} />;
}

/** Positions / Orders / History (CLAUDE.md §6 Layout). */
export function PositionsTableView({ match, info, onClose: closePos, closedAt = UTC_CLOSED, closeDisabled = false, ordersHint, onCancelQueued }: PositionsTableViewProps) {
  const [tab, setTab] = useState<Tab>('positions');

  if (!match || !info) return null;
  const { currency, lotStep } = match.config;
  const decimals = priceDecimalsFor(info);
  const trades = [...match.trades].reverse();
  const nextOpen = costsOf(match.config).fillModel === 'next_open';
  const hint = ordersHint ?? (nextOpen ? 'Market orders wait here until the next candle opens.' : 'Market orders fill straight away. Stops and targets are on the position.');
  const queued = match.queued;

  return (
    <Panel title="Account" description="Open positions, pending orders and closed trades" icon={ClipboardList}>
      <Tabs<Tab>
        label="Account tables"
        idPrefix="acct"
        value={tab}
        onChange={setTab}
        items={[
          { value: 'positions', label: 'Positions', icon: Layers, count: match.positions.length },
          { value: 'orders', label: 'Orders', icon: ListOrdered, count: queued ? 1 : 0 },
          { value: 'history', label: 'History', icon: History, count: match.trades.length },
        ]}
      />
      <div role="tabpanel" id={`acct-panel-${tab}`} aria-labelledby={`acct-tab-${tab}`} className="mt-2">
        {tab === 'positions' &&
          (match.positions.length === 0 ? (
            <EmptyState icon={Layers} title="No open positions" hint="Use Buy or Sell to open one." />
          ) : (
            <Table caption="Open positions">
              <THead>
                <Th>Symbol</Th>
                <Th>Side</Th>
                <Th numeric>Units</Th>
                <Th numeric>Avg entry</Th>
                <Th numeric>Current</Th>
                <Th numeric>Stop</Th>
                <Th numeric>Target</Th>
                <Th numeric>Unrealized</Th>
                <Th numeric>
                  <span className="sr-only">Actions</span>
                </Th>
              </THead>
              <TBody>
                {match.positions.map((p) => {
                  const pnl = positionPnl(match, p);
                  return (
                    <Tr key={p.symbol}>
                      <Td className="font-mono">{shortSymbol(p.symbol)}</Td>
                      <Td>
                        <Badge tone={p.units > 0 ? 'emerald' : 'rose'}>{p.units > 0 ? 'Long' : 'Short'}</Badge>
                      </Td>
                      <Td numeric>{fmtUnits(Math.abs(p.units), lotStep)}</Td>
                      <Td numeric>{fmtPrice(p.avgEntry, decimals)}</Td>
                      <Td numeric>{fmtPrice(currentPrice(match), decimals)}</Td>
                      <Td numeric className="text-rose-300">{fmtPrice(p.stopLoss ?? null, decimals)}</Td>
                      <Td numeric className="text-emerald-300">{fmtPrice(p.takeProfit ?? null, decimals)}</Td>
                      <Td numeric className={cn('font-bold', pnlClass(pnl))}>
                        {fmtSignedMoney(pnl, currency)}
                      </Td>
                      <Td numeric>
                        <Button variant="secondary" disabled={match.status === 'ended' || closeDisabled || Boolean(queued)} onClick={closePos}>
                          Close
                        </Button>
                      </Td>
                    </Tr>
                  );
                })}
              </TBody>
            </Table>
          ))}

        {tab === 'orders' &&
          (!queued ? (
            <EmptyState icon={ListOrdered} title="No pending orders" hint={hint} />
          ) : (
            <Table caption="Pending orders">
              <THead>
                <Th>Placed</Th>
                <Th>Side</Th>
                <Th>Type</Th>
                <Th numeric>Units</Th>
                <Th numeric>
                  <span className="sr-only">Actions</span>
                </Th>
              </THead>
              <TBody>
                <Tr>
                  <Td className="font-mono text-slate-400 whitespace-nowrap">{closedAt.format(queued.placedAt)}</Td>
                  <Td>
                    <Badge tone={queued.side === 'buy' ? 'emerald' : 'rose'}>{queued.side === 'buy' ? 'Buy' : 'Sell'}</Badge>
                  </Td>
                  <Td className="text-slate-300">{queued.close ? 'Close at next open' : 'Market at next open'}</Td>
                  <Td numeric>{queued.close ? 'All' : fmtUnits(queued.units, lotStep)}</Td>
                  <Td numeric>
                    {onCancelQueued && (
                      <Button variant="secondary" disabled={match.status === 'ended' || closeDisabled} onClick={onCancelQueued}>
                        Cancel
                      </Button>
                    )}
                  </Td>
                </Tr>
              </TBody>
            </Table>
          ))}

        {tab === 'history' &&
          (trades.length === 0 ? (
            <EmptyState icon={History} title="No closed trades yet" hint="Trades appear here when you reduce or close a position." />
          ) : (
            <Table caption="Closed trades, newest first">
              <THead>
                <Th>{closedAt.header}</Th>
                <Th>Side</Th>
                <Th numeric>Units</Th>
                <Th numeric>Entry</Th>
                <Th numeric>Exit</Th>
                <Th numeric>P&amp;L</Th>
              </THead>
              <TBody>
                {trades.map((t) => (
                  <Tr key={t.id}>
                    <Td className="font-mono text-slate-400 whitespace-nowrap">{closedAt.format(t.closedAt)}</Td>
                    <Td>
                      <Badge tone={t.side === 'buy' ? 'emerald' : 'rose'}>{t.side === 'buy' ? 'Long' : 'Short'}</Badge>
                    </Td>
                    <Td numeric>{fmtUnits(t.units, lotStep)}</Td>
                    <Td numeric>{fmtPrice(t.entry, decimals)}</Td>
                    <Td numeric>{fmtPrice(t.exit, decimals)}</Td>
                    <Td numeric className={cn('font-bold', pnlClass(t.pnl))}>
                      {fmtSignedMoney(t.pnl, currency)}
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          ))}
      </div>
    </Panel>
  );
}
