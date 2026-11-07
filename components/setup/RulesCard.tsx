'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui';
import { Dialog } from '@/components/ui/Dialog';
import { fmtDateTime, fmtMoney, fmtPct, shortSymbol } from '@/lib/format';
import { executionSummary } from '@/lib/orders';
import type { MatchConfig } from '@/lib/types';

export const COUNTDOWN_FROM = 3;

type RulesCardProps = {
  config: MatchConfig;
  /** Time of the candle the match starts on. */
  startTime: number;
  limitedData: boolean;
  onGo: () => void;
};

/**
 * Match rules and a 3-2-1 countdown before the replay starts (plan D8). The match stays idle,
 * so the timer does not run during the countdown. Skip starts at once.
 */
export function RulesCard({ config, startTime, limitedData, onGo }: RulesCardProps) {
  const [n, setN] = useState(COUNTDOWN_FROM);
  const skipRef = useRef<HTMLButtonElement>(null);
  const onGoRef = useRef(onGo);
  onGoRef.current = onGo;

  useEffect(() => {
    if (n <= 0) {
      onGoRef.current();
      return;
    }
    const t = setTimeout(() => setN((x) => x - 1), 1000);
    return () => clearTimeout(t);
  }, [n]);

  const exec = executionSummary(config);
  const rules: [string, string, string?][] = [
    ['Symbol', shortSymbol(config.symbol)],
    ['Interval', config.interval],
    ['Time limit', `${config.durationMs / 60_000} min`],
    ['Starting balance', fmtMoney(config.startingBalance, config.currency)],
    ['Max drawdown', fmtPct(config.maxDrawdownPct, config.maxDrawdownPct % 1 ? 1 : 0, false), 'text-amber-400'],
    ['Session starts', fmtDateTime(startTime)],
    ['Orders fill at', exec.fills],
    ['Commission', exec.commission],
    ['Slippage', exec.slippage],
  ];

  return (
    <Dialog open title="Match rules" initialFocus={skipRef}>
      <dl className="grid grid-cols-2 gap-2 mt-1">
        {rules.map(([k, v, tone]) => (
          <div key={k} className="rounded-lg border border-slate-800 bg-[#0b1120]/60 px-3 py-2">
            <dt className="text-[10px] text-slate-400">{k}</dt>
            <dd className={`text-xs font-mono font-semibold ${tone ?? 'text-white'}`}>{v}</dd>
          </div>
        ))}
      </dl>
      {limitedData && <p className="mt-3 text-[11px] text-amber-300">Limited data for this symbol: the session may end before the timer.</p>}
      <div className="mt-5 flex items-center justify-between">
        <p className="text-[11px] text-faint">Trading opens when the replay starts.</p>
        <div className="flex items-center gap-3">
          <span aria-live="assertive" className="text-4xl font-bold font-mono text-blue-400 tabular-nums w-8 text-center motion-safe:animate-[toast-in_300ms_ease-out]" key={n}>
            {Math.max(n, 1)}
          </span>
          <Button ref={skipRef} variant="secondary" onClick={() => onGoRef.current()}>
            Skip
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
