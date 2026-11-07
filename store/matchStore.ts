import { createStore, type StoreApi } from 'zustand/vanilla';
import { useStore } from 'zustand';
import { aggregate, appendToAggregate } from '@/lib/aggregate';
import { DEFAULT_TIMEFRAME, SPEEDS } from '@/lib/config';
import { OrderError, advance, cancelQueued, closePosition, createMatch, drawdownPct, endMatch, pause, placeMarketOrder, play, setBrackets, tick } from '@/lib/engine';
import { priceDecimalsFor } from '@/lib/format';
import { cancelMessage, fillMessage, levelsText, orderErrorText, queuedMessage, toOrderRequest, type SizeInput } from '@/lib/orders';
import { candlesForFrame, clampFrame } from '@/lib/replay';
import { buildResult, type MatchResult } from '@/lib/results';
import { saveResult } from '@/lib/storage';
import type { ChallengeRef } from '@/lib/challenge';
import type { Brackets, Candle, MatchConfig, MatchState, Session, SymbolInfo, Timeframe } from '@/lib/types';
import { toastStore, type ToastKind } from './toastStore';

export type Speed = (typeof SPEEDS)[number];

/** Share of the drawdown limit at which a one-time warning is shown (plan M7). */
export const DRAWDOWN_WARN_SHARE = 0.8;

export type MatchStore = {
  match: MatchState | null;
  matchId: string | null;
  info: SymbolInfo | null;
  limitedData: boolean;
  speed: Speed;
  timeframe: Timeframe;
  /** Aggregated bars for `timeframe`, built only from revealed candles. This is what the chart draws. */
  bars: Candle[];
  /** Fractional candles carried between frames. */
  carry: number;
  /** Set once, when the match ends. */
  result: MatchResult | null;
  /** False if the finished result could not be saved in this browser. */
  resultSaved: boolean;
  /** True once drawdown has passed DRAWDOWN_WARN_SHARE of the limit in this match. */
  drawdownWarned: boolean;
  /** Plan M13 C5: the challenge this match answers, saved with the result. */
  challenge: ChallengeRef | null;

  start: (args: { config: MatchConfig; session: Session; info: SymbolInfo; challenge?: ChallengeRef | null }) => void;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  setSpeed: (speed: Speed) => void;
  setTimeframe: (tf: Timeframe) => void;
  /** Pause, then reveal one candle. */
  step: () => void;
  /** Reveal `n` candles at once (forward only, plan D5). */
  jumpBy: (n: number) => void;
  /** Reveal candles until the current candle's time is at or after `unixSec`. */
  jumpToTime: (unixSec: number) => void;
  /** One animation frame of `dtMs` while running: advances the timer, then the candles. */
  frame: (dtMs: number) => void;
  /** Market orders (CLAUDE.md §5). Return true when filled; a rejection leaves the state unchanged. */
  /** Plan M15: `brackets` attaches a stop and/or target to the order. */
  buy: (size: SizeInput, brackets?: Brackets | null) => boolean;
  sell: (size: SizeInput, brackets?: Brackets | null) => boolean;
  closePosition: () => boolean;
  /** Plan M12: set or clear the position's stop-loss / take-profit. True when accepted. */
  setBrackets: (brackets: Brackets) => boolean;
  /** Plan M12: cancel the order waiting for the next open. */
  cancelQueued: () => void;
  /** The player ends the match before the timer (after confirming in the UI). */
  endEarly: () => void;
  reset: () => void;
};

export type Notify = (kind: ToastKind, message: string) => void;

export type MatchStoreDeps = {
  now?: () => number;
  notify?: Notify;
  persist?: (result: MatchResult) => boolean;
  newId?: () => string;
};

const defaultNotify: Notify = (kind, message) => void toastStore.getState().push(kind, message);
const defaultId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `m-${Date.now()}-${Math.random().toString(36).slice(2)}`);

const INITIAL = {
  match: null,
  matchId: null,
  info: null,
  limitedData: false,
  speed: 1 as Speed,
  timeframe: DEFAULT_TIMEFRAME as Timeframe,
  bars: [] as Candle[],
  carry: 0,
  result: null,
  resultSaved: true,
  drawdownWarned: false,
  challenge: null as ChallengeRef | null,
};

/** Advance `n` times (stopping if the match ends) and extend the bars with the newly revealed candles. */
function advanceN(match: MatchState, bars: Candle[], tf: Timeframe, n: number): { match: MatchState; bars: Candle[] } {
  let m = match;
  for (let i = 0; i < n && m.status !== 'ended'; i++) m = advance(m);
  let b = bars;
  for (let i = match.cursor + 1; i <= m.cursor; i++) b = appendToAggregate(b, m.candles[i], tf);
  return { match: m, bars: b };
}

