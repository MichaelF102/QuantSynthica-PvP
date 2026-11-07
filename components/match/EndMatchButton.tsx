'use client';

import { useState } from 'react';
import { Flag } from 'lucide-react';
import { Button } from '@/components/ui';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { currentPrice } from '@/lib/engine';
import { fmtPrice, priceDecimalsFor } from '@/lib/format';
import { useMatchStore } from '@/store/matchStore';

/** Ends the match early, after confirmation (CLAUDE.md §10). Opening the dialog pauses replay. */
export function EndMatchButton() {
  const match = useMatchStore((s) => s.match);
  const info = useMatchStore((s) => s.info);
  const pause = useMatchStore((s) => s.pause);
  const endEarly = useMatchStore((s) => s.endEarly);
  const [open, setOpen] = useState(false);

  if (!match || match.status === 'idle') return null;
  const ended = match.status === 'ended';
  const hasPosition = match.positions.length > 0;

  return (
    <>
      <Button
        variant="secondary"
        disabled={ended}
        className="border-rose-500/40 text-rose-300 hover:border-rose-400/70 hover:text-rose-200 hover:bg-rose-500/10"
        onClick={() => {
          pause();
          setOpen(true);
        }}
      >
        <Flag className="w-3.5 h-3.5" aria-hidden /> End match
      </Button>
      <ConfirmDialog
        open={open}
        title="End the match now?"
        confirmLabel="End match"
        destructive
        onCancel={() => setOpen(false)}
        onConfirm={() => {
          setOpen(false);
          endEarly();
        }}
      >
        {hasPosition ? <>Open positions close at the last revealed price, {fmtPrice(currentPrice(match), priceDecimalsFor(info))}.</> : <>You have no open positions.</>} The time left is not
        used and the result is saved.
      </ConfirmDialog>
    </>
  );
}
