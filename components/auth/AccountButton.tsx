'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { LogIn } from 'lucide-react';
import { buttonClasses } from '@/components/ui';
import { cn } from '@/lib/utils';
import { useAuth } from '@/store/authStore';
import { Avatar } from './Avatar';
import { SignInDialog } from './SignInDialog';

const FOCUS = 'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500/70';

/** Navbar sign-in (plans M14, M16): hidden on a site without Firebase, a profile link once signed in. */
export function AccountButton({ className }: { className?: string }) {
  const status = useAuth((s) => s.status);
  const user = useAuth((s) => s.user);
  const syncing = useAuth((s) => s.sync.state === 'syncing');
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  if (status === 'off') return null;
  if (status === 'loading') return <span className={cn('block w-7 h-7 rounded-full bg-slate-800 animate-pulse', className)} aria-hidden />;
  if (status === 'signed_in' && user) {
    return (
      <Link href="/profile" className={cn('relative inline-flex rounded-full', FOCUS, className)} aria-label={`Your profile${syncing ? ' (syncing)' : ''}`} title={user.name ?? user.email ?? 'Your profile'}>
        <Avatar name={user.name ?? user.email} photoURL={user.photoURL} />
        {syncing && <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-blue-400 border border-[#080C14] motion-safe:animate-pulse" aria-hidden />}
      </Link>
    );
  }
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={buttonClasses('secondary', cn('px-2 sm:px-3', className))} aria-label="Sign in" aria-haspopup="dialog">
        <LogIn className="w-3.5 h-3.5" aria-hidden />
        <span className="hidden sm:inline">Sign in</span>
      </button>
      <SignInDialog open={open} onClose={close} />
    </>
  );
}
