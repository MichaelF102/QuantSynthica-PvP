import type { Metadata } from 'next';
import { AppShell } from '@/components/layout/AppShell';
import { DuelResultView } from '@/components/multiplayer/DuelResultView';

export const metadata: Metadata = { title: '1v1 result' };

export default function DuelResultPage({ params }: { params: { id: string } }) {
  return (
    <AppShell>
      <DuelResultView id={decodeURIComponent(params.id)} />
    </AppShell>
  );
}
