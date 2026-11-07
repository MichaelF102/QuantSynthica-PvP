import type { CSSProperties } from 'react';
import { classifyMarket, type Market } from '@/lib/landing/markets';
import { cn } from '@/lib/utils';
import { TYPE_DOT } from './marketColors';

/** One market: symbol, name, type, region and currency. Never a price. */
export function MarketCard({ market, index, selected, onSelect }: { market: Market; index: number; selected: boolean; onSelect: () => void }) {
  const c = classifyMarket(market);
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      style={{ '--i': index } as CSSProperties}
      className={cn(
        'lp-card text-left rounded-xl border px-4 py-3.5 transition-colors duration-200',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500/70',
        selected ? 'border-blue-600 bg-blue-600/15' : 'border-slate-800/90 bg-[#0b1222]/95 hover:border-slate-700',
      )}
    >
      <span className="block font-mono text-sm text-blue-400 truncate">{market.symbol}</span>
      <span className="block mt-1 text-sm font-semibold text-white truncate">{market.name}</span>
      <span className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="w-1.5 h-1.5 rounded-full" style={{ background: TYPE_DOT[c.type] }} />
          {c.type}
        </span>
        <span>· {c.region}</span>
        <span className="font-mono">· {market.currency}</span>
      </span>
    </button>
  );
}
