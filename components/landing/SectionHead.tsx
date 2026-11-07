import { cn } from '@/lib/utils';

/** Eyebrow (DESIGN.md §5) and a large section heading. */
export function SectionHead({ id, eyebrow, title, className }: { id: string; eyebrow: string; title: string; className?: string }) {
  return (
    <div className={cn('mb-10', className)}>
      <p className="text-[10px] font-mono uppercase tracking-wider text-slate-400">{eyebrow}</p>
      <h2 id={id} className="mt-2 text-[clamp(1.8rem,4vw,3rem)] font-extrabold tracking-tight leading-[1.15] text-white">
        {title}
      </h2>
    </div>
  );
}
