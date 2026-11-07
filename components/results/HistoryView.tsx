'use client';

import { useState } from 'react';
import Link from 'next/link';
import { History, Trash2 } from 'lucide-react';
import { Banner, Button, EmptyState, Panel, PanelSkeleton, buttonClasses } from '@/components/ui';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { fmtPlayedAt, shortSymbol } from '@/lib/format';
import type { MatchResult } from '@/lib/results';
import { MAX_RESULTS, clearResults, deleteResult } from '@/lib/storage';
import { HistoryTable } from './HistoryTable';
import { useSavedResults } from './useSavedResults';

type Pending = { kind: 'clear' } | { kind: 'delete'; result: MatchResult } | null;

/** Every saved match, with delete and clear (plan M8). */
export function HistoryView() {
  const { status, results, error, refresh } = useSavedResults();
  const [pending, setPending] = useState<Pending>(null);
  const [writeFailed, setWriteFailed] = useState(false);

  if (status === 'loading') return <PanelSkeleton rows={6} label="Loading results" />;

  const confirm = () => {
    const ok = pending?.kind === 'clear' ? clearResults() : pending?.kind === 'delete' ? deleteResult(pending.result.id) : true;
    setWriteFailed(!ok);
    setPending(null);
    refresh();
  };

  return (
    <div className="space-y-4">
      {error && <Banner kind="warning">Some saved results could not be read in this browser and are not shown.</Banner>}
      {writeFailed && <Banner kind="error">That change could not be saved. This browser may be blocking site storage.</Banner>}
      <Panel
        title="Saved matches"
        description={`Newest first · kept in this browser only · up to ${MAX_RESULTS}`}
        icon={History}
        actions={
          results.length > 0 && (
            <Button variant="secondary" onClick={() => setPending({ kind: 'clear' })}>
              <Trash2 className="w-3.5 h-3.5" aria-hidden /> Clear history
            </Button>
          )
        }
      >
        {results.length === 0 ? (
          <EmptyState
            icon={History}
            title="No matches yet"
            hint="Start a practice match to see your results here."
            action={
              <Link href="/practice" className={buttonClasses('secondary')}>
                Start practice
              </Link>
            }
          />
        ) : (
          <HistoryTable results={results} onDelete={(r) => setPending({ kind: 'delete', result: r })} />
        )}
      </Panel>
      <ConfirmDialog
        open={pending !== null}
        title={pending?.kind === 'clear' ? 'Clear all saved matches?' : 'Delete this match?'}
        confirmLabel={pending?.kind === 'clear' ? 'Clear history' : 'Delete'}
        destructive
        onCancel={() => setPending(null)}
        onConfirm={confirm}
      >
        {pending?.kind === 'delete'
          ? `${shortSymbol(pending.result.symbol)}, played ${fmtPlayedAt(pending.result.playedAt)}. This cannot be undone.`
          : `All ${results.length} saved results will be removed from this browser. This cannot be undone.`}
      </ConfirmDialog>
    </div>
  );
}
