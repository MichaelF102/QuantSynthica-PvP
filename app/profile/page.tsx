import type { Metadata } from 'next';
import { ProfileView } from '@/components/auth/ProfileView';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';

export const metadata: Metadata = { title: 'Profile' };

export default function ProfilePage() {
  return (
    <AppShell>
      <PageHeader title="Your" highlight="profile" description="Sign in with Google to keep your progress on every device." />
      <ProfileView />
    </AppShell>
  );
}
