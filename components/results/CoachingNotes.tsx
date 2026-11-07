import { CheckCircle2, Info, Lightbulb, TriangleAlert } from 'lucide-react';
import { Panel } from '@/components/ui';
import type { CoachNote } from '@/lib/coaching';
import { cn } from '@/lib/utils';

const ICON = { positive: CheckCircle2, negative: TriangleAlert, neutral: Info } as const;
const TONE = { positive: 'text-emerald-400', negative: 'text-amber-400', neutral: 'text-blue-400' } as const;

/** What the numbers say about this match, computed from its own trades. */
export function CoachingNotes({ notes }: { notes: readonly CoachNote[] }) {
  return (
    <Panel title="What the numbers say" description="Read from this match's trades; not advice" icon={Lightbulb} tone="amber">
      {notes.length === 0 ? (
        <p className="text-xs text-faint">Nothing stands out in this match.</p>
      ) : (
        <ul className="grid gap-2.5 sm:grid-cols-2">
          {notes.map((n) => {
            const Icon = ICON[n.tone];
            return (
              <li key={n.id} className="flex gap-2.5 rounded-lg border border-slate-800/80 bg-slate-900/30 p-3 text-xs text-slate-200 leading-relaxed">
                <Icon className={cn('w-4 h-4 shrink-0 mt-px', TONE[n.tone])} aria-hidden />
                <span>{n.text}</span>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
