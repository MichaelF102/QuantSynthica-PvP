'use client';

import { useId, useState, type FormEvent } from 'react';
import { LogIn, Mail } from 'lucide-react';
import { Banner, Button } from '@/components/ui';
import { PASSWORD_MIN } from '@/lib/cloud/apps';
import { useAuth } from '@/store/authStore';

type Mode = 'signin' | 'signup' | 'reset';

const INPUT = 'w-full rounded-lg border border-slate-700/50 bg-[#0F172A]/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-blue-500';
const LABEL = 'block text-[10px] uppercase tracking-wider text-slate-400 mb-1';
const LINK = 'text-[11px] text-blue-300 hover:text-blue-200 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500/70 rounded';
const SUBMIT: Record<Mode, string> = { signin: 'Sign in', signup: 'Create account', reset: 'Send reset link' };

/** Plan M16: Google or email + password. One account works on every QuantSynthica site. */
export function SignInForm() {
  const { error, notice, signIn, signInEmail, signUpEmail, resetPassword, clearMessages } = useAuth((s) => s);
  const [mode, setMode] = useState<Mode>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const id = useId();

  const go = (m: Mode) => {
    setMode(m);
    setHint(null);
    clearMessages();
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setHint(null);
    if (!email.trim()) return setHint('Enter your email address.');
    if (mode !== 'reset' && !password) return setHint('Enter your password.');
    if (mode === 'signup' && password.length < PASSWORD_MIN) return setHint(`Use at least ${PASSWORD_MIN} characters for the password.`);
    setBusy(true);
    try {
      if (mode === 'signin') await signInEmail(email, password);
      else if (mode === 'signup') await signUpEmail(name, email, password);
      else if (await resetPassword(email)) setMode('signin');
    } finally {
      setBusy(false);
    }
  };

  const shown = hint ?? error;
  return (
    <div className="space-y-4">
      <Button variant="secondary" onClick={() => void signIn()} className="w-full justify-center py-2.5" disabled={busy}>
        <LogIn className="w-3.5 h-3.5" aria-hidden /> Continue with Google
      </Button>

      <div className="flex items-center gap-3 text-[10px] uppercase tracking-wider text-faint" aria-hidden>
        <span className="h-px flex-1 bg-slate-800" /> or with email <span className="h-px flex-1 bg-slate-800" />
      </div>

      <form onSubmit={submit} noValidate className="space-y-3" aria-label={SUBMIT[mode]}>
        {mode === 'signup' && (
          <div>
            <label htmlFor={`${id}-name`} className={LABEL}>
              Name <span className="normal-case tracking-normal text-faint">(optional)</span>
            </label>
            <input id={`${id}-name`} value={name} onChange={(e) => setName(e.target.value)} maxLength={100} autoComplete="name" className={INPUT} />
          </div>
        )}
        <div>
          <label htmlFor={`${id}-email`} className={LABEL}>
            Email
          </label>
          <input id={`${id}-email`} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" inputMode="email" className={INPUT} />
        </div>
        {mode !== 'reset' && (
          <div>
            <label htmlFor={`${id}-password`} className={LABEL}>
              Password
            </label>
            <input
              id={`${id}-password`}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              className={INPUT}
            />
            {mode === 'signup' && <p className="mt-1 text-[11px] text-faint">At least {PASSWORD_MIN} characters.</p>}
          </div>
        )}

        <div aria-live="polite" className="space-y-2">
          {shown && <Banner kind="error">{shown}</Banner>}
          {notice && <Banner kind="info">{notice}</Banner>}
        </div>

        <Button type="submit" className="w-full justify-center py-2.5" disabled={busy}>
          <Mail className="w-3.5 h-3.5" aria-hidden /> {busy ? 'Please wait…' : SUBMIT[mode]}
        </Button>
      </form>

      <div className="flex flex-wrap justify-between gap-2">
        {mode === 'signin' ? (
          <>
            <button type="button" className={LINK} onClick={() => go('signup')}>
              Create an account
            </button>
            <button type="button" className={LINK} onClick={() => go('reset')}>
              Forgot password?
            </button>
          </>
        ) : (
          <button type="button" className={LINK} onClick={() => go('signin')}>
            {mode === 'signup' ? 'Have an account? Sign in' : 'Back to sign in'}
          </button>
        )}
      </div>
    </div>
  );
}
