import { describe, expect, it } from 'vitest';
import { fromDoc, isDocId, mergeById, newerNote, toDoc } from './merge';

// Plan M14 A4. TEST FIXTURE: hand-written items, not real results.

type I = { id: string; playedAt: number; note?: string; noteUpdatedAt?: number };
const it_ = (id: string, playedAt: number, extra: Partial<I> = {}): I => ({ id, playedAt, ...extra });

describe('mergeById', () => {
  it('combines by id without duplicates and pushes what the cloud lacks', () => {
    const m = mergeById([it_('a', 3), it_('b', 2)], [it_('b', 2), it_('c', 1)], 10, newerNote);
    expect(m.kept.map((x) => x.id)).toEqual(['a', 'b', 'c']);
    expect(m.push.map((x) => x.id)).toEqual(['a']);
    expect(m.drop).toEqual([]);
  });

  it('keeps the newer note on a conflict, either way round', () => {
    const local = it_('a', 1, { note: 'new', noteUpdatedAt: 20 });
    const cloud = it_('a', 1, { note: 'old', noteUpdatedAt: 10 });
    expect(mergeById([local], [cloud], 10, newerNote)).toMatchObject({ kept: [local], push: [local] });
    expect(mergeById([cloud], [local], 10, newerNote)).toMatchObject({ kept: [local], push: [] });
  });

  it('caps both sides at the newest items and drops the rest from the cloud', () => {
    const m = mergeById([it_('a', 5), it_('b', 1)], [it_('c', 4), it_('d', 2)], 3, newerNote);
    expect(m.kept.map((x) => x.id)).toEqual(['a', 'c', 'd']);
    expect(m.push.map((x) => x.id)).toEqual(['a']);
    expect(m.drop).toEqual([]);
    expect(mergeById([], [it_('x', 1), it_('y', 2)], 1, newerNote).drop).toEqual(['x']);
  });
});

describe('documents', () => {
  it('round-trips and rejects unreadable, invalid or mismatched documents', () => {
    const valid = (v: unknown): v is I => typeof (v as I).id === 'string';
    const doc = toDoc(it_('a', 1, { note: 'n' }));
    expect(doc).toEqual({ id: 'a', playedAt: 1, v: 1, data: JSON.stringify({ id: 'a', playedAt: 1, note: 'n' }) });
    expect(fromDoc(doc, valid)).toEqual(it_('a', 1, { note: 'n' }));
    expect(fromDoc({ ...doc, data: '{bad' }, valid)).toBeNull();
    expect(fromDoc({ ...doc, id: 'b' }, valid)).toBeNull();
    expect(fromDoc({ ...doc, data: '{}' }, valid)).toBeNull();
  });

  it('accepts only safe document ids', () => {
    expect(isDocId('duel-K7M2QX-1700000060-1700000120')).toBe(true);
    expect(isDocId('3f2b9c1e-1111-4a2b-9c3d-123456789abc')).toBe(true);
    expect(isDocId('a/b')).toBe(false);
    expect(isDocId('..')).toBe(false);
    expect(isDocId('')).toBe(false);
  });
});
