import { APP_SUBTITLE } from '@/lib/config';
import { cn } from '@/lib/utils';

/** "QuantSynthica PvP" with "PvP" in the accent colour, plus the brand subtitle (DESIGN.md §5). */
export function Wordmark({ showSubtitle = true, className }: { showSubtitle?: boolean; className?: string }) {
  return (
    <span className={cn('flex flex-col leading-tight', className)}>
      <span className="font-bold text-[1rem] tracking-tight text-white">
        QuantSynthica <span className="text-blue-400">PvP</span>
      </span>
      {showSubtitle && (
        <span className="text-[9px] uppercase tracking-[0.14em] font-semibold text-slate-400">{APP_SUBTITLE}</span>
      )}
    </span>
  );
}
