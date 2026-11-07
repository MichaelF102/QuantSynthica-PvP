import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { reduceDuel } from '@/lib/multiplayer/duelClient';
import type { OpponentView, ServerMessage, YouView } from '@/lib/multiplayer/protocol';
import { initialRoomClient, type RoomClientState, type RoomInfo } from '@/lib/multiplayer/roomClient';
import type { Candle } from '@/lib/types';
import { toastStore } from '@/store/toastStore';
import { DuelView } from './DuelView';

vi.mock('lightweight-charts', () => {
  const series = { setData: vi.fn(), update: vi.fn(), setMarkers: vi.fn(), applyOptions: vi.fn(), createPriceLine: vi.fn(() => ({})), removePriceLine: vi.fn() };
  const chart = { addCandlestickSeries: () => series, addHistogramSeries: () => series, priceScale: () => ({ applyOptions: vi.fn() }), timeScale: () => ({ fitContent: vi.fn(), scrollToRealTime: vi.fn() }), applyOptions: vi.fn(), subscribeCrosshairMove: vi.fn(), unsubscribeCrosshairMove: vi.fn(), remove: vi.fn() };
  return { createChart: () => chart, ColorType: { Solid: 'solid' }, CrosshairMode: { Normal: 0 }, LineStyle: { Dashed: 2 } };
});

// TEST FIXTURE: synthetic candles in session seconds, not market data.
const candles: Candle[] = Array.from({ length: 5 }, (_, i) => ({ time: 60 * i, open: 100, high: 101, low: 99, close: 100, volume: 3 }));
const ROOM: RoomInfo = {
  type: 'room',
  code: 'K7M2QX',
  phase: 'running',
  settings: { symbol: 'NQ=F', durationMin: 10, speed: 2, startingBalance: 100_000, maxDrawdownPct: 5 },
  symbol: { symbol: 'NQ=F', name: 'Nasdaq 100 E-mini Futures', currency: 'USD', lotStep: 0.01, priceDecimals: 2, assetClass: 'futures' },
  players: [
    { id: 'me', nickname: 'Ann', ready: true, connected: true, status: 'live' },
    { id: 'them', nickname: 'Bo', ready: true, connected: true, status: 'live' },
  ],
  countdownEndsAt: null,
  serverNow: Date.now(),
};
const YOU: YouView = { status: 'live', balance: 100_000, equity: 100_250, returnPct: 0.25, drawdownPct: 0.1, position: { symbol: 'NQ=F', units: 2, avgEntry: 99, openedAt: 180 }, fills: [], trades: 0, closed: [], elapsedMs: 0, lastSeq: 2 };
const OPP: OpponentView = { id: 'them', nickname: 'Bo', connected: true, status: 'live', equity: 99_000, returnPct: -1, drawdownPct: 1, trades: 3 };

function state(you: YouView = YOU, opp: OpponentView = OPP, pending: number[] = []): RoomClientState {
  const start: ServerMessage = { type: 'start', history: candles, cursor: 4, startCursor: 2, tickMs: 500, durationMs: 600_000, startedAt: Date.now(), serverNow: Date.now() };
  let duel = reduceDuel(null, start);
  duel = reduceDuel(duel, { type: 'you', you });
  duel = reduceDuel(duel, { type: 'opponent', opponent: opp });
  return { ...initialRoomClient, status: 'open', room: ROOM, you: 'me', duel: duel && { ...duel, pending } };
}

describe('DuelView', () => {
  it('shows both scores, hides the date, and the opponent has no position', () => {
    render(<DuelView room={ROOM} state={state()} placeOrder={vi.fn(() => true)} onForfeit={vi.fn()} />);
    const you = screen.getByRole('region', { name: 'You score' });
    const opp = screen.getByRole('region', { name: 'Opponent score' });
    expect(within(you).getByText('$100,250.00')).toBeInTheDocument();
    expect(within(you).getByText('+0.25%')).toBeInTheDocument();
    expect(within(opp).getByText('Bo')).toBeInTheDocument();
    expect(within(opp).getByText('-1.00%')).toBeInTheDocument();
    expect(within(opp).getByText('3')).toBeInTheDocument();
    expect(within(opp).queryByText(/Long|Short/)).toBeNull();
    expect(screen.getByText(/date hidden until the end/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '1d' })).toBeNull();
    expect(screen.getByText(/T\+0:02/)).toBeInTheDocument(); // OHLC readout in session time
  });

  it('sends orders to the server and waits while one is pending', () => {
    const placeOrder = vi.fn(() => true);
    const { unmount } = render(<DuelView room={ROOM} state={state()} placeOrder={placeOrder} onForfeit={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Buy' }));
    expect(placeOrder).toHaveBeenCalledWith({ side: 'buy', percent: 10 });
    fireEvent.click(screen.getAllByRole('button', { name: /Close/ })[0]);
    expect(placeOrder).toHaveBeenCalledWith('close');
    unmount();
    render(<DuelView room={ROOM} state={state(YOU, OPP, [3])} placeOrder={placeOrder} onForfeit={vi.fn()} />);
    expect(screen.getAllByRole('button', { name: 'Sending…' })).toHaveLength(2);
  });

  it('asks before forfeiting', () => {
    const onForfeit = vi.fn();
    render(<DuelView room={ROOM} state={state()} placeOrder={vi.fn(() => true)} onForfeit={onForfeit} />);
    fireEvent.click(screen.getByRole('button', { name: /Forfeit/ }));
    expect(onForfeit).not.toHaveBeenCalled();
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Forfeit' }));
    expect(onForfeit).toHaveBeenCalled();
  });

  it('explains a knockout and disables trading', () => {
    render(<DuelView room={ROOM} state={state({ ...YOU, status: 'out_drawdown', position: null })} placeOrder={vi.fn(() => true)} onForfeit={vi.fn()} />);
    expect(screen.getByText(/You hit the max drawdown/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Buy' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: /Forfeit/ })).toBeNull();
  });

  it('toasts fills and rejects from the server', () => {
    toastStore.getState().clear();
    const s = state();
    const filled = { ...s, duel: reduceDuel(s.duel, { type: 'fill', seq: 3, cursor: 4, fill: { id: 'f1', symbol: 'NQ=F', side: 'buy', units: 2, price: 100, time: 240, realizedPnl: 0 } }) };
    const { rerender } = render(<DuelView room={ROOM} state={filled} placeOrder={vi.fn(() => true)} onForfeit={vi.fn()} />);
    expect(toastStore.getState().toasts.at(-1)).toMatchObject({ kind: 'success', message: 'Bought 2 NQ @ 100.00' });
    const rejected = { ...filled, duel: reduceDuel(filled.duel, { type: 'reject', seq: 4, code: 'insufficient_balance', message: 'Insufficient balance' }) };
    rerender(<DuelView room={ROOM} state={rejected} placeOrder={vi.fn(() => true)} onForfeit={vi.fn()} />);
    expect(toastStore.getState().toasts.at(-1)).toMatchObject({ kind: 'error', message: 'Insufficient balance' });
  });
});
