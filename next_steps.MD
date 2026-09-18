# Rava — Next Steps, Roadmap & Monetisation Plan

> Last updated: June 2026  
> Current status: **Functional MVP (~65% complete)** — demo-ready, not production-ready

## 24 August 2026 Reconciliation

The June inventory below is historical and must not be treated as the current code state without checking it first.

Verified now:

- [x] Backend TypeScript build passes (`npm run build --workspace=server`).
- [x] Current Expo app TypeScript check passes (`npm run typecheck --workspace=app`).
- [x] Web and Expo route trees have error boundaries and toast/error paths.
- [x] Comments API and UI foundations exist.
- [x] Avatar/reel uploads await Storage completion and validate MIME type plus file signature.
- [x] Same-origin API configuration replaced the old hardcoded production URL fallback.

Current credential-independent priorities:

- [ ] Add the missing server-side video thumbnail/compression pipeline; `thumbnailUrl` is still written as `null`.
- [ ] Add focused backend tests for upload, comments, paid-order, and authorization failure paths.
- [ ] Verify the Expo feed/upload/profile journey on signed Android hardware and record iOS as a separate gate.
- [ ] Re-audit secrets and Firebase/OAuth/domain state in the live consoles; local source inspection is not live verification.
- [ ] Prove one creator upload → brand discovery → campaign → paid collaboration loop before expanding growth features.

---

## 1. Where Things Stand Right Now

| Layer | Status | Notes |
|---|---|---|
| Web App (React) | ✅ Feature-complete | 8 pages, all core interactions work |
| Backend API (Express) | ✅ Solid | Validation, rate limiting, auth middleware in place |
| Landing Page (Next.js) | ✅ Done | Hero, How It Works, Demo Reels, CTAs |
| UI Component Library | ✅ Done | 10 shared components |
| Mobile App (React Native) | ⚠️ Scaffold only | Screens exist, no real API integration |
| Video Processing | ❌ Missing | No thumbnails, no compression |
| Payments | ❌ Missing | No way for anyone to earn money |
| Notifications | ❌ Missing | No FCM, no in-app alerts |
| Comments | ❌ Missing | Likes/saves exist, comments do not |
| Analytics | ❌ Missing | No dashboards for brands or creators |

---

## 2. Critical Bugs to Fix First (Before Any New Features)

These can cause crashes, data loss, or security incidents. Fix before any user testing.

### 2.1 App-Crashing Issues
- **Empty `catch {}` blocks** — like/save failures are completely silent. Users think the action succeeded when it didn't.  
  Files: `apps/web-app/src/pages/HomePage.tsx` lines 92, 109  
  Fix: Show a toast/snackbar on failure, log errors.

- **Unsafe `data()!` non-null assertions** — no Firestore doc existence checks. Any missing document crashes the server.  
  Files: `backend/server/src/routes/reels.ts`, `auth.ts`  
  Fix: Add `if (!docSnap.exists())` checks everywhere before calling `.data()`.

- **No React Error Boundaries** — one unhandled error kills the entire app.  
  Fix: Wrap route-level components in `<ErrorBoundary>` with a fallback UI.

### 2.2 Security Issues
- **Hardcoded Firebase API keys in repo** — `backend/server/.env`, `apps/web-app/.env`  
  Fix: Rotate keys, move to environment variables, ensure `.env` is in `.gitignore`.

- **Hardcoded production API URL** — fixed: `packages/config/index.ts:13` now defaults to `/api/v1`.  
  Follow-up: Keep using environment overrides only when a deployment is not same-origin with Firebase Hosting.

### 2.3 Scalability Issues
- **User search fetches all users (limit 100), filters client-side** — `backend/server/src/routes/users.ts:17`  
  Fix: Add a Firestore index on `username` and use `startAt`/`endAt` for prefix search.

- **N+1 query pattern in collaborations** — separate DB fetch per user in the listing.  
  Files: `backend/server/src/routes/collaborations.ts:36-39, 71-74`  
  Fix: Batch fetch all userIds with `getAll()`.

---

## 3. Phase 1 — Production Hardening (2–3 weeks)

Make the app safe and stable for real users.

