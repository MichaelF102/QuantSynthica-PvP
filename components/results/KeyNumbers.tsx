import { Hash, Percent, Scale, TrendingDown, Trophy, Waypoints } from 'lucide-react';
import { StatTile } from '@/components/ui';
import { edgePts } from '@/lib/analysis';
import { costsOf } from '@/lib/execution';
import { fmtMoney, fmtPct, fmtProfitFactor } from '@/lib/format';
import { executionSummary } from '@/lib/orders';
import type { MatchResult } from '@/lib/results';
import type { SessionStatus } from './useSessionCandles';

const tone = (v: number | null): 'positive' | 'negative' | 'neutral' => (v === null ? 'neutral' : v > 0 ? 'positive' : v < 0 ? 'negative' : 'neutral');

/** KPI strip. The buy & hold tile depends on the session candles and shows its own loading state. */
export function KeyNumbers({ result, buyHold, sessionStatus }: { result: MatchResult; buyHold: number | null; sessionStatus: SessionStatus }) {
  const { stats, config } = result;
  const edge = edgePts(stats.returnPct, buyHold);
  const pf = stats.profitFactor;
  const ddUsed = config.maxDrawdownPct > 0 ? (stats.maxDrawdownPct / config.maxDrawdownPct) * 100 : null;
  // Plan M12: every position is closed at the end, so the trades carry every fee paid.
  const fees = result.trades.reduce((sum, t) => sum + (t.fees ?? 0), 0);
  const costs = costsOf(config);
  const exec = executionSummary(config);
  const showExec = costs.fillModel !== 'close' || costs.commission > 0 || costs.slippageBps > 0;

  return (
    <div className="space-y-2">
      <section aria-label="Key numbers" className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        <StatTile
          label="Return"
          icon={Percent}
          value={fmtPct(stats.returnPct)}
          delta={edge === null ? undefined : `${edge >= 0 ? 'Beat' : 'Trailed'} market by ${Math.abs(edge).toFixed(2)} pts`}
          deltaTone={tone(edge === null ? null : Number(edge.toFixed(2)))}
          info="Net P&L as a % of the starting balance, compared with buy & hold over the same session."
          valueTone={tone(Number(stats.returnPct.toFixed(2)))} // tone follows the shown value: -0.0005% reads "0.00%", neutral
        />
        {sessionStatus === 'loading' ? (
          <div className="rounded-xl border border-slate-800/90 bg-[#0b1222]/95 p-3.5 animate-pulse space-y-2" role="status" aria-label="Loading buy and hold">
            <div className="h-2.5 w-20 bg-slate-800 rounded" />
            <div className="h-5 w-16 bg-slate-800/60 rounded" />
          </div>
        ) : (
          <StatTile
            label="Buy & hold"
            icon={Waypoints}
            value={fmtPct(buyHold)}
            delta={buyHold === null ? (sessionStatus === 'error' ? 'Could not load' : 'Session data unavailable') : 'Same session, full balance'}
            info="Return of buying at the first session candle's close and holding to the last revealed candle. Uses the session's market data."
          />
        )}
        <StatTile label="Win rate" icon={Trophy} value={fmtPct(stats.winRate, 1, false)} info="Winning closed trades / all closed trades. — with no trades." />
        <StatTile
          label="Profit factor"
          icon={Scale}
          value={fmtProfitFactor(pf)}
          delta={pf === null ? undefined : pf >= 1 ? 'Profits cover losses' : 'Below 1: losses exceed profits'}
          deltaTone={pf === null ? 'neutral' : pf >= 1 ? 'positive' : 'negative'}
          info="Gross profit / gross loss. — with no trades or no losing trades."
          valueTone={pf !== null && pf < 1 ? 'negative' : 'neutral'}
        />
        <StatTile
          label="Max drawdown"
          icon={TrendingDown}
          value={fmtPct(stats.maxDrawdownPct, 2, false)}
          delta={ddUsed === null ? undefined : `${ddUsed.toFixed(0)}% of the ${fmtPct(config.maxDrawdownPct, 0, false)} limit`}
          deltaTone={ddUsed !== null && ddUsed >= 70 ? 'negative' : 'neutral'}
          info="Largest peak-to-trough fall of equity during the match."
        />
        <StatTile label="Trades" icon={Hash} value={String(stats.trades)} delta={stats.trades ? `${stats.wins} won · ${stats.losses} lost` : 'None closed'} info="Closed trades. A partial close counts as its own trade." />
      </section>
      {showExec && (
        <p className="text-[11px] text-slate-400 font-mono">
          Fills: {exec.fills} · Commission: {exec.commission} · Slippage: {exec.slippage}
          {fees > 0 && (
            <>
              {' '}
              · Fees paid: <span className="text-rose-300">{fmtMoney(fees, config.currency)}</span> (included in P&amp;L)
            </>
          )}
        </p>
      )}
    </div>
  );
}
