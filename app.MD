# Rava - Application Documentation

## What is Rava?

Rava is a **full-stack fashion e-commerce platform** connecting three user types:

- **Influencers** — Create and upload short fashion reels (TikTok/Instagram Reels-style videos) promoting products
- **Viewers** — Browse a fashion-only feed, like/save reels, and shop products directly
- **Brands** — Discover influencers, promote products, and initiate collaborations

Core value proposition: AI-powered matching between brands and influencers, with a built-in short-video feed for fashion content.

---

## Architecture

### Monorepo Structure

```
ReelBazzar/   # product: Rava
├── apps/
│   ├── web-app/              # React + Vite + Tailwind PWA (main frontend)
│   ├── landing-page/         # Next.js marketing site
│   └── mobile-app/           # React Native CLI (separate native app)
├── packages/
│   ├── ui/                   # Shared React UI components
│   ├── config/               # Shared types, constants, Firebase config
│   └── api/                  # API client (native fetch)
├── backend/
│   └── server/               # Express.js + Firebase Admin SDK
└── sample_data/              # Sample seed data
```

### Tech Stack

| Layer       | Technology                                      |
| ----------- | ----------------------------------------------- |
| Frontend    | React 18, Vite, Tailwind CSS, React Router v6   |
| Backend     | Node.js, Express 4.18, Firebase Admin SDK 12.0   |
| Database    | Firebase Firestore (NoSQL)                       |
| Storage     | Firebase Cloud Storage (videos + avatars)         |
| Auth        | Firebase Authentication (Google OAuth + Email)    |
| Mobile      | Capacitor (Android/iOS from web) + React Native  |
| API Client  | Native `fetch` (no Axios)                        |
| Monorepo    | Turbo                                            |

### Firestore Data Model

```
users/              → User profiles (influencer, viewer, brand)
reels/              → Fashion videos with metadata
reelLikes/          → Like records (doc ID: userId_reelId)
reelSaves/          → Save records (doc ID: userId_reelId)
reelViews/          → View tracking (doc ID: userId_reelId)
collaborations/     → Brand-influencer matches (doc ID: brandId_influencerId)
```

---

## Features Implemented

### Backend API Endpoints

**Auth**
- `POST /api/auth/register` — Register new user (defaults to influencer)
- `GET /api/auth/me` — Get current user profile
- `PATCH /api/auth/me` — Update profile fields

**Reels**
- `GET /api/reels` — Feed with cursor-based pagination + category filter
- `GET /api/reels/:id` — Single reel with creator data
- `GET /api/reels/user/:userId` — User's reels
- `POST /api/reels/upload` — Upload video (multipart → Firebase Storage)
- `POST /api/reels/:id/like` — Toggle like
- `POST /api/reels/:id/save` — Toggle save
- `POST /api/reels/:id/view` — Record view (once per user)
- `DELETE /api/reels/:id` — Delete reel + video from Storage

**Users**
- `GET /api/users/search?q=query` — Search users (client-side filtered, max 100)
- `GET /api/users/:id` — Get user profile + reel count

**Collaborations**
- `GET /api/collaborations/suggestions` — AI-matched suggestions (top 10 by score)
- `GET /api/collaborations` — User's collaborations
- `PATCH /api/collaborations/:id` — Accept/decline collaboration

**Upload**
- `POST /api/upload/avatar` — Upload avatar to Firebase Storage

### Frontend Pages

| Route                      | Page             | Description                                        |
| -------------------------- | ---------------- | -------------------------------------------------- |
| `/`                        | HomePage         | Infinite vertical-scroll feed with category tabs   |
| `/create`                  | CreateReelPage   | Video upload, product link, caption, category, tag |
| `/profile`                 | ProfilePage      | Own profile, reels, stats, sign out                |
| `/profile/:userId`         | ProfilePage      | Other user's profile                               |
| `/collaborations`          | CollaborationsPage| Suggested + active collaborations                 |

### Other Features

- **Google Sign-In** via Firebase
- **Demo Mode** — Fully functional offline experience with hardcoded data and LocalStorage persistence
- **AI Matching** — Scores brands and influencers by category overlap, age group, and gender alignment

---

## Bugs & Issues

### Critical

| # | Bug | Location | Impact |
|---|-----|----------|--------|
| 1 | Empty `catch {}` blocks — like/save failures are completely silent | `apps/web-app/src/pages/HomePage.tsx:92,109` | Users get no feedback on failed actions |
| 2 | Unsafe `data()!` non-null assertions — no existence checks on Firestore docs | `backend/server/src/routes/reels.ts`, `auth.ts` | Server crashes on missing data |
| 3 | Heavy use of `any` types across backend services | `backend/server/src/services/matching.ts`, `routes/reels.ts`, `routes/collaborations.ts` | Refactoring risk, runtime type errors |

