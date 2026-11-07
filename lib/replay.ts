import { CANDLES_PER_SEC_1X } from './config';

/** A frame longer than this (a stalled or background tab) counts as this long, so nothing jumps. */
export const MAX_FRAME_MS = 250;

export function clampFrame(dtMs: number): number {
  if (!Number.isFinite(dtMs) || dtMs <= 0) return 0;
  return Math.min(dtMs, MAX_FRAME_MS);
}

/**
 * How many candles to reveal for a frame of `dtMs` at `speed`, carrying the fractional remainder
 * to the next frame. Plan D1: 1x = CANDLES_PER_SEC_1X candles per real second.
 */
export function candlesForFrame(carry: number, dtMs: number, speed: number, perSec1x = CANDLES_PER_SEC_1X): { count: number; carry: number } {
  const total = carry + (clampFrame(dtMs) * perSec1x * speed) / 1000;
  // Tiny epsilon so 1000 frames of exactly 1 ms land on whole candles despite float error.
  const count = Math.floor(total + 1e-9);
  return { count, carry: Math.max(0, total - count) };
}
