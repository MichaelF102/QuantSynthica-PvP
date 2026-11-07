import { Swords } from 'lucide-react';
import { Panel } from '@/components/ui';
import { fmtPct } from '@/lib/format';
import type { MatchResult } from '@/lib/results';
import { cn } from '@/lib/utils';

/** Plan M13 C5: your result next to the score that came in the challenge link. */
export function ChallengeCompare({ result }: { result: MatchResult }) {
  const c = result.challenge;
  if (!c) return null;
  const you = result.stats;
  const diff = Math.round(you.returnPct * 100) - Math.round(c.score.returnPct * 100);
  const verdict = diff > 0 ? `You beat ${c.from}` : diff < 0 ? `${c.from} wins this one` : 'Dead heat';
  const rows: [string, string, string, number][] = [
    ['Return', fmtPct(you.returnPct), fmtPct(c.score.returnPct), you.returnPct - c.score.returnPct],
    ['Closed trades', String(you.trades), String(c.score.trades), 0],
    ['Trade win rate', fmtPct(you.winRate, 1, false), fmtPct(c.score.winRate, 1, false), 0],
    ['Max drawdown', fmtPct(you.maxDrawdownPct, 2, false), fmtPct(c.score.maxDrawdownPct, 2, false), c.score.maxDrawdownPct - you.maxDrawdownPct],
  ];
  return (
    <Panel title="Challenge" description={`Same session as ${c.from}. Their numbers come from the link and are not verified.`} icon={Swords}>
      <p className={cn('text-lg font-bold', diff > 0 ? 'text-emerald-400' : diff < 0 ? 'text-rose-400' : 'text-white')}>{verdict}</p>
      <table className="mt-2 w-full text-xs">
        <caption className="sr-only">Your result and the challenger&apos;s</caption>
        <thead>
          <tr className="text-[10px] uppercase tracking-wider text-slate-400">
            <th scope="col" className="text-left font-medium py-1" />
            <th scope="col" className="text-right font-medium py-1">You</th>
            <th scope="col" className="text-right font-medium py-1">{c.from} (from the link)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([k, a, b, edge]) => (
            <tr key={k} className="border-t border-slate-800">
              <th scope="row" className="text-left font-normal text-slate-300 py-1.5">
                {k}
              </th>
              <td className={cn('text-right font-mono py-1.5', edge > 0 ? 'text-emerald-400 font-bold' : 'text-slate-200')}>{a}</td>
              <td className={cn('text-right font-mono py-1.5', edge < 0 ? 'text-emerald-400 font-bold' : 'text-slate-200')}>{b}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}
