// Local save events and delete tombstones (plan M14 A5). The storage modules call these after a
// successful write; the cloud sync listens. Without a signed-in account nothing listens, so
// these are cheap no-ops apart from the small tombstone list.

export type SyncKind = 'result' | 'duel';
export type LocalChange = { kind: SyncKind; op: 'put'; id: string } | { kind: SyncKind; op: 'delete'; ids: string[] } | { kind: 'profile' };

export const LOCAL_CHANGE_EVENT = 'qs-pvp:local-change';
/** Fired after a sync rewrote local data, so open views re-read it. */
export const SYNCED_EVENT = 'qs-pvp:synced';

export function emitLocalChange(change: LocalChange): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<LocalChange>(LOCAL_CHANGE_EVENT, { detail: change }));
}

export function emitSynced(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(SYNCED_EVENT));
}

/** Re-reads on another tab's change and after a cloud sync. Returns the unsubscribe. */
export function onStoredDataChange(refresh: () => void): () => void {
  window.addEventListener('storage', refresh);
  window.addEventListener(SYNCED_EVENT, refresh);
  return () => {
    window.removeEventListener('storage', refresh);
    window.removeEventListener(SYNCED_EVENT, refresh);
  };
}

// ---------- tombstones ----------

export const TOMBSTONES_KEY = 'qs-pvp:deleted:v1';
const MAX_TOMBSTONES = 500;
export type Tombstone = { kind: SyncKind; id: string };
type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

function local(): StorageLike | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function loadTombstones(storage: StorageLike | null = local()): Tombstone[] {
  try {
    const v: unknown = JSON.parse(storage?.getItem(TOMBSTONES_KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((t): t is Tombstone => t && (t.kind === 'result' || t.kind === 'duel') && typeof t.id === 'string') : [];
  } catch {
    return [];
  }
}

function writeTombstones(list: Tombstone[], storage: StorageLike | null): void {
  try {
    storage?.setItem(TOMBSTONES_KEY, JSON.stringify(list.slice(-MAX_TOMBSTONES)));
  } catch {
    /* storage full or blocked: the next sync may bring the item back */
  }
}

export function addTombstones(kind: SyncKind, ids: string[], storage: StorageLike | null = local()): void {
  if (!ids.length) return;
  const have = loadTombstones(storage).filter((t) => !(t.kind === kind && ids.includes(t.id)));
  writeTombstones([...have, ...ids.map((id) => ({ kind, id }))], storage);
}

export function removeTombstones(done: Tombstone[], storage: StorageLike | null = local()): void {
  const key = (t: Tombstone) => `${t.kind}:${t.id}`;
  const gone = new Set(done.map(key));
  writeTombstones(loadTombstones(storage).filter((t) => !gone.has(key(t))), storage);
}

/** A saved item counts as deleted until its tombstone is cleared. */
export const isTombstoned = (list: Tombstone[], kind: SyncKind, id: string) => list.some((t) => t.kind === kind && t.id === id);
