'use client';

import { useEffect, useId, useState, type FormEvent } from 'react';
import { CloudOff, LogIn, LogOut, RefreshCw, Trash2, UserRound } from 'lucide-react';
import { Banner, Button, EmptyState, Panel, PanelSkeleton } from '@/components/ui';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { fmtPlayedAt } from '@/lib/format';
import { loadNickname, saveNickname } from '@/lib/multiplayer/client';
import { NICKNAME_MAX, cleanNickname } from '@/lib/multiplayer/protocol';
import { useAuth } from '@/store/authStore';
import { Avatar } from './Avatar';

/** Plan M14 A8: the signed-in player's account, sync status and account controls. */
export function ProfileView() {
  const { status, user, sync, error, signIn, signOut, syncNow, deleteAccount } = useAuth((s) => s);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleted, setDeleted] = useState(false);

  if (status === 'loading') return <PanelSkeleton rows={4} label="Loading your account" />;
  if (status === 'off') {
    return (
      <Panel title="Account" icon={UserRound}>
        <EmptyState icon={CloudOff} title="Accounts are not set up on this site" hint="Your progress is saved in this browser. The README explains how to turn on Google sign-in." />
      </Panel>
    );
  }
  if (status === 'signed_out' || !user) {
    return (
      <Panel title="Account" icon={UserRound}>
        <div className="space-y-4 py-2">
          {deleted && <Banner kind="info">Your account and cloud data were deleted. This browser keeps its copy.</Banner>}
          {error && <Banner kind="error">{error}</Banner>}
          <p className="text-xs text-slate-300 max-w-prose">
            Sign in to keep your practice results, 1v1 results and profile on every device. It is free. Without an account everything still works, saved in this browser only.
          </p>
          <Button onClick={() => void signIn()} className="px-5 py-2.5">
            <LogIn className="w-3.5 h-3.5" aria-hidden /> Sign in with Google
          </Button>
          <p className="text-[11px] text-faint max-w-prose">We keep your results, your 1v1 name and your last match setup. Your Google name and photo are shown on this page. Nothing is shared with other players.</p>
        </div>
      </Panel>
    );
  }

  const syncText =
    sync.state === 'syncing' ? 'Syncing…' : sync.state === 'error' ? sync.error : sync.at ? `Synced ${fmtPlayedAt(sync.at)}` : 'Not synced yet in this visit';

  return (
    <div className="space-y-4">
      {error && <Banner kind="error">{error}</Banner>}
      <Panel title="Account" icon={UserRound}>
        <div className="flex flex-wrap items-center gap-4">
          <Avatar name={user.name} photoURL={user.photoURL} size={56} />
          <div className="min-w-0">
            <p className="text-sm font-bold text-white truncate">{user.name ?? 'Signed in'}</p>
            {user.email && <p className="text-[11px] text-slate-400 truncate">{user.email}</p>}
            <p className="text-[11px] text-faint">Signed in with Google</p>
          </div>
          <Button variant="secondary" className="sm:ml-auto" onClick={() => void signOut()}>
            <LogOut className="w-3.5 h-3.5" aria-hidden /> Sign out
          </Button>
        </div>
      </Panel>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="1v1 name" description="Shown to your opponent and in challenge links">
          <NicknameEditor />
        </Panel>
        <Panel
          title="Cloud sync"
          description="Practice results, 1v1 results and your profile"
          actions={
            <Button variant="secondary" onClick={() => void syncNow()} disabled={sync.state === 'syncing'}>
              <RefreshCw className="w-3.5 h-3.5" aria-hidden /> Sync now
            </Button>
          }
        >
          <div className="space-y-2" aria-live="polite">
            <p className={sync.state === 'error' ? 'text-xs text-amber-300' : 'text-xs text-slate-200'}>{syncText}</p>
            {sync.results !== null && (
              <p className="text-[11px] font-mono text-slate-400">
                {sync.results} practice result{sync.results === 1 ? '' : 's'} · {sync.duels} 1v1 result{sync.duels === 1 ? '' : 's'}
              </p>
            )}
            <p className="text-[11px] text-faint">
              Results from this browser and the cloud are merged, so nothing is lost or counted twice. The newest 50 of each are kept. Signing out keeps a copy here; signing in with another account on this
              browser adds this copy to that account.
            </p>
          </div>
        </Panel>
      </div>

      <Panel title="Delete account" description="Removes your cloud data and your sign-in">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[11px] text-slate-400 max-w-prose">All results and your profile are deleted from the cloud and the account is removed. This browser keeps its own copy, which you can clear on the History page.</p>
          <Button variant="secondary" className="text-rose-300 hover:text-rose-200 hover:border-rose-500/50" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="w-3.5 h-3.5" aria-hidden /> Delete account
          </Button>
        </div>
      </Panel>
      <ConfirmDialog
        open={confirmDelete}
        title="Delete your account?"
        confirmLabel="Delete account"
        destructive
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          setConfirmDelete(false);
          if (await deleteAccount()) setDeleted(true);
        }}
      >
        Your cloud results and profile are deleted and you are signed out. Google may ask you to confirm. This cannot be undone.
      </ConfirmDialog>
    </div>
  );
}

function NicknameEditor() {
  const id = useId();
  const [text, setText] = useState('');
  const [saved, setSaved] = useState<string | null>(null);
  useEffect(() => {
    const n = loadNickname() ?? '';
    setText(n);
    setSaved(n);
  }, []);
  const name = cleanNickname(text);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name) return;
    saveNickname(name);
    setText(name);
    setSaved(name);
  };
  return (
    <form onSubmit={submit} noValidate className="space-y-1.5">
      <label htmlFor={id} className="block text-[10px] uppercase tracking-wider text-slate-400">
        Your name
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={NICKNAME_MAX}
          autoComplete="nickname"
          className="min-w-0 flex-1 rounded-lg border border-slate-700/50 bg-[#0F172A]/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-blue-500"
        />
        <Button type="submit" disabled={!name || name === saved}>
          Save
        </Button>
      </div>
      <p className="text-[11px] text-faint">Up to {NICKNAME_MAX} characters.</p>
    </form>
  );
}
