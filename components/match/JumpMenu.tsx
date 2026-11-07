'use client';

import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { ChevronsRight } from 'lucide-react';
import { Button } from '@/components/ui';
import { fromUtcInputValue, toUtcInputValue } from '@/lib/session';

const STEPS = [5, 15, 60] as const;

type JumpMenuProps = {
  disabled?: boolean;
  /** Time of the current candle (the earliest allowed target). */
  currentTime: number;
  /** Time of the session's last candle (the latest allowed target). */
  lastTime: number;
  onJumpBy: (n: number) => void;
  onJumpTo: (unixSec: number) => void;
};

/** Forward-only jump (plan D5): by a number of candles, or to a UTC time. */
export function JumpMenu({ disabled, currentTime, lastTime, onJumpBy, onJumpTo }: JumpMenuProps) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const inputId = useId();

  useEffect(() => {
    if (!open) return;
    setValue(toUtcInputValue(currentTime));
    setError(null);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const onClick = (e: MouseEvent) => !rootRef.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
    // Only re-seed the input when the menu opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const t = fromUtcInputValue(value);
    if (t === null) return setError('Enter a valid date and time.');
    if (t <= currentTime) return setError('Pick a time after the current candle. Replay only moves forward.');
    if (t > lastTime) return setError('That is after the end of this session.');
    onJumpTo(t);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
      <Button variant="secondary" disabled={disabled} aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((o) => !o)}>
        <ChevronsRight className="w-3.5 h-3.5" aria-hidden /> Jump
      </Button>
      {open && (
        <div id={panelId} role="dialog" aria-label="Jump forward" className="absolute right-0 top-full mt-1 w-64 z-[60] rounded-xl border border-slate-800 bg-[#0B101C] p-3 shadow-[0_18px_48px_-12px_rgba(0,0,0,0.65)] space-y-3">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1.5">Skip candles</p>
            <div className="flex gap-1.5">
              {STEPS.map((n) => (
                <Button
                  key={n}
                  variant="secondary"
                  className="flex-1 font-mono"
                  onClick={() => {
                    onJumpBy(n);
                    setOpen(false);
                  }}
                >
                  +{n}
                </Button>
              ))}
            </div>
          </div>
          <form onSubmit={submit} noValidate className="space-y-1.5">
            <label htmlFor={inputId} className="block text-[10px] font-mono uppercase tracking-wider text-slate-400">
              Jump to time (UTC)
            </label>
            <div className="flex gap-1.5">
              <input
                id={inputId}
                type="datetime-local"
                value={value}
                min={toUtcInputValue(currentTime)}
                max={toUtcInputValue(lastTime)}
                onChange={(e) => setValue(e.target.value)}
                className="min-w-0 flex-1 bg-[#0F172A]/70 border border-slate-700/50 focus:border-blue-500 rounded-lg px-2 py-1.5 text-xs font-mono text-slate-100 outline-none [color-scheme:dark]"
              />
              <Button type="submit">Go</Button>
            </div>
            {error && <p className="text-[11px] text-rose-300" role="alert">{error}</p>}
          </form>
        </div>
      )}
    </div>
  );
}
