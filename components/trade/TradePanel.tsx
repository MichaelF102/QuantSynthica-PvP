'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { ArrowLeftRight, X } from 'lucide-react';
import { Badge, Button, Panel, Segmented } from '@/components/ui';
import { costsOf, positionFor, positionPnl } from '@/lib/engine';
import { fmtMoney, fmtPrice, fmtSignedMoney, fmtUnits, priceDecimalsFor, shortSymbol } from '@/lib/format';
import { TRADE_INTENT_EVENT, type TradeIntentDetail } from '@/lib/hotkeys';
import { orderErrorText, percentSize, previewOrder, unitsToPercent, type SizeInput, type SizeMode } from '@/lib/orders';
import type { Brackets, MatchState, SymbolInfo } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useMatchStore } from '@/store/matchStore';
import { BracketEditor } from './BracketEditor';
import { NO_LEVELS, OrderLevels, levelsFrom, type LevelsInput } from './OrderLevels';
import { QueuedOrderNote } from './QueuedOrderNote';

const QUICK = [10, 25, 50, 100] as const;
const MODES = [
  { value: 'units' as SizeMode, label: 'Units' },
  { value: 'percent' as SizeMode, label: '% of balance' },
];

export type TradeInfo = Pick<SymbolInfo, 'symbol' | 'priceDecimals'>;

type TradePanelViewProps = {
  match: MatchState | null;
  info: TradeInfo | null;
  /** Plan M15: `brackets` are the stop / target attached on the ticket, or null. */
  onBuy: (size: SizeInput, brackets: Brackets | null) => void;
  onSell: (size: SizeInput, brackets: Brackets | null) => void;
  onClose: () => void;
  /** Plan M12: stop-loss / take-profit. Omitted hides the editor. */
  onSetBrackets?: (brackets: Brackets) => boolean | void;
  /** Plan M12: cancel the order waiting for the next open. */
  onCancelQueued?: () => void;
  /** An order is on its way to the server (1v1): buttons wait for the answer. */
  sending?: boolean;
  /** Replaces the default panel description. */
  description?: string;
};

/** Practice: the panel wired to the match store. */
export function TradePanel() {
  const match = useMatchStore((s) => s.match);
  const info = useMatchStore((s) => s.info);
  const buy = useMatchStore((s) => s.buy);
  const sell = useMatchStore((s) => s.sell);
  const closePos = useMatchStore((s) => s.closePosition);
  const setBrackets = useMatchStore((s) => s.setBrackets);
  const cancelQueued = useMatchStore((s) => s.cancelQueued);
  return <TradePanelView match={match} info={info} onBuy={buy} onSell={sell} onClose={closePos} onSetBrackets={setBrackets} onCancelQueued={cancelQueued} />;
}

