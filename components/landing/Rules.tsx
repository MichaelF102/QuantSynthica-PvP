import { RulesCarousel } from './RulesCarousel';
import { RulesChart } from './RulesChart';
import { Section } from './Section';
import { SectionHead } from './SectionHead';

export function Rules() {
  return (
    <Section id="rules" glow="blue" labelledBy="rules-title">
      <SectionHead id="rules-title" eyebrow="Rules" title="The same terms, every match." />
      <RulesChart />
      <RulesCarousel />
      <p className="mt-6 text-[11px] text-faint">Diagrams are illustrations, not market data.</p>
    </Section>
  );
}
