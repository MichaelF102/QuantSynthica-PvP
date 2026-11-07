'use client';

import { Search } from 'lucide-react';
import { Segmented } from '@/components/ui';
import { REGION_FILTERS, TYPE_FILTERS, type MarketFilter } from '@/lib/landing/markets';

const typeOptions = TYPE_FILTERS.map((v) => ({ value: v, label: v }));
const regionOptions = REGION_FILTERS.map((v) => ({ value: v, label: v }));
const LABEL = 'w-14 shrink-0 text-[10px] font-mono uppercase tracking-wider text-slate-400';

export function MarketFilters({ filter, onChange }: { filter: MarketFilter; onChange: (f: MarketFilter) => void }) {
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className={LABEL}>Type</span>
        <Segmented label="Filter by type" options={typeOptions} value={filter.type} onChange={(type) => onChange({ ...filter, type })} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className={LABEL}>Market</span>
        <Segmented label="Filter by market" options={regionOptions} value={filter.region} onChange={(region) => onChange({ ...filter, region })} />
      </div>
      <div className="relative flex items-center w-full max-w-md bg-[#0F172A]/70 border border-slate-700/50 hover:border-slate-600 focus-within:border-blue-500 rounded-lg transition-colors">
        <Search className="ml-3 mr-2 h-3.5 w-3.5 text-slate-400 shrink-0" aria-hidden />
        <input
          type="search"
          value={filter.query}
          onChange={(e) => onChange({ ...filter, query: e.target.value })}
          placeholder="Search symbol or name"
          aria-label="Search markets"
          className="w-full bg-transparent py-2 pr-3 text-sm text-slate-100 placeholder:text-faint outline-none"
        />
      </div>
    </div>
  );
}
