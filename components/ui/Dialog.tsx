'use client';

import { useEffect, useId, useRef, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { PANEL_SHELL } from './Panel';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

type DialogProps = {
  open: boolean;
  title: string;
  /** Called on Esc or a backdrop click. Omit to make the dialog non-dismissible. */
  onClose?: () => void;
  role?: 'dialog' | 'alertdialog';
  /** Element focused when the dialog opens (defaults to the first focusable one). */
  initialFocus?: RefObject<HTMLElement>;
  children: ReactNode;
  className?: string;
};

/** Modal with a focus trap; returns focus to where it was on close (CLAUDE.md §10, §11). */
export function Dialog({ open, title, onClose, role = 'dialog', initialFocus, children, className }: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const first = initialFocus?.current ?? panel?.querySelector<HTMLElement>(FOCUSABLE) ?? panel;
    first?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onCloseRef.current) {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !panel) return;
      const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (items.length === 0) return e.preventDefault();
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      previous?.focus?.();
    };
  }, [open, initialFocus]);

  // Rendered on <body>: inside the page, parent spacing utilities (space-y-*) would add a margin
  // to the fixed overlay and shift it down.
  if (!open || typeof document === 'undefined') return null;
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm motion-safe:animate-[toast-in_150ms_ease-out]" aria-hidden onClick={() => onCloseRef.current?.()} />
      <div
        ref={panelRef}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          PANEL_SHELL,
          'relative w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto p-5 shadow-[0_18px_48px_-12px_rgba(0,0,0,0.65)] outline-none motion-safe:animate-[toast-in_150ms_ease-out]',
          className,
        )}
      >
        <h2 id={titleId} className="text-sm font-bold text-white tracking-wide mb-2">
          {title}
        </h2>
        {children}
      </div>
    </div>,
    document.body,
  );
}
