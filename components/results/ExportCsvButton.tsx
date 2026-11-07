'use client';

import { Download } from 'lucide-react';
import { buttonClasses } from '@/components/ui';
import type { MatchResult } from '@/lib/results';
import { csvFileName, tradesCsv } from '@/lib/tradeTable';

/** Downloads the trade list as CSV. Built in the browser; nothing is uploaded. */
export function ExportCsvButton({ result }: { result: MatchResult }) {
  const download = () => {
    const blob = new Blob([tradesCsv(result.trades, { symbol: result.symbol, currency: result.currency })], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = csvFileName(result.symbol, result.sessionStart);
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };
  return (
    <button type="button" onClick={download} disabled={result.trades.length === 0} className={buttonClasses('secondary', 'disabled:opacity-50 disabled:cursor-not-allowed')}>
      <Download className="w-3.5 h-3.5" aria-hidden /> Export CSV
    </button>
  );
}
