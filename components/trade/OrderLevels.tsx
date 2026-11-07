'use client';

import { useId } from 'react';
import { fmtMoney } from '@/lib/format';
import { bracketPlan } from '@/lib/orders';
import type { Brackets, Side } from '@/lib/types';
import { cn } from '@/lib/utils';

const FIELD = 'flex items-center bg-[#0F172A]/70 border hover:border-slate-600 focus-within:border-blue-500 rounded-lg transition-colors';

export type LevelsInput = { on: boolean; stopText: string; targetText: string };
export const NO_LEVELS: LevelsInput = { on: false, stopText: '', targetText: '' };

/** Empty clears a level; anything that is not a positive number is NaN (invalid). */
export function parseLevel(text: string): number | null {
  const t = text.trim().replace(/,/g, '');
  if (t === '') return null;
  return /^\d+(\.\d+)?$/.test(t) ? Number(t) : Number.NaN;
}

/** The levels to send, null when off or both empty, 'invalid' when one is not a number. */
export function levelsFrom(input: LevelsInput): Brackets | null | 'invalid' {
  if (!input.on) return null;
  const stopLoss = parseLevel(input.stopText);
  const takeProfit = parseLevel(input.targetText);
  if (Number.isNaN(stopLoss) || Number.isNaN(takeProfit)) return 'invalid';
  return stopLoss === null && takeProfit === null ? null : { stopLoss, takeProfit };
}

type OrderLevelsProps = {
  value: LevelsInput;
  onChange: (v: LevelsInput) => void;
  /** The side the levels fit (a stop below the price is a buy), or null when they fit neither. */
  side: Side | null;
  units: number;
  price: number;
  currency: string;
  balance: number;
  disabled?: boolean;
};

/** Plan M15: an optional stop and target sent with the next order, with its risk and reward. */
export function OrderLevels({ value, onChange, side, units, price, currency, balance, disabled = false }: OrderLevelsProps) {
  const ids = { toggle: useId(), stop: useId(), target: useId(), help: useId() };
  const parsed = levelsFrom(value);
  const plan = side && parsed && parsed !== 'invalid' && units > 0 ? bracketPlan(side, units, price, parsed) : null;

  return (
    <div className="rounded-lg border border-slate-800 bg-[#0b1120]/40 p-2.5 space-y-2">
      <label htmlFor={ids.toggle} className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer">
        <input id={ids.toggle} type="checkbox" checked={value.on} disabled={disabled} onChange={(e) => onChange({ ...value, on: e.target.checked })} className="accent-blue-500" />
        Attach stop / target to this order
      </label>
      {value.on && (
        <>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                [ids.stop, 'Stop loss', 'stopText', 'text-rose-300'],
                [ids.target, 'Take profit', 'targetText', 'text-emerald-300'],
              ] as const
            ).map(([id, label, key, tone]) => (
              <div key={id}>
                <label htmlFor={id} className={cn('block text-[10px] mb-0.5', tone)}>
                  {label}
                </label>
                <div className={cn(FIELD, 'border-slate-700/50')}>
                  <input
                    id={id}
                    inputMode="decimal"
                    placeholder="—"
                    value={value[key]}
                    disabled={disabled}
                    aria-describedby={ids.help}
                    onChange={(e) => onChange({ ...value, [key]: e.target.value })}
                    className="w-full bg-transparent px-2.5 py-1.5 text-xs font-mono text-slate-100 placeholder:text-faint outline-none disabled:opacity-50"
                  />
                </div>
              </div>
            ))}
          </div>
          <p id={ids.help} className={cn('text-[11px]', parsed === 'invalid' ? 'text-rose-300' : 'text-faint')}>
            {parsed === 'invalid'
              ? 'Enter a price using digits only, or leave it empty.'
              : !parsed
                ? 'Enter a stop, a target or both. A buy needs the stop below the price; a sell, above.'
                : plan
                  ? `${side === 'buy' ? 'Buy' : 'Sell'}: risk ${plan.risk !== null ? `${fmtMoney(plan.risk, currency)} (${((plan.risk / balance) * 100).toFixed(2)}% of balance)` : '—'} · reward ${plan.reward !== null ? fmtMoney(plan.reward, currency) : '—'}${plan.ratio !== null ? ` · 1 : ${plan.ratio.toFixed(1)}` : ''}. Before fees and slippage.`
                  : 'These levels do not fit a buy or a sell at the current price.'}
          </p>
        </>
      )}
    </div>
  );
}
