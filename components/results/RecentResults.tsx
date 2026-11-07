'use client';

import Link from 'next/link';
import { ArrowRight, History } from 'lucide-react';
import { EmptyState, Panel, PanelSkeleton, buttonClasses } from '@/components/ui';
import { HistoryTable } from './HistoryTable';
import { useSavedResults } from './useSavedResults';

export const RECENT_COUNT = 5;

/** Landing-page card with the latest saved matches. */
export function RecentResults() {
  const { status, results } = useSavedResults();
  if (status === 'loading') return <PanelSkeleton rows={3} label="Loading recent results" />;
  return (
    <Panel
      title="Recent results"
      description="Your last practice matches, saved in this browser"
      icon={History}
      actions={
        results.length > 0 && (
          <Link href="/history" className="group flex items-center gap-1 text-[11px] font-medium text-blue-400 hover:text-blue-300 transition-colors rounded focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500/70">
            View all <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" aria-hidden />
          </Link>
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
        <HistoryTable results={results.slice(0, RECENT_COUNT)} />
      )}
    </Panel>
  );
}
