import { shortSymbol } from '@/lib/format';
import type { CatalogEntry } from '@/lib/catalog';
import { cn } from '@/lib/utils';

/** A reference ticker without candles. It cannot start a match; choosing it explains how to add data. */
export function NoDataOption({ entry, open, hintId, onToggle }: { entry: CatalogEntry; open: boolean; hintId: string; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-controls={hintId}
      onClick={onToggle}
      className={cn(
        'w-full flex items-center justify-between gap-2 rounded-lg border border-dashed px-3 py-2 text-left transition-colors',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500/70',
        open ? 'border-amber-500/40 bg-amber-500/5' : 'border-slate-800 hover:bg-slate-800/30',
      )}
    >
      <span className="min-w-0">
        <span className="block text-xs font-mono font-semibold text-slate-300">{shortSymbol(entry.symbol)}</span>
        <span className="block text-[11px] text-faint truncate">{entry.name}</span>
      </span>
      <span className="flex items-center gap-2 shrink-0">
        {entry.exchange && <span className="text-[10px] font-mono text-faint">{entry.exchange}</span>}
        <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-faint">No data</span>
      </span>
    </button>
  );
}