| Task | Effort | Why |
|---|---|---|
| Fix all critical bugs above | 3 days | Prevents crashes and data corruption |
| Add input validation (email format, URL format, empty fields) | 2 days | Auth + Reel routes have none |
| Remove hardcoded credentials, fix env setup | 1 day | Security |
| Add React Error Boundaries to all routes | 1 day | Prevents full-app crashes |
| Implement video thumbnail generation | 3 days | Every reel thumbnail is currently `null` — feed looks broken |
| Fix `thumbnailUrl` pipeline — generate server-side on upload | 2 days | Tied to above |
| Add basic error logging (Sentry or similar) | 1 day | Currently flying blind on production errors |
| Replace `any` types in backend services | 2 days | `matching.ts`, `reels.ts`, `collaborations.ts` — refactoring risk |

**Deliverable:** An app that won't randomly crash and looks correct with real content.

---

## 4. Phase 2 — Core Missing Features (4–6 weeks)

Features needed before growth or monetisation can happen.

### 4.1 Comments System
- Firestore collection: `reelComments/{commentId}` with `reelId`, `authorId`, `text`, `createdAt`
- Backend: `POST /reels/:id/comments`, `GET /reels/:id/comments` (paginated)
- Frontend: Comment drawer on SingleReelPage and HomePage overlay
- Moderation: Flag/delete by creator or admin
- **Effort:** ~1 week

### 4.2 Push Notifications (Firebase Cloud Messaging)
- Trigger events: new collaboration match, collaboration accepted/declined, new follower, reel liked by brand
- Backend: FCM token stored per user, notification service layer
- Frontend: Permission request on login, notification bell in header
- **Effort:** ~1 week

### 4.3 Video Processing Pipeline
- On upload: generate thumbnail (FFmpeg or cloud function), compress video to 720p
- Store both `thumbnailUrl` and compressed `videoUrl` in Firestore
- Consider: Firebase Cloud Functions triggered on Storage upload
- **Effort:** ~1.5 weeks

### 4.4 Analytics Dashboard for Creators & Brands
- Creator view: views/likes/saves over time per reel, follower growth, top performing content
- Brand view: impression counts per collaboration, click-through rate on product links, top creators by engagement
- Backend: Aggregation queries + time-series snapshots
- Frontend: Charts (Recharts or Chart.js), new `/analytics` page
- **Effort:** ~2 weeks

### 4.5 Campaign Management (Upgrade to Collaborations)
- Current state: brands just accept/decline
- Needed: collaboration briefs (description, deliverables, deadline, budget), status tracking (draft → sent → negotiating → active → completed)
- New Firestore fields on `collaborations/`: `brief`, `budget`, `deadline`, `deliverables[]`, `status` (expanded)
- Frontend: Campaign creation form for brands, timeline view for creators
- **Effort:** ~1.5 weeks

---

## 5. Phase 3 — Monetisation (6–10 weeks)

How Rava makes money. Three revenue streams.

### 5.1 Stream 1 — Brand Subscription (Primary Revenue)

**Model:** Brands pay a monthly SaaS fee to access the platform and initiate collaborations.

| Tier | Price/month | Features |
|---|---|---|
| Starter | ₹2,999 / $35 | Up to 5 active collaborations, basic analytics |
| Growth | ₹7,999 / $95 | Up to 20 collaborations, advanced analytics, priority matching |
| Enterprise | ₹24,999 / $299 | Unlimited, campaign management, dedicated support |

**Implementation:**
- Integrate Razorpay (India) + Stripe (global)
- New `subscriptions/` Firestore collection: `brandId`, `plan`, `status`, `currentPeriodEnd`
- Backend middleware: check brand subscription before allowing collaboration creation
- Frontend: `/pricing` page on landing site, billing portal in dashboard

**Effort:** ~3 weeks

### 5.2 Stream 2 — Platform Fee on Paid Collaborations

**Model:** When a brand pays a creator through the platform, Rava takes 10–15% commission.

- Add `paymentAmount` to collaboration documents
- Escrow: brand deposits funds → creator gets paid on completion → Rava takes cut
- Razorpay Route / Stripe Connect for multi-party payouts
- Dispute resolution flow

**Effort:** ~3 weeks (after subscription system exists)

### 5.3 Stream 3 — Promoted Reels / Boosted Visibility

**Model:** Creators or brands pay to feature a reel at the top of the feed or in a "Promoted" section.

- New collection: `promotedReels/` with `reelId`, `budget`, `startDate`, `endDate`, `category`
- Feed algorithm: inject promoted reel every N organic reels
- Simple ad-booking UI: pick reel, set budget, pick dates, pay
- Analytics: impressions, clicks, CPM

**Effort:** ~2 weeks

---

