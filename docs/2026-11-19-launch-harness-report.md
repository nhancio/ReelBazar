# Rava — 8-Point Play Store & App Store Launch-Readiness Report

Date: 2026-11-19  
Target: `Rava/apps/app/` (Expo SDK 56 · `com.nhancio.rava` · v1.0.0 · Android `versionCode: 1` · iOS `buildNumber: 4`) + `Rava/apps/landing-page/` (`rava.one`) + `Rava/backend/server/`

## Summary Scorecard

| # | Check | Status | Headline |
|---|---|---|---|
| 1 | **UI** | **PASS (after fixes)** | Safe areas fixed on 9:16 player, light-theme cold-start overwrite fixed, dead guest-mode Settings button fixed; dark/light themes, `expo-video`, `ErrorBoundary`, and native tabs/controls verified. |
| 2 | **SEO** | **WARN** | Landing page has full metadata, OG, JSON-LD, `robots.ts`, `sitemap.ts`; `+html.tsx` fixed for pinch-zoom + title/description/OG. Minor gaps: `apps/app/public/site.webmanifest` missing, `SITE_DESCRIPTION` is 182 chars (>160), unused `Footer.tsx` has `#` links, and `rava.one/` currently redirects canonical to `/myacc`. |
| 3 | **Security** | **WARN** | Firestore/Storage rules strong; fixed UGC Report/Block UI + feed filtering, direct-upload rule mismatch in `create.tsx`, and pending-payout double-withdrawal bug. Remaining: `backend/server/serviceAccountKey.json` & `.env*` exist locally on disk (gitignored, never committed), `.envrc` not in `.gitignore`, backend `GET /reels` does not filter blocked creators server-side, and `DELETE /users/me` does not purge `blocks`/`reports`/avatar object. |
| 4 | **Terms & Conditions** | **WARN** | In-app `legal.tsx` + public `rava.one/privacy`, `rava.one/terms`, `rava.one/delete-account` exist; removed bracketed placeholders from `legalContent.ts`, allowed `/legal` pre-login, added Terms/Privacy links on `/auth`. Needs lawyer sign-off + named Grievance Officer under India IT Rules 2021 + live deployment check of `rava.one/privacy` & `rava.one/delete-account`. |
| 5 | **Payments** | **PASS (with ops check)** | Physical fashion goods only (shipping address + 6-digit Indian pincode + courier tracking required); Razorpay (`react-native-razorpay` native + checkout.js web) is compliant with Apple 3.1.3(e) & Play Billing physical-goods exemptions. Demo mode is blocked in production (`orderLogic.ts`). Confirm live Razorpay keys & webhook secret are set in Cloud Functions. |
| 6 | **Widgets** | **N/A** | No iOS WidgetKit / Android AppWidget / Glance targets or widget components exist in `Rava/apps/app/`. |
| 7 | **Screens** | **PASS** | **18/18 route files implemented — 0 `NotPortedYet` stubs remain** (`docs/EXPO_MIGRATION.md` §3 is outdated). |
| 8 | **Logo & Assets** | **PASS (visual polish optional)** | Real Rava pink shopping-bag brand icons generated (not placeholders) and pass all `buildAssets.js --check` + `playStorePreflight.js` dimension/alpha checks. Minor JPEG-extraction white halo on dark icon/feature graphic; store screenshots not yet present in repo. |

---

## Detailed 8-Point Audit

### 1. UI Check — PASS (after fixes)
- **Theme (`dark` / `light`):** Full semantic `Palette` in `apps/app/theme/colors.ts` + `ThemeContext.tsx`. **Fixed bug:** `ThemeProvider` mounted before `hydrateStorage()` resolved, resetting a saved `'light'` preference back to `'dark'` on every cold launch.
- **Safe Areas:** All standard screens use `useSafeAreaInsets()`. **Fixed bug:** `components/ReelPlayer916.tsx` used hardcoded `top: 52` for the mute button (overlapped iPhone Dynamic Island at `insets.top = 59`) and hardcoded `bottom: 92`/`106` without `insets.bottom`.
- **Guest Mode UX:** **Fixed bug:** `app/(tabs)/profile.tsx` rendered a Settings icon in guest mode whose modal lived below the early return, making the button a dead tap.
- **Video Player:** `ReelPlayer916.tsx` & `ReelVideo.tsx` use `expo-video` with `loop`, `muted`, viewability-driven play/pause + rewind, `allowsPictureInPicture={false}`, and bounded `FlatList` window (`windowSize={3}`).
- **Accessibility & Error Handling:** Root `ErrorBoundary` wraps the entire tree; `Button`, tabs, and moderation controls set `accessibilityRole` / `accessibilityLabel`. Removed `user-scalable=no` from `app/+html.tsx`.

