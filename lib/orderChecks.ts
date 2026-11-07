import { costsOf } from './execution';
import { EPS, positionFor } from './matchRead';
import { exposureAfter } from './positions';
import type { MatchState, Side } from './types';

/** Rule 4 with costs (plan M12 C8): would this fill leave a position worth more than the cash, after the fee? */
export function exceedsBalance(state: MatchState, side: Side, units: number, price: number): boolean {
  const after = exposureAfter(positionFor(state), side, units, state.config.lotStep);
  return after.increases && after.units * price + costsOf(state.config).commission > state.balance + EPS;
}
