'use client';

import { useState } from 'react';
import { Button } from '@/components/ui';
import { candlesFromCloses } from '@/lib/landing/geometry';
import { ILLUSTRATIVE_CLOSES, canReveal, initialPlayground, placeFill, playgroundFeedback, revealNext } from '@/lib/landing/playground';
import { PANEL_SHELL } from '@/components/ui/Panel';
import { cn } from '@/lib/utils';
import { CandleGlyphs } from './CandleGlyphs';

const toY = (v: number) => 170 - (v - 95) * 4.5;
const CANDLES = candlesFromCloses(ILLUSTRATIVE_CLOSES, 20, 24, toY);

/** Try the fill rule on a short illustrative sequence. Not market data, and no prices are shown. */
export function FillPlayground() {
  const [p, setP] = useState(initialPlayground);
  const mark = p.fill ? CANDLES[p.fill.index] : null;

  return (
    <div className={cn(PANEL_SHELL, 'mt-12 p-5 sm:p-6')}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Try it</p>
        <p className="text-[11px] text-faint">Illustration, not market data</p>
      </div>
      <svg viewBox="0 0 360 210" role="img" aria-label={`Practice candles, ${p.shown} of ${CANDLES.length} shown. Buy or sell fills at the close of the candle on screen.`} className="block w-full max-w-xl h-auto mx-auto mt-3">
        <CandleGlyphs candles={CANDLES.slice(0, p.shown)} />
        {mark && p.fill && (
          <>
            <line x1={mark.x} x2={340} y1={mark.c} y2={mark.c} stroke="#60a5fa" strokeDasharray="3 3" />
            <circle cx={mark.x} cy={mark.c} r={5} fill={p.fill.side === 'Buy' ? '#34d399' : '#fb7185'} stroke="#0b1222" strokeWidth={2} />
          </>
        )}
      </svg>
      <p aria-live="polite" className="mt-4 min-h-[3em] text-sm text-slate-300 leading-relaxed">
        {playgroundFeedback(p)}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button disabled={!canReveal(p)} onClick={() => setP(revealNext)}>
          Next candle
        </Button>
        <Button variant="buy" disabled={p.fill !== null} onClick={() => setP((s) => placeFill(s, 'Buy'))}>
          Buy
        </Button>
        <Button variant="sell" disabled={p.fill !== null} onClick={() => setP((s) => placeFill(s, 'Sell'))}>
          Sell
        </Button>
        <Button variant="secondary" className="px-4 py-2" onClick={() => setP(initialPlayground())}>
          Reset
        </Button>
      </div>
    </div>
  );
}
