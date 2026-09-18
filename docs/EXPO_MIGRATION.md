# Expo migration — Rava

Status: **EAS project live, typecheck clean, web bundle builds. Screens partly ported.**

EAS project: `@nithindidigam/rava` — `90f1a13d-4e29-407b-a025-31075553022d`
(https://expo.dev/accounts/nithindidigam/projects/rava). The id is committed in
`app.config.js`; it is not a secret.

Verified on 2026-08-21: `npx tsc --noEmit` passes, and `npx expo export --platform web`
produces a working `dist/` (3.7 MB, 19 assets).

Rava is moving from three clients (Vite web app, Next.js landing page, React Native CLI
scaffold) to **one Expo codebase serving web + iOS + Android**, plus the unchanged Next.js
landing page. The new client lives in [`apps/app`](../apps/app).

The stack and every non-obvious config decision is copied from **Aura+**
(`../Aura++`), which already ships this exact setup to the App Store and Play Store.

---

## 1. Decisions taken

| Decision | Choice |
|---|---|
| Web client | Expo web export **replaces** `apps/web-app`; Firebase Hosting site `reelbaazar` repoints from `apps/web-app/dist` to `apps/app/dist` |
| Styling | Theme tokens + `StyleSheet` (`apps/app/theme/`). No Tailwind, no NativeWind |
| Scope | Full parity with the web app |
| Firebase | **Web JS SDK** (`firebase`) on all platforms — not `@react-native-firebase` |
| Backend | `backend/server` unchanged |
| Bundle id / package | `com.nhancio.rava`, scheme `rava`, slug `rava` — **unconfirmed, see §5** |

### Why the web SDK matters

It is the decision that makes this migration cheap. `packages/api` (fetch client) and
`packages/config` (types + constants) run unchanged on device, and every Firestore/Auth call
already written for the web app works as-is. Only auth *persistence* differs per platform,
handled in [`apps/app/lib/firebase.ts`](../apps/app/lib/firebase.ts).

---

## 2. What is done

**Config**
- `app.config.js` — dynamic config so `googleServicesFile` can read an EAS secret; R8
  minify + resource shrinking; `blockedPermissions`; iOS `extraPods` modular headers;
  camera/image-picker/video/splash plugins; OTA `runtimeVersion: appVersion`
- `eas.json` — development / preview / production profiles with matching OTA channels
- `metro.config.js` — monorepo `watchFolders` + `nodeModulesPaths`, hierarchical lookup
  disabled, and the `idb` → CJS resolver Firebase's ESM bundle needs on native
- `tsconfig.json`, `.env.example`, `.gitignore`, `.nvmrc` (Node 20.19)

**Foundation**
- `theme/` — `colors.ts` (both palettes, lifted from the old `globals.css`), `layout.ts`
  (spacing/radii/type scale/device frame), `shadows.{native,web}.ts`
- `lib/firebase.ts` — platform-split auth persistence, web-only Firestore persistent cache
- `lib/storage.ts` — synchronous AsyncStorage-backed store, hydrated once at boot, so the
  ported `useState(() => store.getItem(...))` initialisers keep working
- `lib/googleSignIn.{web,native}.ts` — popup/redirect on web, native Google SDK on device
- `lib/timeAgo.ts` — plus `formatCount`, because Hermes has no full ICU for `toLocaleString`

Icons import from `@expo/vector-icons/Ionicons`, never the `@expo/vector-icons` barrel. The
barrel pulls every icon font into the bundle — ~4 MB of TTFs across 15 families for the one
family this app draws. Same class of problem Aura+ solved with a Metro stub; the deep import
is the cheaper fix. Keep it that way when adding icons.

**Shared package changes**
- `packages/config/index.ts` — reads `EXPO_PUBLIC_*` via **static** member access (Metro only
  inlines `process.env.X`, never `process.env[key]`); Vite's `import.meta` isolated
- `packages/api/src/client.ts` — `uploadFile` accepts `File | { uri, name, type }`;
  `buildUrl` now throws a directive error instead of silently resolving to `http://localhost`
  when `API_BASE_URL` is relative on native

**Screens**
- `app/_layout.tsx` — providers, splash gating, and the auth/onboarding redirects that used
  to live inline in `App.tsx`
- `app/(tabs)/_layout.tsx` — Home / Discover / Create / Profile, `freezeOnBlur`
- `app/(tabs)/index.tsx` — **the feed, fully ported.** Firestore-first with API fallback,
  batched creator enrichment, optimistic like/save with rollback, viewability-driven
  playback, pull-to-refresh, infinite scroll
- `components/ReelVideo.tsx` + `components/ReelPostCard.tsx` — `expo-video` player and the
  RN port of `InstaPostCard`
- `app/auth.tsx` — Google, **Apple** (new, and mandatory — see §4), guest mode
- `app/(tabs)/profile.tsx` — identity, streak, theme toggle, sign out
- `components/` — `ErrorBoundary` (the web app had none on most routes), `AppFrame`
  (the desktop phone-frame treatment), `Button`, `Avatar`, `LoadingSpinner`

## 3. What is not done

Each of these renders a `NotPortedYet` placeholder naming its source file, so the app is
navigable end to end today:

| Route | Port from |
|---|---|
| `app/(tabs)/discover.tsx` | `apps/web-app/src/pages/DiscoverPage.tsx` |
| `app/(tabs)/create.tsx` | `apps/web-app/src/pages/CreateReelPage.tsx` — needs `expo-image-picker` / `expo-camera` |
| `app/(tabs)/collaborations.tsx` | `apps/web-app/src/pages/CollaborationsPage.tsx` |
| `app/onboarding.tsx` | `apps/web-app/src/pages/OnboardingPage.tsx` |
| `app/reel/[reelId].tsx` | `SingleReelPage.tsx` + `components/CommentsDrawer.tsx` |
| `app/profile/[userId].tsx` | `ProfilePage.tsx` (32 KB — the largest screen) |

`app/(tabs)/profile.tsx` is a reduced version: own reels grid, saved reels, followers,
editing, and the brand product/order/payout surfaces are still to come.

Also outstanding: assets are **placeholders** (see `apps/app/assets/images/README.md`);
`firebase.json` still points hosting at `apps/web-app/dist`; no `eas init` has run, so OTA
is inert; `apps/mobile-app` (the old RN CLI scaffold) is now dead and should be deleted.

---

## 4. Store blockers — build these before submitting

**a. UGC moderation.** App Store Guideline 1.2 and Play's UGC policy both require, for any
app with user-uploaded video: content filtering, in-app reporting, block-user, published
contact info, and acting on reports within 24 h. `app.MD` lists content moderation (#12) and
block/report (#19) as unimplemented. This is the most common rejection reason for feed apps.

**b. Sign in with Apple.** Done — `app/auth.tsx`. Requires `usesAppleSignIn: true` (set) and
the Apple provider enabled in the Firebase console.

**c. Payments.** Selling *physical* goods through an external rail is permitted. Anything
digital requires IAP. Confirm Rava sells physical goods only, and that Razorpay is the right rail for physical products.

**d. Committed credentials.** `backend/server/serviceAccountKey.json` is in the working tree.
Every `EXPO_PUBLIC_*` value is embedded in the shipped binary; an Admin key must never come
near `apps/app`.

---

## 5. What is still needed from the owner

**Decisions**
- Confirm or override `com.nhancio.rava` / scheme `rava` / slug `rava`
- Reuse the Aura+ Expo account and Apple team `76G23XAVL3`, or separate?
- Physical goods only? (see §4c)
- Is the Firebase project id `reelbaazar` (double 'a') intentional? `next_steps.MD` flags it

**Credentials**

| Need | Source |
|---|---|
| `eas login` on this machine | Expo account |
| iOS + Android apps registered in Firebase | Firebase console, project `reelbaazar` |
| `google-services.json`, `GoogleService-Info.plist` | falls out of the above |
| Google OAuth client ids — web, iOS, Android | Google Cloud Console → Credentials |
| App Store Connect app record → `ascAppId` | Apple Developer Program |
| ASC API key `.p8` + key id + issuer id | App Store Connect → Users and Access → Keys |
| Play Console app + service account JSON | Play Console → Setup → API access |

Android SHA-1/SHA-256 come from `eas credentials` once the Expo login exists.

**Assets** — 1024×1024 icon (no alpha), transparent adaptive foreground + monochrome,
splash, and the confirmed brand palette to replace the values in `theme/colors.ts`.

**Toolchain** — Node 20.19 (`.nvmrc`; this machine is on 24, which SDK 56 does not support),
and Xcode + CocoaPods for local iOS builds.

---

## 6. Running it

```bash
cd apps/app
nvm use                      # Node 20.19
cp .env.example .env         # fill in EXPO_PUBLIC_FIREBASE_*
npm install
npx expo install --fix       # pins every expo-* package to the SDK 56 matrix
npm run web                  # browser
npm run ios / npm run android   # needs a dev client build first
```

Deploying web, once hosting is repointed:

```bash
cd apps/app && npm run build   # expo export --platform web -> dist/
firebase deploy --only hosting:reelbaazar
```


---

## 7. Deployment runbook

### Web — app.rava.one and rava.one

Both are Firebase Hosting sites in project `reelbaazar`, already configured in
`firebase.json`. Custom domains are attached in the Firebase console (Hosting → Add custom
domain), not in any file here — check whether `app.rava.one` and `rava.one` are already
connected before assuming a deploy will make them live.

```bash
npm i -g firebase-tools     # not currently installed on this machine
firebase login              # interactive, one time

# App (Vite build today; switch `public` to apps/app/dist when Expo web takes over)
cd apps/web-app && npx vite build && cd ../..
firebase deploy --only hosting:reelbaazar --project reelbaazar

# Landing
cd apps/landing-page && npx next build && cd ../..
firebase deploy --only hosting:reelbaazar-landing --project reelbaazar
```

For CI, create a token (`firebase login:ci`) and set `FIREBASE_TOKEN` — `deploy.sh` already
reads it.

### Android

```bash
cd apps/app
eas build --platform android --profile preview      # installable APK
eas build --platform android --profile production   # AAB for Play
```

EAS generates and stores the upload keystore on first run. Before a *useful* build exists:
- `apps/app/.env` with the `EXPO_PUBLIC_FIREBASE_*` values — without them the app boots to a
  sign-in screen that cannot sign in.
- `google-services.json` in `apps/app/`, from the Firebase console once an Android app is
  registered for `com.nhancio.rava`. `@react-native-google-signin` needs it.
- Real icons (see `apps/app/assets/images/README.md`).

### iOS

```bash
cd apps/app
eas build --platform ios --profile production
eas submit --platform ios --profile production --latest
```

Blocked until there is an Apple Developer Program membership. EAS needs to sign in to Apple
to create the bundle id, certificate and provisioning profile, and `eas submit` needs an App
Store Connect app record plus an API key. A **simulator** build needs none of that:

```bash
eas build --platform ios --profile development --local   # or add "simulator": true to a profile
```

### Store submission checklist

| Item | State |
|---|---|
| Account deletion in-app | Done — profile → Delete account |
| Report content / report user | Done — `POST /moderation/reports` |
| Block / unblock | Done — profile → Blocked accounts |
| Sign in with Apple | Done — `app/auth.tsx` |
| Terms & Privacy in-app | Done — `app/legal.tsx` (**draft, needs legal review**) |
| Privacy policy public URL | **Missing** — both stores require one; host at rava.one/privacy |
| Play Data Safety form | **Not filled** |
| App Store privacy questionnaire | **Not filled** |
| Age rating | **Not set** — UGC + shopping, likely 12+/T |
| Real icons and screenshots | **Missing** |
| Report-response process (24h) | **No owner assigned** — review asks how reports are handled |
