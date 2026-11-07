import { fmtDateTime, fmtPct, fmtPrice, fmtSignedPrice, fmtVolume } from '@/lib/format';
import type { BarSummary } from '@/lib/chartData';
import { cn } from '@/lib/utils';

/** O/H/L/C, change and volume of the hovered bar (or the latest bar), in mono. */
export function OhlcReadout({ summary, priceDecimals, showVolume, timeFormatter = fmtDateTime }: { summary: BarSummary | null; priceDecimals: number; showVolume: boolean; timeFormatter?: (t: number) => string }) {
  if (!summary) return <div className="h-5 text-[11px] font-mono text-faint">—</div>;
  const { bar, change, changePct } = summary;
  const tone = change === null || change === 0 ? 'text-slate-300' : change > 0 ? 'text-emerald-400' : 'text-rose-400';
  const item = (k: string, v: string) => (
    <span className="whitespace-nowrap">
      <span className="text-faint">{k}</span> <span className={tone}>{v}</span>
    </span>
  );
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] font-mono" aria-live="off">
      <span className="text-slate-400 whitespace-nowrap">{timeFormatter(bar.time)}</span>
      {item('O', fmtPrice(bar.open, priceDecimals))}
      {item('H', fmtPrice(bar.high, priceDecimals))}
      {item('L', fmtPrice(bar.low, priceDecimals))}
      {item('C', fmtPrice(bar.close, priceDecimals))}
      <span className={cn('whitespace-nowrap', tone)}>
        {fmtSignedPrice(change, priceDecimals)} ({fmtPct(changePct)})
      </span>
      {showVolume && item('Vol', fmtVolume(bar.volume))}
    </div>
  );
}
