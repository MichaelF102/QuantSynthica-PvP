'use client';

import { useEffect } from 'react';
import { firebaseConfig } from '@/lib/cloud/config';
import { authErrorText, syncErrorText } from '@/lib/cloud/errors';
import { browserIO } from '@/lib/cloud/localIO';
import { mirror, syncAll } from '@/lib/cloud/sync';
import type { CloudStore, CloudUser } from '@/lib/cloud/types';
import { LOCAL_CHANGE_EVENT, emitSynced, type LocalChange } from '@/lib/localChanges';
import { IDLE_SYNC, authStore } from '@/store/authStore';

/**
 * Plan M14: loads Firebase (only when the site has a config), follows the sign-in state, syncs on
 * sign-in and mirrors every local change while signed in. Renders nothing.
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
        authStore.setState({
          status: 'signed_out',
          signIn: async () => {
            authStore.setState({ error: null });
            try {
              await api.signIn();
            } catch (e) {
              authStore.setState({ error: authErrorText(e) });
            }
          },
          signOut: async () => {
            await api.signOut();
          },
          syncNow: async () => {
            await runSync();
          },
          deleteAccount: async () => {
            const s = session;
            if (!s) return false;
            try {
              await s.store.removeAll();
              await api.deleteAccount();
              return true;
            } catch (e) {
              authStore.setState({ error: authErrorText(e) ?? 'The account could not be deleted. Try again.' });
              return false;
            }
          },
        });
        unsubscribe = api.onChange((user) => {
          session = user ? { user, store: api.store(user.uid) } : null;
          authStore.setState({ status: user ? 'signed_in' : 'signed_out', user, sync: IDLE_SYNC });
          if (user) void runSync();
        });
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
