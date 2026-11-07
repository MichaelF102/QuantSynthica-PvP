'use client';

import { useCallback, useEffect, useState } from 'react';
import type { MatchResult } from '@/lib/results';
import { onStoredDataChange } from '@/lib/localChanges';
import { listResults } from '@/lib/storage';

export type SavedResults = { status: 'loading' | 'ready'; results: MatchResult[]; error: boolean; refresh: () => void };

/**
 * Saved results, read after mount (the server has no localStorage, so the first render is a
 * skeleton and there is no hydration mismatch). Updates when another tab changes them.
 */
export function useSavedResults(): SavedResults {
  const [state, setState] = useState<Omit<SavedResults, 'refresh'>>({ status: 'loading', results: [], error: false });
  const refresh = useCallback(() => setState({ status: 'ready', ...listResults() }), []);
  useEffect(() => {
    refresh();
    // Another tab's change, or a cloud sync (plan M14).
    return onStoredDataChange(refresh);
  }, [refresh]);
  return { ...state, refresh };
}
