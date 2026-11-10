'use client';

import type { ReactNode } from 'react';
import { Button } from '@/components/ui';
import { placeFromTicket } from '@/lib/hotkeys';
import { cn } from '@/lib/utils';
import { useTicket } from '@/store/ticketStore';

const TONE = { up: 'text-emerald-400', down: 'text-rose-400', flat: 'text-slate-300' } as const;

/**
 * Phones and tablets: Buy / Sell (and the replay toggle) pinned to the bottom of the screen, so the
 * chart and the order buttons are on screen together. Orders go through the trade panel, which
 * keeps its size, stop / target and checks. Hidden from `lg` up, where the panel sits beside the chart.
 */
export function MobileTradeBar({ leading }: { leading?: ReactNode }) {
  const t = useTicket();
  if (!t || !t.live) return null;
  return (
    <div
      className="lg:hidden fixed inset-x-0 bottom-0 z-[60] border-t border-slate-800 bg-[#080d1a]/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)] print:hidden"
      role="region"
      aria-label="Quick trade"
    >
      <div className="app-container flex items-center gap-2 py-2">
        {leading}
        <div className="min-w-0 flex-1 leading-tight">
          {t.pnl ? (
            <p className="text-[11px] font-mono truncate">
              <span className="text-slate-400">{t.pnl.side} </span>
              <span className={cn('font-bold', TONE[t.pnl.tone])}>{t.pnl.text}</span>
            </p>
          ) : (
            <p className="text-[11px] text-faint">Flat</p>
          )}
          <p className="text-[10px] font-mono text-slate-400 truncate" title={t.reason ?? undefined}>
            {t.reason ?? `Size ${t.size}`}
          </p>
        </div>
        <Button variant="buy" className="min-h-11 min-w-[76px] text-sm" disabled={t.buyBlocked || t.sending} onClick={() => placeFromTicket('buy')} aria-label={`Buy ${t.size}`}>
          {t.sending ? '…' : 'Buy'}
        </Button>
        <Button variant="sell" className="min-h-11 min-w-[76px] text-sm" disabled={t.sellBlocked || t.sending} onClick={() => placeFromTicket('sell')} aria-label={`Sell ${t.size}`}>
          {t.sending ? '…' : 'Sell'}
        </Button>
      </div>
    </div>
  );
}
