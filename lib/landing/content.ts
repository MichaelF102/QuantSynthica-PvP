// Landing-page copy. Text only, no numbers that pretend to be market data.

export const NAV_LINKS = [
  { id: 'how', label: 'How it works' },
  { id: 'rules', label: 'Rules' },
  { id: 'features', label: 'Features' },
  { id: 'markets', label: 'Markets' },
  { id: 'faq', label: 'Questions' },
] as const;

export type NavId = (typeof NAV_LINKS)[number]['id'];

export const HERO_PHRASES = ['Beat the clock.', 'Survive the drawdown.', 'Read the tape.'] as const;

export const STEPS = [
  { title: 'Pick a market', body: 'Choose from the curated list of futures, forex, indices and stocks.' },
  { title: 'Replay history', body: 'Candles appear one at a time. Nothing ahead of the current candle is shown.' },
  { title: 'Trade within the limits', body: 'Buy or sell as the chart develops, and stay inside the drawdown for the full ten minutes.' },
  { title: 'Review your results', body: 'See the return, win rate, profit factor, drawdown and every trade with its entry and exit.' },
] as const;

export const FEATURES = [
  { title: 'Replay controls', body: 'Play, pause, step one candle at a time, or jump to a point in the session. Speed is 1x, 2x or 5x.' },
  { title: 'Timeframes', body: 'Read the same session on 1m, 5m, 15m, 1h or 1d candles.' },
  { title: 'Random sessions', body: 'Every match starts at a different point in history, so you cannot memorise the chart.' },
  { title: 'Trade panel', body: 'Market buy and sell, sized in units or as a percentage of your balance.' },
  { title: 'Results analytics', body: 'Win rate, profit factor, max drawdown and an equity curve for every match.' },
  { title: 'Saved in your browser', body: 'Results stay on this device. There are no accounts, and nothing is uploaded.' },
] as const;

export type RuleId = 'balance' | 'time' | 'drawdown' | 'leverage' | 'fills' | 'sessions';

export const RULES: readonly { id: RuleId; label: string; headline: string; description: string }[] = [
  { id: 'balance', label: 'Starting balance', headline: '$100,000 to start', description: 'A virtual balance of $100,000, or ₹10,00,000 for INR markets. Every match starts the same way.' },
  { id: 'time', label: 'Time limit', headline: 'Ten minutes of real time', description: 'The clock runs in real time and pauses when you pause replay.' },
  { id: 'drawdown', label: 'Max drawdown', headline: 'Stay within 5% of your peak', description: 'Equity can fall 5% from its highest point. Go past it and the match ends, even with time left.' },
  { id: 'leverage', label: 'Leverage', headline: 'No leverage', description: 'An order larger than your balance is rejected. You trade only what you have.' },
  { id: 'fills', label: 'Fills', headline: 'Fills at the candle close', description: 'Orders fill at the close of the candle you are looking at. The next candle stays hidden.' },
  { id: 'sessions', label: 'Sessions', headline: 'A random stretch of history', description: 'Each match draws a random window from the curated markets, so no two matches look the same.' },
];

export const ANATOMY = [
  { id: 'high', label: 'High', y: 30, text: 'The highest price in the candle. The top wick reaches it.' },
  { id: 'close', label: 'Close', y: 70, text: 'Where the candle finished. On a rising candle this is the top of the body. Fills use this price.' },
  { id: 'open', label: 'Open', y: 190, text: 'Where the candle started. On a rising candle this is the bottom of the body.' },
  { id: 'low', label: 'Low', y: 230, text: 'The lowest price in the candle. The bottom wick reaches it.' },
] as const;

export const FAQS: readonly [string, string][] = [
  ['Is this real money?', 'No. Matches use a virtual balance, and nothing is sent to a broker.'],
  ['Is it free?', 'Practice is free in v1. There are no accounts, so there is nothing to pay for yet.'],
  ['What data does it use?', 'Historical price data for the markets in the curated list. Each match draws a random window from that history.'],
  ['Do I need trading experience?', 'No. The loss limit is the hard part, and most people learn more from it than from the charts.'],
  ['Can I review my trades afterwards?', 'Yes. Every match keeps its trade list and equity curve in this browser.'],
  ['Can I pause a match?', 'Yes. Pausing stops the candles and the ten-minute timer together, so a pause never costs you time. Prices and fills do not change while the replay is paused, and you can resume from the same candle.'],
  ['Can I change the length or the loss limit?', 'Yes, at setup. You can choose the match length, the starting balance and the maximum drawdown before you start. The defaults are ten minutes, the balance for the market you pick, and a 5% limit.'],
  ['What happens when a match ends?', 'Any open position closes at the last candle you saw, and the match report opens. It shows the return, win rate, profit factor, max drawdown, every trade with its entry and exit, and an equity curve.'],
  ['Why can I not see the future candles?', 'So your decisions use only what you would have known at the time. The chart never shows a candle beyond the current one, and the trading logic checks this every time a candle appears.'],
];

/**
 * Index of the section the reader is in: of the sections whose top has crossed `line` px from the
 * viewport top, the one closest to it. Independent of link order, since the nav order need not
 * match the page order.
 */
export function activeSection(tops: readonly (number | null)[], line: number): number | null {
  let current: number | null = null;
  let best = -Infinity;
  tops.forEach((top, i) => {
    if (top !== null && top <= line && top > best) {
      best = top;
      current = i;
    }
  });
  return current;
}

/** Scroll progress 0..1. */
export function scrollProgress(scrollY: number, scrollHeight: number, viewport: number): number {
  const max = scrollHeight - viewport;
  return max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0;
}
