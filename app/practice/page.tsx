import type { Metadata } from 'next';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { MatchView } from '@/components/match/MatchView';

export const metadata: Metadata = { title: 'Practice' };

export default function PracticePage() {
  return (
    <AppShell>
      <PageHeader title="Practice" highlight="match" description="Trade a random historical session against the clock." />
      <MatchView />
    </AppShell>
  );
}
