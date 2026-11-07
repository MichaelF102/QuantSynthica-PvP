'use client';

import { useCallback, useEffect, useState } from 'react';
import { loadCatalog, type CatalogEntry } from '@/lib/catalog';

export type CatalogStatus = 'loading' | 'ready' | 'error';

/** The ticker reference list. A failure only hides the no-data tickers; playable ones still work. */
export function useCatalog(): { status: CatalogStatus; catalog: readonly CatalogEntry[]; retry: () => void } {
  const [status, setStatus] = useState<CatalogStatus>('loading');
  const [catalog, setCatalog] = useState<readonly CatalogEntry[]>([]);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    loadCatalog()
      .then((c) => {
        if (cancelled) return;
        setCatalog(c);
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);
  return { status, catalog, retry };
}
