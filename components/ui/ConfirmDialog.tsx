'use client';

import { useRef, type ReactNode } from 'react';
import { Button } from './Button';
import { Dialog } from './Dialog';

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /** Rose button for destructive actions such as ending a match. */
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/** Yes/no question. Cancel has focus first so Enter never confirms by accident. */
export function ConfirmDialog({ open, title, children, confirmLabel, cancelLabel = 'Cancel', destructive, onConfirm, onCancel }: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  return (
    <Dialog open={open} title={title} role="alertdialog" onClose={onCancel} initialFocus={cancelRef}>
      <div className="text-xs text-slate-300 leading-relaxed">{children}</div>
      <div className="mt-5 flex justify-end gap-2">
        <Button ref={cancelRef} variant="secondary" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button variant={destructive ? 'sell' : 'primary'} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}
