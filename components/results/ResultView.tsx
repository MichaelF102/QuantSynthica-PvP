'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FileQuestion } from 'lucide-react';
import { EmptyState, Panel, PanelSkeleton, buttonClasses } from '@/components/ui';
import type { MatchResult } from '@/lib/results';
import { getResult } from '@/lib/storage';
import { ResultsReport } from './ResultsReport';

/** Loads one saved result after mount (localStorage is browser-only). */
export function ResultView({ id }: { id: string }) {
  const [state, setState] = useState<{ status: 'loading' } | { status: 'ready'; result: MatchResult | null }>({ status: 'loading' });
  useEffect(() => setState({ status: 'ready', result: getResult(id) }), [id]);

  if (state.status === 'loading') return <PanelSkeleton rows={6} label="Loading results" />;
  if (!state.result)
    return (
      <Panel>
        <EmptyState
          icon={FileQuestion}
          title="Result not found"
          hint="Results are saved only in the browser where the match was played. It may have been deleted or cleared."
          action={
            <Link href="/history" className={buttonClasses('secondary')}>
              See all results
            </Link>
          }
        />
      </Panel>
    );
  return <ResultsReport result={state.result} />;
}
