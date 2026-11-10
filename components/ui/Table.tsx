import type { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/** Data table recipe from DESIGN.md §7.7. Scrolls inside its own container, never the page. */
export function Table({ children, className, caption }: { children: ReactNode; className?: string; caption?: string }) {
  return (
    // `relative`: absolutely placed children (sr-only labels) stay inside the scroll box instead of
    // widening the page on phones.
    <div className="relative w-full overflow-x-auto">
      <table className={cn('w-full text-left border-collapse text-xs', className)}>
        {caption && <caption className="sr-only">{caption}</caption>}
        {children}
      </table>
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return (
    <thead>
      <tr className="border-b border-slate-800 text-[10px] text-slate-400 uppercase tracking-wider">{children}</tr>
    </thead>
  );
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-slate-800/50">{children}</tbody>;
}

export function Tr({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn('hover:bg-slate-800/30 transition-colors', className)} {...props} />;
}

type Align = { numeric?: boolean };

export function Th({ numeric, className, ...props }: ThHTMLAttributes<HTMLTableCellElement> & Align) {
  return <th scope="col" className={cn('py-1.5 px-2 font-medium', numeric && 'text-right', className)} {...props} />;
}

/** Numbers are right-aligned and monospace. */
export function Td({ numeric, className, ...props }: TdHTMLAttributes<HTMLTableCellElement> & Align) {
  return <td className={cn('py-2 px-2', numeric ? 'text-right font-mono' : 'text-slate-200', className)} {...props} />;
}
