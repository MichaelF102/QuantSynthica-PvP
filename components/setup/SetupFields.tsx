'use client';

import { useId, type Dispatch, type SetStateAction } from 'react';
import { Segmented } from '@/components/ui';
import { DURATION_OPTIONS_MIN } from '@/lib/config';
import { fmtMoney } from '@/lib/format';
import { parseAmount, withSymbol, type DurationMin, type SetupErrors, type SetupForm } from '@/lib/setup';
import type { SymbolInfo } from '@/lib/types';
import { cn } from '@/lib/utils';
import { ExecutionFields } from './ExecutionFields';
import { SymbolPicker } from './SymbolPicker';

const DURATIONS = DURATION_OPTIONS_MIN.map((m) => ({ value: m as DurationMin, label: `${m} min` }));
const FIELD = 'flex items-center bg-[#0F172A]/70 border hover:border-slate-600 focus-within:border-blue-500 rounded-lg transition-colors';

type SetupFieldsProps = {
  index: SymbolInfo[];
  form: SetupForm;
  setForm: Dispatch<SetStateAction<SetupForm>>;
  errors: SetupErrors;
  /** The symbol error shows only after a submit attempt. */
  touched: boolean;
};

/** Symbol, time limit, starting balance, max drawdown, fills and costs. Used by practice setup and room creation. */
export function SetupFields({ index, form, setForm, errors, touched }: SetupFieldsProps) {
  const ids = { balance: useId(), balanceHelp: useId(), dd: useId(), ddHelp: useId() };
  const info = index.find((i) => i.symbol === form.symbol) ?? null;
  const balance = parseAmount(form.balanceText);
  const prefix = info?.currency === 'INR' ? '₹' : '$';

  return (
    <>
      <fieldset className="space-y-1.5">
        <legend className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Symbol</legend>
        <SymbolPicker index={index} value={form.symbol} onChange={(i) => setForm((f) => withSymbol(f, i))} />
        {touched && errors.symbol && <p className="text-[11px] text-rose-300">{errors.symbol}</p>}
      </fieldset>

      <fieldset>
        <legend className="text-[10px] uppercase tracking-wider text-slate-400 mb-1.5">Time limit</legend>
        <Segmented<DurationMin> label="Time limit" options={DURATIONS} value={form.durationMin} onChange={(d) => setForm((f) => ({ ...f, durationMin: d }))} className="w-full [&>button]:flex-1" />
      </fieldset>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor={ids.balance} className="block text-[10px] uppercase tracking-wider text-slate-400 mb-1">
            Starting balance ({info?.currency ?? '—'})
          </label>
          <div className={cn(FIELD, errors.balance ? 'border-rose-500/60' : 'border-slate-700/50')}>
            <span className="pl-3 text-xs font-mono text-slate-400">{prefix}</span>
            <input
              id={ids.balance}
              inputMode="decimal"
              value={form.balanceText}
              onChange={(e) => setForm((f) => ({ ...f, balanceText: e.target.value, balanceEdited: true }))}
              aria-invalid={Boolean(errors.balance)}
              aria-describedby={ids.balanceHelp}
              className="w-full bg-transparent px-2 py-2 text-sm font-mono text-slate-100 outline-none"
            />
          </div>
          <p id={ids.balanceHelp} className={cn('mt-1 text-[11px] font-mono', errors.balance ? 'text-rose-300' : 'text-faint')}>
            {errors.balance ?? fmtMoney(balance, info?.currency ?? 'USD')}
          </p>
        </div>
        <div>
          <label htmlFor={ids.dd} className="block text-[10px] uppercase tracking-wider text-slate-400 mb-1">
            Max drawdown
          </label>
          <div className={cn(FIELD, errors.drawdown ? 'border-rose-500/60' : 'border-slate-700/50')}>
            <input
              id={ids.dd}
              inputMode="decimal"
              value={form.drawdownText}
              onChange={(e) => setForm((f) => ({ ...f, drawdownText: e.target.value }))}
              aria-invalid={Boolean(errors.drawdown)}
              aria-describedby={ids.ddHelp}
              className="w-full bg-transparent px-3 py-2 text-sm font-mono text-slate-100 outline-none"
            />
            <span className="pr-3 text-xs font-mono text-slate-400">%</span>
          </div>
          <p id={ids.ddHelp} className={cn('mt-1 text-[11px]', errors.drawdown ? 'text-rose-300' : 'text-faint')}>
            {errors.drawdown ?? 'The match ends if equity falls this far from its peak.'}
          </p>
        </div>
      </div>

      <ExecutionFields form={form} setForm={setForm} errors={errors} currency={info?.currency ?? 'USD'} />
    </>
  );
}
