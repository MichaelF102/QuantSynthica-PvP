// Firebase web config from the environment (plan M14 A1). These values are public by design:
// the Firestore rules (firestore.rules) are what protect the data. With no config the site
// works as before and the sign-in button is hidden.

export type FirebaseWebConfig = { apiKey: string; authDomain: string; projectId: string; appId: string };

export function firebaseConfig(
  env: Record<string, string | undefined> = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  },
): FirebaseWebConfig | null {
  const v = (k: string) => (env[k] ?? '').trim();
  const c = { apiKey: v('apiKey'), authDomain: v('authDomain'), projectId: v('projectId'), appId: v('appId') };
  return c.apiKey && c.authDomain && c.projectId && c.appId ? c : null;
}