### 2. SEO Check — WARN
- **Landing page (`apps/landing-page/`):**
  - `src/app/layout.tsx` & `src/lib/seo.ts`: Complete `metadataBase`, Open Graph, Twitter cards, JSON-LD (`Organization`, `WebSite`, `MobileApplication`, `SoftwareApplication`), `robots.ts` (including AI crawlers), and `sitemap.ts` (`/`, `/myacc`, `/privacy`, `/terms`, `/delete-account`).
  - **Warnings (not edited to respect uncommitted user work in `apps/landing-page/`):**
    - `SITE_DESCRIPTION` is 182 chars (comment notes `<=160`).
    - `openGraph.images` / `twitter:card: summary_large_image` uses a 512×512 square JPEG (`logo/logo.jpeg`) instead of a 1200×630 OG image.
    - `src/app/page.tsx` currently renders `<MyAcc />` with `alternates: { canonical: "/myacc" }` (intentional temporary homepage swap, but verify before Play/App Store reviewers visit `rava.one`).
    - `src/components/Footer.tsx` (currently unused) has placeholder `href="#"` links.
- **Expo Web (`apps/app/app/+html.tsx`):**
  - **Fixed:** Added `<title>`, `<meta name="description">`, `og:*`, and `twitter:*` tags; removed `maximum-scale=1, user-scalable=no`.
  - **Warning:** `+html.tsx` links `/site.webmanifest` and `/favicon.ico`, but `apps/app/public/` does not exist (Expo web export only copies `apps/app/public/`, not the monorepo root).

### 3. Security Check — WARN
- **Firestore & Storage Rules (`Rava/firestore.rules`, `Rava/storage.rules`):**
  - Strong default-deny rules; social counters bounded to `±1`; commerce collections (`products`, `orders`, `payouts`, `reelClicks`, `streakEvents`) are backend-Admin-SDK-only; Storage enforces owner-scoped paths, MIME types, and size limits (50 MB video / 10 MB image).
  - **Fixed rule mismatches in app code:**
    - `app/(tabs)/create.tsx` direct-upload fallback wrote to `reels/{fileId}_...` (denied by `storage.rules`, which requires `reels/{uid}/...`) and `caption: null` (denied by `firestore.rules`, which requires `caption is string`). Fixed both.
    - `app/(tabs)/index.tsx` (`trackView`) and `app/reel/[reelId].tsx` (`onProductLinkPress`) attempted direct Firestore `updateDoc` on `viewsCount`/`clicksCount` (silently denied by `firestore.rules`). Switched to `reelsApi.view()` and `reelsApi.click()`.
- **UGC Moderation (App Store Guideline 1.2 / Play UGC Policy):**
  - **Critical blocker fixed:** Backend `POST /moderation/reports`, `POST /moderation/blocks/:id`, and `GET /moderation/blocks` existed, and `app/blocked.tsx` existed, **but no UI anywhere in `apps/app/` let a user report a reel/user or block a creator**, nor did the feed filter blocked users.
  - Added reusable `components/ModerationSheet.tsx` and wired Report + Block into `ReelPlayer916.tsx` / `app/(tabs)/index.tsx` (with immediate feed removal + blocked-ID filtering), `app/reel/[reelId].tsx`, and `app/profile/[userId].tsx`.
  - **Remaining gap:** Backend `GET /reels` and `GET /reels/search` do not filter blocked users server-side (client feed filters them).
- **Account Deletion (`DELETE /users/me`):**
  - Wired from Profile → Settings → Delete account with destructive confirmation; deletes reels + videos, likes, saves, views, comments, follows, streakEvents, products, user doc, and Firebase Auth account.
  - **Minor gap:** Does not yet delete `blocks`, `reports`, `collaborations`, or the user's avatar file from Storage.
- **Payout Security (`backend/server/src/routes/payouts.ts`):**
  - **Fixed bug:** `paidOutRequests` only subtracted `['completed', 'processing']` requests, ignoring `'pending'` requests and allowing duplicate withdrawal submissions for the same balance. Now includes `'pending'`.
