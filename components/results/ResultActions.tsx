'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, RotateCcw, Settings2, Trash2 } from 'lucide-react';
import { buttonClasses } from '@/components/ui';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { shortSymbol } from '@/lib/format';
import type { MatchResult } from '@/lib/results';
import { deleteResult } from '@/lib/storage';
import { ChallengeButton } from './ChallengeButton';

/** Play the same setup again, start a new one, go back to all results, or delete this one. */
export function ResultActions({ result }: { result: MatchResult }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [failed, setFailed] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link href={`/practice?from=${encodeURIComponent(result.id)}`} className={buttonClasses('primary')}>
        <RotateCcw className="w-3.5 h-3.5" aria-hidden /> Play {shortSymbol(result.symbol)} again
      </Link>
      <Link href="/practice" className={buttonClasses('secondary')}>
        <Settings2 className="w-3.5 h-3.5" aria-hidden /> New setup
      </Link>
      <Link href="/history" className={buttonClasses('secondary')}>
        <ArrowLeft className="w-3.5 h-3.5" aria-hidden /> All results
      </Link>
      <ChallengeButton result={result} />
      <button type="button" onClick={() => setConfirming(true)} className={buttonClasses('secondary', 'sm:ml-auto text-rose-300 hover:text-rose-200 hover:border-rose-500/50')}>
        <Trash2 className="w-3.5 h-3.5" aria-hidden /> Delete result
      </button>
      {failed && <p role="alert" className="w-full text-[11px] text-rose-300">The result could not be deleted. Browser storage may be blocked.</p>}
      <ConfirmDialog
        open={confirming}
        title="Delete this result?"
        confirmLabel="Delete"
        destructive
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          if (deleteResult(result.id)) router.push('/history');
          else setFailed(true);
        }}
      >
        The {shortSymbol(result.symbol)} match from this report, its trades and your note are removed from this browser. This cannot be undone.
      </ConfirmDialog>
    </div>
  );
}
