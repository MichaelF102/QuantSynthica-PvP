import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { RoomInfo } from '@/lib/multiplayer/roomClient';
import { initialRoomClient, type RoomClientState } from '@/lib/multiplayer/roomClient';
import type { SymbolInfo } from '@/lib/types';
import { CreateRoomPanel } from './CreateRoomPanel';
import { JoinRoomPanel } from './JoinRoomPanel';
import { LobbyView } from './LobbyView';
import { RoomScreen } from './RoomScreen';

const nav = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => nav, usePathname: () => '/play' }));

const hook = vi.hoisted(() => ({ state: null as unknown as RoomClientState, send: vi.fn(), leave: vi.fn(), clearNotice: vi.fn(), nickname: undefined as string | null | undefined }));
vi.mock('@/store/useRoom', () => ({
  useRoom: (_code: string, nickname: string | null) => {
    hook.nickname = nickname;
    return { state: hook.state, send: hook.send, leave: hook.leave, clearNotice: hook.clearNotice };
  },
}));

// TEST FIXTURE: symbol metadata only, no prices.
const INDEX: SymbolInfo[] = [{ symbol: 'NQ=F', name: 'Nasdaq 100 E-mini Futures', assetClass: 'futures', currency: 'USD', dataFile: 'NQ_F.csv', barsAvailable: 5000, firstTime: 1, lastTime: 2, lotStep: 0.01, priceDecimals: 2 }];

const ROOM: RoomInfo = {
  type: 'room',
  code: 'K7M2QX',
  phase: 'lobby',
  settings: { symbol: 'NQ=F', durationMin: 10, speed: 2, startingBalance: 100_000, maxDrawdownPct: 5 },
  symbol: { symbol: 'NQ=F', name: 'Nasdaq 100 E-mini Futures', currency: 'USD', lotStep: 0.01, priceDecimals: 2, assetClass: 'futures' },
  players: [
    { id: 'me', nickname: 'Ann', ready: false, connected: true, status: 'live' },
    { id: 'them', nickname: 'Bo', ready: true, connected: true, status: 'live' },
  ],
  countdownEndsAt: null,
  serverNow: 0,
};

beforeEach(() => {
  nav.push.mockReset();
  hook.send.mockReset();
  hook.leave.mockReset();
  localStorage.clear();
});

