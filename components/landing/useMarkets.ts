'use client';

import { useCallback, useEffect, useState } from 'react';
import { loadIndex } from '@/lib/data';
import { CURATED_MARKETS } from '@/lib/landing/curatedMarkets';
import { marketsFromIndex, type Market } from '@/lib/landing/markets';

export type MarketsStatus = 'loading' | 'ready' | 'empty' | 'error';

/**
 * Markets from /data/index.json. When it is empty or fails, `items` falls back to the curated
 * list, and `status` says why, so the UI can label it.
 */
export function useMarkets(): { status: MarketsStatus; items: readonly Market[]; retry: () => void } {
  const [status, setStatus] = useState<MarketsStatus>('loading');
  const [items, setItems] = useState<readonly Market[]>([]);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    loadIndex()
      .then((index) => {
        if (cancelled) return;
        if (index.length === 0) {
          setItems(CURATED_MARKETS);
          setStatus('empty');
        } else {
          setItems(marketsFromIndex(index));
          setStatus('ready');
        }
      })
      .catch(() => {
        if (cancelled) return;
        setItems(CURATED_MARKETS);
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);
  return { status, items, retry };
}
