# QuantSynthica PvP

A practice trading game on real historical market data. You trade a session candle by candle
against a clock and a loss limit, then get a full results report. Practice only: no real money.

- **Practice:** 24 US and Indian markets (futures, indices, stocks), 1-minute candles with
  5m/15m/1h/1d views, play/pause/step/jump, market orders, stop-loss / take-profit (on the
  position or attached to the order), optional next-candle-open fills, commission and slippage.
- **Results:** P&L, return, win rate, profit factor, drawdown, equity curve, trade list, notes,
  CSV export, and a replay of the session with your entries and exits.
- **Progress:** trends across your matches, best and worst symbols, 1v1 record.
- **1v1 rooms:** two players join by a 6-character code and trade the same session on one shared
  clock. Single game or best of 3; opponent positions hidden or visible.
- **Challenge links:** send a friend the exact session you played and the score to beat.
- **Accounts (optional):** Google or email sign-in keeps your progress on every device, with one
  account for every QuantSynthica site. Without it,
  everything is saved in the browser.

Everything below runs on free plans: Vercel or Render for the app, Firebase for sign-in,
Cloudflare Workers for 1v1 rooms. No credit card is needed for any of them.

---

## Run it locally

Needs Node 20.9–22 (`.nvmrc` says 22). Python is only needed to refresh market data.

```bash
npm install
npm run dev        # app on http://localhost:3000 and the 1v1 room server on :8787
```

`npm run dev` first refreshes `public/data/` if it is more than 12 hours old (needs the Python
setup below); if that fails it warns and starts with the data already there. To skip it:
`npm run dev:offline`.

To try 1v1 locally, open `http://localhost:3000/play` in two different browsers (or a normal and
a private window, so each is its own player).

