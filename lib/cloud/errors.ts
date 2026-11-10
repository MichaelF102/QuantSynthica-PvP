// Firebase error codes as sentences fit to show (plans M14, M16). No SDK import, so the UI can use it.

const AUTH_TEXT: Record<string, string> = {
  'auth/unauthorized-domain': 'Sign-in is not allowed on this web address yet. Add it to the authorized domains in the Firebase console.',
  'auth/network-request-failed': 'Could not reach the sign-in service. Check your connection and try again.',
  'auth/invalid-credential': 'The email or password is wrong.',
  'auth/wrong-password': 'The email or password is wrong.',
  'auth/user-not-found': 'The email or password is wrong.',
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/missing-email': 'Enter your email address.',
  'auth/missing-password': 'Enter your password.',
  'auth/weak-password': 'Choose a longer password.',
  'auth/password-does-not-meet-requirements': 'Choose a longer password.',
  'auth/email-already-in-use': 'An account with this email already exists. Sign in with your password or with Google.',
  'auth/account-exists-with-different-credential': 'This email already has an account that signs in another way. Use that way instead.',
  'auth/too-many-requests': 'Too many attempts. Wait a few minutes and try again.',
  'auth/operation-not-allowed': 'This way of signing in is not turned on for the site yet.',
  'auth/user-disabled': 'This account has been turned off.',
  'auth/requires-recent-login': 'For safety, sign out, sign in again, then try once more.',
};

/** A sign-in error as a sentence fit to show. Closing the popup is not an error. */
export function authErrorText(e: unknown): string | null {
  const code = (e as { code?: string })?.code ?? '';
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return null;
  return AUTH_TEXT[code] ?? 'Sign-in failed. Try again.';
}

/** A sync error as a sentence. */
export function syncErrorText(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  if (code === 'permission-denied') return 'The cloud refused the change. Sign out and in again.';
  if (code === 'unavailable' || code === 'deadline-exceeded') return 'Offline. Your progress is saved in this browser and syncs when you are back online.';
  if (code === 'resource-exhausted') return 'The free cloud quota for today is used up. Your progress is saved in this browser and syncs later.';
  return 'Sync failed. Your progress is saved in this browser.';
}

export const VERIFY_FIRST = 'Verify your email to turn on cloud sync. Your progress is saved in this browser until then.';
