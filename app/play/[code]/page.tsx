import type { Metadata } from 'next';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { RoomScreen } from '@/components/multiplayer/RoomScreen';

export const metadata: Metadata = { title: '1v1 room' };

export default function RoomPage({ params }: { params: { code: string } }) {
  return (
    <AppShell>
      <PageHeader title="1v1" highlight="room" description="Same market, same clock, separate accounts. Highest final equity wins." />
      <RoomScreen code={params.code} />
    </AppShell>
  );
}
