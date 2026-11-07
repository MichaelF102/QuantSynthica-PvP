'use client';

import { useRef } from 'react';
import { Button } from '@/components/ui';
import { Dialog } from '@/components/ui/Dialog';
import { SHORTCUTS } from '@/lib/hotkeys';

/** Reference list of the match-screen shortcuts. */
export function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  return (
    <Dialog open={open} title="Keyboard shortcuts" onClose={onClose} initialFocus={closeRef}>
      <dl className="divide-y divide-slate-800/60">
        {SHORTCUTS.map(({ keys, action }) => (
          <div key={keys} className="flex items-center justify-between gap-4 py-2">
            <dt>
              <kbd className="inline-block min-w-[2rem] text-center rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-[11px] font-mono text-slate-200">{keys}</kbd>
            </dt>
            <dd className="text-xs text-slate-300 text-right">{action}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-[11px] text-faint">Shortcuts are ignored while you type in a field, except Enter in the size box.</p>
      <div className="mt-4 flex justify-end">
        <Button ref={closeRef} variant="secondary" onClick={onClose}>
          Close
        </Button>
      </div>
    </Dialog>
  );
}
