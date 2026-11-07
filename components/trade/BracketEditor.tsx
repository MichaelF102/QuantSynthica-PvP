'use client';

import { useEffect, useId, useState, type FormEvent } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui';
import { fmtPrice } from '@/lib/format';
import type { Brackets, Position } from '@/lib/types';
import { cn } from '@/lib/utils';

const FIELD = 'flex items-center bg-[#0F172A]/70 border border-slate-700/50 hover:border-slate-600 focus-within:border-blue-500 rounded-lg transition-colors';

type BracketEditorProps = {
  position: Position;
  decimals: number;
  /** Returns true when the levels were accepted. */
  onSet: (brackets: Brackets) => boolean | void;
  disabled?: boolean;
};

const toText = (v: number | null | undefined, decimals: number) => (v === null || v === undefined ? '' : v.toFixed(decimals));
/** Empty text clears a level; anything else that is not a positive number is invalid (NaN). */
const toLevel = (text: string): number | null => {
  const t = text.trim().replace(/,/g, '');
  if (t === '') return null;
  return /^\d+(\.\d+)?$/.test(t) ? Number(t) : Number.NaN;
};

/** Plan M12 C4: stop-loss and take-profit for the open position. The engine validates the levels. */
export function BracketEditor({ position, decimals, onSet, disabled = false }: BracketEditorProps) {
  const ids = { stop: useId(), target: useId(), help: useId() };
  const long = position.units > 0;
  const [stopText, setStopText] = useState(toText(position.stopLoss, decimals));
  const [targetText, setTargetText] = useState(toText(position.takeProfit, decimals));

  // Follow the engine when a level changes elsewhere (set, cleared, or a new position).
  useEffect(() => setStopText(toText(position.stopLoss, decimals)), [position.stopLoss, position.openedAt, decimals]);
  useEffect(() => setTargetText(toText(position.takeProfit, decimals)), [position.takeProfit, position.openedAt, decimals]);

  const stop = toLevel(stopText);
  const target = toLevel(targetText);
  const invalid = Number.isNaN(stop) || Number.isNaN(target);
  const unchanged = stop === (position.stopLoss ?? null) && target === (position.takeProfit ?? null);
  const hasLevels = position.stopLoss != null || position.takeProfit != null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!invalid && !unchanged) onSet({ stopLoss: stop, takeProfit: target });
  };

  return (
    <form onSubmit={submit} className="space-y-2" aria-describedby={ids.help}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-400">
        <ShieldCheck className="w-3.5 h-3.5" aria-hidden /> Stop loss / take profit
      </div>
      <div className="grid grid-cols-2 gap-2">
        {(
          [
            [ids.stop, 'Stop loss', stopText, setStopText, 'text-rose-300'],
            [ids.target, 'Take profit', targetText, setTargetText, 'text-emerald-300'],
          ] as const
        ).map(([id, label, value, setValue, tone]) => (
          <div key={id}>
            <label htmlFor={id} className={cn('block text-[10px] mb-0.5', tone)}>
              {label}
            </label>
            <div className={FIELD}>
              <input
                id={id}
                inputMode="decimal"
                value={value}
                placeholder="—"
                disabled={disabled}
                onChange={(e) => setValue(e.target.value)}
                className="w-full bg-transparent px-2.5 py-1.5 text-xs font-mono text-slate-100 placeholder:text-faint outline-none disabled:opacity-50"
              />
            </div>
          </div>
        ))}
      </div>
      <p id={ids.help} className={cn('text-[11px]', invalid ? 'text-rose-300' : 'text-faint')}>
        {invalid
          ? 'Enter a price using digits only, or leave it empty.'
          : long
            ? 'Long: stop below the price, target above. Empty clears a level.'
            : 'Short: stop above the price, target below. Empty clears a level.'}
      </p>
      <div className="flex items-center gap-2">
        <Button type="submit" variant="secondary" className="flex-1" disabled={disabled || invalid || unchanged}>
          {hasLevels ? 'Update levels' : 'Set levels'}
        </Button>
        {hasLevels && (
          <Button variant="text" disabled={disabled} onClick={() => onSet({ stopLoss: null, takeProfit: null })}>
            Clear
          </Button>
        )}
      </div>
      {hasLevels && (
        <p className="text-[11px] font-mono text-slate-400">
          SL {fmtPrice(position.stopLoss ?? null, decimals)} · TP {fmtPrice(position.takeProfit ?? null, decimals)}
        </p>
      )}
    </form>
  );
}
