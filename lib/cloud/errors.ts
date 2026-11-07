// Firebase error codes as sentences fit to show (plan M14). No SDK import, so the UI can use it.

/** A sign-in error as a sentence fit to show. Closing the popup is not an error. */
export function authErrorText(e: unknown): string | null {
  const code = (e as { code?: string })?.code ?? '';
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return null;
  if (code === 'auth/unauthorized-domain') return 'Sign-in is not allowed on this web address yet. Add it to the authorized domains in the Firebase console.';
  if (code === 'auth/network-request-failed') return 'Could not reach Google. Check your connection and try again.';
  return 'Sign-in failed. Try again.';
}

/** A sync error as a sentence. */
export function syncErrorText(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  if (code === 'permission-denied') return 'The cloud refused the change. Sign out and in again.';
  if (code === 'unavailable' || code === 'deadline-exceeded') return 'Offline. Your progress is saved in this browser and syncs when you are back online.';
  if (code === 'resource-exhausted') return 'The free cloud quota for today is used up. Your progress is saved in this browser and syncs later.';
  return 'Sync failed. Your progress is saved in this browser.';
}
