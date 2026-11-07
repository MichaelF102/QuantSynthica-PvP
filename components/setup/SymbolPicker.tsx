'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Banner } from '@/components/ui';
import { NO_PICKER_FILTER, isPickerFilterActive, pickerResults, type PickerFilter } from '@/lib/catalog';
import { shortSymbol } from '@/lib/format';
import { classifyMarket, type MarketType } from '@/lib/landing/markets';
import type { SymbolInfo } from '@/lib/types';
import { AddDataHint } from './AddDataHint';
import { NoDataOption } from './NoDataOption';
import { PickerFilters } from './PickerFilters';
import { SymbolOption } from './SymbolOption';
import { useCatalog } from './useCatalog';

const GROUPS: readonly MarketType[] = ['Indices', 'Equity', 'Currency'];
const HEAD = 'text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1';

/**
 * Symbol picker: market and type filters, search, the playable symbols (a radio group) and,
 * once a filter or search is set, matching reference tickers that have no data yet.
 */
export function SymbolPicker({ index, value, onChange }: { index: SymbolInfo[]; value: string; onChange: (info: SymbolInfo) => void }) {
  const [filter, setFilter] = useState<PickerFilter>(NO_PICKER_FILTER);
  const [openNoData, setOpenNoData] = useState<string | null>(null);
  const { status, catalog, retry } = useCatalog();
  const hintId = useId();
  const listRef = useRef<HTMLDivElement>(null);

  const { ready, noData, noDataTotal } = pickerResults(index, catalog, filter);
  const groups = GROUPS.map((t) => ({ t, items: ready.filter((i) => classifyMarket(i).type === t) })).filter((g) => g.items.length > 0);
  const flat = groups.flatMap((g) => g.items);
  const selectedHidden = value !== '' && !flat.some((i) => i.symbol === value);
  const selected = index.find((i) => i.symbol === value);
  const openEntry = noData.find((e) => e.symbol === openNoData) ?? null;
  const filtering = isPickerFilterActive(filter);

  // Keep the chosen symbol visible inside the scrolling list.
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.scrollIntoView?.({ block: 'nearest' });
  }, [value]);

  // A new filter starts the list at the top, and moves the selection onto a visible playable
  // symbol, so "Start match" never starts a symbol the player cannot see.
  const changeFilter = (f: PickerFilter) => {
    setFilter(f);
    setOpenNoData(null);
    if (listRef.current) listRef.current.scrollTop = 0;
    const next = pickerResults(index, [], f).ready;
    const ordered = GROUPS.flatMap((t) => next.filter((i) => classifyMarket(i).type === t));
    if (ordered.length > 0 && !ordered.some((i) => i.symbol === value)) onChange(ordered[0]);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const idx = flat.findIndex((i) => i.symbol === value);
    const next = flat[(idx + (e.key === 'ArrowDown' ? 1 : -1) + flat.length) % flat.length];
    if (!next) return;
    onChange(next);
    listRef.current?.querySelector<HTMLButtonElement>(`[data-symbol="${CSS.escape(next.symbol)}"]`)?.focus();
  };

  return (
    <div className="space-y-2">
      <PickerFilters filter={filter} onChange={changeFilter} />

      <p className="text-[11px] text-faint" aria-live="polite">
        <span className="font-mono text-slate-300">{ready.length}</span> ready to play
        {filtering && status === 'ready' && (
          <>
            {' · '}
            <span className="font-mono">{noDataTotal.toLocaleString('en-US')}</span> without data
            {noDataTotal > noData.length && ` (first ${noData.length} shown, refine the search)`}
          </>
        )}
        {selectedHidden && selected && <> · Selected <span className="font-mono text-slate-300">{shortSymbol(selected.symbol)}</span> is hidden by the filters</>}
      </p>

      <div ref={listRef} className="max-h-64 overflow-y-auto space-y-3 pr-1">
        <div role="radiogroup" aria-label="Symbol" onKeyDown={onKeyDown} className="space-y-2">
          {groups.length === 0 && <p className="text-xs text-faint py-2 text-center">No playable symbol matches. {filtering && 'Check the tickers without data below.'}</p>}
          {groups.map(({ t, items }) => (
            <div key={t}>
              <p className={HEAD}>{t}</p>
              <div className="space-y-1">
                {items.map((i) => (
                  <SymbolOption
                    key={i.symbol}
                    info={i}
                    checked={i.symbol === value}
                    focusable={i.symbol === value || (selectedHidden && i === flat[0]) || (!value && i === flat[0])}
                    onSelect={() => onChange(i)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        {filtering && status === 'loading' && <p className="text-[11px] text-faint animate-pulse">Loading the ticker list…</p>}
        {filtering && status === 'ready' && noData.length > 0 && (
          <div>
            <p className={HEAD}>No data yet</p>
            <div className="space-y-1">
              {noData.map((e) => (
                <NoDataOption key={e.symbol} entry={e} open={openNoData === e.symbol} hintId={hintId} onToggle={() => setOpenNoData((s) => (s === e.symbol ? null : e.symbol))} />
              ))}
            </div>
          </div>
        )}
      </div>

      {status === 'error' && (
        <Banner kind="warning" onRetry={retry}>
          The ticker list could not be loaded. Only playable symbols are shown.
        </Banner>
      )}
      <AddDataHint id={hintId} entry={openEntry} />
    </div>
  );
}
