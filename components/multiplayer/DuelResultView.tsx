'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FileQuestion } from 'lucide-react';
import { EmptyState, Panel, PanelSkeleton, buttonClasses } from '@/components/ui';
import { getDuel, type DuelResult } from '@/lib/multiplayer/duelResult';
import { DuelReport } from './DuelReport';

/** /duel/[id]: a saved head-to-head result, read after mount (localStorage is browser-only). */
export function DuelResultView({ id }: { id: string }) {
  const [state, setState] = useState<{ status: 'loading' } | { status: 'ready'; result: DuelResult | null }>({ status: 'loading' });
  useEffect(() => setState({ status: 'ready', result: getDuel(id) }), [id]);

  if (state.status === 'loading') return <PanelSkeleton rows={6} label="Loading the result" />;
  if (!state.result)
    return (
      <Panel>
        <EmptyState
          icon={FileQuestion}
          title="Result not found"
          hint="1v1 results are saved only in the browser that played the match. It may have been deleted or cleared."
          action={
            <Link href="/history" className={buttonClasses('secondary')}>
              See all results
            </Link>
          }
        />
      </Panel>
    );
  return (
    <DuelReport
      result={state.result}
      actions={
        <Link href="/play" className={buttonClasses('primary')}>
          New 1v1
        </Link>
      }
    />
  );
}
