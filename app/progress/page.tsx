import type { Metadata } from 'next';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { ProgressView } from '@/components/progress/ProgressView';

export const metadata: Metadata = { title: 'Progress' };

export default function ProgressPage() {
  return (
    <AppShell>
      <PageHeader title="Your" highlight="progress" description="Trends across the matches saved in this browser. Nothing is uploaded." />
      <ProgressView />
    </AppShell>
  );
}
