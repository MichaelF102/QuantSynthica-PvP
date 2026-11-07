import { fmtMoney, fmtPct, shortSymbol } from '@/lib/format';
import type { RoomInfo } from '@/lib/multiplayer/roomClient';
import { executionSummary } from '@/lib/orders';
import { seriesText } from '@/lib/multiplayer/seriesText';

/** The room's rules, shared by both players. The session date stays hidden (MP9). */
export function RoomRules({ room }: { room: RoomInfo }) {
  const { settings: s, symbol } = room;
  const exec = executionSummary({ ...s, currency: symbol.currency });
  const series = room.series;
  const rows: [string, string, string?][] = [
    ['Symbol', `${shortSymbol(symbol.symbol)} · ${symbol.name}`],
    ['Interval', '1m'],
    ['Time limit', `${s.durationMin} min`],
    ['Speed', `${s.speed}x · no pause`],
    ['Starting balance', fmtMoney(s.startingBalance, symbol.currency)],
    ['Max drawdown', fmtPct(s.maxDrawdownPct, s.maxDrawdownPct % 1 ? 1 : 0, false), 'text-amber-400'],
    ['Session date', 'Revealed at the end'],
    ['Winner', 'Highest final equity'],
    ['Orders fill at', exec.fills],
    ['Commission', exec.commission],
    ['Slippage', exec.slippage],
    ['Stop / target', 'On your position'],
    ['Format', s.series === 3 ? 'Best of 3' : 'Single game'],
    ['Opponent positions', s.openPositions ? 'Visible to both' : 'Hidden until the end'],
  ];
  if (series && series.of === 3) rows.unshift(['Series', seriesText(series, room.players, null)]);
  return (
    <dl className="grid grid-cols-2 gap-2">
      {rows.map(([k, v, tone]) => (
        <div key={k} className="rounded-lg border border-slate-800 bg-[#0b1120]/60 px-3 py-2 min-w-0">
          <dt className="text-[10px] text-slate-400">{k}</dt>
          <dd className={`text-xs font-mono font-semibold truncate ${tone ?? 'text-white'}`} title={v}>
            {v}
          </dd>
        </div>
      ))}
    </dl>
  );
}
