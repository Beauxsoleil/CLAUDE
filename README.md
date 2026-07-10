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
  can join the same live camp instead of creating their own — or let them
  **scan the join QR** (Setup → Show join QR); their camera opens a link that
  joins automatically.
- **Teams** — the groups competing for points.
- **Event presets** — reusable event templates (name, points, estimated
  duration) so common activities can be awarded in one tap without retyping
  point values.
- **Schedule** — today's ordered list of events, built from presets or
  one-off custom events. Drag to reorder at any time; mark one "active" to
  drive the Live tab, mark it "done" when it wraps up. Order is fluid, not
  clock-locked, so shuffling the day around is just a drag, not a rebuild.
- **Scoring modes** — each preset/event is either **flat** (every team you
  tap gets the same points) or **ranked** (points by finishing place, e.g.
  1st 5000, 2nd 3000, 3rd 1000). Toggle it per event, with an editable ladder
  of any number of places.
- **Live tab** — shows the active event and lets you tap teams *in finishing
  order*. In flat mode every tap awards the same points; in ranked mode the
  first tap gets 1st-place points, the next gets 2nd, and so on (the tiles
  show what the next tap is worth). Plus a floating "+ Extra points" button
  for ad-hoc awards/deductions with a reason, and a live leaderboard.
- **Placements** — each event remembers who finished 1st/2nd/3rd (derived
  from award order), shown on the team tiles while the event runs and on the
  Schedule tab afterward (with the points earned, for ranked events).
- **Double point days** — mark any day 2× in Setup (today with one tap, or
  any date). Every transaction is timestamped, so flipping a day on or off
  retroactively doubles/undoubles everything awarded that day, everywhere,
  instantly.
- **History** — a running, deletable log of every point transaction (with 2×
  badges on double days), so you can audit or undo an accidental award.
- **Scoreboard / present mode** — the "Present" button on the Live leaderboard
  opens a full-screen, large-type standings view to cast to a TV or project at
  the evening rally. Bars animate as scores change and the screen stays awake
  while it's open (where the browser supports it).
- **Trends** — the History tab has a **Log / Trends** toggle. Trends shows a
  cumulative points-over-time line per team (in each team's color) and a
  per-event finishing-order breakdown.
- **Celebration** — awarding points fires a short confetti burst (bigger for a
  1st-place finish or a large award) plus a haptic tap where supported. Both
  respect the OS "reduce motion" setting.
- **Viewer lock** — set a 4-digit scorekeeper PIN in Setup, then switch spare
  or kid-facing devices to **viewer mode**: they can watch the scoreboard but
  every award/edit/delete control is hidden until someone re-enters the PIN.
  (This is a soft guard against casual tampering, not hard security — see
  *Notes and limitations*.)
- **Offline-ready** — points awarded without signal apply to the scoreboard
  immediately, an "Offline" banner shows in the header, and everything syncs
  automatically when connection returns.
- **Themes** — an Appearance picker in Setup switches between a dark
  ("Midnight") look and a minimalist warm-beige ("Sandstone") look. The
  choice is saved per device, so each counselor can pick their own. Colors
  are driven by semantic CSS-variable tokens, so new themes are easy to add.
- **Update prompt** — when a new version is deployed, the app shows a
  "New version available — Refresh" banner instead of silently caching the
  old one.

## Tech stack

- React + TypeScript + Vite
- Tailwind CSS v4
- Firebase Firestore (realtime sync, offline-tolerant writes)
- `vite-plugin-pwa` (installable, offline app-shell caching, update prompt)
- `@dnd-kit` for the drag-to-reorder schedule
- `qrcode` for the join QR, `canvas-confetti` for award celebration
- Points-over-time chart is dependency-free inline SVG

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
the simplest since it's already set up in `firebase.json`.

**First-time setup (once):**

```bash
npm install -g firebase-tools   # or prefix the commands below with npx
firebase login
firebase use --add              # pick your project, alias it "default"
```

`firebase use --add` writes a `.firebaserc` so future deploys don't prompt for
a project.

**Deploy:**

```bash
npm run deploy            # builds, THEN deploys hosting + rules
# or, more granular:
npm run deploy:hosting    # builds + deploys only the web app
npm run deploy:rules      # deploys only firestore.rules
```

> **Why `npm run deploy` and not `firebase deploy`?** `firebase deploy` only
> *uploads* the `dist/` folder — it does not build. If you run it after a build
> that failed (or forgot to build), it happily publishes the **old** bundle and
> the site "deploys" but never changes. `npm run deploy` runs the build first
> and stops if the build fails, so a broken or stale build can't ship.

Vercel or Netlify work too — point them at this repo with build command
`npm run build` and output directory `dist`, and set the same `VITE_FIREBASE_*`
environment variables in their dashboard. (Those hosts don't deploy Firestore
rules, so still run `npm run deploy:rules` or edit rules in the Firebase console.)

## 4b. Deploying an update (and actually seeing it)

"I deployed but the site still shows the old version" is almost always a build
or cache issue, not a Firebase problem. This checklist avoids both:

1. `git pull` then `npm install` (in case dependencies changed).
2. `npm run deploy`. **Watch the output** — if the build prints red errors,
   stop and fix them; nothing new ships until the build passes.
3. If `firestore.rules` changed (it did for the viewer-lock PIN), run
   `npm run deploy:rules` once — or paste the contents of `firestore.rules`
   into **Firebase console → Firestore → Rules → Publish** (no CLI needed).
4. **Clear the old cached version once.** Because this is an installed PWA, your
   phone/browser serves the cached copy until the new service worker takes over:
   - Desktop: hard-refresh twice (⌘/Ctrl+Shift+R), or open the URL in a private
     window.
   - iPhone home-screen app: swipe it fully closed, then reopen once or twice.
   After this first clear, the app shows a **"New version available — Refresh"**
   banner on future deploys, so you won't have to do this again.
5. **Confirm it's live.** Open the **Setup** tab and check the small
   **`Build <timestamp> UTC`** line at the very bottom. If it matches the deploy
   you just ran, you're on the new version; if it shows an older time, you're
   still looking at cache — repeat step 4.

The app now sends `no-cache` headers for `index.html` and the service worker
(see `firebase.json`), so once the old worker is cleared, new deploys are picked
up promptly instead of being masked by the browser cache.

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
- **Viewer lock is a soft guard, not real security.** It hides the editing
  controls on a locked device so campers holding a viewing phone can't
  casually change scores, but a determined person with the camp code could
  still write through the API. The scorekeeper PIN is stored on the camp
  document (readable), so treat it as a "keep honest people honest" lock, not
  a password. The Firestore rules allow updating only the `doublePointDays`
  and `pin` fields on a camp after creation.
- Team totals are computed by summing the transaction log on each device,
  so the History tab is also your audit trail and undo mechanism (delete a
  transaction to reverse it).
- The schedule uses relative order and estimated durations rather than fixed
  clock times, since real camp days rarely run on schedule — reordering with
  a drag is the "replanning" mechanism.
