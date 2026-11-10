import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';

// What the trade panel would send right now, for the phone action bar (MobileTradeBar). The panel
// is the only writer and stays the single place that sizes and checks orders; the bar asks it to
// place one through TRADE_INTENT_EVENT.

export type TicketSummary = {
  /** e.g. "10% · 8,897 6E" */
  size: string;
  buyBlocked: boolean;
  sellBlocked: boolean;
  /** Why both sides are blocked, when they share a reason. */
  reason: string | null;
  sending: boolean;
  live: boolean;
  /** The open position's unrealized P&L, signed and formatted, or null when flat. */
  pnl: { text: string; tone: 'up' | 'down' | 'flat'; side: 'Long' | 'Short' } | null;
};

export const ticketStore = createStore<{ ticket: TicketSummary | null }>()(() => ({ ticket: null }));

export function useTicket(): TicketSummary | null {
  return useStore(ticketStore, (s) => s.ticket);
}
