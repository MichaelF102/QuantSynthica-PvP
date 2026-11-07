import Link from 'next/link';
import { Badge, TBody, THead, Table, Td, Th, Tr } from '@/components/ui';
import { fmtPct, shortSymbol } from '@/lib/format';
import type { SymbolRow } from '@/lib/progress';
import { cn } from '@/lib/utils';

const tone = (v: number) => (v > 0 ? 'text-emerald-400' : v < 0 ? 'text-rose-400' : 'text-slate-300');

/** Per-symbol results, best average return first (plan M13 P5). */
export function SymbolTable({ rows }: { rows: SymbolRow[] }) {
  return (
    <Table caption="Results by symbol, best average return first">
      <THead>
        <Th>Symbol</Th>
        <Th numeric>Matches</Th>
        <Th numeric>Avg return</Th>
        <Th numeric>Best</Th>
        <Th numeric>Worst</Th>
        <Th numeric>Trade win rate</Th>
        <Th numeric>Stop-outs</Th>
        <Th numeric>
          <span className="sr-only">Actions</span>
        </Th>
      </THead>
      <TBody>
        {rows.map((r) => (
          <Tr key={r.symbol}>
            <Td>
              <span className="flex items-center gap-2">
                <span className="font-mono text-white" title={r.name}>
                  {shortSymbol(r.symbol)}
                </span>
                {r.tag && <Badge tone={r.tag === 'best' ? 'emerald' : 'rose'}>{r.tag === 'best' ? 'Best' : 'Worst'}</Badge>}
              </span>
            </Td>
            <Td numeric>{r.matches}</Td>
            <Td numeric className={cn('font-bold', tone(r.avgReturn))}>
              {fmtPct(r.avgReturn)}
            </Td>
            <Td numeric className={tone(r.bestReturn)}>
              {fmtPct(r.bestReturn)}
            </Td>
            <Td numeric className={tone(r.worstReturn)}>
              {fmtPct(r.worstReturn)}
            </Td>
            <Td numeric>{fmtPct(r.tradeWinRate, 1, false)}</Td>
            <Td numeric className={r.stopOuts ? 'text-amber-400' : undefined}>
              {r.stopOuts}
            </Td>
            <Td numeric>
              <Link href={`/practice?symbol=${encodeURIComponent(r.symbol)}`} className="text-[11px] text-blue-400 hover:text-blue-300 rounded focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500/70">
                Practice
              </Link>
            </Td>
          </Tr>
        ))}
      </TBody>
    </Table>
  );
}
