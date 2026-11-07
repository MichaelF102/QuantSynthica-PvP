import type { ReactNode } from 'react';
import { Navbar } from './Navbar';
import { Footer } from './Footer';

/** Navy market theme wrapper (DESIGN.md §4.1) with navbar and footer. */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="qs-market-theme flex flex-col flex-1 min-h-screen">
      <Navbar />
      <main className="app-container py-6 space-y-6 flex-1">{children}</main>
      <Footer />
    </div>
  );
}
