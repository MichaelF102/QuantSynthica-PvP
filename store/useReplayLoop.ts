'use client';

import { useEffect } from 'react';
import type { StoreApi } from 'zustand/vanilla';
import { createFrameLoop, type FrameLoop } from './clock';
import { matchStore, type MatchStore } from './matchStore';

/**
 * Runs the frame loop only while the match is running, and pauses when the tab is hidden
 * (CLAUDE.md §10: the timer pauses with it). Returns an unbind function.
 */
export function bindReplayLoop(store: StoreApi<MatchStore>, doc: Document, loop: FrameLoop = createFrameLoop((dt) => store.getState().frame(dt))): () => void {
  const sync = (s: MatchStore) => {
    if (s.match?.status === 'running') loop.start();
    else loop.stop();
  };
  const unsubscribe = store.subscribe(sync);
  sync(store.getState());

  const onVisibility = () => {
    if (doc.visibilityState === 'hidden') store.getState().pause();
  };
  doc.addEventListener('visibilitychange', onVisibility);

  return () => {
    unsubscribe();
    doc.removeEventListener('visibilitychange', onVisibility);
    loop.stop();
  };
}

export function useReplayLoop(store: StoreApi<MatchStore> = matchStore): void {
  useEffect(() => bindReplayLoop(store, document), [store]);
}
