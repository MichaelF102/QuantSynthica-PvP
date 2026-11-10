// Every QuantSynthica site shares one Firebase project (plan M16). The trading game keeps its own
// collections (`results`, `duels`); the other sites store under `users/{uid}/apps/{app}`.
// Keep this list in step with `knownApp` in firestore.rules.

export const OTHER_APPS = ['fundamentals', 'mf', 'swing', 'terminal', 'lab'] as const;
export type OtherApp = (typeof OTHER_APPS)[number];

/** Firebase accepts 6; the sign-up form asks for at least this many characters. */
export const PASSWORD_MIN = 8;