/** Market order entry (CLAUDE.md §1, §5). The engine decides what fills; this only previews. */
export function TradePanelView({ match, info, onBuy: buy, onSell: sell, onClose: closePos, onSetBrackets, onCancelQueued, sending = false, description }: TradePanelViewProps) {
  const [mode, setMode] = useState<SizeMode>('percent');
  const [raw, setRaw] = useState('10');
  const ids = { size: useId(), buyWhy: useId(), sellWhy: useId() };
  // Keyboard order entry (CLAUDE.md §10): B / S pick a side and focus the size; Enter places it.
  const [intent, setIntent] = useState<'buy' | 'sell' | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [levels, setLevels] = useState<LevelsInput>(NO_LEVELS);
  const latest = useRef<{ intent: typeof intent; size: SizeInput; brackets: Brackets | null; send: (side: 'buy' | 'sell') => void }>({ intent: null, size: { mode, value: Number.NaN }, brackets: null, send: () => {} });

  useEffect(() => {
    const onIntent = (e: Event) => {
      const detail = (e as CustomEvent<TradeIntentDetail>).detail;
      if ('intent' in detail) {
        setIntent(detail.intent);
        inputRef.current?.focus();
        inputRef.current?.select();
        return;
      }
      const { intent: side, send } = latest.current;
      if (side) send(side);
    };
    window.addEventListener(TRADE_INTENT_EVENT, onIntent);
    return () => window.removeEventListener(TRADE_INTENT_EVENT, onIntent);
  }, []);

  if (!match || !info) return null;
  const { lotStep, currency } = match.config;
  const decimals = priceDecimalsFor(info);
  const value = raw.trim() === '' ? Number.NaN : Number(raw);
  const size = { mode, value };
  const parsedLevels = levelsFrom(levels);
  const brackets = parsedLevels === 'invalid' ? null : parsedLevels;
  const preview = previewOrder(match, size, brackets);
  // Levels that are not numbers block both sides until fixed.
  const levelsBlocked = parsedLevels === 'invalid';
  const send = (side: 'buy' | 'sell') => {
    if (levelsBlocked || (side === 'buy' ? preview.buyError : preview.sellError)) return;
    (side === 'buy' ? buy : sell)(size, brackets);
    // The levels go with this order only.
    if (brackets) setLevels(NO_LEVELS);
  };
  latest.current = { intent, size, brackets, send };
  const position = positionFor(match);
  const pnl = position ? positionPnl(match, position) : null;
  const nextOpen = costsOf(match.config).fillModel === 'next_open';
  const live = match.status !== 'ended';
  const sliderPct = mode === 'percent' ? (Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0) : unitsToPercent(match, preview.units);

  const setPercent = (p: number) => {
    if (mode === 'percent') setRaw(String(p));
    else setRaw(String(percentSize(match, p)));
  };

  const switchMode = (next: SizeMode) => {
    if (next === mode) return;
    // Keep the same order size when switching how it is expressed.
    if (next === 'percent') setRaw(preview.units > 0 ? String(Math.round(unitsToPercent(match, preview.units) * 100) / 100) : '');
    else setRaw(preview.units > 0 ? String(preview.units) : '');
    setMode(next);
  };

  const buyWhy = preview.buyError ? orderErrorText(preview.buyError, match) : null;
  const sellWhy = preview.sellError ? orderErrorText(preview.sellError, match) : null;
  const same = buyWhy !== null && buyWhy === sellWhy;
  // When both sides share a reason, both buttons point at one line.
  const sellWhyId = same ? ids.buyWhy : ids.sellWhy;

  return (
    <Panel title="Trade" description={description ?? `Market orders fill at the ${nextOpen ? 'next candle open' : 'current close'} · ${shortSymbol(info.symbol)}`}
      icon={ArrowLeftRight}
      info={`${nextOpen ? 'Orders wait for the next candle and fill at its open.' : 'Orders fill at the close of the latest revealed candle.'} No leverage: a position plus fees cannot be worth more than your balance.`}
    >
      <div className="space-y-3">
        <Segmented<SizeMode> label="Size mode" options={MODES} value={mode} onChange={switchMode} className="w-full [&>button]:flex-1" />

        <div>
          <label htmlFor={ids.size} className="block text-[10px] uppercase tracking-wider text-slate-400 mb-1">
            {mode === 'percent' ? 'Size (% of balance)' : `Size (units, step ${fmtUnits(lotStep, lotStep)})`}
          </label>
          <div className="flex items-center bg-[#0F172A]/70 border border-slate-700/50 hover:border-slate-600 focus-within:border-blue-500 rounded-lg transition-colors">
            <input
              ref={inputRef}
              id={ids.size}
              data-trade-size
              type="number"
              inputMode="decimal"
              min={0}
              max={mode === 'percent' ? 100 : undefined}
              step={mode === 'percent' ? 1 : lotStep}
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              className="w-full bg-transparent px-3 py-2 text-sm font-mono text-slate-100 placeholder:text-faint outline-none [appearance:textfield]"
              placeholder="0"
            />
            <span className="pr-3 text-xs font-mono text-slate-400">{mode === 'percent' ? '%' : shortSymbol(info.symbol)}</span>
          </div>
        </div>

        <div className="space-y-1.5">
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={Math.round(sliderPct)}
            onChange={(e) => setPercent(Number(e.target.value))}
            aria-label="Size as % of balance"
            aria-valuetext={`${Math.round(sliderPct)}% of balance`}
            className="w-full accent-blue-500"
          />
          <div className="grid grid-cols-4 gap-1.5">
            {QUICK.map((p) => (
              <Button key={p} variant="secondary" className="font-mono px-0" onClick={() => setPercent(p)}>
                {p}%
              </Button>
            ))}
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] font-mono rounded-lg border border-slate-800 bg-[#0b1120]/60 p-2.5">
          <dt className="text-faint">Units</dt>
          <dd className="text-right text-slate-200">{preview.units > 0 ? fmtUnits(preview.units, lotStep) : '—'}</dd>
          <dt className="text-faint">Notional</dt>
          <dd className="text-right text-slate-200">{preview.units > 0 ? fmtMoney(preview.notional, currency) : '—'}</dd>
          <dt className="text-faint">{nextOpen ? 'Last close' : 'Fill @'}</dt>
          <dd className="text-right text-slate-200">{fmtPrice(preview.price, decimals)}</dd>
          {preview.fee > 0 && (
            <>
              <dt className="text-faint">Fee</dt>
              <dd className="text-right text-slate-200">{fmtMoney(preview.fee, currency)}</dd>
            </>
          )}
          <dt className="text-faint">Balance</dt>
          <dd className="text-right text-slate-200">{fmtMoney(match.balance, currency)}</dd>
        </dl>

        <OrderLevels
          value={levels}
          onChange={setLevels}
          side={brackets ? (!preview.buyError ? 'buy' : !preview.sellError ? 'sell' : null) : null}
          units={preview.units}
          price={preview.price}
          currency={currency}
          balance={match.balance}
          disabled={!live}
        />

        <div className="grid grid-cols-2 gap-2">
          <Button variant="buy" className={cn('py-2.5 text-sm min-h-10', intent === 'buy' && 'ring-2 ring-emerald-300/80 ring-offset-2 ring-offset-[#0b1222]')} aria-keyshortcuts="B" disabled={Boolean(preview.buyError) || levelsBlocked || sending} aria-describedby={buyWhy ? ids.buyWhy : undefined} onClick={() => send('buy')}>
            {sending ? 'Sending…' : 'Buy'}
          </Button>
          <Button variant="sell" className={cn('py-2.5 text-sm min-h-10', intent === 'sell' && 'ring-2 ring-rose-300/80 ring-offset-2 ring-offset-[#0b1222]')} aria-keyshortcuts="S" disabled={Boolean(preview.sellError) || levelsBlocked || sending} aria-describedby={sellWhy ? sellWhyId : undefined} onClick={() => send('sell')}>
            {sending ? 'Sending…' : 'Sell'}
          </Button>
        </div>
        {match.queued && <QueuedOrderNote order={match.queued} symbol={info.symbol} lotStep={lotStep} onCancel={onCancelQueued} disabled={!live || sending} />}
        {intent && <p className="text-[11px] text-faint">Press Enter in the size box to {intent}.</p>}
        {(buyWhy || sellWhy) && (
          <div className="text-[11px] text-amber-300 space-y-0.5">
            {buyWhy && <p id={ids.buyWhy}>{same ? buyWhy : `Buy: ${buyWhy}`}</p>}
            {sellWhy && !same && <p id={ids.sellWhy}>Sell: {sellWhy}</p>}
          </div>
        )}

        <div className="border-t border-slate-800 pt-3">
          {position && pnl !== null ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Badge tone={position.units > 0 ? 'emerald' : 'rose'}>{position.units > 0 ? 'Long' : 'Short'}</Badge>
                <span className={cn('text-sm font-mono font-bold', pnl > 0 ? 'text-emerald-400' : pnl < 0 ? 'text-rose-400' : 'text-slate-300')}>{fmtSignedMoney(pnl, currency)}</span>
              </div>
              <p className="text-[11px] font-mono text-slate-400">
                {fmtUnits(Math.abs(position.units), lotStep)} {shortSymbol(info.symbol)} @ {fmtPrice(position.avgEntry, decimals)}
              </p>
              <Button variant="secondary" className="w-full" disabled={!live || sending || Boolean(match.queued)} onClick={closePos}>
                <X className="w-3.5 h-3.5" aria-hidden /> Close position
              </Button>
              {onSetBrackets && (
                <div className="border-t border-slate-800 pt-3">
                  <BracketEditor position={position} decimals={decimals} onSet={onSetBrackets} disabled={!live || sending} />
                </div>
              )}
            </div>
          ) : (
            <p className="text-[11px] text-faint">No open position.</p>
          )}
        </div>
      </div>
    </Panel>
  );
}