- **Secrets & Committed Credentials Audit (NO secrets printed or deleted):**
  - `git ls-files` & `git log --all` confirmed: `backend/server/serviceAccountKey.json`, `backend/server/.env`, `apps/app/.env`, `apps/app/google-play-service-account.json`, `GoogleService-Info.plist`, `google-services.json`, and `apps/app/credentials/ios/*` are **NOT tracked in git and have NEVER been committed in git history**.
  - They **do exist locally on disk** (gitignored): `backend/server/serviceAccountKey.json`, `backend/server/.env`, `backend/server/.env.bak`, `apps/app/.env`, `apps/app/google-play-service-account.json`, `apps/app/credentials/ios/*`, plus duplicate `GoogleService-Info.plist` / `google-services.json` at repo root and in `apps/app/`.
  - `apps/web-app/.env.production` is tracked in git (contains only public client `VITE_*` Firebase/origin keys, no private keys).
  - **Flag:** `.envrc` exists at `Rava/.envrc` and is not listed in `Rava/.gitignore` (currently untracked, add to `.gitignore` if it holds env vars).
  - **Pre-existing backend test failure:** `backend/server/src/instagramPublicProfile.test.ts` fails 1 test (`parsePublicProfileHtml reads og:description follower counts`, unrelated to mobile store launch, part of uncommitted `/myacc` work).

### 4. Terms & Conditions Check — WARN
- **In-app (`app/legal.tsx` + `lib/legalContent.ts`):** Covers age limits (13+ / 18+ commerce), content licensing, prohibited UGC, 24h moderation/reporting/blocking, physical-goods seller terms, creator earnings, account deletion, privacy, and retention.
  - **Fixed:** Replaced literal placeholders `[LEGAL ENTITY NAME]` and `Grievance Officer: [NAME], [EMAIL]` with `Nhancio (operating Rava)` and the designated grievance contact (`shopatrava@gmail.com`, matching `rava.one/privacy`).
  - **Fixed:** `app/_layout.tsx` previously blocked unauthenticated access to `/legal`; now `/legal` is accessible before login and linked directly on `app/auth.tsx` ("By continuing you agree to our Terms & Privacy Policy").
- **Web legal pages (`apps/landing-page/src/app/{privacy,terms,delete-account}/page.tsx`):** All three exist and are built into `apps/landing-page/out/`.
- **Remaining:** Legal review of copy, exact registered legal entity name + named individual Grievance Officer (India IT Rules 2021), and confirming `https://rava.one/privacy`, `https://rava.one/terms`, and `https://rava.one/delete-account` are live and returning HTTP 200 on Firebase Hosting.

### 5. Payments Check — PASS (with ops verification)
- **Compliance (Apple Guideline 3.1.3(e) & Google Play Billing):** All checkout flows (`ProductPurchaseDrawer.tsx`, `RazorpayCheckoutModal.tsx`, `backend/server/src/routes/orders.ts`) are strictly for **physical fashion goods** requiring a full Indian shipping address + 6-digit pincode + courier fulfillment tracking (`packed` → `shipped` → `out_for_delivery` → `delivered`). No digital goods, subscriptions, coins, or feature unlocks are sold. External payment via Razorpay (`react-native-razorpay` native, `checkout.js` web) is compliant.
- **Safety:** `orderLogic.ts` disables demo/sandbox payments whenever `NODE_ENV === 'production'` or `K_SERVICE` (Cloud Functions) is set (verified by `orderLogic.test.ts`: 3/3 passing). iOS `LSApplicationQueriesSchemes: ['tez', 'phonepe', 'paytmmp']` and Android R8 ProGuard keep rules for `com.razorpay.**` are configured in `app.config.js`.
- **Ops check before launch:** Ensure live `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET` are configured on the deployed Cloud Function (otherwise `/orders/checkout` returns HTTP 503 in production).

### 6. Widgets Check — N/A
- No iOS WidgetKit extensions, Android AppWidgets, Jetpack Glance widgets, or Expo widget plugins exist anywhere in `Rava/apps/app/`.

### 7. Screens Check — PASS (18/18 Ported, 0 `NotPortedYet` Stubs)

