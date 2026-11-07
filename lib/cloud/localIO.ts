import { loadTombstones, removeTombstones } from '../localChanges';
import { loadNickname, saveNickname } from '../multiplayer/client';
import { MAX_DUELS, isDuelResult, listDuels, replaceDuels } from '../multiplayer/duelResult';
import { LAST_SETUP_KEY } from '../setup';
import { MAX_RESULTS, isMatchResult, listResults, replaceResults } from '../storage';
import { DUEL_PICK, RESULT_PICK, type LocalIO } from './sync';

// This browser's storage, as the sync engine sees it (plan M14). Writes made here announce nothing,
// so a sync never triggers itself.

function rawSetup(): string | null {
  try {
    return window.localStorage.getItem(LAST_SETUP_KEY);
  } catch {
    return null;
  }
}

function writeSetup(json: string): void {
  try {
    const v: unknown = JSON.parse(json);
    if (v && typeof v === 'object' && !Array.isArray(v)) window.localStorage.setItem(LAST_SETUP_KEY, json);
  } catch {
    /* unreadable or storage blocked: keep what this browser has */
  }
}

export function browserIO(): LocalIO {
  return {
    result: { list: () => listResults().results, replace: (items) => replaceResults(items), valid: isMatchResult, cap: MAX_RESULTS, pickLocal: RESULT_PICK },
    duel: { list: () => listDuels().duels, replace: (items) => replaceDuels(items), valid: isDuelResult, cap: MAX_DUELS, pickLocal: DUEL_PICK },
    nickname: { get: () => loadNickname(), set: (name) => saveNickname(name, undefined, false) },
    lastSetup: { get: rawSetup, set: writeSetup },
    tombstones: { load: () => loadTombstones(), remove: (done) => removeTombstones(done) },
  };
}
