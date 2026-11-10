import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { QSLogoMark } from '@/components/brand/QSLogoMark';
import { Wordmark } from '@/components/brand/Wordmark';
import { APP_NAME, CONTACT_EMAIL } from '@/lib/config';
import { NAV_LINKS } from '@/lib/landing/content';

const HEAD = 'mb-3 text-[10px] font-mono uppercase tracking-wider text-slate-400';
const LINK = 'touch:inline-block touch:py-2 text-sm text-slate-300 hover:text-white transition-colors rounded focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500/70';

/** Landing footer: brand, Explore, Legal and Contact columns, then the copyright and disclaimer. */
export function LandingFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-slate-800/80 bg-[#070b15] pt-14 pb-8 print:hidden">
      <div className="app-container flex flex-wrap justify-between gap-x-16 gap-y-10">
        <div className="flex-[1_1_280px] max-w-sm">
          <div className="flex items-center gap-2.5">
            <QSLogoMark className="h-8 w-[51px] text-slate-200" title="" aria-hidden />
            <Wordmark showSubtitle={false} />
          </div>
          <p className="mt-4 text-sm text-slate-400 leading-relaxed">
            Practice trading on real market history, one candle at a time, under a loss limit you cannot ignore.
          </p>
          <Link href="/practice" className="group mt-5 inline-flex items-center gap-1 text-sm font-medium text-blue-400 hover:text-blue-300 rounded focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500/70">
            Start practice <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Link>
        </div>

        <nav aria-label="Explore" className="flex-[0_1_150px]">
          <p className={HEAD}>Explore</p>
          <ul className="grid gap-2.5">
            {NAV_LINKS.map(({ id, label }) => (
              <li key={id}>
                <a href={`#${id}`} className={LINK}>{label}</a>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Legal" className="flex-[0_1_150px]">
          <p className={HEAD}>Legal</p>
          <ul className="grid gap-2.5">
            <li><Link href="/privacy" prefetch={false} className={LINK}>Privacy policy</Link></li>
            <li><Link href="/terms" prefetch={false} className={LINK}>Terms of use</Link></li>
          </ul>
        </nav>

        <div className="flex-[0_1_220px]">
          <p className={HEAD}>Contact</p>
          <a href={`mailto:${CONTACT_EMAIL}`} className={LINK}>{CONTACT_EMAIL}</a>
          <p className="mt-3 text-[11px] text-faint">Replace with your support address.</p>
        </div>
      </div>

      <div className="app-container mt-12">
        <div className="pt-6 border-t border-slate-800 flex flex-wrap justify-between gap-x-8 gap-y-2 text-xs text-faint">
          <span>© <span className="font-mono">{year}</span> {APP_NAME}. All rights reserved.</span>
          <span>Practice only. Nothing on this site is investment advice.</span>
        </div>
      </div>
    </footer>
  );
}