| Route File | Status | Notes |
|---|---|---|
| `app/_layout.tsx` | Implemented | Root providers, splash gating, `ErrorBoundary`, auth/onboarding routing (fixed `/legal` pre-login + theme hydration). |
| `app/+html.tsx` | Implemented | Expo web HTML shell (fixed pinch-zoom + title/description/OG tags). |
| `app/+not-found.tsx` | Implemented | 404 fallback screen linking back to feed. |
| `app/auth.tsx` | Implemented | Google Sign-In, Sign in with Apple (iOS), Guest mode, Terms & Privacy links (added). |
| `app/onboarding.tsx` | Implemented | Username, Persona (Creator/Brand/User), Interest chips, Firestore + backend sync. |
| `app/legal.tsx` | Implemented | Terms & Privacy viewer (`?doc=terms` / `?doc=privacy`). |
| `app/blocked.tsx` | Implemented | Blocked accounts list with optimistic unblock. |
| `app/(tabs)/_layout.tsx` | Implemented | `NativeTabs` on iOS/Android (Home, AI, Create, Search, Profile; Collaborations hidden); Liquid Glass capsule bar on web. |
| `app/(tabs)/index.tsx` | Implemented | Full 9:16 vertical reel feed, category filters, like/save, shoppable drawer, Report/Block + blocked-user filtering (added). |
| `app/(tabs)/ai.tsx` | Implemented | "Ask Rava" AI stylist search with prompts + voice input (`useVoiceInput`). |
| `app/(tabs)/create.tsx` | Implemented | Video picker/preview, brand catalog product tagging, upload progress, Storage/Firestore fallback (fixed rules mismatch). |
| `app/(tabs)/search.tsx` | Implemented | Discover/search grid with debounced search + category chips. |
| `app/(tabs)/collaborations.tsx` | Implemented | Brand/creator match suggestions & active collaborations (reachable via Profile → Settings). |
| `app/(tabs)/profile.tsx` | Implemented | Posts/Saved/Creator Earnings/Brand Hub tabs, edit profile, add product, payouts, order fulfillment, Settings, Delete Account (fixed guest Settings modal). |
| `app/reel/[reelId].tsx` | Implemented | Single reel view, comments drawer, follow, instant checkout drawer, Report/Block menu (added). |
| `app/profile/[userId].tsx` | Implemented | Public creator/brand profile, follow/followers/following, reels grid, Report/Block menu (added). |
| `app/orders/index.tsx` | Implemented | Buyer order history with All / Active / Delivered filters. |
| `app/orders/[orderId].tsx` | Implemented | Live order tracking timeline, courier/AWB info, address & payment breakdown. |

### 8. Logo & Assets Check — PASS (polish optional)
- Verified real Rava brand mark (pink shopping bag) — **not** placeholders — across all 7 required assets:
  - `assets/images/icon.png` — 1024×1024, opaque (`hasAlpha=no`), 146 KB
  - `assets/images/android-icon-foreground.png` — 432×432, transparent (`hasAlpha=yes`), safe-zone centered, 29 KB
  - `assets/images/android-icon-monochrome.png` — 432×432, white silhouette (`hasAlpha=yes`), 8.4 KB
  - `assets/images/splash-icon.png` — 512×512, transparent (`hasAlpha=yes`), 41 KB
  - `assets/images/favicon.png` — 196×196, 28 KB
  - `assets/store/google-play-icon-512.png` — 512×512, 53 KB
  - `assets/store/google-play-feature-graphic.png` — 1024×500, opaque (`hasAlpha=no`), 28 KB
- **Visual polish note:** `icon.png` and `google-play-feature-graphic.png` show a faint light fringe around the pink stroke on `#000000` (artifact of chroma-keying `public/logo/logo.jpeg`), and the feature graphic is a plain auto-generated logo on black. Dropping a clean transparent PNG master in `assets/source/icon-source.png` + custom `feature-graphic-source.png` and re-running `npm run assets:generate` will make them crisp. Store screenshots are not yet checked into `apps/app/`.

---

## Fixes Applied in This Harness Run