describe('CreateRoomPanel', () => {
  it('sends the chosen settings and opens the new room', async () => {
    const create = vi.fn(async () => 'K7M2QX');
    render(<CreateRoomPanel index={INDEX} host="localhost:8787" create={create} />);
    fireEvent.click(screen.getByRole('button', { name: '5x' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create room' }));
    await waitFor(() => expect(nav.push).toHaveBeenCalledWith('/play/K7M2QX'));
    expect(create).toHaveBeenCalledWith('localhost:8787', { symbol: 'NQ=F', durationMin: 10, speed: 5, startingBalance: 100_000, maxDrawdownPct: 5 });
  });

  it('sends best of 3 and open positions when chosen (plan M13)', async () => {
    const create = vi.fn(async () => 'K7M2QX');
    render(<CreateRoomPanel index={INDEX} host="h" create={create} />);
    fireEvent.click(screen.getByRole('button', { name: 'Best of 3' }));
    fireEvent.click(screen.getByRole('button', { name: 'Visible to both' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create room' }));
    await waitFor(() => expect(create).toHaveBeenCalled());
    expect(create).toHaveBeenCalledWith('h', expect.objectContaining({ series: 3, openPositions: true }));
  });

  it('shows the server error and lets the player try again', async () => {
    const create = vi.fn(async () => Promise.reject(new Error('This symbol does not have enough data for that time limit and speed.')));
    render(<CreateRoomPanel index={INDEX} host="h" create={create} />);
    fireEvent.click(screen.getByRole('button', { name: 'Create room' }));
    expect(await screen.findByText(/not have enough data/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create room' })).toBeEnabled();
  });
});

describe('JoinRoomPanel', () => {
  it('normalizes the code, and rejects an invalid one', () => {
    render(<JoinRoomPanel />);
    const input = screen.getByLabelText('Room code');
    fireEvent.change(input, { target: { value: 'k7m' } });
    fireEvent.click(screen.getByRole('button', { name: 'Join' }));
    expect(screen.getByText(/6-character room code/)).toBeInTheDocument();
    expect(nav.push).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: 'k7m-2qx' } });
    fireEvent.click(screen.getByRole('button', { name: 'Join' }));
    expect(nav.push).toHaveBeenCalledWith('/play/K7M2QX');
  });
});

describe('LobbyView', () => {
  it('shows both seats, the rules with the date hidden, and toggles ready', () => {
    const onReady = vi.fn();
    render(<LobbyView room={ROOM} you="me" countdown={null} onReady={onReady} onLeave={vi.fn()} />);
    expect(screen.getByText('Ann')).toBeInTheDocument();
    expect(screen.getByText('Ready')).toBeInTheDocument();
    expect(screen.getByText('Revealed at the end')).toBeInTheDocument();
    expect(screen.getByText('2x · no pause')).toBeInTheDocument();
    expect(screen.getByText('$100,000.00')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'I’m ready' }));
    expect(onReady).toHaveBeenCalledWith(true);
  });

  it('disables ready until the opponent joins', () => {
    render(<LobbyView room={{ ...ROOM, phase: 'waiting', players: [ROOM.players[0]] }} you="me" countdown={null} onReady={vi.fn()} onLeave={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'I’m ready' })).toBeDisabled();
    expect(screen.getByText(/Waiting for an opponent/)).toBeInTheDocument();
  });

  it('shows the countdown with a cancel button', () => {
    const onReady = vi.fn();
    render(<LobbyView room={{ ...ROOM, phase: 'countdown' }} you="me" countdown={2} onReady={onReady} onLeave={vi.fn()} />);
    expect(screen.getByText('2')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onReady).toHaveBeenCalledWith(false);
  });
});

describe('RoomScreen', () => {
  it('rejects a malformed code without connecting', () => {
    hook.nickname = undefined;
    render(<RoomScreen code="nope" />);
    expect(screen.getByText('That is not a room code.')).toBeInTheDocument();
    expect(hook.nickname).toBeUndefined();
  });

  it('asks for a name first, saves it, then passes it to the socket', async () => {
    hook.state = { ...initialRoomClient, status: 'open', room: ROOM };
    render(<RoomScreen code="k7m2qx" />);
    fireEvent.change(await screen.findByLabelText('Your name'), { target: { value: '  Ann  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Join room' }));
    await waitFor(() => expect(hook.nickname).toBe('Ann'));
    expect(localStorage.getItem('qs-pvp:nickname')).toBe('Ann');
  });

  it('shows the lobby once seated, and fatal errors as an empty state', async () => {
    localStorage.setItem('qs-pvp:nickname', 'Ann');
    hook.state = { ...initialRoomClient, status: 'open', room: ROOM, you: 'me' };
    const { unmount } = render(<RoomScreen code="K7M2QX" />);
    expect(await screen.findByRole('button', { name: 'I’m ready' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Leave room' }));
    expect(hook.leave).toHaveBeenCalled();
    expect(nav.push).toHaveBeenCalledWith('/play');
    unmount();

    hook.state = { ...initialRoomClient, fatal: { code: 'expired', message: 'This room has expired. Create a new room to play.' } };
    render(<RoomScreen code="K7M2QX" />);
    expect(screen.getByText('This room has expired. Create a new room to play.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to 1v1' })).toHaveAttribute('href', '/play');
  });

  it('warns while reconnecting', async () => {
    localStorage.setItem('qs-pvp:nickname', 'Ann');
    hook.state = { ...initialRoomClient, status: 'reconnecting', room: ROOM, you: 'me' };
    render(<RoomScreen code="K7M2QX" />);
    expect(await screen.findByText(/Reconnecting/)).toBeInTheDocument();
  });
});
