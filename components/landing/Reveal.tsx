'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Fades and lifts its content the first time it scrolls into view, then adds `rv-on`, which
 * starts the entrance animations inside. Under reduced motion the CSS shows it at once.
 */
export function Reveal({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      // No ratio threshold: a section taller than the screen could never reach one. It reveals once
      // its top is 10% above the bottom of the viewport.
      { threshold: 0, rootMargin: '0px 0px -10% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className={cn('lp-reveal', shown && 'rv-on', className)}>
      {children}
    </div>
  );
}