1. `Rava/apps/app/components/ModerationSheet.tsx` *(new)* — Reusable UGC Report (8 backend-aligned reasons) & Block bottom sheet.
2. `Rava/apps/app/components/ReelPlayer916.tsx` — Added safe-area insets for mute button & bottom overlays; added UGC moderation (`...`) action button on right rail.
3. `Rava/apps/app/app/(tabs)/index.tsx` — Wired `ModerationSheet`, loaded/filtered blocked users in feed, switched `trackView` to `reelsApi.view()`.
4. `Rava/apps/app/app/reel/[reelId].tsx` — Wired `ModerationSheet` in header; switched click tracking to `reelsApi.click()`.
5. `Rava/apps/app/app/profile/[userId].tsx` — Wired `ModerationSheet` in header for reporting/blocking other accounts.
6. `Rava/apps/app/app/(tabs)/profile.tsx` — Fixed dead Settings button in guest mode by rendering a guest-safe Settings modal (Appearance + Legal + Sign in).
7. `Rava/apps/app/context/ThemeContext.tsx` & `Rava/apps/app/app/_layout.tsx` — Fixed cold-start theme hydration race (prevented overwriting saved `'light'` theme); allowed unauthenticated navigation to `/legal`.
8. `Rava/apps/app/app/auth.tsx` — Added Terms & Privacy Policy links on sign-in screen.
9. `Rava/apps/app/app/(tabs)/create.tsx` — Fixed direct-upload fallback Storage path (`reels/{uid}/...`) and Firestore `caption` type (`""` instead of `null`) to comply with `storage.rules` and `firestore.rules`.
10. `Rava/apps/app/lib/legalContent.ts` — Removed literal `[LEGAL ENTITY NAME]` and `[NAME], [EMAIL]` placeholders to match `rava.one/privacy`.
11. `Rava/apps/app/app/+html.tsx` — Removed `maximum-scale=1, user-scalable=no`; added `<title>`, description, OG, and Twitter meta tags.
12. `Rava/backend/server/src/routes/payouts.ts` — Included `'pending'` payout requests when computing `pendingBalance` to prevent double withdrawals.

### Verification Results
- `apps/app`: `npm run typecheck` (`tsc --noEmit`) — **PASS (0 errors)**
- `apps/app`: `npm run lint` (`expo lint --max-warnings 0`) — **PASS (0 warnings, 0 errors)**
- `apps/app`: `node scripts/buildAssets.js --check` — **PASS**
- `apps/app`: `node scripts/playStorePreflight.js` — **PASS (with dirty-git warning)**
- `apps/app`: `node scripts/releasePreflight.js` — **PASS (all native Expo modules match SDK 56; dirty-git warning)**
- `apps/landing-page`: `npm run typecheck` — **PASS (0 errors)**
- `backend/server`: `npm run typecheck` — **PASS (0 errors)**
- `backend/server`: `npx tsx --test src/orderLogic.test.ts` — **PASS (3/3)** *(Note: pre-existing `src/instagramPublicProfile.test.ts` has 1 failing test in uncommitted `/myacc` code)*

---

## Remaining Work / Blockers to Ship to Play Store & App Store Today

1. **Commit clean release state:** Commit (or stash) pending changes; `release:build:*:eas` requires `--require-clean`.
2. **Deploy updated backend + rules + landing page:**
   - Deploy `backend/server` (includes the payout fix + moderation routes) and confirm live `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` are configured.
   - Verify `https://rava.one/privacy`, `https://rava.one/terms`, and `https://rava.one/delete-account` are live (HTTP 200) and linked in both store consoles.
3. **Store console metadata & review requirements:**
   - Fill Google Play **Data Safety** form, **App Access** (demo reviewer credentials or note guest browsing), **Content Rating** (12+/Teen for UGC + shopping), and **Account Deletion URL** (`https://rava.one/delete-account`).
   - Fill App Store Connect **App Privacy** questionnaire, **Age Rating**, **Support/Privacy URLs**, and **App Review Notes** (include test account + note 24h UGC moderation owner & physical-goods-only Razorpay checkout).
   - Capture & upload required iOS (6.7" / 6.5") and Google Play phone screenshots (none currently in repo).
4. **Legal & Moderation Ops:**
   - Assign an operational owner monitoring Firestore `reports` collection to act within 24 hours (App Store 1.2 / Play UGC policy).
   - Have legal counsel confirm exact registered corporate entity name & named Grievance Officer (India IT Rules 2021) in `legalContent.ts` and `rava.one/privacy`.
5. **Toolchain & Credentials:**
   - Build with **Node 20.19** (`.nvmrc`; machine currently runs Node 24.22.1, flagged by `engines` for SDK 56).
   - Verify EAS secrets (`GOOGLE_SERVICES_JSON`, `GOOGLE_SERVICES_INFO_PLIST`, `EXPO_PUBLIC_*`) match production Firebase project `reelbaazar` and Sign in with Apple is enabled in Firebase Auth Console.
   - Confirm whether `backend/server/serviceAccountKey.json` should stay local or be removed from disk once Cloud Functions ADC is used everywhere.
