'use client';

import { useId, useState } from 'react';
import { NotebookPen } from 'lucide-react';
import { Button, Panel } from '@/components/ui';
import { MAX_NOTE_LENGTH } from '@/lib/results';
import { setResultNote } from '@/lib/storage';

type Status = 'idle' | 'saved' | 'error';

/** The player's own note on the match, saved with the result in this browser. */
export function ResultNote({ id, initial }: { id: string; initial: string }) {
  const [text, setText] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [status, setStatus] = useState<Status>('idle');
  const fieldId = useId();
  const dirty = text.trim() !== saved.trim();

  const save = () => {
    if (!dirty) return;
    if (setResultNote(id, text)) {
      setSaved(text.trim());
      setStatus('saved');
    } else setStatus('error');
  };

  return (
    <Panel title="Your notes" description="What you would do differently. Saved with this result, in this browser only." icon={NotebookPen}>
      <label htmlFor={fieldId} className="sr-only">
        Notes on this match
      </label>
      <textarea
        id={fieldId}
        value={text}
        maxLength={MAX_NOTE_LENGTH}
        rows={3}
        placeholder="e.g. Waited too long to cut the second long; size down after a loss."
        onChange={(e) => {
          setText(e.target.value);
          setStatus('idle');
        }}
        onBlur={save}
        className="w-full resize-y rounded-lg bg-[#0F172A]/70 border border-slate-700/50 hover:border-slate-600 focus:border-blue-500 px-3 py-2 text-xs text-slate-100 placeholder:text-faint outline-none transition-colors"
      />
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-[11px] text-faint" aria-live="polite">
          {status === 'saved' && !dirty ? 'Saved' : status === 'error' ? 'Could not save: browser storage is blocked or full.' : dirty ? 'Not saved yet' : ' '}
        </span>
        <span className="flex items-center gap-3">
          <span className="text-[10px] font-mono text-faint">
            {text.length}/{MAX_NOTE_LENGTH}
          </span>
          <Button variant="secondary" disabled={!dirty} onClick={save}>
            Save note
          </Button>
        </span>
      </div>
    </Panel>
  );
}
