import { describe, expect, it } from 'vitest';
import type { SyncKind, Tombstone } from '../localChanges';
import { toDoc } from './merge';
import { mirror, syncAll, type LocalIO } from './sync';
import type { CloudDoc, CloudProfile, CloudStore, CloudUser } from './types';

// Plan M14 A4–A6 against in-memory fakes. TEST FIXTURE: hand-written items, not real results.

type I = { id: string; playedAt: number; note?: string; noteUpdatedAt?: number };
const item = (id: string, playedAt: number, extra: Partial<I> = {}): I => ({ id, playedAt, ...extra });
const USER: CloudUser = { uid: 'u1', name: 'Ann Example', email: 'ann@example.com', photoURL: 'https://example.com/a.png', provider: 'google', emailVerified: true };

function fakeCloud(seed: Partial<Record<SyncKind, I[]>> = {}, profile: CloudProfile | null = null) {
  const docs: Record<SyncKind, Map<string, CloudDoc>> = {
    result: new Map((seed.result ?? []).map((x) => [x.id, toDoc(x)])),
    duel: new Map((seed.duel ?? []).map((x) => [x.id, toDoc(x)])),
  };
  let prof = profile;
  const store: CloudStore = {
    list: async (kind) => [...docs[kind].values()],
    put: async (kind, list) => list.forEach((d) => docs[kind].set(d.id, d)),
    remove: async (kind, ids) => ids.forEach((id) => docs[kind].delete(id)),
    getProfile: async () => prof,
    putProfile: async (p) => void (prof = p),
    removeAll: async () => {
      docs.result.clear();
      docs.duel.clear();
      prof = null;
    },
  };
  return { store, ids: (kind: SyncKind) => [...docs[kind].keys()].sort(), profile: () => prof, raw: docs };
}

function fakeLocal(seed: Partial<Record<SyncKind, I[]>> = {}, tombs: Tombstone[] = [], nickname: string | null = null, lastSetup: string | null = null) {
  const lists: Record<SyncKind, I[]> = { result: seed.result ?? [], duel: seed.duel ?? [] };
  let tombstones = tombs;
  const state = { nickname, lastSetup };
  const col = (kind: SyncKind) => ({
    list: () => lists[kind],
    replace: (items: I[]) => ((lists[kind] = items), true),
    valid: (v: unknown): v is I => typeof (v as I)?.id === 'string',
    cap: 3,
    pickLocal: (l: I, c: I) => (l.noteUpdatedAt ?? 0) >= (c.noteUpdatedAt ?? 0),
  });
  const io = {
    result: col('result'),
    duel: col('duel'),
    nickname: { get: () => state.nickname, set: (n: string) => void (state.nickname = n) },
    lastSetup: { get: () => state.lastSetup, set: (j: string) => void (state.lastSetup = j) },
    tombstones: { load: () => tombstones, remove: (done: Tombstone[]) => void (tombstones = tombstones.filter((t) => !done.includes(t))) },
  } as unknown as LocalIO;
  return { io, lists, state, tombs: () => tombstones };
}

describe('syncAll', () => {
  it('merges both sides so each holds the same newest results', async () => {
    const cloud = fakeCloud({ result: [item('b', 2), item('c', 1)], duel: [item('d1', 5)] });
    const local = fakeLocal({ result: [item('a', 3), item('b', 2)] });
    const summary = await syncAll(cloud.store, local.io, USER, 1000);
    expect(summary).toEqual({ results: 3, duels: 1, at: 1000 });
    expect(local.lists.result.map((x) => x.id)).toEqual(['a', 'b', 'c']);
    expect(local.lists.duel.map((x) => x.id)).toEqual(['d1']);
    expect(cloud.ids('result')).toEqual(['a', 'b', 'c']);
  });

  it('applies tombstones first, so a delete made signed out is not brought back', async () => {
    const cloud = fakeCloud({ result: [item('gone', 2), item('kept', 1)] });
    const local = fakeLocal({ result: [item('kept', 1)] }, [{ kind: 'result', id: 'gone' }]);
    await syncAll(cloud.store, local.io, USER);
    expect(cloud.ids('result')).toEqual(['kept']);
    expect(local.lists.result.map((x) => x.id)).toEqual(['kept']);
    expect(local.tombs()).toEqual([]);
  });

  it('drops unreadable cloud documents', async () => {
    const cloud = fakeCloud({ result: [item('ok', 1)] });
    cloud.raw.result.set('bad', { id: 'bad', playedAt: 2, v: 1, data: 'not json' });
    await syncAll(cloud.store, fakeLocal().io, USER);
    expect(cloud.ids('result')).toEqual(['ok']);
  });

  it('fills the profile: local wins, then the cloud, then the Google name (A6)', async () => {
    const fresh = fakeLocal();
    const c1 = fakeCloud({}, { nickname: 'CloudAnn', lastSetup: '{"symbol":"NQ=F"}' });
    await syncAll(c1.store, fresh.io, USER, 5);
    expect(fresh.state).toEqual({ nickname: 'CloudAnn', lastSetup: '{"symbol":"NQ=F"}' });

    const google = fakeLocal();
    const c2 = fakeCloud();
    await syncAll(c2.store, google.io, USER, 5);
    expect(google.state.nickname).toBe('Ann Example');
    expect(c2.profile()).toEqual({ nickname: 'Ann Example', displayName: 'Ann Example', photoURL: 'https://example.com/a.png', updatedAt: 5 });

    const mine = fakeLocal({}, [], 'Mine', '{"symbol":"AAPL"}');
    const c3 = fakeCloud({}, { nickname: 'CloudAnn', lastSetup: '{"symbol":"NQ=F"}' });
    await syncAll(c3.store, mine.io, USER, 5);
    expect(c3.profile()).toMatchObject({ nickname: 'Mine', lastSetup: '{"symbol":"AAPL"}' });
  });

  it('never stores the email', async () => {
    const cloud = fakeCloud();
    await syncAll(cloud.store, fakeLocal().io, USER);
    expect(JSON.stringify(cloud.profile())).not.toContain('ann@example.com');
  });
});

describe('mirror', () => {
  it('pushes a saved item, flushes deletes and updates the profile', async () => {
    const cloud = fakeCloud({ result: [item('old', 1)] });
    const local = fakeLocal({ result: [item('new', 2), item('old', 1)] }, [], 'Ann');
    await mirror(cloud.store, local.io, USER, { kind: 'result', op: 'put', id: 'new' });
    expect(cloud.ids('result')).toEqual(['new', 'old']);

    local.lists.result = [item('new', 2)];
    const withTomb = fakeLocal({ result: local.lists.result }, [{ kind: 'result', id: 'old' }]);
    await mirror(cloud.store, withTomb.io, USER, { kind: 'result', op: 'delete', ids: ['old'] });
    expect(cloud.ids('result')).toEqual(['new']);
    expect(withTomb.tombs()).toEqual([]);

    await mirror(cloud.store, local.io, USER, { kind: 'profile' }, 9);
    expect(cloud.profile()).toMatchObject({ nickname: 'Ann', updatedAt: 9 });
  });
});
