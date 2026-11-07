'use client';

import { useId } from 'react';
import { Search } from 'lucide-react';
import { Segmented } from '@/components/ui';
import type { PickerFilter } from '@/lib/catalog';
import { REGION_FILTERS, TYPE_FILTERS } from '@/lib/landing/markets';

const regionOptions = REGION_FILTERS.map((v) => ({ value: v, label: v }));
const typeOptions = TYPE_FILTERS.map((v) => ({ value: v, label: v }));
const LABEL = 'w-12 shrink-0 text-[10px] font-mono uppercase tracking-wider text-faint';

/** Market and type filters plus the search box for the symbol picker. */
export function PickerFilters({ filter, onChange }: { filter: PickerFilter; onChange: (f: PickerFilter) => void }) {
  const searchId = useId();
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-2">
          <span className={LABEL}>Market</span>
          <Segmented label="Filter by market" options={regionOptions} value={filter.region} onChange={(region) => onChange({ ...filter, region })} />
        </div>
        <div className="flex items-center gap-2">
          <span className={LABEL}>Type</span>
          <Segmented label="Filter by type" options={typeOptions} value={filter.type} onChange={(type) => onChange({ ...filter, type })} />
        </div>
      </div>
      <div className="relative flex items-center bg-[#0F172A]/70 border border-slate-700/50 hover:border-slate-600 focus-within:border-blue-500 rounded-lg transition-colors">
        <Search className="ml-3 mr-2 h-3.5 w-3.5 text-slate-400" aria-hidden />
        <label htmlFor={searchId} className="sr-only">
          Search symbols
        </label>
        <input
          id={searchId}
          type="search"
          value={filter.query}
          onChange={(e) => onChange({ ...filter, query: e.target.value })}
          placeholder="Search ticker or company, e.g. RELIANCE, Apple, Nifty"
          autoComplete="off"
          spellCheck={false}
          className="w-full bg-transparent py-1.5 pr-3 text-xs text-slate-100 placeholder:text-faint outline-none"
        />
      </div>
    </div>
  );
}
