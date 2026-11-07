import type { Metadata } from 'next';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { DuelHistory } from '@/components/multiplayer/DuelHistory';
import { HistoryView } from '@/components/results/HistoryView';

export const metadata: Metadata = { title: 'History' };

export default function HistoryPage() {
  return (
    <AppShell>
      <PageHeader title="Match" highlight="history" description="Every practice and 1v1 match you finish is saved in this browser. Results are not shared or uploaded." />
      <HistoryView />
      <DuelHistory />
    </AppShell>
  );
}
