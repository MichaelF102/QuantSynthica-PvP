'use client';

import { useEffect } from 'react';
import { firebaseConfig } from '@/lib/cloud/config';
import { VERIFY_FIRST, authErrorText, syncErrorText } from '@/lib/cloud/errors';
import { browserIO } from '@/lib/cloud/localIO';
import { mirror, syncAll } from '@/lib/cloud/sync';
import type { CloudStore, CloudUser } from '@/lib/cloud/types';
import { LOCAL_CHANGE_EVENT, emitSynced, type LocalChange } from '@/lib/localChanges';
import { IDLE_SYNC, authStore } from '@/store/authStore';

/**
 * Plans M14, M16: loads Firebase (only when the site has a config), follows the sign-in state,
 * syncs on sign-in and mirrors every local change while signed in. An email/password account
 * syncs only once its email is verified (the Firestore rules require it). Renders nothing.
 */
export function CloudSync() {
  useEffect(() => {
    const config = firebaseConfig();
    if (!config) {
      authStore.setState({ status: 'off' });
      return;
    }
    let cancelled = false;
    let unsubscribe: (() => void) | null = null;
    /** Set only for a verified account: nothing syncs or mirrors without one. */
    let session: { user: CloudUser; store: CloudStore } | null = null;
    // One queue, so a mirror never runs in the middle of a full sync.
    let queue: Promise<void> = Promise.resolve();
    const enqueue = (job: () => Promise<void>) => (queue = queue.then(job, job));
    const io = browserIO();

    const runSync = () =>
      enqueue(async () => {
        const s = session;
        if (!s) return;
        authStore.setState((st) => ({ sync: { ...st.sync, state: 'syncing', error: null } }));
        try {
          const summary = await syncAll(s.store, io, s.user);
          if (session !== s) return;
          authStore.setState({ sync: { state: 'done', at: summary.at, error: null, results: summary.results, duels: summary.duels } });
          emitSynced();
        } catch (e) {
          authStore.setState((st) => ({ sync: { ...st.sync, state: 'error', error: syncErrorText(e) } }));
        }
      });

    const onLocal = (e: Event) => {
      const change = (e as CustomEvent<LocalChange>).detail;
      enqueue(async () => {
        const s = session;
        if (!s) return;
        try {
          await mirror(s.store, io, s.user, change);
          authStore.setState((st) => ({ sync: { ...st.sync, state: 'done', at: Date.now(), error: null } }));
        } catch (err) {
          // The local copy is safe; the next full sync pushes it (deletes keep their tombstone).
          authStore.setState((st) => ({ sync: { ...st.sync, state: 'error', error: syncErrorText(err) } }));
        }
      });
    };
    window.addEventListener(LOCAL_CHANGE_EVENT, onLocal);

    import('@/lib/cloud/firebaseClient')
      .then(({ createAuthApi }) => {
        if (cancelled) return;
        const api = createAuthApi(config);

        const applyUser = (user: CloudUser | null, store?: CloudStore) => {
          session = user?.emailVerified ? { user, store: store ?? api.store(user.uid) } : null;
          authStore.setState({
            status: user ? 'signed_in' : 'signed_out',
            user,
            sync: user && !user.emailVerified ? { ...IDLE_SYNC, state: 'error', error: VERIFY_FIRST } : IDLE_SYNC,
          });
          if (session) void runSync();
        };
        /** Runs an account action; shows its error, and `notice` when it succeeded. */
        const attempt = async (job: () => Promise<void>, notice: string | null = null) => {
          authStore.setState({ error: null, notice: null });
          try {
            await job();
            authStore.setState({ notice });
            return true;
          } catch (e) {
            authStore.setState({ error: authErrorText(e) });
            return false;
          }
        };

        authStore.setState({
          status: 'signed_out',
          signIn: async () => {
            await attempt(() => api.signIn());
          },
          signInEmail: (email, password) => attempt(() => api.signInEmail(email, password)),
          signUpEmail: async (name, email, password) => {
            const ok = await attempt(() => api.signUpEmail(name, email, password), `We sent a link to ${email.trim()}. Open it to verify your email and turn on cloud sync.`);
            // The account was created before its name was set: show it with the name.
            if (ok) applyUser(await api.refreshUser().catch(() => null));
            return ok;
          },
          resetPassword: (email) => attempt(() => api.resetPassword(email), `If an account uses ${email.trim()}, a link to reset the password is on its way.`),
          resendVerification: async () => {
            await attempt(() => api.resendVerification(), 'Verification email sent again. Check your inbox and spam folder.');
          },
          refreshUser: async () => {
            const before = session;
            const user = await api.refreshUser().catch(() => null);
            if (!user) return;
            applyUser(user, before?.store);
            if (!user.emailVerified) authStore.setState({ notice: 'Not verified yet. Open the link in the email, then try again.' });
          },
          signOut: async () => {
            authStore.setState({ error: null, notice: null });
            await api.signOut();
          },
          syncNow: async () => {
            await runSync();
          },
          deleteAccount: async () => {
            const user = authStore.getState().user;
            if (!user) return false;
            try {
              // Reads and deletes are allowed before verification, so this works for every account.
              await (session?.store ?? api.store(user.uid)).removeAll();
              await api.deleteAccount();
              return true;
            } catch (e) {
              authStore.setState({ error: authErrorText(e) ?? 'The account could not be deleted. Try again.' });
              return false;
            }
          },
        });
        unsubscribe = api.onChange((user) => applyUser(user));
      })
      .catch(() => authStore.setState({ status: 'off' }));

    return () => {
      cancelled = true;
      unsubscribe?.();
      window.removeEventListener(LOCAL_CHANGE_EVENT, onLocal);
    };
  }, []);
  return null;
}
