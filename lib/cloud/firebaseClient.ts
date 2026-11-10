import { getApps, initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  deleteUser,
  getAuth,
  onAuthStateChanged,
  reauthenticateWithPopup,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { collection, deleteDoc, doc, getDoc, getDocs, getFirestore, setDoc, writeBatch, type Firestore } from 'firebase/firestore';
import type { SyncKind } from '../localChanges';
import { OTHER_APPS } from './apps';
import type { FirebaseWebConfig } from './config';
import type { CloudDoc, CloudProfile, CloudStore, CloudUser } from './types';

// The only module that touches the Firebase SDK (plans M14, M16). It is loaded with a dynamic
// import, so visitors on a site without a Firebase config never download it.

const COLLECTION: Record<SyncKind, string> = { result: 'results', duel: 'duels' };
const BATCH = 400; // Firestore allows 500 writes per batch

export type AuthApi = {
  onChange(cb: (user: CloudUser | null) => void): () => void;
  signIn(): Promise<void>;
  signInEmail(email: string, password: string): Promise<void>;
  /** Creates the account, sets its name and sends the verification email. */
  signUpEmail(name: string, email: string, password: string): Promise<void>;
  resetPassword(email: string): Promise<void>;
  resendVerification(): Promise<void>;
  /** Reloads the account (after the email link was clicked) and returns it fresh. */
  refreshUser(): Promise<CloudUser | null>;
  signOut(): Promise<void>;
  /** Removes the Firebase account, asking Google again if the sign-in is old. */
  deleteAccount(): Promise<void>;
  store(uid: string): CloudStore;
};

export const toUser = (u: User): CloudUser => ({
  uid: u.uid,
  name: u.displayName,
  email: u.email,
  photoURL: u.photoURL,
  provider: u.providerData.some((p) => p.providerId === 'google.com') ? 'google' : 'password',
  emailVerified: u.emailVerified,
});

function firestoreStore(db: Firestore, uid: string): CloudStore {
  const col = (kind: SyncKind) => collection(db, 'users', uid, COLLECTION[kind]);
  const inBatches = async (ids: string[], op: (b: ReturnType<typeof writeBatch>, id: string) => void) => {
    for (let i = 0; i < ids.length; i += BATCH) {
      const batch = writeBatch(db);
      ids.slice(i, i + BATCH).forEach((id) => op(batch, id));
      await batch.commit();
    }
  };
  const clear = async (path: string[]) => {
    const c = collection(db, path.join('/'));
    const snap = await getDocs(c);
    await inBatches(
      snap.docs.map((d) => d.id),
      (b, id) => b.delete(doc(c, id)),
    );
  };
  return {
    async list(kind) {
      const snap = await getDocs(col(kind));
      return snap.docs.map((d) => d.data() as CloudDoc).filter((d) => typeof d.data === 'string' && typeof d.id === 'string');
    },
    async put(kind, docs) {
      const byId = new Map(docs.map((d) => [d.id, d]));
      await inBatches([...byId.keys()], (b, id) => b.set(doc(col(kind), id), byId.get(id)!));
    },
    async remove(kind, ids) {
      await inBatches(ids, (b, id) => b.delete(doc(col(kind), id)));
    },
    async getProfile() {
      const snap = await getDoc(doc(db, 'users', uid));
      return snap.exists() ? (snap.data() as CloudProfile) : null;
    },
    async putProfile(profile) {
      await setDoc(doc(db, 'users', uid), profile);
    },
    async removeAll() {
      // The account is shared by every QuantSynthica site, so deleting it clears theirs too.
      for (const kind of Object.keys(COLLECTION) as SyncKind[]) await clear(['users', uid, COLLECTION[kind]]);
      for (const app of OTHER_APPS) {
        await clear(['users', uid, 'apps', app, 'items']);
        await deleteDoc(doc(db, 'users', uid, 'apps', app));
      }
      await deleteDoc(doc(db, 'users', uid));
    },
  };
}

export function createAuthApi(config: FirebaseWebConfig): AuthApi {
  const app = getApps()[0] ?? initializeApp(config);
  const auth = getAuth(app);
  const db = getFirestore(app);
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  return {
    onChange: (cb) => onAuthStateChanged(auth, (u) => cb(u ? toUser(u) : null)),
    async signIn() {
      try {
        await signInWithPopup(auth, provider);
      } catch (e) {
        // Popups are blocked on some browsers and in-app web views: fall back to a full redirect.
        if ((e as { code?: string }).code === 'auth/popup-blocked') await signInWithRedirect(auth, provider);
        else throw e;
      }
    },
    async signInEmail(email, password) {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    },
    async signUpEmail(name, email, password) {
      const { user } = await createUserWithEmailAndPassword(auth, email.trim(), password);
      if (name.trim()) await updateProfile(user, { displayName: name.trim() });
      await sendEmailVerification(user);
    },
    resetPassword: (email) => sendPasswordResetEmail(auth, email.trim()),
    async resendVerification() {
      if (auth.currentUser) await sendEmailVerification(auth.currentUser);
    },
    async refreshUser() {
      const u = auth.currentUser;
      if (!u) return null;
      await reload(u);
      // A fresh token carries email_verified, which the Firestore rules check.
      await u.getIdToken(true);
      return toUser(u);
    },
    signOut: () => signOut(auth),
    async deleteAccount() {
      const u = auth.currentUser;
      if (!u) return;
      try {
        await deleteUser(u);
      } catch (e) {
        // Email/password accounts get "sign in again" from authErrorText instead of a prompt here.
        if ((e as { code?: string }).code !== 'auth/requires-recent-login' || toUser(u).provider !== 'google') throw e;
        await reauthenticateWithPopup(u, provider);
        await deleteUser(u);
      }
    },
    store: (uid) => firestoreStore(db, uid),
  };
}
