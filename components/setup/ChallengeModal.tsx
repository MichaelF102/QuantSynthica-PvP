'use client';

import Link from 'next/link';
import { Swords } from 'lucide-react';
import { Banner, Button, buttonClasses } from '@/components/ui';
import { Dialog } from '@/components/ui/Dialog';
import type { Challenge } from '@/lib/challenge';
import { fmtDateTime, fmtMoney, fmtPct, shortSymbol } from '@/lib/format';
import { executionSummary } from '@/lib/orders';
import type { SymbolInfo } from '@/lib/types';

type ChallengeModalProps = {
  challenge: Challenge;
  /** null when the symbol is not playable on this site. */
  info: SymbolInfo | null;
  busy: boolean;
  error: string | null;
  onAccept: () => void;
  /** Leave the challenge and set up a normal match. */
  onDecline: () => void;
};

/** Plan M13 C2, C3: the score to beat and the rules, before playing the same session. */
export function ChallengeModal({ challenge: c, info, busy, error, onAccept, onDecline }: ChallengeModalProps) {
  const currency = info?.currency ?? 'USD';
  const exec = executionSummary({ ...c, currency });
  const rules: [string, string][] = [
    ['Symbol', info ? `${shortSymbol(c.symbol)} · ${info.name}` : shortSymbol(c.symbol)],
    ['Session starts', fmtDateTime(c.start)],
    ['Time limit', `${c.durationMin} min`],
    ['Starting balance', fmtMoney(c.balance, currency)],
    ['Max drawdown', fmtPct(c.maxDrawdownPct, c.maxDrawdownPct % 1 ? 1 : 0, false)],
    ['Orders fill at', exec.fills],
    ['Commission', exec.commission],
    ['Slippage', exec.slippage],
  ];
  return (
    <Dialog open title={`${c.from} challenged you`} className="max-w-lg">
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-lg border border-blue-500/30 bg-blue-500/10 p-3">
          <Swords className="w-5 h-5 text-blue-300 shrink-0" aria-hidden />
          <div className="text-xs text-slate-200">
            Score to beat:{' '}
            <span className={`font-mono font-bold ${c.score.returnPct > 0 ? 'text-emerald-400' : c.score.returnPct < 0 ? 'text-rose-400' : 'text-white'}`}>{fmtPct(c.score.returnPct)}</span> with {c.score.trades} closed trade
            {c.score.trades === 1 ? '' : 's'}, max drawdown <span className="font-mono">{fmtPct(c.score.maxDrawdownPct, 2, false)}</span>.
            <span className="block text-[11px] text-faint">From the link, not verified. You play the same session and rules, on your own.</span>
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-2">
          {rules.map(([k, v]) => (
            <div key={k} className="rounded-lg border border-slate-800 bg-[#0b1120]/60 px-3 py-2 min-w-0">
              <dt className="text-[10px] text-slate-400">{k}</dt>
              <dd className="text-xs font-mono font-semibold text-white truncate" title={v}>
                {v}
              </dd>
            </div>
          ))}
        </dl>
        {!info && <Banner kind="warning">{shortSymbol(c.symbol)} has no market data on this site, so this challenge cannot be played here.</Banner>}
        {error && <Banner kind="error">{error}</Banner>}
        <div className="flex items-center justify-between gap-2">
          <Link href="/" className={buttonClasses('secondary')}>
            Back home
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="text" onClick={onDecline}>
              {error ? 'Play a random session instead' : 'Set up my own match'}
            </Button>
            <Button onClick={onAccept} disabled={!info || busy || Boolean(error)} className="px-5 py-2.5">
              {busy ? 'Loading session…' : 'Accept challenge'}
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
