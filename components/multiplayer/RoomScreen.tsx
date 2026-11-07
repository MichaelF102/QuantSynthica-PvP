'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DoorClosed } from 'lucide-react';
import { Banner, Button, EmptyState, Panel, PanelSkeleton, buttonClasses } from '@/components/ui';
import { normalizeRoomCode } from '@/lib/multiplayer/code';
import { loadNickname, saveNickname } from '@/lib/multiplayer/client';
import { countdownLeft } from '@/lib/multiplayer/roomClient';
import { useNow } from '@/store/useNow';
import { useRoom } from '@/store/useRoom';
import { DuelEnded } from './DuelEnded';
import { DuelView } from './DuelView';
import { LobbyView } from './LobbyView';
import { NicknameForm } from './NicknameForm';
import { RoomRules } from './RoomRules';

const backToPlay = (
  <Link href="/play" className={buttonClasses('secondary')}>
    Back to 1v1
  </Link>
);

/** /play/[code]: checks the code, then connects. */
export function RoomScreen({ code: raw }: { code: string }) {
  const code = normalizeRoomCode(decodeURIComponent(raw));
  if (!code) return <EmptyState icon={DoorClosed} title="That is not a room code." hint="Room codes have 6 letters and digits, like K7M2QX." action={backToPlay} />;
  return <ConnectedRoom code={code} />;
}

function ConnectedRoom({ code }: { code: string }) {
  const router = useRouter();
  // Read after mount so the server render and the first client render match.
  const [nickname, setNickname] = useState<string | null>(null);
  const [nickLoaded, setNickLoaded] = useState(false);
  useEffect(() => {
    setNickname(loadNickname());
    setNickLoaded(true);
  }, []);

  const { state, send, leave, clearNotice, placeOrder } = useRoom(code, nickname);
  const now = useNow(state.room?.phase === 'countdown');
  const { room, you, fatal, notice, status } = state;

  if (fatal) {
    const action =
      fatal.code === 'replaced' ? (
        <Button variant="secondary" onClick={() => window.location.reload()}>
          Play here instead
        </Button>
      ) : (
        backToPlay
      );
    return <EmptyState icon={DoorClosed} title={fatal.message} hint={`Room ${code}`} action={action} />;
  }
  if (!room || !nickLoaded) return <PanelSkeleton rows={6} label="Connecting to room" />;

  const banners = (
    <>
      {status === 'reconnecting' && <Banner kind="warning">Connection lost. Reconnecting… Your seat is kept for 30 seconds during a match.</Banner>}
      {notice && <Banner onDismiss={clearNotice}>{notice}</Banner>}
    </>
  );

  if (!nickname || !you) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        <div className="lg:col-span-7 space-y-4">
          {banners}
          <Panel title={`Join room ${code}`} description={`${room.players.length} of 2 players in the room.`}>
            {nickname ? (
              <PanelSkeleton rows={2} label="Joining" />
            ) : (
              <NicknameForm
                onSubmit={(name) => {
                  saveNickname(name);
                  setNickname(name);
                }}
              />
            )}
          </Panel>
        </div>
        <div className="lg:col-span-5">
          <Panel title="Rules" description="Both players trade the same session under these rules.">
            <RoomRules room={room} />
          </Panel>
        </div>
      </div>
    );
  }

  const exit = () => {
    leave();
    router.push('/play');
  };

  if (room.phase === 'waiting' || room.phase === 'lobby' || room.phase === 'countdown') {
    return (
      <div className="space-y-4">
        {banners}
        <LobbyView room={room} you={you} countdown={countdownLeft(state, now)} onReady={(ready) => send({ type: ready ? 'ready' : 'unready' })} onLeave={exit} />
      </div>
    );
  }

  if (room.phase === 'running') {
    return (
      <div className="space-y-4">
        {banners}
        <DuelView room={room} state={state} placeOrder={placeOrder} onForfeit={() => send({ type: 'forfeit' })} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {banners}
      <DuelEnded room={room} state={state} onRematch={() => send({ type: 'rematch' })} onLeave={exit} />
    </div>
  );
}
