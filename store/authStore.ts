import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';
import type { CloudUser } from '@/lib/cloud/types';

// Sign-in and sync status for the whole app (plans M14, M16). CloudSync fills in the actions once
// the Firebase SDK has loaded; before that, and on a site without Firebase, they do nothing.

export type AuthStatus = 'off' | 'loading' | 'signed_out' | 'signed_in';
export type SyncState = { state: 'idle' | 'syncing' | 'done' | 'error'; at: number | null; error: string | null; results: number | null; duels: number | null };

export type AuthStore = {
  status: AuthStatus;
  user: CloudUser | null;
  sync: SyncState;
  /** The latest sign-in or account error to show, if any. */
  error: string | null;
  /** The latest account confirmation to show ("Check your inbox"), if any. */
  notice: string | null;
  /** Google. */
  signIn: () => Promise<void>;
  /** The email/password actions resolve true when they succeeded. */
  signInEmail: (email: string, password: string) => Promise<boolean>;
  signUpEmail: (name: string, email: string, password: string) => Promise<boolean>;
  resetPassword: (email: string) => Promise<boolean>;
  resendVerification: () => Promise<void>;
  /** Re-reads the account after the verification link was clicked, then syncs. */
  refreshUser: () => Promise<void>;
  signOut: () => Promise<void>;
  syncNow: () => Promise<void>;
  deleteAccount: () => Promise<boolean>;
  clearMessages: () => void;
};

const noop = async () => {};
const no = async () => false;
export const IDLE_SYNC: SyncState = { state: 'idle', at: null, error: null, results: null, duels: null };

export const authStore = createStore<AuthStore>()((set) => ({
  status: 'loading',
  user: null,
  sync: IDLE_SYNC,
  error: null,
  notice: null,
  signIn: noop,
  signInEmail: no,
  signUpEmail: no,
  resetPassword: no,
  resendVerification: noop,
  refreshUser: noop,
  signOut: noop,
  syncNow: noop,
  deleteAccount: no,
  clearMessages: () => set({ error: null, notice: null }),
}));

export function useAuth<T>(selector: (s: AuthStore) => T): T {
  return useStore(authStore, selector);
}
