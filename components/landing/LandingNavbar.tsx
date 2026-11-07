'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AccountButton } from '@/components/auth/AccountButton';
import { Menu, X } from 'lucide-react';
import { QSLogoMark } from '@/components/brand/QSLogoMark';
import { Wordmark } from '@/components/brand/Wordmark';
import { buttonClasses } from '@/components/ui';
import { APP_NAME } from '@/lib/config';
import { NAV_LINKS } from '@/lib/landing/content';
import { cn } from '@/lib/utils';
import { useActiveSection } from './useActiveSection';

const FOCUS = 'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500/70 rounded';
const IDS = NAV_LINKS.map((l) => l.id);

/** Landing navbar (DESIGN.md §7.11): section links from xl, a drawer below it. No Lab button. */
export function LandingNavbar() {
  const active = useActiveSection(IDS);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const onResize = () => window.innerWidth >= 1280 && setOpen(false);
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-50 bg-[#080C14]/95 backdrop-blur-md border-b border-slate-800/80 print:hidden">
      <div className="mx-auto w-[96%] max-w-[1720px] h-16 flex items-center justify-between gap-4">
        <Link href="/" className={cn('group flex items-center gap-2.5 min-w-0', FOCUS)} aria-label={`${APP_NAME} home`}>
          <QSLogoMark className="h-8 w-[51px] shrink-0 text-slate-200 transition-transform duration-200 group-hover:scale-105" title="" aria-hidden />
          <Wordmark />
        </Link>

        <nav aria-label="Sections" className="hidden xl:block">
          <ul className="flex items-center gap-1">
            {NAV_LINKS.map(({ id, label }) => {
              const on = active === id;
              return (
                <li key={id}>
                  <a
                    href={`#${id}`}
                    aria-current={on ? 'true' : undefined}
                    className={cn('relative block text-xs px-2 py-4 transition-colors', FOCUS, on ? 'text-blue-400 font-semibold' : 'font-medium text-slate-300 hover:text-white')}
                  >
                    {label}
                    {on && <span aria-hidden className="absolute bottom-0 left-2 right-2 h-0.5 bg-blue-500 rounded-full" />}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          <AccountButton />
          <Link href="/practice" className={buttonClasses('primary', 'hidden sm:inline-flex')}>
            Start practice
          </Link>
          <button
            type="button"
            className={buttonClasses('icon', 'xl:hidden')}
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            aria-controls="lp-drawer"
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <X className="w-5 h-5" aria-hidden /> : <Menu className="w-5 h-5" aria-hidden />}
          </button>
        </div>
      </div>

      {open && (
        <nav id="lp-drawer" aria-label="Sections" className="xl:hidden border-t border-slate-800/80 bg-[#0C101A]">
          <ul className="app-container py-3 grid gap-1">
            {NAV_LINKS.map(({ id, label }) => (
              <li key={id}>
                <a
                  href={`#${id}`}
                  onClick={() => setOpen(false)}
                  aria-current={active === id ? 'true' : undefined}
                  className={cn('block px-2.5 py-2.5 rounded-lg text-sm hover:bg-slate-800/70', FOCUS, active === id ? 'text-blue-400 font-semibold' : 'text-slate-200')}
                >
                  {label}
                </a>
              </li>
            ))}
            <li className="pt-2 sm:hidden">
              <Link href="/practice" className={buttonClasses('primary', 'w-full py-2.5')}>
                Start practice
              </Link>
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}
