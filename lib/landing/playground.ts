// Fill playground on the landing page: an illustrative close sequence (not market data), revealed
// one candle at a time. A fill uses the close of the candle on screen, as in a real match.

export const ILLUSTRATIVE_CLOSES: readonly number[] = [100, 103, 101, 106, 104, 108, 105, 102, 104, 99, 101, 97, 100, 103];
export const PLAYGROUND_START = 3;

export type PlaySide = 'Buy' | 'Sell';
export type PlayFill = { side: PlaySide; index: number };
export type Playground = { shown: number; fill: PlayFill | null };

export const initialPlayground = (): Playground => ({ shown: PLAYGROUND_START, fill: null });

export function revealNext(p: Playground, total = ILLUSTRATIVE_CLOSES.length): Playground {
  return { ...p, shown: Math.min(total, p.shown + 1) };
}

/** Fills at the last revealed candle. A second fill is ignored: the playground allows one. */
export function placeFill(p: Playground, side: PlaySide): Playground {
  if (p.fill || p.shown < 1) return p;
  return { ...p, fill: { side, index: p.shown - 1 } };
}

export const canReveal = (p: Playground, total = ILLUSTRATIVE_CLOSES.length) => p.shown < total;

export function playgroundFeedback(p: Playground, closes: readonly number[] = ILLUSTRATIVE_CLOSES): string {
  const { fill } = p;
  const last = p.shown - 1;
  if (!fill) return 'Reveal a candle, then buy or sell. Your fill uses the close of the candle on screen.';
  if (last === fill.index) return 'Filled at this candle’s close. Reveal the next candle to see how the price moved.';
  const fillPrice = closes[fill.index];
  const now = closes[last];
  if (now === fillPrice) return `Price is unchanged from your fill. For a ${fill.side.toLowerCase()}, that is flat right now.`;
  const moved = now > fillPrice ? 'higher' : 'lower';
  const good = fill.side === 'Buy' ? now > fillPrice : now < fillPrice;
  return `Price is ${moved} than your fill. For a ${fill.side.toLowerCase()}, that is ${good ? 'in profit' : 'a loss'} right now.`;
}
