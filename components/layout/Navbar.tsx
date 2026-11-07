'use client';

import { useState, type MouseEvent } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { QSLogoMark } from '@/components/brand/QSLogoMark';
import { Wordmark } from '@/components/brand/Wordmark';
import { AccountButton } from '@/components/auth/AccountButton';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { APP_NAME } from '@/lib/config';
import { cn } from '@/lib/utils';
import { matchStore } from '@/store/matchStore';
import { useIsMatchLive } from '@/store/useLeaveGuard';

const LINKS = [
  { href: '/practice', label: 'Practice' },
  { href: '/play', label: '1v1' },
  { href: '/history', label: 'History' },
  { href: '/progress', label: 'Progress' },
] as const;

const FOCUS = 'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500/70 rounded';

/** Navbar from DESIGN.md §7.11, cut down for v1: no Lab button, search or avatar. */
export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const live = useIsMatchLive();
  const [leaveTo, setLeaveTo] = useState<string | null>(null);

  // The App Router cannot block navigation, so links ask first while a match is live.
  const guard = (href: string) => (e: MouseEvent<HTMLAnchorElement>) => {
    if (!live || href === pathname || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    matchStore.getState().pause();
    setLeaveTo(href);
  };

  return (
    <header className="sticky top-0 z-50 bg-[#080C14]/95 backdrop-blur-md border-b border-slate-800/80 print:hidden">
      <nav aria-label="Main" className="mx-auto w-[96%] max-w-[1720px] h-16 flex items-center justify-between gap-2 sm:gap-4">
        <Link href="/" onClick={guard('/')} className={cn('group flex items-center gap-2.5', FOCUS)} aria-label={`${APP_NAME} home`}>
          <QSLogoMark className="h-8 w-[51px] text-slate-200 transition-transform duration-200 group-hover:scale-105" title="" aria-hidden />
          <Wordmark className="hidden sm:flex" />
        </Link>
        <div className="flex items-center gap-1 sm:gap-2 min-w-0">
          <ul className="flex items-center gap-0.5 sm:gap-1">
            {LINKS.map(({ href, label }) => {
              const active = pathname === href || pathname.startsWith(`${href}/`);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={guard(href)}
                    aria-current={active ? 'page' : undefined}
                    className={cn('relative block text-xs px-1.5 sm:px-2 py-4 transition-colors', FOCUS, active ? 'text-blue-400 font-semibold' : 'font-medium text-slate-300 hover:text-white')}
                  >
                    {label}
                    {active && <span className="absolute bottom-0 left-1.5 right-1.5 sm:left-2 sm:right-2 h-0.5 bg-blue-500 rounded-full" aria-hidden />}
                  </Link>
                </li>
              );
            })}
          </ul>
          <AccountButton className="shrink-0" />
        </div>
      </nav>
      <ConfirmDialog
        open={leaveTo !== null}
        title="Leave the match?"
        confirmLabel="Leave"
        cancelLabel="Stay"
        destructive
        onCancel={() => setLeaveTo(null)}
        onConfirm={() => {
          const to = leaveTo;
          setLeaveTo(null);
          if (to) router.push(to);
        }}
      >
        The match is still in progress. Leaving now discards it: matches cannot be resumed, and no result is saved. To keep a result, use End match first.
      </ConfirmDialog>
    </header>
  );
}
