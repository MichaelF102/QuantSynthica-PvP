import type { SyncKind } from '../localChanges';

// The cloud side of plan M14, behind an interface so the sync logic is tested without Firebase.

/** One saved result in the cloud (A2): the result itself is kept as JSON in `data`. */
export type CloudDoc = { id: string; playedAt: number; v: 1; data: string };

export type CloudProfile = {
  nickname?: string;
  /** The last match setup, as the JSON the setup page stores. */
  lastSetup?: string;
  displayName?: string;
  photoURL?: string;
  updatedAt?: number;
};

/** One signed-in user's documents. */
export interface CloudStore {
  list(kind: SyncKind): Promise<CloudDoc[]>;
  put(kind: SyncKind, docs: CloudDoc[]): Promise<void>;
  remove(kind: SyncKind, ids: string[]): Promise<void>;
  getProfile(): Promise<CloudProfile | null>;
  putProfile(profile: CloudProfile): Promise<void>;
  /** Every document of this user (Delete account). */
  removeAll(): Promise<void>;
}

export type CloudUser = {
  uid: string;
  name: string | null;
  email: string | null;
  photoURL: string | null;
  /** How the account signs in (plan M16). Google wins when both are linked. */
  provider: 'google' | 'password';
  /** Google accounts always are; email/password accounts after the link in the email. */
  emailVerified: boolean;
};
