import { cn } from '@/lib/utils';

export type SegmentedOption<T extends string | number> = { value: T; label: string };

type SegmentedProps<T extends string | number> = {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  disabled?: boolean;
  className?: string;
};

/** Segmented control from DESIGN.md §7.4 (timeframes, speeds, short option sets). */
export function Segmented<T extends string | number>({ options, value, onChange, label, disabled, className }: SegmentedProps<T>) {
  return (
    <div role="group" aria-label={label} className={cn('inline-flex items-center p-0.5 rounded-lg bg-[#0b1222] border border-slate-800', className)}>
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            key={String(opt.value)}
            type="button"
            aria-pressed={selected}
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className={cn(
              'px-2.5 py-1 rounded text-[11px] font-mono transition-colors duration-150 touch:min-h-9',
              'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500/70 disabled:opacity-50',
              selected ? 'bg-blue-600 text-white shadow-sm font-semibold' : 'font-medium text-slate-400 hover:text-white',
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
