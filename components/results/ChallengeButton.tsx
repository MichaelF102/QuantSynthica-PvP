'use client';

import { useEffect, useId, useState } from 'react';
import { Check, Swords } from 'lucide-react';
import { Button } from '@/components/ui';
import { challengeFromResult, challengeUrl, NAME_MAX } from '@/lib/challenge';
import { loadNickname } from '@/lib/multiplayer/client';
import type { MatchResult } from '@/lib/results';

/** Plan M13 C1: copies a link that lets a friend play this exact session against your score. */
export function ChallengeButton({ result }: { result: MatchResult }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [copied, setCopied] = useState<'ok' | 'failed' | null>(null);
  const [origin, setOrigin] = useState('');
  const nameId = useId();
  useEffect(() => {
    setOrigin(window.location.origin);
    setName(loadNickname() ?? '');
  }, []);

  const link = origin ? challengeUrl(origin, challengeFromResult(result, name)) : '';
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied('ok');
    } catch {
      setCopied('failed');
    }
  };

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <Swords className="w-3.5 h-3.5" aria-hidden /> Challenge a friend
      </Button>
    );
  }
  return (
    <div className="w-full rounded-lg border border-slate-800 bg-[#0b1120]/60 p-3 space-y-2">
      <p className="text-xs text-slate-300">Your friend plays this exact session with the same rules, then sees their score next to yours.</p>
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label htmlFor={nameId} className="block text-[10px] uppercase tracking-wider text-slate-400 mb-1">
            Your name in the link
          </label>
          <input
            id={nameId}
            value={name}
            maxLength={NAME_MAX}
            placeholder="A friend"
            onChange={(e) => {
              setName(e.target.value);
              setCopied(null);
            }}
            className="bg-[#0F172A]/70 border border-slate-700/50 hover:border-slate-600 focus:border-blue-500 rounded-lg px-3 py-1.5 text-xs text-slate-100 outline-none"
          />
        </div>
        <Button onClick={copy} disabled={!link}>
          {copied === 'ok' ? <Check className="w-3.5 h-3.5" aria-hidden /> : <Swords className="w-3.5 h-3.5" aria-hidden />}
          {copied === 'ok' ? 'Link copied' : 'Copy challenge link'}
        </Button>
      </div>
      <p className="text-[11px] font-mono text-faint break-all" aria-live="polite">
        {copied === 'failed' ? 'Copy failed. Select the link and copy it: ' : ''}
        {link}
      </p>
    </div>
  );
}
