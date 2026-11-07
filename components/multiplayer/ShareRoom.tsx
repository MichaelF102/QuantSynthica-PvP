'use client';

import { useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui';
import { roomLink } from '@/lib/multiplayer/code';

/** The room code, large, with a copy-link button. */
export function ShareRoom({ code }: { code: string }) {
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState<'ok' | 'failed' | null>(null);
  useEffect(() => setLink(roomLink(window.location.origin, code)), [code]);

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied('ok');
    } catch {
      setCopied('failed');
    }
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="rounded-lg border border-slate-800 bg-[#0b1120]/60 p-3">
      <p className="text-[10px] uppercase tracking-wider text-slate-400">Room code</p>
      <div className="mt-1 flex items-center justify-between gap-3">
        <span className="text-2xl font-bold font-mono tracking-[0.25em] text-white select-all">{code}</span>
        <Button variant="secondary" onClick={copy} disabled={!link} aria-label="Copy room link">
          {copied === 'ok' ? <Check className="w-3.5 h-3.5 text-emerald-400" aria-hidden /> : <Copy className="w-3.5 h-3.5" aria-hidden />}
          {copied === 'ok' ? 'Copied' : 'Copy link'}
        </Button>
      </div>
      <p className="mt-1.5 text-[11px] font-mono text-faint break-all" aria-live="polite">
        {copied === 'failed' ? 'Copy failed. Select the link and copy it: ' : ''}
        {link ?? '—'}
      </p>
    </div>
  );
}
