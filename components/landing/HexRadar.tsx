'use client';

import { labelAnchor, pointsAttr, radarPoint } from '@/lib/landing/geometry';
import type { ProfileAxis } from '@/lib/landing/sampleReport';
import { clamp01 } from '@/lib/landing/sampleReport';
import type { HighlightHoverProps } from './useHighlight';

const CX = 220;
const CY = 170;
const R = 108;

/** Six-axis match profile. Labels are hover-linked to the tiles beside it. */
export function HexRadar({ axes, active, hoverProps }: { axes: readonly ProfileAxis[]; active: number | null; hoverProps: HighlightHoverProps }) {
  const n = axes.length;
  const ring = (f: number) => pointsAttr(axes.map((_, i) => radarPoint(i, n, R * f, CX, CY)));
  const data = axes.map((a, i) => radarPoint(i, n, R * clamp01(a.value), CX, CY));
  const summary = axes.map((a) => `${a.label} ${a.display}`).join(', ');

  return (
    <svg viewBox="0 0 440 340" role="img" aria-label={`Sample match profile (test fixture): ${summary}`} className="w-full max-w-[480px] h-auto">
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <polygon key={f} points={ring(f)} fill="none" stroke="#1e293b" />
      ))}
      {axes.map((a, i) => {
        const [x, y] = radarPoint(i, n, R, CX, CY);
        return <line key={a.label} x1={CX} y1={CY} x2={x} y2={y} stroke="#1e293b" />;
      })}
      <polygon className="lp-radar-area" points={pointsAttr(data)} fill="rgba(59, 130, 246, 0.2)" stroke="#60a5fa" strokeWidth={2} strokeLinejoin="round" />
      {data.map(([x, y], i) => (
        <circle key={axes[i].label} className="lp-radar-dot" cx={x} cy={y} r={active === i ? 6 : 3.5} fill="#bfdbfe" />
      ))}
      {axes.map((a, i) => {
        const [lx, ly] = radarPoint(i, n, R + 26, CX, CY);
        const anchor = labelAnchor(lx, CX);
        return (
          <g key={a.label} {...hoverProps(i)} className="cursor-default" style={{ opacity: active === null || active === i ? 1 : 0.45, transition: 'opacity 0.2s ease' }}>
            <text x={lx} y={ly} textAnchor={anchor} className="fill-slate-400" fontSize={12}>{a.label}</text>
            <text x={lx} y={ly + 14} textAnchor={anchor} className="font-mono fill-slate-100" fontSize={12}>{a.display}</text>
          </g>
        );
      })}
    </svg>
  );
}
