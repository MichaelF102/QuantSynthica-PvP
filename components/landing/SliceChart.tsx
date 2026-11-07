import type { CSSProperties, ReactNode } from 'react';
import { pieSlice, ringSegment } from '@/lib/landing/geometry';
import type { HighlightHoverProps } from './useHighlight';

const C = 130;

/**
 * Equal pie slices (inner = 0) or ring segments, linked to a list by `active`. Pointer hover only:
 * the list beside it is the keyboard route, so the chart stays out of the tab order.
 */
export function SliceChart({
  count,
  colors,
  inner = 0,
  active,
  hoverProps,
  label,
  center,
}: {
  count: number;
  colors: readonly string[];
  inner?: number;
  active: number | null;
  hoverProps: HighlightHoverProps;
  label: string;
  center: ReactNode;
}) {
  return (
    <svg viewBox="0 0 260 260" role="img" aria-label={label} className="w-full max-w-[420px] h-auto shrink-0 mx-auto lg:mx-0">
      {Array.from({ length: count }, (_, i) => {
        const { d, dx, dy } = inner > 0 ? ringSegment(i, count, 110, inner, C) : pieSlice(i, count, 110, C);
        const on = active === i;
        return (
          <g
            key={i}
            {...hoverProps(i)}
            className="cursor-pointer"
            style={{
              transform: on ? `translate(${dx}px, ${dy}px)` : 'translate(0px, 0px)',
              transition: 'transform 0.3s ease, opacity 0.3s ease',
              opacity: active === null || on ? 1 : 0.35,
            }}
          >
            <path className="lp-slice" style={{ '--i': i } as CSSProperties} d={d} fill={colors[i % colors.length]} stroke="#080d1a" strokeWidth={2} />
          </g>
        );
      })}
      {center}
    </svg>
  );
}
