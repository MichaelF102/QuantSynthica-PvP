'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Play } from 'lucide-react';
import { Banner, Button, buttonClasses } from '@/components/ui';
import { Dialog } from '@/components/ui/Dialog';
import { defaultForm, validateSetup, type LastSetup, type SetupForm } from '@/lib/setup';
import type { SymbolInfo } from '@/lib/types';
import { SetupFields } from './SetupFields';

type SetupModalProps = {
  index: SymbolInfo[];
  last: LastSetup | null;
  busy: boolean;
  error: string | null;
  onRetry: () => void;
  onStart: (form: SetupForm) => void;
};

/**
 * Match settings (plan M9). It cannot be dismissed with Esc because the practice page has nothing
 * else to show; "Back home" leaves instead.
 */
export function SetupModal({ index, last, busy, error, onRetry, onStart }: SetupModalProps) {
  const [form, setForm] = useState<SetupForm>(() => defaultForm(index, last));
  const [touched, setTouched] = useState(false);
  const errors = validateSetup(form, index);
  const valid = Object.keys(errors).length === 0;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (valid && !busy) onStart(form);
  };

  return (
    <Dialog open title="New practice match" className="max-w-lg">
      <form onSubmit={submit} noValidate className="space-y-4">
        <p className="text-[11px] text-slate-400">Interval 1m · Random historical session · Market data</p>

        <SetupFields index={index} form={form} setForm={setForm} errors={errors} touched={touched} />

        {error && (
          <Banner kind="error" onRetry={onRetry}>
            {error} You can also choose another symbol.
          </Banner>
        )}

        {/* Stays in view at the bottom of the scrolling dialog, so Start is always one tap away on a phone. */}
        <div className="sticky bottom-0 -mx-5 -mb-5 px-5 py-3 border-t border-slate-800 bg-[#0b1222] flex items-center justify-between gap-2">
          <Link href="/" className={buttonClasses('secondary')}>
            Back home
          </Link>
          <Button type="submit" disabled={!valid || busy} className="px-5 py-2.5">
            <Play className="w-3.5 h-3.5" aria-hidden /> {busy ? 'Loading session…' : 'Start match'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
