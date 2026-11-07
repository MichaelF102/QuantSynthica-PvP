'use client';

import { useId, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { LogIn } from 'lucide-react';
import { Button, Panel } from '@/components/ui';
import { ROOM_CODE_LENGTH, normalizeRoomCode } from '@/lib/multiplayer/code';
import { cn } from '@/lib/utils';

const STEPS = [
  'Both players trade the same market on one shared clock, each with their own account.',
  'You see your opponent’s equity, return and drawdown live, but not their trades.',
  'Hitting the max drawdown knocks you out. Highest final equity wins.',
  'The session date stays hidden until the end.',
];

export function JoinRoomPanel() {
  const router = useRouter();
  const id = useId();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const code = normalizeRoomCode(text);
    if (!code) return setError(`Enter the ${ROOM_CODE_LENGTH}-character room code, e.g. K7M2QX.`);
    router.push(`/play/${code}`);
  };

  return (
    <Panel title="Join a room" description="Got a code from a friend? Enter it here, or open their link." icon={LogIn} tone="emerald">
      <form onSubmit={submit} noValidate className="space-y-2">
        <label htmlFor={id} className="block text-[10px] uppercase tracking-wider text-slate-400">
          Room code
        </label>
        <div className="flex gap-2">
          <input
            id={id}
            value={text}
            onChange={(e) => (setText(e.target.value.toUpperCase()), setError(null))}
            maxLength={ROOM_CODE_LENGTH + 2}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="K7M2QX"
            aria-invalid={Boolean(error)}
            aria-describedby={`${id}-help`}
            className={cn(
              'min-w-0 flex-1 rounded-lg border bg-[#0F172A]/70 px-3 py-2 text-[1rem] font-mono tracking-[0.3em] text-slate-100 outline-none placeholder:text-slate-600 focus:border-blue-500',
              error ? 'border-rose-500/60' : 'border-slate-700/50',
            )}
          />
          <Button type="submit" variant="secondary">
            Join
          </Button>
        </div>
        <p id={`${id}-help`} className={cn('text-[11px]', error ? 'text-rose-300' : 'text-faint')}>
          {error ?? 'Letters and digits, not case sensitive.'}
        </p>
      </form>
      <h3 className="mt-5 text-[10px] uppercase tracking-wider text-slate-400">How a 1v1 works</h3>
      <ul className="mt-2 space-y-1.5 text-xs text-slate-300 list-disc pl-4 marker:text-slate-600">
        {STEPS.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>
    </Panel>
  );
}
