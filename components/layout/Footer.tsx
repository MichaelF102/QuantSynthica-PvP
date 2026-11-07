import { APP_NAME } from '@/lib/config';

export function Footer() {
  return (
    <footer className="border-t border-slate-800/80 bg-[#080d1a] print:hidden">
      <div className="app-container py-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-faint">
        <span>
          <span className="font-semibold text-slate-300">{APP_NAME}</span> · Practice only. Not investment advice. No real money.
        </span>
        <span>Market data · Historical sessions</span>
      </div>
    </footer>
  );
}
