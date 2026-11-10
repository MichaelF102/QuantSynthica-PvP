'use client';

import { useState } from 'react';
import { MailCheck } from 'lucide-react';
import { Button } from '@/components/ui';
import { useAuth } from '@/store/authStore';

/** Plan M16: an email/password account syncs only after its email is verified. */
export function VerifyEmailBanner({ email }: { email: string | null }) {
  const { notice, resendVerification, refreshUser } = useAuth((s) => s);
  const [busy, setBusy] = useState(false);
  const run = async (job: () => Promise<void>) => {
    setBusy(true);
    try {
      await job();
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-3" role="status" aria-live="polite">
      <div className="flex items-start gap-3">
        <MailCheck className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" aria-hidden />
        <div className="space-y-1 min-w-0">
          <p className="text-xs font-semibold text-amber-200">Verify your email to turn on cloud sync</p>
          <p className="text-[11px] text-slate-300">
            Open the link we sent{email ? ` to ${email}` : ''}, then press &ldquo;I&apos;ve verified it&rdquo;. Until then your progress is saved in this browser only.
          </p>
          {notice && <p className="text-[11px] text-slate-200">{notice}</p>}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => void run(refreshUser)} disabled={busy}>
          I&apos;ve verified it
        </Button>
        <Button variant="secondary" onClick={() => void run(resendVerification)} disabled={busy}>
          Send the email again
        </Button>
      </div>
    </div>
  );
}
