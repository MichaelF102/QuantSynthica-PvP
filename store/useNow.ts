'use client';

import { useEffect, useState } from 'react';

/** Re-renders every `ms` while `active` (countdowns and the shared match clock). */
export function useNow(active: boolean, ms = 200): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [active, ms]);
  return now;
}
