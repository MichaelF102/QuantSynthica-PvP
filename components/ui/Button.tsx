import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export type ButtonVariant = 'primary' | 'secondary' | 'text' | 'icon' | 'buy' | 'sell';

const FOCUS = 'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500/70';
// Phones and tablets get finger-sized targets; desktop keeps DESIGN.md's sizes.
const TOUCH: Partial<Record<ButtonVariant, string>> = { primary: 'touch:min-h-10', secondary: 'touch:min-h-10', buy: 'touch:min-h-10', sell: 'touch:min-h-10', icon: 'touch:min-h-10 touch:min-w-10' };

// Class strings from DESIGN.md §7.5 and CLAUDE.md §6 (buy/sell tints).
const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-600/20 inline-flex items-center justify-center gap-1.5',
  secondary:
    'inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700/80 bg-slate-900/70 hover:bg-slate-800 hover:border-slate-600 text-slate-200 hover:text-white text-xs font-medium',
  text: 'inline-flex items-center gap-1 text-[11px] font-medium text-blue-400 hover:text-blue-300 rounded',
  icon: 'inline-flex items-center justify-center p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60',
  buy: 'px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5',
  sell: 'px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5',
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', className, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        VARIANTS[variant],
        TOUCH[variant],
        'transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
        FOCUS,
        className,
      )}
      {...props}
    />
  );
});

/** Same classes for links styled as buttons. */
export function buttonClasses(variant: ButtonVariant = 'primary', className?: string): string {
  return cn(VARIANTS[variant], TOUCH[variant], 'transition-colors duration-150', FOCUS, className);
}
