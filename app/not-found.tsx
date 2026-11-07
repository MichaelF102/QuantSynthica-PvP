import Link from 'next/link';
import { Compass } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { EmptyState, Panel, buttonClasses } from '@/components/ui';

export default function NotFound() {
  return (
    <AppShell>
      <Panel>
        <EmptyState
          icon={Compass}
          title="Page not found"
          hint="The page you asked for does not exist."
          action={
            <Link href="/" className={buttonClasses('secondary')}>
              Back home
            </Link>
          }
        />
      </Panel>
    </AppShell>
  );
}
