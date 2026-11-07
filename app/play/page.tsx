import type { Metadata } from 'next';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { PlayView } from '@/components/multiplayer/PlayView';

export const metadata: Metadata = { title: '1v1' };

export default function PlayPage() {
  return (
    <AppShell>
      <PageHeader title="Play a" highlight="friend" description="Create a room, share the code, and trade the same historical session head to head." />
      <PlayView />
    </AppShell>
  );
}
