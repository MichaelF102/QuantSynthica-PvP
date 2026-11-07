import { ClosingCta } from '@/components/landing/ClosingCta';
import { Features } from '@/components/landing/Features';
import { Hero } from '@/components/landing/Hero';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { LandingFooter } from '@/components/landing/LandingFooter';
import { LandingNavbar } from '@/components/landing/LandingNavbar';
import { Markets } from '@/components/landing/Markets';
import { Questions } from '@/components/landing/Questions';
import { Rules } from '@/components/landing/Rules';
import { SampleResult } from '@/components/landing/SampleResult';
import { ScrollProgress } from '@/components/landing/ScrollProgress';
import { PanelErrorBoundary } from '@/components/ui/PanelErrorBoundary';

/** Landing page. Each section is isolated, so one failing section does not take the page down. */
export default function HomePage() {
  return (
    <div className="lp-root qs-market-theme flex flex-col flex-1 min-h-screen overflow-x-clip">
      <ScrollProgress />
      <LandingNavbar />
      <main className="flex-1">
        <Hero />
        <PanelErrorBoundary name="rules"><Rules /></PanelErrorBoundary>
        <PanelErrorBoundary name="how it works"><HowItWorks /></PanelErrorBoundary>
        <PanelErrorBoundary name="features"><Features /></PanelErrorBoundary>
        <PanelErrorBoundary name="markets"><Markets /></PanelErrorBoundary>
        <PanelErrorBoundary name="results"><SampleResult /></PanelErrorBoundary>
        <PanelErrorBoundary name="questions"><Questions /></PanelErrorBoundary>
        <PanelErrorBoundary name="closing"><ClosingCta /></PanelErrorBoundary>
      </main>
      <LandingFooter />
    </div>
  );
}
