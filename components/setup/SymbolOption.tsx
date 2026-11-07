import { Badge } from '@/components/ui';
import { shortSymbol } from '@/lib/format';
import { classifyMarket } from '@/lib/landing/markets';
import type { SymbolInfo } from '@/lib/types';
import { cn } from '@/lib/utils';

/** A playable symbol: one radio in the picker's radio group. */
export function SymbolOption({ info, checked, focusable, onSelect }: { info: SymbolInfo; checked: boolean; focusable: boolean; onSelect: () => void }) {
  const { region } = classifyMarket(info);
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      data-symbol={info.symbol}
      tabIndex={focusable ? 0 : -1}
      onClick={onSelect}
      className={cn(
        'w-full flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left transition-colors',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500/70',
        checked ? 'border-blue-500/60 bg-blue-500/10' : 'border-slate-800 bg-slate-900/40 hover:bg-slate-800/50',
      )}
    >
      <span className="min-w-0">
        <span className="block text-xs font-mono font-semibold text-white">{shortSymbol(info.symbol)}</span>
        <span className="block text-[11px] text-slate-400 truncate">{info.name}</span>
      </span>
      <span className="flex items-center gap-2 shrink-0">
        <span className="text-[10px] text-faint">{region}</span>
        <Badge tone={checked ? 'blue' : 'slate'}>{info.currency}</Badge>
      </span>
    </button>
  );
}