## 6. Phase 4 — Mobile App (4–6 weeks)

The mobile app is currently a scaffold. Full implementation needed.

### Priority order:
1. **API integration** — connect all 5 screens to real backend (currently all hardcoded)
2. **Video feed** — infinite scroll, autoplay, like/save/view on mobile
3. **Video upload** — camera capture + gallery picker, upload to Firebase Storage
4. **Push notifications** — FCM integration for iOS + Android
5. **Follow system** — follow/unfollow from mobile
6. **Deep linking** — share reel URL that opens in app

### iOS vs Android:
- Currently only Android has been tested (Maestro test files exist)
- Need to run and fix iOS build separately
- App Store / Play Store submission checklist should be drafted

---

## 7. Phase 5 — Growth Features (Ongoing)

Nice-to-have features that increase engagement and retention.

| Feature | Impact | Effort |
|---|---|---|
| Hashtag support + trending page | High | Medium |
| Reel sharing (native share sheet) | High | Low |
| Block/report users | Medium | Medium |
| Creator verification badges | Medium | Low |
| Geographic targeting for collaborations | Medium | Medium |
| Influencer tiers (nano/micro/macro by follower count) | Medium | Low |
| Dark/light theme toggle (currently fixed dark) | Low | Low |
| Multi-language support | Low | High |
| Affiliate / referral system | Medium | High |
| Follow recommendations ("people you may know") | High | Medium |
| DM / direct messaging | High | High |

---

## 8. Technical Debt to Clear

| Item | Files |
|---|---|
| Delete unused utility files never imported | `backend/server/src/create_bucket.ts`, `check_buckets.ts`, `upload_videos.ts` |
| Fix Firebase project ID typo | `.firebaserc` has `reelbaazar` (double 'a') — confirm if intentional |
| Avatar upload doesn't verify success before returning URL | `backend/server/src/routes/upload.ts` |
| `thumbnailUrl` field is always `null` in all seeded data | `backend/server/src/seed.ts:127` |
| Mobile app has hardcoded `localhost:4000` API URL | `apps/mobile-app` |
| Replace all `any` types in backend | `matching.ts`, `reels.ts`, `collaborations.ts` |
| User search doesn't scale | `backend/server/src/routes/users.ts:17` |

---

## 9. Recommended Work Order

```
Week 1–2   Fix all critical bugs → secure credentials → add error logging
Week 3     Video thumbnails → error boundaries → input validation
Week 4–5   Comments system → push notifications
Week 6     Analytics dashboard (basic version)
Week 7–8   Campaign management upgrades to collaborations
Week 9–10  Razorpay/Stripe subscription billing (Brand Tier 1)
Week 11–12 Platform fee on paid collaborations
Week 13    Promoted reels / boosted visibility
Week 14–18 Mobile app full implementation
Week 19+   Growth features (hashtags, DMs, referrals, etc.)
```

---

## 10. What Would Make This Investor-Ready

- [ ] Fix all critical bugs (no more silent failures or crashes) <!-- clickup_id: 86d3u98x6 -->
- [ ] Real users in the system (even 50–100 real creators and 5–10 real brand accounts) <!-- clickup_id: 86d3u98x7 -->
- [ ] At least one completed brand–creator paid collaboration as proof of monetisation <!-- clickup_id: 86d3u98x8 -->
- [ ] Analytics showing engagement metrics (even basic) <!-- clickup_id: 86d3u98x9 -->
- [ ] Mobile app working end-to-end (at least on Android) <!-- clickup_id: 86d3u98xa -->
- [ ] Clean `.env` setup — no credentials in repo <!-- clickup_id: 86d3u98xd -->
- [ ] Basic unit/integration tests on backend (currently zero tests) <!-- clickup_id: 86d3u98xj -->
- [ ] A short demo video showing the full loop: creator uploads → brand discovers → collaboration initiated → brand pays <!-- clickup_id: 86d3u98xp -->

---

## 11. Quick Wins (Can Be Done in 1–2 Days Each)

- Add toast notifications for like/save success/failure (currently silent errors)
- Show reel count on profile cards in DiscoverPage
- Add loading skeletons to feed so it doesn't flash blank
- Add character counter to caption field on CreateReelPage
- Show "Verified Brand" badge for accounts with active subscription
- Add `createdAt` relative timestamp on reels ("2 days ago")
- Fix the category constants — currently only `['Men', 'Women', 'Kids']`; add `Accessories`, `Footwear`, `Beauty`
