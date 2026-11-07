import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { advance, closePosition, createMatch, placeMarketOrder, play } from '@/lib/engine';
import { listDuels } from '@/lib/multiplayer/duelResult';
import type { ServerMessage } from '@/lib/multiplayer/protocol';
import { initialRoomClient, type RoomClientState, type RoomInfo } from '@/lib/multiplayer/roomClient';
import { computeStats } from '@/lib/stats';
import type { Candle } from '@/lib/types';
import { DuelEnded } from './DuelEnded';
import { DuelHistory } from './DuelHistory';

vi.mock('recharts', async (orig) => {
  const actual = await orig<typeof import('recharts')>();
  return { ...actual, ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div style={{ width: 600, height: 240 }}>{children}</div> };
});

// TEST FIXTURE: synthetic candles, not market data.
const candles: Candle[] = [100, 100, 104].map((c, i) => ({ time: 1_700_000_000 + 60 * i, open: c, high: c, low: c, close: c, volume: 1 }));
const config = { symbol: 'NQ=F', currency: 'USD', interval: '1m' as const, durationMs: 600_000, startingBalance: 100_000, maxDrawdownPct: 5, lotStep: 0.01 };
let won = placeMarketOrder(play(createMatch(config, candles, 1), 0), { side: 'buy', units: 10 });
won = closePosition(advance(won));
const flat = createMatch(config, candles, 1);

const ROOM: RoomInfo = {
  type: 'room',
  code: 'K7M2QX',
  phase: 'ended',
  settings: { symbol: 'NQ=F', durationMin: 10, speed: 2, startingBalance: 100_000, maxDrawdownPct: 5 },
  symbol: { symbol: 'NQ=F', name: 'Nasdaq 100 E-mini Futures', currency: 'USD', lotStep: 0.01, priceDecimals: 2, assetClass: 'futures' },
  players: [
    { id: 'me', nickname: 'Ann', ready: false, connected: true, status: 'done' },
    { id: 'them', nickname: 'Bo', ready: false, connected: true, status: 'out_drawdown' },
  ],
  countdownEndsAt: null,
  serverNow: 0,
};
const END: Extract<ServerMessage, { type: 'end' }> = {
  type: 'end',
  reason: 'timer',
  winner: 'me',
  sessionStart: 1_700_000_060,
  sessionEnd: 1_700_000_120,
  players: [
    { id: 'me', nickname: 'Ann', status: 'done', stats: computeStats(won), trades: won.trades, equityCurve: won.equityCurve },
    { id: 'them', nickname: 'Bo', status: 'out_drawdown', stats: computeStats(flat), trades: [], equityCurve: flat.equityCurve },
  ],
};
const state = (over: Partial<RoomClientState> = {}): RoomClientState => ({ ...initialRoomClient, status: 'open', room: ROOM, you: 'me', end: END, ...over });

beforeEach(() => localStorage.clear());

describe('DuelEnded in a best of 3 (plan M13)', () => {
  const series = (wins: Record<string, number>, game: number, done: boolean, winner: string | null = null) => ({ of: 3 as const, game, wins, done, winner });

  it('offers the next game mid-series and saves the game number', async () => {
    const end = { ...END, series: series({ me: 1 }, 1, false) };
    render(<DuelEnded room={{ ...ROOM, series: end.series }} state={state({ end })} onRematch={vi.fn()} onLeave={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Next game/ })).toBeInTheDocument();
    expect(screen.getByText(/Game 1 of 3 · You lead 1–0\. Game 2 uses a new random session\./)).toBeInTheDocument();
    await waitFor(() => expect(listDuels().duels[0]?.series).toEqual({ game: 1, of: 3, youWins: 1, opponentWins: 0, done: false, outcome: null }));
  });

  it('says who took the series and offers a fresh rematch', () => {
    const end = { ...END, series: series({ me: 2, them: 1 }, 3, true, 'me') };
    render(<DuelEnded room={{ ...ROOM, series: end.series }} state={state({ end })} onRematch={vi.fn()} onLeave={vi.fn()} />);
    expect(screen.getByText(/You won the series 2–1\. Rematch starts a new series\./)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Rematch$/ })).toBeInTheDocument();
  });
});

describe('DuelEnded', () => {
  it('shows the winner, both results and the real date, and saves once', async () => {
    render(<DuelEnded room={ROOM} state={state()} onRematch={vi.fn()} onLeave={vi.fn()} />);
    expect(screen.getByRole('heading', { name: /You won/ })).toBeInTheDocument();
    expect(screen.getByText('Time ran out · Bo hit the max drawdown')).toBeInTheDocument();
    const table = screen.getByRole('table', { name: /Both players/ });
    expect(within(table).getByText('$100,040.00')).toBeInTheDocument(); // 10 × +4
    expect(within(table).getByText('$100,000.00')).toBeInTheDocument();
    expect(screen.getByText('2023-11-14 22:14 UTC')).toBeInTheDocument();
    await waitFor(() => expect(listDuels().duels).toHaveLength(1));
    expect(listDuels().duels[0]).toMatchObject({ outcome: 'win', opponent: { nickname: 'Bo' } });
  });

  it('reveals the opponent’s trades in a tab', () => {
    render(<DuelEnded room={ROOM} state={state()} onRematch={vi.fn()} onLeave={vi.fn()} />);
    expect(screen.getByRole('tab', { name: /Yours/ })).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('tab', { name: /Bo/ }));
    expect(screen.getByText('No trades this match')).toBeInTheDocument();
  });

  it('rematch: ask, accept, wait, or blocked when the opponent left', () => {
    const onRematch = vi.fn();
    const { rerender } = render(<DuelEnded room={ROOM} state={state()} onRematch={onRematch} onLeave={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Rematch' }));
    expect(onRematch).toHaveBeenCalled();
    rerender(<DuelEnded room={ROOM} state={state({ rematch: ['them'] })} onRematch={onRematch} onLeave={vi.fn()} />);
    expect(screen.getByText(/Bo wants a rematch/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Accept rematch' })).toBeEnabled();
    rerender(<DuelEnded room={ROOM} state={state({ rematch: ['me'] })} onRematch={onRematch} onLeave={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Waiting for opponent…' })).toBeDisabled();
    const gone = { ...ROOM, players: [ROOM.players[0], { ...ROOM.players[1], connected: false }] };
    rerender(<DuelEnded room={gone} state={state({ room: gone })} onRematch={onRematch} onLeave={vi.fn()} />);
    expect(screen.getByText(/left the room/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rematch' })).toBeDisabled();
  });
});

describe('DuelHistory', () => {
  it('lists saved duels with a link, and deletes after confirming', async () => {
    const { unmount } = render(<DuelEnded room={ROOM} state={state()} onRematch={vi.fn()} onLeave={vi.fn()} />);
    await waitFor(() => expect(listDuels().duels).toHaveLength(1));
    unmount();
    render(<DuelHistory />);
    const row = (await screen.findByText('Bo')).closest('tr')!;
    expect(within(row).getByText('You won')).toBeInTheDocument();
    expect(within(row).getByRole('link')).toHaveAttribute('href', `/duel/${encodeURIComponent(listDuels().duels[0].id)}`);
    fireEvent.click(within(row).getByRole('button', { name: /Delete 1v1 against Bo/ }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }));
    expect(await screen.findByText('No 1v1 matches yet')).toBeInTheDocument();
  });
});
