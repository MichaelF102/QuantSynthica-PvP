// Room codes: 6 characters from an alphabet without look-alikes (no 0/O, 1/I/L), so a code read
// aloud or typed from a screenshot is unambiguous. 31^6 ≈ 887 million codes.

export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_LENGTH = 6;

const VALID = new RegExp(`^[${ROOM_CODE_ALPHABET}]{${ROOM_CODE_LENGTH}}$`);

/** A random room code. `rng` returns [0, 1) and is injectable for tests. */
export function generateRoomCode(rng: () => number = Math.random): string {
  let out = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) out += ROOM_CODE_ALPHABET[Math.floor(rng() * ROOM_CODE_ALPHABET.length) % ROOM_CODE_ALPHABET.length];
  return out;
}

export const isRoomCode = (v: unknown): v is string => typeof v === 'string' && VALID.test(v);

/**
 * Cleans what a player typed: trims, uppercases, drops spaces and dashes, and maps the common
 * look-alikes (O→0 is not in the alphabet, so O and 0 both fail; I/L/1 likewise). Returns the
 * code if valid, otherwise null.
 */
export function normalizeRoomCode(input: string): string | null {
  const cleaned = input.trim().toUpperCase().replace(/[\s-]/g, '');
  return isRoomCode(cleaned) ? cleaned : null;
}

/** Share link for a room on the given app origin. */
export const roomLink = (origin: string, code: string) => `${origin.replace(/\/$/, '')}/play/${code}`;
