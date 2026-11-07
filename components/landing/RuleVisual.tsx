import { candlesFromCloses } from '@/lib/landing/geometry';
import type { RuleId } from '@/lib/landing/content';
import { ILLUSTRATIVE_CLOSES } from '@/lib/landing/playground';
import { CandleGlyphs } from './CandleGlyphs';

// Diagrams for the six rules, drawn in a 360 x 210 box. Illustrative only, not market data.

const MONO = 'font-mono';
const toY = (v: number) => 170 - (v - 95) * 4.5;
const RING = 2 * Math.PI * 70;
const FILL = candlesFromCloses(ILLUSTRATIVE_CLOSES.slice(0, 10), 40, 30, toY);
const FILL_MARK = FILL[6];
const STRIP = candlesFromCloses(ILLUSTRATIVE_CLOSES, 20, 24, toY);
const WIN = STRIP.slice(4, 10);
const WIN_X = WIN[0].x - 14;
const WIN_W = WIN[WIN.length - 1].x - WIN[0].x + 28;

const BALANCE = (
  <>
    <text x={180} y={96} textAnchor="middle" fill="#ffffff" fontSize={30} fontWeight={600} className={MONO}>$100,000</text>
    <text x={180} y={124} textAnchor="middle" fill="#94a3b8" fontSize={12} className={MONO}>or ₹10,00,000 for INR markets</text>
  </>
);

const CLOCK = (
  <>
    <circle cx={180} cy={100} r={70} fill="none" stroke="#1e293b" strokeWidth={10} />
    <circle cx={180} cy={100} r={70} fill="none" stroke="#3b82f6" strokeWidth={10} strokeLinecap="round" strokeDasharray={RING} strokeDashoffset={RING * 0.35} transform="rotate(-90 180 100)" />
    <text x={180} y={108} textAnchor="middle" fill="#ffffff" fontSize={24} className={MONO}>10:00</text>
    <text x={180} y={128} textAnchor="middle" fill="#94a3b8" fontSize={10}>real time</text>
  </>
);

const DRAWDOWN = (
  <>
    <line x1={20} x2={340} y1={80} y2={80} stroke="#475569" strokeDasharray="2 4" />
    <text x={340} y={72} textAnchor="end" fill="#94a3b8" fontSize={10}>Peak</text>
    <line x1={20} x2={340} y1={130} y2={130} stroke="#f43f5e" strokeWidth={1.2} strokeDasharray="5 4" />
    <text x={20} y={122} fill="#fb7185" fontSize={10} className={MONO}>5% limit</text>
    <polyline points="20,80 60,70 100,95 140,82 180,80 220,100 260,112 320,126" fill="none" stroke="#60a5fa" strokeWidth={2.5} strokeLinejoin="round" />
    <text x={20} y={168} fill="#94a3b8" fontSize={11}>Equity stays above the line, so the match runs on.</text>
  </>
);

const LEVERAGE = (
  <>
    <text x={60} y={66} fill="#94a3b8" fontSize={10}>Your balance</text>
    <rect x={60} y={72} width={180} height={16} rx={8} fill="#3b82f6" opacity={0.6} />
    <text x={60} y={110} fill="#94a3b8" fontSize={10}>Order: <tspan className={MONO}>150%</tspan> of balance</text>
    <rect x={60} y={116} width={270} height={16} rx={8} fill="none" stroke="#f43f5e" strokeDasharray="4 3" />
    <rect x={60} y={150} width={92} height={24} rx={12} fill="rgba(244,63,94,0.15)" stroke="#f43f5e" />
    <text x={106} y={166} textAnchor="middle" fill="#fb7185" fontSize={11} fontWeight={600}>Rejected</text>
  </>
);

const FILLS = (
  <>
    <CandleGlyphs candles={FILL} />
    <line x1={FILL_MARK.x} x2={FILL_MARK.x} y1={FILL_MARK.c} y2={186} stroke="#60a5fa" strokeDasharray="2 3" />
    <circle cx={FILL_MARK.x} cy={FILL_MARK.c} r={5} fill="#60a5fa" stroke="#0b1222" strokeWidth={2} />
    <text x={FILL_MARK.x} y={200} textAnchor="middle" fill="#93c5fd" fontSize={10}>Fill at close</text>
  </>
);

const SESSIONS = (
  <>
    <rect x={WIN_X} y={60} width={WIN_W} height={120} rx={8} fill="rgba(59,130,246,0.12)" stroke="#3b82f6" strokeDasharray="4 3" />
    <text x={WIN_X + WIN_W / 2} y={52} textAnchor="middle" fill="#93c5fd" fontSize={10}>Random window</text>
    <CandleGlyphs candles={STRIP} />
  </>
);

const VISUALS: Record<RuleId, JSX.Element> = { balance: BALANCE, time: CLOCK, drawdown: DRAWDOWN, leverage: LEVERAGE, fills: FILLS, sessions: SESSIONS };

export function RuleVisual({ id, label }: { id: RuleId; label: string }) {
  return (
    <svg viewBox="0 0 360 210" role="img" aria-label={label} className="w-full max-w-[420px] h-auto">
      {VISUALS[id]}
    </svg>
  );
}
