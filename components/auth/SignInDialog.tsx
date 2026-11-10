'use client';

import { useEffect } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import { useAuth } from '@/store/authStore';
import { SignInForm } from './SignInForm';

/** The navbar's sign-in (plan M16). Closes once signed in. */
export function SignInDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const status = useAuth((s) => s.status);
  const clearMessages = useAuth((s) => s.clearMessages);

  useEffect(() => {
    if (open && status === 'signed_in') onClose();
  }, [open, status, onClose]);

  return (
    <Dialog
      open={open}
      title="Sign in to QuantSynthica"
      onClose={() => {
        clearMessages();
        onClose();
      }}
    >
      <p className="text-[11px] text-slate-400 mb-4">One free account for every QuantSynthica site. Your progress follows you to any device.</p>
      <SignInForm />
    </Dialog>
  );
}
