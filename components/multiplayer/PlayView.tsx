'use client';

import { useCallback, useEffect, useState } from 'react';
import { Banner, PanelSkeleton } from '@/components/ui';
import { DataError, loadIndex } from '@/lib/data';
import { roomHost } from '@/lib/multiplayer/client';
import { FATAL_TEXT } from '@/lib/multiplayer/roomClient';
import type { SymbolInfo } from '@/lib/types';
import { CreateRoomPanel } from './CreateRoomPanel';
import { JoinRoomPanel } from './JoinRoomPanel';

/** /play: create a room or join one by code. */
export function PlayView() {
  const host = roomHost();
  const [index, setIndex] = useState<SymbolInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchIndex = useCallback(() => {
    setError(null);
    setIndex(null);
    loadIndex()
      .then(setIndex)
      .catch((e) => setError(e instanceof DataError ? e.message : 'Could not load the symbol list.'));
  }, []);
  useEffect(fetchIndex, [fetchIndex]);

  if (!host) return <Banner kind="warning">{FATAL_TEXT.unavailable} Practice matches still work.</Banner>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
      <div className="lg:col-span-7">
        {error ? (
          <Banner kind="error" onRetry={fetchIndex}>
            {error}
          </Banner>
        ) : !index ? (
          <PanelSkeleton rows={8} label="Loading symbols" />
        ) : index.length === 0 ? (
          <Banner kind="warning">No symbols are available yet. The market data files have not been generated.</Banner>
        ) : (
          <CreateRoomPanel index={index} host={host} />
        )}
      </div>
      <div className="lg:col-span-5">
        <JoinRoomPanel />
      </div>
    </div>
  );
}