### Security

| # | Issue | Location | Risk |
|---|-------|----------|------|
| 5 | Hardcoded Firebase API keys visible in repo | `backend/server/.env`, `apps/web-app/.env`, `.env.example` | Credential exposure |
| 6 | `.env` files not properly excluded from git | Root `.gitignore` | Secrets committed to version control |

### Performance

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| 7 | User search fetches ALL users (limit 100) and filters client-side | `backend/server/src/routes/users.ts:17` | Won't scale beyond 100 users |
| 8 | N+1 query pattern in collaboration fetching — separate fetch per user | `backend/server/src/routes/collaborations.ts:36-39,71-74` | Slow with many collaborations |
| 9 | Creator data enrichment fetches individually per reel | `backend/server/src/routes/reels.ts:30-34` | Could batch by unique creatorId |

### Functional Gaps

| # | Issue | Location |
|---|-------|----------|
| 10 | No React Error Boundaries — errors crash entire app | Web app route wrappers |
| 11 | No input validation on backend (email format, URL format, empty fields) | Auth + Reel routes |
| 12 | All seeded reels point to a likely non-existent demo video URL | `backend/server/src/seed.ts:127` |
| 13 | `thumbnailUrl` always null — no thumbnail generation | All reel creation paths |
| 14 | Bare `.catch()` calls silently swallowing errors | `HomePage.tsx` (and similar) |

### Code Quality

| # | Issue | Location |
|---|-------|----------|
| 15 | Unused utility files not imported anywhere | `backend/server/src/create_bucket.ts`, `check_buckets.ts`, `upload_videos.ts` |
| 16 | Avatar upload doesn't verify upload success before returning URL | `backend/server/src/routes/upload.ts` |
| 17 | Hardcoded production API URL | `packages/config/index.ts:13` (`https://reelbazar-backend.vercel.app/api`) |

---

## Yet-to-Implement Features

### High Priority (Revenue & Core UX)

| # | Feature | Description |
|---|---------|-------------|
| 1 | **Payment System** | No payment processing for collaborations. No Stripe/Razorpay integration. Influencers can't earn money despite value proposition |
| 2 | **Push Notifications** | No notifications for new matches or collaboration updates |
| 3 | **Comments on Reels** | Only likes/saves/views exist. No comment system |
| 4 | **Follow/Following System** | No follow/unfollow. No follower counts on profiles |
| 5 | **Video Processing** | No compression, transcoding, or thumbnail generation. Videos served as uploaded |

### Medium Priority (Growth & Engagement)

| # | Feature | Description |
|---|---------|-------------|
| 7 | **Analytics Dashboard** | No reel performance analytics (views over time, engagement). Brands can't see conversion rates |
| 8 | **Hashtag/Trending System** | No hashtag support. No trending reels section |
| 9 | **Reel Sharing** | Can share product links but not reels themselves |
| 10 | **Advanced Filtering** | Can't filter by engagement, date, influencer stats, or follower count |
| 11 | **Campaign Management** | Collaborations only have accept/decline. No briefs, budgets, deliverables, or deadlines |
| 12 | **Content Moderation** | No flagging, reporting, or approval workflows |
| 13 | **Influencer Verification/Tiers** | No verification badges or tier-based matching |

### Lower Priority (Polish & Scale)

| # | Feature | Description |
|---|---------|-------------|
| 15 | **Geographic Targeting** | No location-based matching. Brands can't filter by geography |
| 16 | **Multi-language Support** | Hard-coded English only |
| 17 | **Dark Mode Toggle** | Fixed dark theme, no switcher |
| 18 | **Offline Sync** | Demo mode works offline, but prod requires internet. No offline queue |
| 19 | **Block/Report Users** | No block list or report mechanism |
| 20 | **Contract/Agreement Management** | No templates or e-signing for collaborations |
| 21 | **Brand Portfolio/Case Studies** | Brands can't showcase past work |
| 22 | **Reel Series/Episodes** | No way to group reels into series |
| 23 | **Affiliate/Referral System** | No referral codes or affiliate earnings |

---

## Completion Status

| Area | Status | Estimate |
|------|--------|----------|
| Core App (MVP) | Functional with demo mode | ~70% |
| Production Readiness | Missing error handling, validation, monitoring | ~50% |
| Feature Completeness | Many revenue and premium features missing | ~30% |

### Recommended Fix Order

1. **Fix error handling & validation** — Prevents crashes and silent failures
2. **Secure credentials** — Remove hardcoded keys, fix .gitignore
3. **Implement notifications** — Drives engagement
4. **Add payment system** — Enables the business model
5. **Build analytics** — Business intelligence for brands
6. **Video processing pipeline** — Thumbnails, compression, quality
