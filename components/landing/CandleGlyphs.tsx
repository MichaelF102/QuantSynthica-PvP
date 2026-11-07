import { isRisingPx, type CandlePx } from '@/lib/landing/geometry';

export const UP = '#10b981';
export const DOWN = '#f43f5e';

/** Illustrative candles in SVG pixels. Shapes only, not market data. */
export function CandleGlyphs({ candles, body = 10 }: { candles: readonly CandlePx[]; body?: number }) {
  return (
    <>
      {candles.map((k) => {
        const color = isRisingPx(k) ? UP : DOWN;
        return (
          <g key={k.x}>
            <line x1={k.x} x2={k.x} y1={k.h} y2={k.l} stroke={color} strokeWidth={1.5} />
            <rect x={k.x - body / 2} y={Math.min(k.o, k.c)} width={body} height={Math.max(2, Math.abs(k.o - k.c))} rx={1.5} fill={color} />
          </g>
        );
      })}
    </>
  );
}
