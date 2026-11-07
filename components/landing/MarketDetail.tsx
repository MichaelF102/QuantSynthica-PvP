import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { buttonClasses } from '@/components/ui';
import { dataRangeLabel, lotStepLabel, practiceHref, sessionLabel, startingBalanceLabel, type Market } from '@/lib/landing/markets';

/** The practice setup for the selected market, or a prompt to pick one. */
export function MarketDetail({ market }: { market: Market | null }) {
  if (!market) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-slate-400">Select a market to see its practice setup.</p>
        <span aria-disabled="true" className="inline-flex px-4 py-2 rounded-lg border border-slate-800 text-xs text-faint">
          Choose a market first
        </span>
      </div>
    );
  }

  const rows: [string, string, boolean][] = [
    ['Starting balance', startingBalanceLabel(market.currency), true],
    ['Session', sessionLabel(), false],
    ['Lot step', lotStepLabel(market), true],
    ['Data', dataRangeLabel(market), true],
  ];

  return (
    <div key={market.symbol} className="lp-detail flex flex-wrap items-center justify-between gap-6">
      <div className="min-w-0">
        <p className="font-mono text-sm text-blue-400">{market.symbol}</p>
        <p className="mt-1 text-lg font-semibold text-white">{market.name}</p>
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs">
          {rows.map(([k, v, mono]) => (
            <div key={k} className="contents">
              <dt className="text-faint">{k}</dt>
              <dd className={mono ? 'font-mono text-slate-200' : 'text-slate-200'}>{v}</dd>
            </div>
          ))}
        </dl>
      </div>
      <Link href={practiceHref(market.symbol)} className={buttonClasses('primary', 'px-5 py-2.5 text-sm rounded-full group')}>
        Start practice with {market.name}
        <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
      </Link>
    </div>
  );
}
