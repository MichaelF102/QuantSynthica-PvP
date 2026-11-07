'use client';

import { useId, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui';
import { NICKNAME_MAX, cleanNickname } from '@/lib/multiplayer/protocol';

/** The name your opponent sees. Saved in this browser; no account. */
export function NicknameForm({ initial = '', onSubmit }: { initial?: string; onSubmit: (name: string) => void }) {
  const id = useId();
  const [text, setText] = useState(initial);
  const name = cleanNickname(text);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (name) onSubmit(name);
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-1.5">
      <label htmlFor={id} className="block text-[10px] uppercase tracking-wider text-slate-400">
        Your name
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={NICKNAME_MAX}
          autoComplete="nickname"
          autoFocus
          aria-describedby={`${id}-help`}
          className="min-w-0 flex-1 rounded-lg border border-slate-700/50 bg-[#0F172A]/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-blue-500"
        />
        <Button type="submit" disabled={!name}>
          Join room
        </Button>
      </div>
      <p id={`${id}-help`} className="text-[11px] text-faint">
        Shown to your opponent. Up to {NICKNAME_MAX} characters, saved in this browser.
      </p>
    </form>
  );
}
