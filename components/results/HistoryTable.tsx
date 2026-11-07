import Link from 'next/link';
import { ArrowRight, Trash2 } from 'lucide-react';
import { pnlClass } from '@/components/trade/PositionsTable';
import { Badge, Button, TBody, THead, Table, Td, Th, Tr } from '@/components/ui';
import { fmtDuration, fmtPct, fmtPlayedAt, fmtSignedMoney, shortSymbol } from '@/lib/format';
import { END_REASON_TEXT, type MatchResult } from '@/lib/results';
import { cn } from '@/lib/utils';

const REASON_TONE = { timer: 'blue', user: 'slate', drawdown: 'rose', data_end: 'amber' } as const;

/** Saved matches, newest first. */
export function HistoryTable({ results, onDelete }: { results: MatchResult[]; onDelete?: (r: MatchResult) => void }) {
  return (
    <Table caption="Saved match results, newest first">
      <THead>
        <Th>Played</Th>
        <Th>Symbol</Th>
        <Th numeric>Time</Th>
        <Th numeric>Trades</Th>
        <Th numeric>Win rate</Th>
        <Th numeric>Return</Th>
        <Th numeric>P&amp;L</Th>
        <Th>Ended by</Th>
        <Th numeric>
          <span className="sr-only">Actions</span>
        </Th>
      </THead>
      <TBody>
        {results.map((r) => (
          <Tr key={r.id}>
            <Td className="text-slate-300 whitespace-nowrap">{fmtPlayedAt(r.playedAt)}</Td>
            <Td className="font-mono">{shortSymbol(r.symbol)}</Td>
            <Td numeric className="text-slate-300">
              {fmtDuration(r.stats.durationMs)}
            </Td>
            <Td numeric className="text-slate-300">
              {r.stats.trades}
            </Td>
            <Td numeric className={r.stats.winRate === null ? 'text-faint' : 'text-slate-300'}>
              {fmtPct(r.stats.winRate, 1, false)}
            </Td>
            <Td numeric className={cn('font-bold', pnlClass(r.stats.returnPct))}>
              {fmtPct(r.stats.returnPct)}
            </Td>
            <Td numeric className={cn('font-bold', pnlClass(r.stats.pnl))}>
              {fmtSignedMoney(r.stats.pnl, r.currency)}
            </Td>
            <Td>
              <Badge tone={REASON_TONE[r.endReason]} className="whitespace-nowrap">
                {END_REASON_TEXT[r.endReason]}
              </Badge>
            </Td>
            <Td numeric>
              <div className="flex items-center justify-end gap-1">
                <Link href={`/results/${r.id}`} className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-400 hover:text-blue-300 rounded px-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500/70" aria-label={`Review ${shortSymbol(r.symbol)} match played ${fmtPlayedAt(r.playedAt)}`}>
                  Review <ArrowRight className="w-3 h-3" aria-hidden />
                </Link>
                {onDelete && (
                  <Button variant="icon" aria-label={`Delete ${shortSymbol(r.symbol)} match played ${fmtPlayedAt(r.playedAt)}`} onClick={() => onDelete(r)}>
                    <Trash2 className="w-3.5 h-3.5" aria-hidden />
                  </Button>
                )}
              </div>
            </Td>
          </Tr>
        ))}
      </TBody>
    </Table>
  );
}
