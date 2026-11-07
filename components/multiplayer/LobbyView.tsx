'use client';

import { Check, Clock, UserRound, WifiOff } from 'lucide-react';
import { Badge, Button, Panel } from '@/components/ui';
import type { PlayerSummary } from '@/lib/multiplayer/protocol';
import type { RoomInfo } from '@/lib/multiplayer/roomClient';
import { cn } from '@/lib/utils';
import { RoomRules } from './RoomRules';
import { ShareRoom } from './ShareRoom';

type LobbyViewProps = {
  room: RoomInfo;
  you: string;
  /** Seconds left in the countdown, or null. */
  countdown: number | null;
  onReady: (ready: boolean) => void;
  onLeave: () => void;
};

function Seat({ player, isYou }: { player: PlayerSummary | null; isYou: boolean }) {
  if (!player) {
    return (
      <li className="flex items-center gap-3 rounded-lg border border-dashed border-slate-700 px-3 py-3">
        <UserRound className="w-4 h-4 text-slate-600" aria-hidden />
        <span className="text-xs text-faint">Waiting for an opponent. Share the code or link.</span>
      </li>
    );
  }
  return (
    <li className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-[#0b1120]/60 px-3 py-3">
      <span className="flex items-center gap-2 min-w-0">
        <UserRound className={cn('w-4 h-4 shrink-0', isYou ? 'text-blue-400' : 'text-slate-400')} aria-hidden />
        <span className="text-sm text-white truncate">{player.nickname}</span>
        {isYou && <span className="text-[10px] uppercase tracking-wider text-blue-300">You</span>}
      </span>
      {!player.connected ? (
        <Badge tone="amber" icon={WifiOff}>
          Offline
        </Badge>
      ) : player.ready ? (
        <Badge tone="emerald" icon={Check}>
          Ready
        </Badge>
      ) : (
        <Badge icon={Clock}>Not ready</Badge>
      )}
    </li>
  );
}

/** Lobby: both seats, ready toggles, the shared rules and the 3-2-1 countdown. */
export function LobbyView({ room, you, countdown, onReady, onLeave }: LobbyViewProps) {
  const mine = room.players.find((p) => p.id === you) ?? null;
  const other = room.players.find((p) => p.id !== you) ?? null;
  const full = room.players.length === 2;
  const counting = room.phase === 'countdown' && countdown !== null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
      <div className="lg:col-span-7">
        <Panel title="Players" description={full ? 'The match starts when both players are ready.' : 'One more player needed.'} icon={UserRound}>
          <ul className="space-y-2">
            <Seat player={mine} isYou />
            <Seat player={other} isYou={false} />
          </ul>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <Button variant="text" onClick={onLeave}>
              Leave room
            </Button>
            {counting ? (
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-300">Starting in</span>
                <span aria-live="assertive" key={countdown} className="text-4xl font-bold font-mono text-blue-400 tabular-nums w-8 text-center motion-safe:animate-[toast-in_300ms_ease-out]">
                  {Math.max(countdown, 1)}
                </span>
                <Button variant="secondary" onClick={() => onReady(false)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <Button onClick={() => onReady(!mine?.ready)} disabled={!full} variant={mine?.ready ? 'secondary' : 'primary'} className="px-5 py-2.5 min-h-[40px]">
                {mine?.ready ? 'Not ready' : 'I’m ready'}
              </Button>
            )}
          </div>
          {!full && <p className="mt-2 text-[11px] text-faint text-right">Ready unlocks when your opponent joins.</p>}
        </Panel>
      </div>
      <div className="lg:col-span-5 space-y-4">
        <Panel title="Invite" description="Send this code or link to your opponent.">
          <ShareRoom code={room.code} />
        </Panel>
        <Panel title="Rules" description="Both players trade the same session under these rules.">
          <RoomRules room={room} />
        </Panel>
      </div>
    </div>
  );
}
