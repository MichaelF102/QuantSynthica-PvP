// Decorative rising line behind the hero. A shape only: no axis, no numbers, not market data.
const PATH =
  'M0 300 L80 260 L160 290 L240 200 L320 230 L400 150 L480 180 L560 120 L640 160 L720 90 L800 130 L880 70 L960 110 L1040 50 L1120 80 L1200 40';

export function HeroPriceLine() {
  return (
    <svg aria-hidden viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice" className="absolute inset-x-0 bottom-[8%] w-full h-[55%] opacity-35 pointer-events-none">
      <defs>
        <linearGradient id="lp-area-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path className="lp-price-area" d={`${PATH} L1200 400 L0 400 Z`} fill="url(#lp-area-fade)" />
      <path className="lp-price-line" d={PATH} fill="none" stroke="#3b82f6" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <path className="lp-price-flow" d={PATH} fill="none" stroke="#bfdbfe" strokeWidth={2} strokeLinecap="round" />
      <g className="lp-price-dot">
        <circle className="lp-price-glow" r={10} fill="rgba(96, 165, 250, 0.35)" />
        <circle r={3.5} fill="#e0f2fe" />
        <animateMotion dur="6s" begin="4s" repeatCount="indefinite" path={PATH} />
      </g>
    </svg>
  );
}
