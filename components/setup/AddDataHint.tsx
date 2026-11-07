'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { addDataCommand, type CatalogEntry } from '@/lib/catalog';

/** Explains how to download candles for a ticker that has none. Empty (but present) when nothing is chosen. */
export function AddDataHint({ id, entry }: { id: string; entry: CatalogEntry | null }) {
  const [copied, setCopied] = useState(false);
  if (!entry) return <div id={id} aria-live="polite" />;
  const cmd = addDataCommand(entry.symbol);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(cmd);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div id={id} aria-live="polite" className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-[11px] text-amber-200 space-y-2">
      <p>
        <span className="font-mono font-semibold">{entry.symbol}</span> ({entry.name}) has no market data yet, so it cannot start a match. To add it, run this in
        the project folder, then reload the page:
      </p>
      <div className="flex items-center gap-2">
        <code className="flex-1 min-w-0 truncate rounded bg-[#080d1a] border border-slate-800 px-2 py-1 font-mono text-slate-200">{cmd}</code>
        <button
          type="button"
          onClick={copy}
          aria-label={copied ? 'Command copied' : 'Copy command'}
          className="shrink-0 p-1.5 rounded-lg text-amber-200 hover:bg-amber-500/15 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500/70"
        >
          {copied ? <Check className="w-3.5 h-3.5" aria-hidden /> : <Copy className="w-3.5 h-3.5" aria-hidden />}
        </button>
      </div>
    </div>
  );
}
