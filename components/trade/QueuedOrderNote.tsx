'use client';

import { Clock } from 'lucide-react';
import { Button } from '@/components/ui';
import { fmtUnits, shortSymbol } from '@/lib/format';
import type { QueuedOrder } from '@/lib/types';

type QueuedOrderNoteProps = {
  order: QueuedOrder;
  symbol: string;
  lotStep: number;
  /** Omitted when cancelling is not possible (the order is already on its way). */
  onCancel?: () => void;
  disabled?: boolean;
};

/** Plan M12 C2: the order waiting for the next candle's open. */
export function QueuedOrderNote({ order, symbol, lotStep, onCancel, disabled = false }: QueuedOrderNoteProps) {
  const what = order.close ? 'Close position' : `${order.side === 'buy' ? 'Buy' : 'Sell'} ${fmtUnits(order.units, lotStep)} ${shortSymbol(symbol)}`;
  return (
    <div role="status" className="flex items-center justify-between gap-2 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2">
      <p className="flex items-center gap-1.5 text-[11px] text-blue-200">
        <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden />
        <span>
          <span className="font-mono font-semibold">{what}</span> fills at the next open
        </span>
      </p>
      {onCancel && (
        <Button variant="text" disabled={disabled} onClick={onCancel}>
          Cancel
        </Button>
      )}
    </div>
  );
}
