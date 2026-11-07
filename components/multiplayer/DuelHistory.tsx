'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Swords, Trash2 } from 'lucide-react';
import { Badge, Banner, Button, EmptyState, Panel, PanelSkeleton, TBody, THead, Table, Td, Th, Tr, buttonClasses } from '@/components/ui';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { fmtMoney, fmtPct, fmtPlayedAt, shortSymbol } from '@/lib/format';
import { MAX_DUELS, OUTCOME_TEXT, deleteDuel, listDuels, type DuelResult } from '@/lib/multiplayer/duelResult';
import { onStoredDataChange } from '@/lib/localChanges';
import { cn } from '@/lib/utils';

const OUTCOME_TONE = { win: 'emerald', loss: 'rose', draw: undefined } as const;

/** Saved 1v1 results on the History page (plan M11.6). */
export function DuelHistory() {
  const [state, setState] = useState<{ status: 'loading' } | { status: 'ready'; duels: DuelResult[]; error: boolean }>({ status: 'loading' });
  const [pending, setPending] = useState<DuelResult | null>(null);
  const refresh = useCallback(() => setState({ status: 'ready', ...listDuels() }), []);
  useEffect(() => {
    refresh();
    return onStoredDataChange(refresh);
  }, [refresh]);

  if (state.status === 'loading') return <PanelSkeleton rows={4} label="Loading 1v1 results" />;
  const { duels, error } = state;

  return (
    <Panel title="1v1 matches" description={`Newest first · kept in this browser only · up to ${MAX_DUELS}`} icon={Swords}>
      {error && <Banner kind="warning">Some saved 1v1 results could not be read in this browser.</Banner>}
      {duels.length === 0 ? (
        <EmptyState
          icon={Swords}
          title="No 1v1 matches yet"
          hint="Create a room and share the code to play a friend."
          action={
            <Link href="/play" className={buttonClasses('secondary')}>
              Play a friend
            </Link>
          }
        />
      ) : (
        <Table caption="Saved 1v1 matches, newest first">
          <THead>
            <Th>Played</Th>
            <Th>Result</Th>
            <Th>Opponent</Th>
            <Th>Symbol</Th>
            <Th numeric>Your equity</Th>
            <Th numeric>Your return</Th>
            <Th numeric>Their return</Th>
            <Th numeric>
              <span className="sr-only">Actions</span>
            </Th>
          </THead>
          <TBody>
            {duels.map((d) => (
              <Tr key={d.id}>
                <Td className="whitespace-nowrap">
                  <Link href={`/duel/${encodeURIComponent(d.id)}`} className="text-blue-300 hover:text-blue-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500/70 rounded">
                    {fmtPlayedAt(d.playedAt)}
                  </Link>
                </Td>
                <Td>
                  <Badge tone={OUTCOME_TONE[d.outcome]}>{OUTCOME_TEXT[d.outcome]}</Badge>
                </Td>
                <Td className="max-w-[10rem] truncate">{d.opponent.nickname}</Td>
                <Td className="font-mono">{shortSymbol(d.symbol)}</Td>
                <Td numeric>{fmtMoney(d.you.stats.finalEquity, d.currency)}</Td>
                <Td numeric className={cn(d.you.stats.returnPct > 0 ? 'text-emerald-400' : d.you.stats.returnPct < 0 ? 'text-rose-400' : '')}>
                  {fmtPct(d.you.stats.returnPct)}
                </Td>
                <Td numeric className="text-slate-400">{fmtPct(d.opponent.stats.returnPct)}</Td>
                <Td numeric>
                  <Button variant="icon" aria-label={`Delete 1v1 against ${d.opponent.nickname}, ${fmtPlayedAt(d.playedAt)}`} onClick={() => setPending(d)}>
                    <Trash2 className="w-3.5 h-3.5" aria-hidden />
                  </Button>
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      )}
      <ConfirmDialog
        open={pending !== null}
        title="Delete this 1v1 result?"
        confirmLabel="Delete"
        destructive
        onCancel={() => setPending(null)}
        onConfirm={() => {
          if (pending) deleteDuel(pending.id);
          setPending(null);
          refresh();
        }}
      >
        {pending ? `Against ${pending.opponent.nickname}, played ${fmtPlayedAt(pending.playedAt)}. This cannot be undone.` : null}
      </ConfirmDialog>
    </Panel>
  );
}
