# Rava — Project Context

> This is a moderate-depth companion to `README.md`. For the full engineering roadmap, open
> [`next_steps.MD`](./next_steps.MD) (already present in this repo — note the underscore/caps,
> unlike the `next steps.md` convention used in newer sibling projects). `GUIDE.md` has a
> friendlier walkthrough of setup + user-facing features.

## 1. What Rava is, and who it's for

Rava (internal codename **ReelBazaar**, package name `reelbazaar`) is a fashion PR/reels
platform: influencers upload short reels tagging fashion products, viewers scroll a
fashion-only feed and shop the tagged products, and brands browse/discover influencers for
paid collaborations. Three user types share one data model: **Influencer**, **Viewer**,
**Brand** (see `README.md` for the API surface).

Per `next_steps.MD` (last updated June 2026), the product is a **"Functional MVP (~65%
complete)" — demo-ready, not production-ready**. That status line is the author's own
assessment and is the most current ground truth available in the repo.

## 2. Current tech stack (observed)

- **Monorepo**: npm workspaces + Turborepo (`turbo.json`, workspaces = `apps/*`, `packages/*`,
  `backend/*`)
- **Web app** (`apps/web-app`): React 18 + Vite + Tailwind, PWA via `vite-plugin-pwa`, dev port
  **3000**, proxies `/api` and `/uploads` to `localhost:4000`
- **Landing page** (`apps/landing-page`): Next.js 14, dev port **3001** (`next dev -p 3001`)
- **Mobile app** (`apps/mobile-app`): React Native CLI 0.73 (no Expo); has its own
  `@react-native-firebase/{app,auth}` deps; has no `dev` script so Turbo's `dev` pipeline
  skips it — it's not started by `./run.sh`
- **Backend** (`backend/server`): Node.js + Express + Firebase Admin, dev via `tsx watch
  src/index.ts`, port **4000** (`PORT` env, default 4000)
- **Shared packages**: `packages/ui` (shared React components), `packages/config` (shared
  types/constants/Firebase config), `packages/api` (fetch-based API client, no Axios)
- **Database / Storage / Auth**: Firebase Firestore, Firebase Storage, Firebase Authentication
- **Payments**: Razorpay (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` in
  `backend/server/.env.example`); the deploy script's comments and `.env.example` imply the
  app can also run in a "demo-payments mode" when Razorpay isn't configured — not independently
  verified in code during this pass.

## 3. Directory structure at a glance

```
Rava/
├── apps/
│   ├── web-app/          # PWA — React + Vite + Tailwind (port 3000)
│   ├── landing-page/      # Marketing site — Next.js (port 3001)
│   └── mobile-app/        # React Native CLI app (not part of `npm run dev`)
├── packages/
│   ├── ui/                 # Shared React UI components
│   ├── config/             # Shared types, constants, Firebase config
│   └── api/                 # fetch-based API client
├── backend/
│   └── server/             # Express + Firebase Admin API (port 4000)
├── firebase.json            # Hosting sites: reelbaazar, reelbaazar-landing; Functions: api (us-central1)
├── .firebaserc               # default project: reelbaazar
├── firestore.rules / firestore.indexes.json / storage.rules
├── turbo.json, package.json  # workspace root, `npm run dev` -> `turbo run dev`
├── run.sh / deploy.sh / git.sh / stop.sh
├── README.md, GUIDE.md, next_steps.MD
└── Plugin /                  # design assets (icons, mockups) — not application code
```

## 4. Build / deploy status

- `deploy.sh` is a real, fairly complete pipeline: installs deps, runs
  `turbo run deploy:build` (builds `web-app`, `landing-page`, `server`), verifies the three
  build artifacts exist, then runs `firebase deploy --only hosting,functions` against two
  Firebase Hosting sites (`reelbaazar` for the app, `reelbaazar-landing` for the marketing
  site) and one Functions target (`api`, `us-central1`). It supports `--build-only`,
  `--hosting-only`, `--functions-only`, `--ci`, `--push`, and reads `FIREBASE_TOKEN` for
  non-interactive/CI use.
- As of this pass, `git.sh` (previously a placeholder) is a thin alias into `deploy.sh`, which now always pushes to GitHub first (git add/commit/push, no `--push` flag needed) and then runs the manual Firebase deploy above, since no `.github/workflows` CI/CD exists to do it automatically.
- A `.firebase/` directory and `.turbo/` cache are present in the working tree, which is
  consistent with this project having been built/deployed locally before.
- `.firebaserc` targets Firebase project **`reelbaazar`**. `next_steps.MD` flags a possible
  naming inconsistency worth double-checking ("Fix Firebase project ID typo — `.firebaserc`
  has `reelbaazar` (double 'a') — confirm if intentional").
- Domains referenced in `deploy.sh` output and `.env` files: `app.rava.one` (web app, via
  Hosting site `reelbaazar`) and `rava.one` (landing, via Hosting site `reelbaazar-landing`).
  Whether these domains are currently connected in the Firebase console was not verified here.

## 5. Known blockers / rough edges (from `next_steps.MD`, dated June 2026 — re-verify before relying on this)

- Several silent-failure bugs called out as "critical": empty `catch {}` blocks on like/save
  in `apps/web-app/src/pages/HomePage.tsx`, unchecked `.data()!` non-null assertions in
  `backend/server/src/routes/{reels,auth}.ts`, and no React error boundaries.
- A real `backend/server/serviceAccountKey.json` (Firebase Admin credentials) and `.env`
  files are present in the working tree under `backend/server/` — `next_steps.MD` explicitly
  flags hardcoded/committed credentials as a security issue to fix before real users. This
  agent did not open or copy the credential contents; their mere presence in the repo is the
  observation.
- `apps/web-app/.env.example` contains what look like live-shaped Firebase web config values
  (not just placeholders) — Firebase web API keys are client-exposed by design, but it's worth
  confirming these are the values you intend to keep public.
- Mobile app (`apps/mobile-app`) is described in `next_steps.MD` as "scaffold only" — screens
  exist but aren't wired to the real API yet.
- No automated tests were found for the backend (`next_steps.MD` lists this as an open item).

## 6. Third-party integrations / accounts (from config files)

- **Firebase**: Authentication, Firestore, Storage, Hosting (2 sites), Cloud Functions
  (project `reelbaazar`).
- **Razorpay**: payments/webhooks (`backend/server/.env.example` — `RAZORPAY_KEY_ID`,
  `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`).
- **ClickUp**: `.clickup.json` ties this repo to a ClickUp list/task for project tracking
  (tooling convention shared across this fleet of projects, not part of the app itself).

## 7. Where to go next

See [`next_steps.MD`](./next_steps.MD) for the full phased roadmap (bug fixes → missing
features → monetisation → mobile → growth) and a "quick wins" list.
