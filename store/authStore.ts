import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';
import type { CloudUser } from '@/lib/cloud/types';

// Sign-in and sync status for the whole app (plan M14). CloudSync fills in the actions once the
// Firebase SDK has loaded; before that, and on a site without Firebase, they do nothing.

export type AuthStatus = 'off' | 'loading' | 'signed_out' | 'signed_in';
export type SyncState = { state: 'idle' | 'syncing' | 'done' | 'error'; at: number | null; error: string | null; results: number | null; duels: number | null };

export type AuthStore = {
  status: AuthStatus;
  user: CloudUser | null;
  sync: SyncState;
  /** The latest sign-in or account error to show, if any. */
  error: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  syncNow: () => Promise<void>;
  deleteAccount: () => Promise<boolean>;
};

const noop = async () => {};
export const IDLE_SYNC: SyncState = { state: 'idle', at: null, error: null, results: null, duels: null };

export const authStore = createStore<AuthStore>()(() => ({
  status: 'loading',
  user: null,
  sync: IDLE_SYNC,
  error: null,
  signIn: noop,
  signOut: noop,
  syncNow: noop,
  deleteAccount: async () => false,
}));

export function useAuth<T>(selector: (s: AuthStore) => T): T {
  return useStore(authStore, selector);
}
