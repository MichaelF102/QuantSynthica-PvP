'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { RotateCcw } from 'lucide-react';
import { Banner, Button, PanelSkeleton, buttonClasses } from '@/components/ui';
import { buildDuelResult, saveDuel } from '@/lib/multiplayer/duelResult';
import type { RoomClientState, RoomInfo } from '@/lib/multiplayer/roomClient';
import { seriesText } from '@/lib/multiplayer/seriesText';
import { DuelReport } from './DuelReport';

type DuelEndedProps = { room: RoomInfo; state: RoomClientState; onRematch: () => void; onLeave: () => void };

/** The room after the end: the report, saved once to this browser, plus rematch (both must accept). */
export function DuelEnded({ room, state, onRematch, onLeave }: DuelEndedProps) {
  const playedAt = state.duel?.startedAt;
  const result = useMemo(() => (state.end && state.you ? buildDuelResult(state.end, room, state.you, playedAt ?? Date.now()) : null), [state.end, state.you, room, playedAt]);
  const [saved, setSaved] = useState<boolean | null>(null);
  useEffect(() => {
    if (result) setSaved(saveDuel(result));
  }, [result]);

  if (!state.end) return <PanelSkeleton rows={6} label="Loading the result" />;
  if (!result) return <Banner kind="error">This result does not include your seat, so it cannot be shown here.</Banner>;

  const other = room.players.find((p) => p.id !== state.you);
  const askedByMe = state.rematch.includes(state.you ?? '');
  const askedByThem = Boolean(other && state.rematch.includes(other.id));
  const otherHere = Boolean(other?.connected);
  // M13 R2: in an unfinished best of 3 the button starts the next game.
  const series = state.end.series ?? room.series;
  const midSeries = Boolean(series && series.of > 1 && !series.done);
  const noun = midSeries ? 'next game' : 'rematch';
  const label = askedByMe ? 'Waiting for opponent…' : askedByThem ? `Accept ${noun}` : midSeries ? 'Next game' : 'Rematch';

  return (
    <div className="space-y-4">
      {series && series.of > 1 && (
        <Banner kind="info">
          {seriesText(series, room.players, state.you)}
          {series.done ? '. Rematch starts a new series.' : `. Game ${series.game + 1} uses a new random session.`}
        </Banner>
      )}
      {askedByThem && !askedByMe && <Banner kind="info">{other?.nickname} wants {midSeries ? 'to play the next game' : 'a rematch'} on a new random session.</Banner>}
      {!otherHere && <Banner kind="warning">{other?.nickname ?? 'Your opponent'} left the room, so a {noun} is not possible.</Banner>}
      {saved === false && <Banner kind="warning">This browser blocked storage, so the result was not saved to History.</Banner>}
      <DuelReport
        result={result}
        actions={
          <>
            <Button onClick={onRematch} disabled={askedByMe || !otherHere} className="px-4 py-2.5">
              <RotateCcw className="w-3.5 h-3.5" aria-hidden /> {label}
            </Button>
            <Link href="/history" className={buttonClasses('secondary')}>
              History
            </Link>
            <Button variant="text" onClick={onLeave}>
              Leave room
            </Button>
          </>
        }
      />
    </div>
  );
}
