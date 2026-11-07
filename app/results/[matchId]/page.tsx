import type { Metadata } from 'next';
import { AppShell } from '@/components/layout/AppShell';
import { ResultView } from '@/components/results/ResultView';

export const metadata: Metadata = { title: 'Results' };

export default function ResultsPage({ params }: { params: { matchId: string } }) {
  return (
    <AppShell>
      <ResultView id={decodeURIComponent(params.matchId)} />
    </AppShell>
  );
}
