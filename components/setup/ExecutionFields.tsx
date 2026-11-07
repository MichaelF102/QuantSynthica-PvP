'use client';

import { useId, type Dispatch, type SetStateAction } from 'react';
import { Segmented } from '@/components/ui';
import { fmtMoney } from '@/lib/format';
import { parseAmount, type SetupErrors, type SetupForm } from '@/lib/setup';
import type { FillModel } from '@/lib/types';
import { cn } from '@/lib/utils';

const FIELD = 'flex items-center bg-[#0F172A]/70 border hover:border-slate-600 focus-within:border-blue-500 rounded-lg transition-colors';
const MODELS = [
  { value: 'close' as FillModel, label: 'Current close' },
  { value: 'next_open' as FillModel, label: 'Next candle open' },
];

type ExecutionFieldsProps = {
  form: SetupForm;
  setForm: Dispatch<SetStateAction<SetupForm>>;
  errors: SetupErrors;
  currency: string;
};

/** Plan M12: fill model, commission per fill and slippage. Defaults keep today's rules. */
export function ExecutionFields({ form, setForm, errors, currency }: ExecutionFieldsProps) {
  const ids = { fee: useId(), feeHelp: useId(), slip: useId(), slipHelp: useId(), modelHelp: useId() };
  const fee = form.commissionText.trim() === '' ? 0 : parseAmount(form.commissionText);
  const prefix = currency === 'INR' ? '₹' : '$';

  return (
    <fieldset className="space-y-3 rounded-lg border border-slate-800 bg-[#0b1120]/40 p-3">
      <legend className="px-1 text-[10px] uppercase tracking-wider text-slate-400">Fills and costs</legend>
      <div>
        <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1.5" id={ids.modelHelp}>
          Market orders fill at
        </p>
        <Segmented<FillModel> label="Market orders fill at" options={MODELS} value={form.fillModel} onChange={(fillModel) => setForm((f) => ({ ...f, fillModel }))} className="w-full [&>button]:flex-1" />
        <p className="mt-1 text-[11px] text-faint">
          {form.fillModel === 'close' ? 'Orders fill straight away at the latest close.' : 'Orders wait for the next candle and fill at its open, like a live market.'}
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor={ids.fee} className="block text-[10px] uppercase tracking-wider text-slate-400 mb-1">
            Commission per fill
          </label>
          <div className={cn(FIELD, errors.commission ? 'border-rose-500/60' : 'border-slate-700/50')}>
            <span className="pl-3 text-xs font-mono text-slate-400">{prefix}</span>
            <input
              id={ids.fee}
              inputMode="decimal"
              value={form.commissionText}
              onChange={(e) => setForm((f) => ({ ...f, commissionText: e.target.value }))}
              aria-invalid={Boolean(errors.commission)}
              aria-describedby={ids.feeHelp}
              className="w-full bg-transparent px-2 py-2 text-sm font-mono text-slate-100 outline-none"
            />
          </div>
          <p id={ids.feeHelp} className={cn('mt-1 text-[11px]', errors.commission ? 'text-rose-300' : 'text-faint')}>
            {errors.commission ?? (fee > 0 ? `${fmtMoney(fee, currency)} on every buy and sell.` : 'No commission.')}
          </p>
        </div>
        <div>
          <label htmlFor={ids.slip} className="block text-[10px] uppercase tracking-wider text-slate-400 mb-1">
            Slippage
          </label>
          <div className={cn(FIELD, errors.slippage ? 'border-rose-500/60' : 'border-slate-700/50')}>
            <input
              id={ids.slip}
              inputMode="decimal"
              value={form.slippageText}
              onChange={(e) => setForm((f) => ({ ...f, slippageText: e.target.value }))}
              aria-invalid={Boolean(errors.slippage)}
              aria-describedby={ids.slipHelp}
              className="w-full bg-transparent px-3 py-2 text-sm font-mono text-slate-100 outline-none"
            />
            <span className="pr-3 text-xs font-mono text-slate-400">bps</span>
          </div>
          <p id={ids.slipHelp} className={cn('mt-1 text-[11px]', errors.slippage ? 'text-rose-300' : 'text-faint')}>
            {errors.slippage ?? 'Fills move against you by this much. 1 bps = 0.01%. Not applied to take-profit fills.'}
          </p>
        </div>
      </div>
    </fieldset>
  );
}
