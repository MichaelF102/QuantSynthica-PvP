import type { LocalChange, SyncKind, Tombstone } from '../localChanges';
import type { DuelResult } from '../multiplayer/duelResult';
import type { MatchResult } from '../results';
import { cleanNickname, NICKNAME_MAX } from '../multiplayer/protocol';
import { fromDoc, isDocId, mergeById, newerNote, toDoc } from './merge';
import type { CloudProfile, CloudStore, CloudUser } from './types';

// Sign-in sync and live mirroring (plan M14 A4–A6). Pure apart from the injected local and cloud
// stores, so it is unit-tested with in-memory fakes.

type Item = { id: string; playedAt: number };

export type Collection<T extends Item> = {
  list(): T[];
  /** Rewrites the whole local list without announcing a change. */
  replace(items: T[]): boolean;
  valid(v: unknown): v is T;
  cap: number;
  pickLocal(local: T, cloud: T): boolean;
};

export type LocalIO = {
  result: Collection<MatchResult>;
  duel: Collection<DuelResult>;
  nickname: { get(): string | null; set(name: string): void };
  lastSetup: { get(): string | null; set(json: string): void };
  tombstones: { load(): Tombstone[]; remove(done: Tombstone[]): void };
};

export type SyncSummary = { results: number; duels: number; at: number };

const KINDS: SyncKind[] = ['result', 'duel'];

/** A5: deletes made offline or signed out reach the cloud now. */
export async function flushTombstones(store: CloudStore, io: LocalIO): Promise<void> {
  const tombs = io.tombstones.load();
  for (const kind of KINDS) {
    const ids = tombs.filter((t) => t.kind === kind && isDocId(t.id)).map((t) => t.id);
    if (ids.length) await store.remove(kind, ids);
  }
  if (tombs.length) io.tombstones.remove(tombs);
}

async function syncKind(store: CloudStore, io: LocalIO, kind: SyncKind): Promise<number> {
  const col = io[kind] as Collection<Item>;
  const cloudDocs = await store.list(kind);
  const cloud = cloudDocs.map((d) => fromDoc(d, col.valid)).filter((x): x is Item => x !== null);
  const merged = mergeById(col.list(), cloud, col.cap, col.pickLocal);
  col.replace(merged.kept);
  // Unreadable cloud documents are dropped too, so a bad write cannot stick around.
  const unreadable = cloudDocs.filter((d) => !cloud.some((c) => c.id === d.id)).map((d) => d.id);
  const push = merged.push.filter((x) => isDocId(x.id));
  if (push.length) await store.put(kind, push.map(toDoc));
  const drop = [...merged.drop, ...unreadable].filter(isDocId);
  if (drop.length) await store.remove(kind, drop);
  return merged.kept.length;
}

/** A6: local profile values win; missing ones come from the cloud, then from Google. */
export async function syncProfile(store: CloudStore, io: LocalIO, user: CloudUser, now: number): Promise<void> {
  const cloud = (await store.getProfile()) ?? {};
  let nickname = cleanNickname(io.nickname.get());
  if (!nickname) {
    nickname = cleanNickname(cloud.nickname) ?? cleanNickname(user.name?.slice(0, NICKNAME_MAX));
    if (nickname) io.nickname.set(nickname);
  }
  let lastSetup = io.lastSetup.get();
  if (!lastSetup && typeof cloud.lastSetup === 'string') {
    lastSetup = cloud.lastSetup;
    io.lastSetup.set(lastSetup);
  }
  await store.putProfile(profileFor(user, nickname, lastSetup, now));
}

function profileFor(user: CloudUser, nickname: string | null, lastSetup: string | null, now: number): CloudProfile {
  return {
    ...(nickname ? { nickname } : {}),
    ...(lastSetup && lastSetup.length < 4_000 ? { lastSetup } : {}),
    ...(user.name ? { displayName: user.name.slice(0, 100) } : {}),
    ...(user.photoURL ? { photoURL: user.photoURL.slice(0, 1_000) } : {}),
    updatedAt: now,
  };
}

/** A4: the full sync run at sign-in and on "Sync now". */
export async function syncAll(store: CloudStore, io: LocalIO, user: CloudUser, now = Date.now()): Promise<SyncSummary> {
  await flushTombstones(store, io);
  const results = await syncKind(store, io, 'result');
  const duels = await syncKind(store, io, 'duel');
  await syncProfile(store, io, user, now);
  return { results, duels, at: now };
}

/** A5: one local change, mirrored while signed in. */
export async function mirror(store: CloudStore, io: LocalIO, user: CloudUser, change: LocalChange, now = Date.now()): Promise<void> {
  if (change.kind === 'profile') {
    await store.putProfile(profileFor(user, cleanNickname(io.nickname.get()), io.lastSetup.get(), now));
    return;
  }
  if (change.op === 'delete') {
    await flushTombstones(store, io);
    return;
  }
  const item = (io[change.kind] as Collection<Item>).list().find((x) => x.id === change.id);
  if (item && isDocId(item.id)) await store.put(change.kind, [toDoc(item)]);
}

/** The local IO for result and duel collections, with the right conflict rule. */
export const RESULT_PICK = newerNote;
export const DUEL_PICK = () => false; // a saved duel never changes, so the cloud copy is as good
