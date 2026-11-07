'use client';

import { useCallback, useState } from 'react';

/**
 * Linked highlight between a chart and its list. Hover or focus shows an item; a click pins it,
 * so it also works on touch. Hover wins over the pin while the pointer is on an item.
 */
export function useHighlight() {
  const [hovered, setHovered] = useState<number | null>(null);
  const [pinned, setPinned] = useState<number | null>(null);
  const active = hovered ?? pinned;

  const hoverProps = useCallback(
    (i: number) => ({
      onMouseEnter: () => setHovered(i),
      onMouseLeave: () => setHovered(null),
    }),
    [],
  );

  const itemProps = useCallback(
    (i: number) => ({
      onMouseEnter: () => setHovered(i),
      onMouseLeave: () => setHovered(null),
      onFocus: () => setHovered(i),
      onBlur: () => setHovered(null),
      onClick: () => setPinned((p) => (p === i ? null : i)),
      'aria-pressed': pinned === i,
    }),
    [pinned],
  );

  return { active, hoverProps, itemProps };
}

export type HighlightHoverProps = ReturnType<typeof useHighlight>['hoverProps'];
export type HighlightItemProps = ReturnType<typeof useHighlight>['itemProps'];
