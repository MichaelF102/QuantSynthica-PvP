'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { FAQS } from '@/lib/landing/content';
import { cn } from '@/lib/utils';
import { Section } from './Section';
import { SectionHead } from './SectionHead';

/** Two-column FAQ. One answer open at a time; the first starts open. */
export function Questions() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <Section id="faq" glow="slate" labelledBy="faq-title">
      <div className="flex flex-col lg:flex-row gap-10 items-start">
        <div className="lg:w-[34%] shrink-0">
          <SectionHead id="faq-title" eyebrow="Questions" title="Before you start." className="mb-4" />
          <p className="max-w-sm text-sm text-slate-400 leading-relaxed">
            The questions people ask before their first match. Open one to read the answer. Only one stays open at a time.
          </p>
        </div>

        <div className="flex-1 min-w-0 w-full border-b border-slate-800">
          {FAQS.map(([q, a], i) => {
            const isOpen = open === i;
            return (
              <div key={q} className={cn('lp-faq relative border-t border-slate-800', isOpen && 'is-open')}>
                <h3>
                  <button
                    type="button"
                    id={`faq-q-${i}`}
                    aria-expanded={isOpen}
                    aria-controls={`faq-a-${i}`}
                    onClick={() => setOpen(isOpen ? null : i)}
                    className={cn(
                      'w-full flex items-center gap-4 py-4 pl-4 pr-1 text-left text-[1rem] transition-colors',
                      'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500/70 rounded',
                      isOpen ? 'text-white' : 'text-slate-200 hover:text-white',
                    )}
                  >
                    <span className={cn('font-mono text-xs min-w-[2rem]', isOpen ? 'text-blue-400' : 'text-faint')}>{String(i + 1).padStart(2, '0')}</span>
                    <span className="flex-1">{q}</span>
                    <Plus aria-hidden className={cn('w-4 h-4 shrink-0 text-faint transition-transform duration-200', isOpen && 'rotate-45')} />
                  </button>
                </h3>
                <div
                  id={`faq-a-${i}`}
                  role="region"
                  aria-labelledby={`faq-q-${i}`}
                  className={cn('grid transition-[grid-template-rows] duration-300', isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}
                >
                  <div className="overflow-hidden min-h-0">
                    <p className="pl-16 pr-4 pb-5 max-w-2xl text-sm text-slate-400 leading-relaxed" aria-hidden={!isOpen}>
                      {a}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Section>
  );
}
