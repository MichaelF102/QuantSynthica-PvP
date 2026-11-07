import type { SVGProps } from 'react';
import { useId } from 'react';

/**
 * QuantSynthica "QS" mark: bold Q and S letterforms cut by a rising blue swoosh. Letter strokes
 * above the swoosh use `letterColor` (currentColor by default, so the mark follows the text colour
 * of light and dark surfaces); strokes below it switch to the swoosh gradient.
 *
 * Geometry lives in a 128 x 80 viewBox; size the component with width/height or a className.
 * The same drawing is exported as app/icon.svg for the favicon.
 */

// Letters (stroked, no fill)
const Q_RING = { cx: 34, cy: 38, r: 24 };
const Q_TAIL = 'M44 52 L60 70';
const S_CURVE = 'M110 22 C104 12 78 10 76 24 C74 38 112 34 112 52 C112 70 80 72 72 58';
const STROKE = 13;

// Swoosh: a crescent tapering at both ends, and the boundary used to split the letters
const SWOOSH = 'M10 76 C40 50 82 30 128 26 C88 33 54 50 28 72 C22 77 15 78 10 76 Z';
const BELOW = 'M0 80 L0 78 C40 52 80 34 128 29 L128 80 Z';
const ABOVE = 'M0 0 L128 0 L128 29 C80 34 40 52 0 78 Z';

export function QSLogoMark({
  className,
  letterColor = 'currentColor',
  title = 'QuantSynthica',
  ...rest
}: SVGProps<SVGSVGElement> & { letterColor?: string; title?: string }) {
  const uid = useId().replace(/:/g, '');
  const grad = `qs-grad-${uid}`;
  const below = `qs-below-${uid}`;
  const above = `qs-above-${uid}`;

  const letters = (stroke: string) => (
    <g fill="none" stroke={stroke} strokeWidth={STROKE}>
      <circle {...Q_RING} />
      <path d={Q_TAIL} />
      <path d={S_CURVE} />
    </g>
  );

  return (
    <svg viewBox="0 0 128 80" role="img" aria-label={title} className={className} {...rest}>
      <title>{title}</title>
      <defs>
        <linearGradient id={grad} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#1D4ED8" />
          <stop offset="1" stopColor="#38BDF8" />
        </linearGradient>
        <clipPath id={below}>
          <path d={BELOW} />
        </clipPath>
        <clipPath id={above}>
          <path d={ABOVE} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${above})`}>{letters(letterColor)}</g>
      <g clipPath={`url(#${below})`}>{letters(`url(#${grad})`)}</g>
      <path d={SWOOSH} fill={`url(#${grad})`} />
    </svg>
  );
}
