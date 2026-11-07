'use client';

import { useEffect, useState } from 'react';
import { activeSection } from '@/lib/landing/content';

/** The id of the section whose top has scrolled past 40% of the viewport, or null above them all. */
export function useActiveSection(ids: readonly string[]): string | null {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const tops = ids.map((id) => document.getElementById(id)?.getBoundingClientRect().top ?? null);
      const i = activeSection(tops, window.innerHeight * 0.4);
      setActive(i === null ? null : ids[i]);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [ids]);

  return active;
}
