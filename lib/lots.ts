// Lot-step arithmetic. Sizes are kept on the lot grid with integer maths so 0.1 + 0.2 never
// becomes 0.30000000000000004 units.

/** Decimal places of a lot step: 0.01 -> 2, 1 -> 0, 0.0001 -> 4. */
export function stepDecimals(lotStep: number): number {
  if (!(lotStep > 0)) throw new RangeError('lotStep must be positive');
  const s = lotStep.toString();
  if (s.includes('e-')) return Number(s.split('e-')[1]);
  const dot = s.indexOf('.');
  return dot < 0 ? 0 : s.length - dot - 1;
}

/** Rounds to the nearest lot (cleans float noise from sums of valid sizes). */
export function roundToStep(units: number, lotStep: number): number {
  const d = stepDecimals(lotStep);
  const r = Number((Math.round(units / lotStep) * lotStep).toFixed(d));
  return r === 0 ? 0 : r;
}

/** Rounds a size down (toward zero) to whole lots (CLAUDE.md §5 rule 2). */
export function floorToStep(units: number, lotStep: number): number {
  const d = stepDecimals(lotStep);
  const lots = Math.floor(Math.abs(units) / lotStep + 1e-9);
  const r = Number((lots * lotStep).toFixed(d)) * Math.sign(units);
  return r === 0 ? 0 : r;
}

/** % of balance -> units at `price`, rounded down to the lot step. */
export function percentToUnits(balance: number, percent: number, price: number, lotStep: number): number {
  if (!(balance > 0) || !(percent > 0) || !(price > 0)) return 0;
  return floorToStep((balance * Math.min(percent, 100)) / 100 / price, lotStep);
}