For Google sign-in locally, copy `.env.example` to `.env.local` and fill in the Firebase values
(see [Step 3](#3-firebase-google-sign-in-optional)).

---

## Deploy for free

The app is plain Next.js. The market data ships in the repo (`public/data/`), so hosts only run
`npm ci` and `npm run build`: no Python and no data-provider access. Each optional part switches
on when its environment variables are set. Without them the site still works, just without that
part:

| Part | Free service | Needed for | Environment variables (on Vercel / Render) |
|---|---|---|---|
| App | Vercel Hobby **or** Render free | everything | none |
| Sign-in | Firebase Spark | Google sign-in, cloud progress | `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID` |
| 1v1 rooms | Cloudflare Workers free | playing someone on another device | `NEXT_PUBLIC_ROOM_HOST` |

`NEXT_PUBLIC_*` values are built into the pages, so **redeploy after changing them**. Every build
runs `npm run deploy:check` first (`scripts/check-deploy.mjs`). It stops the build if a data file is
missing, if only some of the Firebase values are set, or if the room host has `https://` in it,
and it prints which optional parts are on. Run it yourself any time with `npm run deploy:check`.

Do the steps in this order: the later services need the app's URL.

### 1. Put the code on GitHub

Vercel and Render deploy from a GitHub repo, and every push to `main` redeploys.

### 2. Deploy the app

**Vercel** (recommended: fast, never sleeps; the Hobby plan is for non-commercial use)

1. [vercel.com](https://vercel.com) → **Add New → Project** → import the repo.
2. Keep the defaults. `vercel.json` sets `npm ci` and `npm run build`. **Deploy.**
3. Note the URL, e.g. `https://quantsynthica-pvp.vercel.app`.

**Render** (alternative or second copy)

1. [render.com](https://render.com) → **New → Blueprint** → pick the repo. Render reads
   `render.yaml`: one free Node web service on Node 22.
2. It asks for the environment variables in the table. Leave them empty for now. **Apply.**
3. Note the URL, e.g. `https://quantsynthica-pvp.onrender.com`. Free services sleep after about
   15 idle minutes, and the next visit takes 30–60 s to wake.

### 3. Firebase: sign-in (optional)

One Firebase project (`quantsynthica`) serves every QuantSynthica site, so the same Google or
email/password account and its data work on all of them. [`firestore.rules`](firestore.rules) in
this repo is the only rules file for that project: other sites add their app id there.

1. [console.firebase.google.com](https://console.firebase.google.com) → **Add project**
   (Analytics not needed). It starts on the free Spark plan.
2. **Build → Authentication → Get started → Sign-in method:** enable **Google** (choose a support
   email) and **Email/Password** (leave "Email link" off). Save each.
3. **Authentication → Settings → Authorized domains → Add domain:** every site's host without
   `https://` (e.g. `quantsynthica-pvp.vercel.app`, `quantsynthica-pvp.onrender.com`, and the
   other QuantSynthica sites).
   `localhost` is already there. Sign-in is refused on any address not listed, including Vercel
   preview URLs.
4. **Build → Firestore Database → Create database** → production mode → a nearby location.
5. **Firestore → Rules:** replace everything with the contents of [`firestore.rules`](firestore.rules)
   and **Publish**. Do not skip this, and never use "test mode" rules: the rules are what stop one
   user from reading another user's data. (CLI alternative: `npx firebase-tools login`, then
   `npm run rules:deploy -- <project-id>`.)
6. **Project settings (gear) → General → Your apps → `</>` (Web)** → register an app (no
   Hosting). From the config it shows, copy `apiKey`, `authDomain`, `projectId` and `appId` into
   the four `NEXT_PUBLIC_FIREBASE_*` variables on Vercel (**Settings → Environment Variables**)
   and/or Render (**Environment**), then **redeploy**.

These four values are public by design (every browser gets them). The Firestore rules protect the
data. Email/password accounts must open the verification email before anything syncs (the rules
require a verified email). Free limits, shared by every site on the project, are 50k document reads and 20k writes a day and 1 GiB of storage. A sign-in
reads at most about 100 documents and each saved match writes one. If the daily quota runs out,
progress keeps saving in the browser and syncs the next day.

### 4. Cloudflare: 1v1 room server (optional)

Without it, 1v1 works only on your own machine (`npm run dev`).

1. `npx wrangler login` (opens a browser once; a free Cloudflare account is enough).
2. Deploy, pointing it at your app for market data and allowing your app's URLs to connect:

   ```bash
   npm run rooms:deploy -- \
     --var DATA_ORIGIN:https://quantsynthica-pvp.vercel.app \
     --var ALLOWED_ORIGINS:https://quantsynthica-pvp.vercel.app,https://quantsynthica-pvp.onrender.com
   ```

   It prints the Worker's host, e.g. `quantsynthica-rooms.<you>.workers.dev`. Check that
   `https://<that host>/health` says `ok`.
3. Set `NEXT_PUBLIC_ROOM_HOST` to that host (no `https://`) on Vercel and/or Render, then
   **redeploy** the app.

`ALLOWED_ORIGINS` must list every address players use, exactly (scheme and host, no trailing
slash). A missing one shows up as a room socket that never connects. Use the Vercel URL for
`DATA_ORIGIN`: a sleeping Render service makes the first room creation slow.

### 5. Check it works

- `/` loads, and `/practice` starts a match.
- With Firebase: **Sign in** in the navbar opens Google. `/profile` shows "Synced …". A match
  played on one device shows up on another after signing in there.
- With rooms: create a room on `/play`, open the link on another device, both press Ready.

### Updating

- **Code:** push to `main`. Vercel and Render redeploy. After a change to room rules or the
  protocol, also run the `npm run rooms:deploy` command again.
- **Market data:** `npm run data:refresh` locally (or `npm run data:add -- RELIANCE.NS`), commit
  `public/data/`, push. Data files are cached for an hour.

---

## Market data

The app reads only static files in `public/data/`: one CSV of 1-minute candles per symbol
(`time,open,high,low,close,volume`, UNIX seconds UTC), `index.json` (the playable symbols) and
`catalog.json` (a searchable ticker list without prices). Nothing is fetched from a data provider
at runtime.

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt -r requirements-dev.txt
npm run data:refresh                 # fetch the default symbols and rebuild the index
npm run data:add -- AAPL             # one more ticker
.venv/bin/python -m pytest scripts/tests -q
```

- `scripts/fetch_data.py` downloads 1-minute bars in 7-day chunks, cleans them and **merges** them
  into each symbol's file, so regular runs build up history. Files are written atomically.
- `scripts/build_index.py` writes `index.json`. Names and sectors come from the metadata lists in
  `data/`, which are not price history.
- 1-minute bars only go back about 30 days at the source, so sessions come from that window plus
  whatever earlier runs have merged in.

## How a match works

1. **Setup:** symbol, time limit (5–30 min), balance, max drawdown, and optionally the fill model
   (current close or next candle open), commission and slippage.
2. **Replay:** 1 candle a second at 1x (2x, 5x). The timer runs only while playing.
3. **Trading:** market orders, one net position per symbol (opposite orders reduce, then flip),
   no leverage, stop-loss / take-profit. A candle that touches both your stop and your target
   counts as the stop.
4. **End:** timer, drawdown limit, end of data, or "End match". Open positions close at the last
   price and the result is saved.

Keyboard: `B` / `S` buy / sell size, `Enter` place, `Space` play/pause, `→` step, `Esc` close,
`?` all shortcuts.

## Development

```bash
npm run lint && npm run test && npm run build   # before calling a change done
npm run rooms:e2e        # real room server + two sockets, ~15 s
npm run rooms:typecheck  # room-server/ against the Worker types
```

| Path | What lives there |
|---|---|
| `lib/engine.ts` (+ `execution`, `brackets`, `pendingOrders`, `matchRead`) | All match rules, pure and unit-tested |
| `lib/stats.ts`, `lib/results.ts`, `lib/progress.ts`, `lib/matchReplay.ts` | Results, progress trends, replay |
| `lib/multiplayer/` | 1v1 protocol, room state machine, series |
| `lib/cloud/` | Google sign-in sync: merge rules, Firestore adapter (the only file that imports Firebase) |
| `room-server/` | Cloudflare Worker + Durable Object shell around `lib/multiplayer` |
| `store/` | Zustand stores, replay clock, hotkeys |
| `components/` | UI |
| `scripts/` | Data pipeline (Python), dev runner, deploy check |
| `firestore.rules` | Firestore security rules |
| `fixtures/` | **TEST FIXTURE** data for unit tests only |
