# Camp Points Tracker

A mobile-first web app for tracking team points at church camp. Preset events
award points with one tap, extra points can be given anytime with a reason,
and a drag-to-reorder schedule doubles as a day planner that stays flexible
when events run long or get shuffled. Data syncs live across every phone
that has the camp's code, via Firebase Firestore.

It's built as an installable Progressive Web App (PWA) rather than a native
iOS app — no App Store account or Xcode/Mac needed. On an iPhone, open the
deployed URL in Safari, tap **Share → Add to Home Screen**, and it behaves
like a regular app: its own icon, full screen, no browser chrome.

## How it works

- **Camp** — the top-level container. Creating one generates a short 5-letter
  code (e.g. `P9NCF`). Share that code with other counselors' phones so they
  can join the same live camp instead of creating their own.
- **Teams** — the groups competing for points.
- **Event presets** — reusable event templates (name, points, estimated
  duration) so common activities can be awarded in one tap without retyping
  point values.
- **Schedule** — today's ordered list of events, built from presets or
  one-off custom events. Drag to reorder at any time; mark one "active" to
  drive the Live tab, mark it "done" when it wraps up. Order is fluid, not
  clock-locked, so shuffling the day around is just a drag, not a rebuild.
- **Live tab** — shows the active event and lets you tap teams *in finishing
  order* to award preset points (1st tap = 1st place 🥇), plus a floating
  "+ Extra points" button for ad-hoc awards/deductions with a reason, and a
  live leaderboard.
- **Placements** — each event remembers who finished 1st/2nd/3rd (derived
  from award order), shown on the team tiles while the event runs and on the
  Schedule tab afterward.
- **Double point days** — mark any day 2× in Setup (today with one tap, or
  any date). Every transaction is timestamped, so flipping a day on or off
  retroactively doubles/undoubles everything awarded that day, everywhere,
  instantly.
- **History** — a running, deletable log of every point transaction (with 2×
  badges on double days), so you can audit or undo an accidental award.
- **Offline-ready** — points awarded without signal apply to the scoreboard
  immediately, an "Offline" banner shows in the header, and everything syncs
  automatically when connection returns.

## Tech stack

- React + TypeScript + Vite
- Tailwind CSS v4
- Firebase Firestore (realtime sync, offline-tolerant writes)
- `vite-plugin-pwa` (installable, offline app-shell caching)
- `@dnd-kit` for the drag-to-reorder schedule

## 1. Create a Firebase project (free tier is enough)

1. Go to the [Firebase console](https://console.firebase.google.com/) and
   create a new project.
2. In **Build → Firestore Database**, click **Create database** and start in
   production mode (any region close to you is fine).
3. In **Project settings → General**, scroll to "Your apps", click the web
   icon (`</>`) to register a web app, and copy the `firebaseConfig` values.
4. Deploy the security rules and indexes in this repo so only valid writes
   are accepted:
   ```bash
   npm install -g firebase-tools
   firebase login
   firebase use --add        # pick your project, alias it e.g. "default"
   firebase deploy --only firestore
   ```
   See `firestore.rules` for what's allowed — there's no user login, access
   is gated purely by knowing the camp code, which trades strict access
   control for zero-friction multi-device editing. That's a reasonable
   tradeoff for a camp scoreboard; don't put sensitive data in it.

## 2. Configure the app

Create a `.env` file in the project root with the values from step 1.3:

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

## 3. Run locally

```bash
npm install
npm run dev
```

Open the printed `localhost` URL. On your phone (same Wi-Fi), run
`npm run dev -- --host` instead and open the "Network" URL it prints.

### Testing without a real Firebase project

The Firebase Local Emulator Suite lets you try the whole app without any
cloud project or credentials:

```bash
npx firebase emulators:start --only firestore --project demo-camp-points
```

In a second terminal, with a `.env.local` containing:

```
VITE_USE_FIRESTORE_EMULATOR=true
VITE_FIREBASE_PROJECT_ID=demo-camp-points
VITE_FIREBASE_API_KEY=demo-key
```

run `npm run dev`. Data lives only in the emulator's memory and resets when
it stops.

## 4. Deploy so it's reachable from any phone

Any static host works since this is a client-only app. Firebase Hosting is
the simplest since it's already set up in `firebase.json`:

```bash
npm run build
firebase deploy --only hosting
```

Vercel or Netlify work too — just point them at this repo with build command
`npm run build` and output directory `dist`, and set the same `VITE_FIREBASE_*`
environment variables in their dashboard.

## 5. Install it on an iPhone

1. Open the deployed URL in **Safari** (must be Safari, not Chrome, for the
   install prompt to work on iOS).
2. Tap the **Share** icon → **Add to Home Screen**.
3. Launch it from the home screen icon — it opens full-screen like a native
   app. Do this on every counselor's phone that needs to award points; they
   all just need the camp code from the Setup tab to see the same live data.

## Notes and limitations

- There's no per-user login — anyone with the camp code can read and write
  that camp's data. This is intentional for frictionless shared use among
  trusted staff on one camp's own devices; don't reuse a camp code across
  events you want kept separate.
- Team totals are computed by summing the transaction log on each device,
  so the History tab is also your audit trail and undo mechanism (delete a
  transaction to reverse it).
- The schedule uses relative order and estimated durations rather than fixed
  clock times, since real camp days rarely run on schedule — reordering with
  a drag is the "replanning" mechanism.
