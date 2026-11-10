'use client';

import { useEffect } from 'react';
import { ticketStore, type TicketSummary } from '@/store/ticketStore';

/** Shares the trade panel's current ticket with the phone action bar. Renders nothing. */
export function TicketPublisher({ size, buyBlocked, sellBlocked, reason, sending, live, pnl }: TicketSummary) {
  const pnlKey = pnl ? `${pnl.side}|${pnl.tone}|${pnl.text}` : '';
  useEffect(() => {
    ticketStore.setState({ ticket: { size, buyBlocked, sellBlocked, reason, sending, live, pnl } });
    // pnl is compared by its text (pnlKey), not by object identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size, buyBlocked, sellBlocked, reason, sending, live, pnlKey]);
  useEffect(() => () => ticketStore.setState({ ticket: null }), []);
  return null;
}
