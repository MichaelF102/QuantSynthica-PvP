import type { ReactNode } from 'react';

type PageHeaderProps = {
  title: string;
  /** Word(s) after the title rendered with the gradient highlight (DESIGN.md §4.5). */
  highlight?: string;
  subtitle?: string;
  description?: string;
  aside?: ReactNode;
};

/** Page hero header: DESIGN.md §6.2 item 2, with the §4.5 glow. */
export function PageHeader({ title, highlight, subtitle, description, aside }: PageHeaderProps) {
  return (
    <header className="relative isolate border-b border-slate-800/60 pb-5 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
      <div className="absolute top-0 left-1/4 w-96 max-w-[60%] h-24 bg-blue-600/10 blur-3xl pointer-events-none rounded-full -z-10" aria-hidden />
      <div className="absolute top-0 right-1/4 w-96 max-w-[60%] h-24 bg-indigo-600/10 blur-3xl pointer-events-none rounded-full -z-10" aria-hidden />
      <div className="space-y-1.5 max-w-2xl">
        {subtitle && <p className="text-xs sm:text-sm font-semibold tracking-wide text-slate-300">{subtitle}</p>}
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-primary">
          {title}
          {highlight && (
            <>
              {' '}
              <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-cyan-400 bg-clip-text text-transparent">{highlight}</span>
            </>
          )}
        </h1>
        {description && <p className="text-xs text-secondary leading-relaxed">{description}</p>}
      </div>
      {aside && <div className="shrink-0">{aside}</div>}
    </header>
  );
}
