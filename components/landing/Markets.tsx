'use client';

import { useState } from 'react';
import { SearchX } from 'lucide-react';
import { Banner, EmptyState, Skeleton } from '@/components/ui';
import { PANEL_SHELL } from '@/components/ui/Panel';
import { PREVIEW_ORDER, PREVIEW_PER_TYPE, countByType, filterMarkets, isFilterActive, visibleMarkets, type MarketFilter } from '@/lib/landing/markets';
import { MarketCard } from './MarketCard';
import { MarketDetail } from './MarketDetail';
import { MarketFilters } from './MarketFilters';
import { Section } from './Section';
import { SectionHead } from './SectionHead';
import { TYPE_DOT } from './marketColors';
import { useMarkets } from './useMarkets';

const NO_FILTER: MarketFilter = { type: 'All', region: 'All', query: '' };
const GRID = 'grid grid-cols-[repeat(auto-fill,minmax(min(100%,220px),1fr))] gap-3';

export function Markets() {
  const { status, items, retry } = useMarkets();
  const [filter, setFilter] = useState<MarketFilter>(NO_FILTER);
  const [selected, setSelected] = useState<string | null>(null);

  const filtering = isFilterActive(filter);
  const matches = filterMarkets(items, filter);
  const visible = visibleMarkets(items, filter);
  const counts = countByType(items);
  const current = items.find((m) => m.symbol === selected) ?? null;

  return (
    <Section id="markets" glow="sky" labelledBy="markets-title">
      <SectionHead id="markets-title" eyebrow="Markets" title="The symbols you can practise on." />

      {status === 'error' && (
        <Banner kind="warning" onRetry={retry} className="mb-5">
          The market list could not be loaded. Showing the curated list instead; some of these may not have data yet.
        </Banner>
      )}
      {status === 'empty' && (
        <Banner kind="info" className="mb-5">
          No markets have data yet. Showing the curated list; practice needs market data for the symbol you pick.
        </Banner>
      )}

      {status === 'loading' ? (
        <div role="status" aria-label="Loading markets" className="animate-pulse space-y-4">
          <Skeleton className="h-5 w-72" />
          <Skeleton className="h-16 w-full max-w-md" />
          <div className={GRID}>
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
          <span className="sr-only">Loading markets…</span>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-x-6 gap-y-2 mb-6 text-sm text-slate-300">
            {PREVIEW_ORDER.map((t) => (
              <span key={t} className="inline-flex items-center gap-2">
                <span aria-hidden className="w-2 h-2 rounded-full" style={{ background: TYPE_DOT[t] }} />
                {t} <span className="font-mono text-faint">{counts[t]}</span>
              </span>
            ))}
          </div>

          <MarketFilters filter={filter} onChange={setFilter} />

          <p className="mt-4 mb-3 text-xs text-faint" aria-live="polite">
            {filtering
              ? `Showing ${matches.length} of ${items.length} markets`
              : `Showing up to ${PREVIEW_PER_TYPE} per type. Pick a type, a market or search to see the full list.`}
          </p>

          {visible.length === 0 ? (
            <div className={PANEL_SHELL}>
              <EmptyState icon={SearchX} title="No markets match" hint="Clear a filter or the search to see more." />
            </div>
          ) : (
            <div className={GRID}>
              {visible.map((m, i) => (
                <MarketCard key={m.symbol} market={m} index={i} selected={selected === m.symbol} onSelect={() => setSelected(selected === m.symbol ? null : m.symbol)} />
              ))}
            </div>
          )}

          <div className="mt-5 p-5 rounded-xl border border-dashed border-slate-800 min-h-[6rem]" aria-live="polite">
            <MarketDetail market={current} />
          </div>
        </>
      )}
    </Section>
  );
}
