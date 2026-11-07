'use client';

import { useEffect, useRef, useState } from 'react';
import { duelAnnouncement, type AnnounceSnapshot } from '@/lib/multiplayer/announce';

/** A polite, visually hidden live region that speaks only important duel changes. */
export function DuelAnnouncer({ snapshot }: { snapshot: AnnounceSnapshot }) {
  const prev = useRef<AnnounceSnapshot>(snapshot);
  const [text, setText] = useState('');
  useEffect(() => {
    const said = duelAnnouncement(prev.current, snapshot);
    prev.current = snapshot;
    if (said) setText(said);
  }, [snapshot]);
  return (
    <p role="status" aria-live="polite" className="sr-only">
      {text}
    </p>
  );
}
