'use client';

import { useState } from 'react';
import { hexGlow, hexGrid } from '@/lib/landing/geometry';

const S = 30;
const W = Math.sqrt(3) * S;
const VB_W = 1600;
const VB_H = 900;
const CELLS = hexGrid(S, VB_W, VB_H);

/** Decorative hexagon field behind the hero. The hovered cell lights up and the glow fades out to its neighbours. */
export function HexGrid() {
  const [hovered, setHovered] = useState<number | null>(null);
  const center = hovered === null ? null : CELLS[hovered];

  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 w-full h-full opacity-70 pointer-events-none [mask-image:radial-gradient(ellipse_at_center,#000_25%,transparent_75%)]"
    >
      {CELLS.map((h, i) => {
        const t = hexGlow(h, center, W);
        return (
          <polygon
            key={h.key}
            className="lp-hex"
            points={h.points}
            onPointerEnter={() => setHovered(i)}
            onPointerLeave={() => setHovered((cur) => (cur === i ? null : cur))}
            style={t > 0.01 ? { fill: `rgba(59, 130, 246, ${(0.34 * t).toFixed(3)})`, stroke: `rgba(96, 165, 250, ${(0.35 + 0.65 * t).toFixed(3)})` } : undefined}
          />
        );
      })}
    </svg>
  );
}
