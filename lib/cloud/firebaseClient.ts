import { getApps, initializeApp } from 'firebase/app';
import { GoogleAuthProvider, deleteUser, getAuth, onAuthStateChanged, reauthenticateWithPopup, signInWithPopup, signInWithRedirect, signOut, type User } from 'firebase/auth';
import { collection, deleteDoc, doc, getDoc, getDocs, getFirestore, setDoc, writeBatch, type Firestore } from 'firebase/firestore';
import type { SyncKind } from '../localChanges';
import type { FirebaseWebConfig } from './config';
import type { CloudDoc, CloudProfile, CloudStore, CloudUser } from './types';

// The only module that touches the Firebase SDK (plan M14). It is loaded with a dynamic import,
// so visitors on a site without a Firebase config never download it.

const COLLECTION: Record<SyncKind, string> = { result: 'results', duel: 'duels' };
const BATCH = 400; // Firestore allows 500 writes per batch

export type AuthApi = {
  onChange(cb: (user: CloudUser | null) => void): () => void;
  signIn(): Promise<void>;
  signOut(): Promise<void>;
  /** Removes the Firebase account, asking Google again if the sign-in is old. */
  deleteAccount(): Promise<void>;
  store(uid: string): CloudStore;
};

const toUser = (u: User): CloudUser => ({ uid: u.uid, name: u.displayName, email: u.email, photoURL: u.photoURL });

function firestoreStore(db: Firestore, uid: string): CloudStore {
  const col = (kind: SyncKind) => collection(db, 'users', uid, COLLECTION[kind]);
  const inBatches = async (ids: string[], op: (b: ReturnType<typeof writeBatch>, id: string) => void) => {
    for (let i = 0; i < ids.length; i += BATCH) {
      const batch = writeBatch(db);
      ids.slice(i, i + BATCH).forEach((id) => op(batch, id));
      await batch.commit();
    }
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
      for (const kind of Object.keys(COLLECTION) as SyncKind[]) {
        const snap = await getDocs(col(kind));
        await inBatches(
          snap.docs.map((d) => d.id),
          (b, id) => b.delete(doc(col(kind), id)),
        );
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
    signOut: () => signOut(auth),
    async deleteAccount() {
      const u = auth.currentUser;
      if (!u) return;
      try {
        await deleteUser(u);
      } catch (e) {
        if ((e as { code?: string }).code !== 'auth/requires-recent-login') throw e;
        await reauthenticateWithPopup(u, provider);
        await deleteUser(u);
      }
    },
    store: (uid) => firestoreStore(db, uid),
  };
}
