'use client';

import { useEffect } from 'react';
import type { MatchStatus } from '@/lib/types';
import { useMatchStore } from './matchStore';

/** A match is "live" once started and until it ends; leaving then loses it (no resume in v1). */
export const isLiveStatus = (status: MatchStatus | undefined) => status === 'running' || status === 'paused';

export function useIsMatchLive(): boolean {
  return useMatchStore((s) => isLiveStatus(s.match?.status));
}

/** Browser refresh/close warning while a match is live (CLAUDE.md §10). */
export function useBeforeUnloadGuard(active: boolean, target: Window | null = typeof window === 'undefined' ? null : window): void {
  useEffect(() => {
    if (!active || !target) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Some browsers still need returnValue set to show the prompt.
      e.returnValue = '';
    };
    target.addEventListener('beforeunload', onBeforeUnload);
    return () => target.removeEventListener('beforeunload', onBeforeUnload);
  }, [active, target]);
}
