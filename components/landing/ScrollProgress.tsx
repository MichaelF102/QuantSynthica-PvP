'use client';

import { useEffect, useState } from 'react';
import { scrollProgress } from '@/lib/landing/content';

/** 2px bar fixed to the top of the viewport. Hidden under reduced motion. */
export function ScrollProgress() {
  const [p, setP] = useState(0);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      setP(scrollProgress(window.scrollY, document.documentElement.scrollHeight, window.innerHeight));
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
  }, []);

  return (
    <div
      aria-hidden
      className="lp-scroll-progress fixed top-0 inset-x-0 h-0.5 z-[60] origin-left bg-gradient-to-r from-blue-700 to-sky-400"
      style={{ transform: `scaleX(${p})` }}
    />
  );
}
