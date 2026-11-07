import type { CloudDoc } from './types';

// Pure merge of local and cloud results (plan M14 A4).

type Item = { id: string; playedAt: number };

/** Firestore document ids we write: no slashes, dots-only or anything odd. */
export const isDocId = (id: string) => /^[A-Za-z0-9_-]{1,150}$/.test(id);

export const toDoc = <T extends Item>(item: T): CloudDoc => ({ id: item.id, playedAt: item.playedAt, v: 1, data: JSON.stringify(item) });

/** The item in a cloud document, or null when it is unreadable or fails `valid`. */
export function fromDoc<T extends Item>(doc: CloudDoc, valid: (v: unknown) => v is T): T | null {
  try {
    const v: unknown = JSON.parse(doc.data);
    return valid(v) && (v as T).id === doc.id ? (v as T) : null;
  } catch {
    return null;
  }
}

export type Merged<T> = {
  /** What both sides should hold: newest first, at most `cap`. */
  kept: T[];
  /** Items the cloud is missing or holds an older version of. */
  push: T[];
  /** Cloud ids that are no longer kept (over the cap). */
  drop: string[];
};

/**
 * Combines by id so nothing is lost and nothing counts twice. `pickLocal` decides a conflict
 * (true keeps the local version). Both sides end up with the newest `cap` items.
 */
export function mergeById<T extends Item>(local: readonly T[], cloud: readonly T[], cap: number, pickLocal: (local: T, cloud: T) => boolean): Merged<T> {
  const cloudById = new Map(cloud.map((c) => [c.id, c]));
  const byId = new Map<string, T>(cloud.map((c) => [c.id, c]));
  const changed = new Set<string>();
  for (const l of local) {
    const c = cloudById.get(l.id);
    if (!c) {
      byId.set(l.id, l);
      changed.add(l.id);
    } else if (pickLocal(l, c) && JSON.stringify(l) !== JSON.stringify(c)) {
      byId.set(l.id, l);
      changed.add(l.id);
    }
  }
  const kept = [...byId.values()].sort((a, b) => b.playedAt - a.playedAt || a.id.localeCompare(b.id)).slice(0, cap);
  const keptIds = new Set(kept.map((k) => k.id));
  return {
    kept,
    push: kept.filter((k) => changed.has(k.id)),
    drop: cloud.filter((c) => !keptIds.has(c.id)).map((c) => c.id),
  };
}

/** A4: for results, the newer note wins; with equal times the local copy is kept. */
export const newerNote = (l: { noteUpdatedAt?: number }, c: { noteUpdatedAt?: number }) => (l.noteUpdatedAt ?? 0) >= (c.noteUpdatedAt ?? 0);