export function createMatchStore({ now = Date.now, notify = defaultNotify, persist = saveResult, newId = defaultId }: MatchStoreDeps = {}): StoreApi<MatchStore> {
  return createStore<MatchStore>()((set, get) => {
    /**
     * The only way the match changes after start. Raises the drawdown warning once, and when
     * the match ends builds and saves the result exactly once.
     */
    const commit = (next: MatchState, extra: Partial<MatchStore> = {}) => {
      const s = get();
      const patch: Partial<MatchStore> = { ...extra, match: next };
      if (!s.drawdownWarned && next.status !== 'ended' && drawdownPct(next) >= next.config.maxDrawdownPct * DRAWDOWN_WARN_SHARE) {
        patch.drawdownWarned = true;
      }
      if (s.match && s.info) announceAuto(s.match, next, s.info);
      if (next.status === 'ended' && !s.result && s.info && s.matchId) {
        const result = buildResult(next, s.info, s.matchId, now(), s.challenge ?? undefined);
        patch.result = result;
        patch.carry = 0;
        let saved = false;
        try {
          saved = persist(result);
        } catch {
          saved = false;
        }
        patch.resultSaved = saved;
      }
      set(patch);
    };

    const fmtOpts = (info: SymbolInfo) => ({ lotStep: info.lotStep, priceDecimals: priceDecimalsFor(info), currency: info.currency });

    /**
     * Plan M12: fills and cancellations the player did not trigger directly (a queued order at the
     * open, a stop or target, a cancel at the open). Forced closes at the match end are shown by
     * the end dialog instead.
     */
    const announceAuto = (prev: MatchState, next: MatchState, info: SymbolInfo) => {
      for (const f of next.fills.slice(prev.fills.length)) {
        if (f.trigger === 'stop_loss') notify('error', fillMessage(f, fmtOpts(info)));
        else if (f.trigger === 'take_profit' || f.trigger === 'next_open') notify('success', fillMessage(f, fmtOpts(info)));
      }
      for (const c of next.cancelled.slice(prev.cancelled.length)) if (c.reason !== 'user' && c.reason !== 'match_end') notify('error', cancelMessage(c));
    };

    /** Runs an engine order, announces the fill, the queued order or the rejection (CLAUDE.md §10). */
    const trade = (run: (m: MatchState) => MatchState, verb?: string, brackets: Brackets | null = null): boolean => {
      const { match, info } = get();
      if (!match || !info) return false;
      try {
        const next = run(match);
        if (next === match) return false;
        commit(next);
        const levels = levelsText(brackets, priceDecimalsFor(info));
        if (next.queued && next.queued !== match.queued) notify('info', queuedMessage(next.queued, info.symbol, info.lotStep) + levels);
        else if (next.fills.length > match.fills.length) notify('success', fillMessage(next.fills[match.fills.length], { ...fmtOpts(info), verb }) + levels);
        return true;
      } catch (e) {
        if (!(e instanceof OrderError)) throw e;
        notify('error', `Order rejected: ${orderErrorText(e.code, match)}`);
        return false;
      }
    };

    const move = (n: number) => {
      const { match, bars, timeframe } = get();
      if (!match || match.status === 'ended' || n <= 0) return;
      // Stepping or jumping pauses the replay: the timer only runs while playing (rule 7).
      const moved = advanceN(pause(match, now()), bars, timeframe, n);
      commit(moved.match, { bars: moved.bars });
    };

    return {
      ...INITIAL,

      start: ({ config, session, info, challenge = null }) => {
        const match = createMatch(config, session.candles, session.startCursor);
        const { speed, timeframe } = get();
        set({ ...INITIAL, speed, timeframe, match, matchId: newId(), info, challenge, limitedData: session.limitedData, bars: aggregate(match.candles, timeframe, match.cursor) });
      },

      play: () => {
        const { match } = get();
        if (match && match.status !== 'ended') commit(play(match, now()));
      },

      pause: () => {
        const { match } = get();
        if (match && match.status === 'running') commit(pause(match, now()));
      },

      togglePlay: () => (get().match?.status === 'running' ? get().pause() : get().play()),

      setSpeed: (speed) => set({ speed, carry: 0 }),

      setTimeframe: (timeframe) => {
        const { match } = get();
        set({ timeframe, bars: match ? aggregate(match.candles, timeframe, match.cursor) : [] });
      },

      step: () => move(1),

      jumpBy: (n) => move(Math.floor(n)),

      jumpToTime: (unixSec) => {
        const { match } = get();
        if (!match) return;
        let target = match.cursor;
        while (target < match.candles.length - 1 && match.candles[target].time < unixSec) target++;
        move(target - match.cursor);
      },

      frame: (dtMs) => {
        const { match, bars, timeframe, speed, carry } = get();
        if (!match || match.status !== 'running') return;
        const dt = clampFrame(dtMs);
        const timed = tick(match, dt);
        if (timed.status === 'ended') return commit(timed);
        const step = candlesForFrame(carry, dt, speed);
        const moved = advanceN(timed, bars, timeframe, step.count);
        commit(moved.match, { bars: moved.bars, carry: step.carry });
      },

      buy: (size, brackets = null) => trade((m) => placeMarketOrder(m, toOrderRequest('buy', size, brackets)), undefined, brackets),
      sell: (size, brackets = null) => trade((m) => placeMarketOrder(m, toOrderRequest('sell', size, brackets)), undefined, brackets),
      closePosition: () => trade((m) => closePosition(m), 'Closed'),

      setBrackets: (brackets) => {
        const { match } = get();
        if (!match) return false;
        try {
          commit(setBrackets(match, brackets));
          return true;
        } catch (e) {
          if (!(e instanceof OrderError)) throw e;
          notify('error', orderErrorText(e.code, match));
          return false;
        }
      },

      cancelQueued: () => {
        const { match } = get();
        if (!match?.queued) return;
        commit(cancelQueued(match));
        notify('info', 'Order cancelled');
      },

      endEarly: () => {
        const { match } = get();
        if (match && match.status !== 'ended') commit(endMatch(match, 'user'));
      },

      reset: () => set({ ...INITIAL, speed: get().speed, timeframe: get().timeframe }),
    };
  });
}

/** The app's single match store. */
export const matchStore = createMatchStore();

export function useMatchStore<T>(selector: (s: MatchStore) => T): T {
  return useStore(matchStore, selector);
}
