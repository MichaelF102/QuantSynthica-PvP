'use client';

import { useCallback, useEffect, useState } from 'react';
import { sessionCandles } from '@/lib/analysis';
import { loadCandles, loadIndex } from '@/lib/data';
import type { MatchResult } from '@/lib/results';
import type { Candle } from '@/lib/types';

export type SessionStatus = 'loading' | 'ready' | 'missing' | 'error';

/**
 * The candles the player saw in a saved match, reloaded from the symbol's CSV (a saved result
 * keeps no candles). `missing` when the symbol or that stretch is no longer in the data files.
 */
export function useSessionCandles(result: Pick<MatchResult, 'symbol' | 'sessionStart' | 'sessionEnd'>) {
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [candles, setCandles] = useState<Candle[]>([]);
  const [attempt, setAttempt] = useState(0);
  const { symbol, sessionStart, sessionEnd } = result;

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    (async () => {
      const info = (await loadIndex()).find((i) => i.symbol === symbol);
      if (!info) return { status: 'missing' as const, candles: [] };
      const session = sessionCandles(await loadCandles(info), sessionStart, sessionEnd);
      return session.length >= 2 ? { status: 'ready' as const, candles: session } : { status: 'missing' as const, candles: [] };
    })()
      .then((r) => {
        if (cancelled) return;
        setCandles(r.candles);
        setStatus(r.status);
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [symbol, sessionStart, sessionEnd, attempt]);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);
  return { status, candles, retry };
}
