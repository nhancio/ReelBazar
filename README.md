# ReelBazaar - Fashion PR Reels Platform

A full-stack monorepo platform where influencers upload reels promoting fashion products, users scroll a fashion-only reels feed, and brands connect with influencers for collaborations.

## Tech Stack

- **Monorepo**: Turborepo
- **Backend**: Node.js + Express + Firebase Admin (Firestore + Storage + Auth)
- **Database**: Firebase Firestore
- **File Storage**: Firebase Storage
- **Web App**: React + Vite (PWA) + Tailwind CSS
- **Landing Page**: Next.js + Tailwind CSS
- **Mobile App**: React Native CLI (no Expo)
- **Auth**: Firebase Authentication
- **Mobile Deployment**: Capacitor (Android + iOS)
- **API Client**: Native `fetch` (no Axios)

## Project Structure

```
ReelBazaar/
├── apps/
│   ├── web-app/          # PWA (React + Vite + Tailwind)
│   ├── landing-page/     # Marketing site (Next.js)
│   └── mobile-app/       # React Native CLI app
├── packages/
│   ├── ui/               # Shared React UI components
│   ├── config/           # Shared types, constants, Firebase config
│   └── api/              # API client using native fetch
├── backend/
│   └── server/           # Express + Firebase Admin
├── turbo.json
└── package.json
```

## Firestore Collections

```
users/              → User profiles (influencers, viewers, brands)
reels/              → Fashion reels with product links
reelLikes/          → Like records (doc ID: userId_reelId)
reelSaves/          → Save records (doc ID: userId_reelId)
reelViews/          → View records (doc ID: userId_reelId)
conversations/      → Chat conversations
  └── messages/     → Subcollection of messages
collaborations/     → Brand-influencer matches (doc ID: brandId_influencerId)
```

## Prerequisites

- Node.js >= 18
- Firebase project with:
  - Authentication (Email/Password + Google sign-in)
  - Firestore Database
  - Storage
- For mobile: Xcode (iOS) / Android Studio (Android)

## Setup

### 1. Clone & Install

```bash
git clone <repo-url>
cd ReelBazaar
npm install
```

### 2. Firebase Setup

1. Create a Firebase project at https://console.firebase.google.com
2. Enable **Authentication** → Email/Password and Google sign-in
3. Create **Firestore Database** (start in test mode for development)
4. Enable **Storage**
5. Go to Project Settings → Service Accounts → Generate new private key
6. Save the JSON file as `backend/server/serviceAccountKey.json`

```bash
# Backend env
cp backend/server/.env.example backend/server/.env
# Set FIREBASE_PROJECT_ID and FIREBASE_STORAGE_BUCKET

# Web App env
cp apps/web-app/.env.example apps/web-app/.env
# Fill in VITE_FIREBASE_* values from Firebase console → Web app config
```

### 3. Seed Demo Data (optional)

```bash
npm run db:seed
```

### 4. Run Development Servers

```bash
# From root - runs all apps
npm run dev

# Or individually:
npm run dev:backend    # Backend on :4000
npm run dev:web        # Web app on :3000
npm run dev:landing    # Landing page on :3001
```

## Run Commands

| Command | Description |
|---|---|
| `npm run dev` | Start all apps in development |
| `npm run dev:backend` | Start backend server only |
| `npm run dev:web` | Start web app only |
| `npm run dev:landing` | Start landing page only |
| `npm run build` | Build all apps |
| `npm run db:seed` | Seed Firestore with demo data |

## Mobile App (Capacitor)

```bash
cd apps/web-app
npm run build
npx cap add android
npx cap add ios
npx cap sync
npx cap open android  # Opens Android Studio
npx cap open ios      # Opens Xcode
```

## Mobile App (React Native)

```bash
cd apps/mobile-app
npm install
# iOS
cd ios && pod install && cd ..
npx react-native run-ios
# Android
npx react-native run-android
```

## API Endpoints

### Auth
- `POST /api/auth/register` - Register new user
- `GET /api/auth/me` - Get current user
- `PATCH /api/auth/me` - Update profile

### Reels
- `GET /api/reels` - Get feed (`?category=Men&cursor=...&limit=10`)
- `GET /api/reels/:id` - Get single reel
- `GET /api/reels/user/:userId` - Get user's reels
- `POST /api/reels/upload` - Upload reel (multipart → Firebase Storage)
- `POST /api/reels/:id/like` - Toggle like
- `POST /api/reels/:id/save` - Toggle save
- `POST /api/reels/:id/view` - Record view
- `DELETE /api/reels/:id` - Delete reel (also deletes from Storage)

### Users
- `GET /api/users/search?q=query` - Search users
- `GET /api/users/:id` - Get user profile

### Messages
- `GET /api/messages/conversations` - Get conversations
- `GET /api/messages/:conversationId` - Get messages
- `POST /api/messages` - Send message
- `PATCH /api/messages/:conversationId/read` - Mark read

### Collaborations
- `GET /api/collaborations/suggestions` - AI-powered suggestions
- `GET /api/collaborations` - Get my collaborations
- `PATCH /api/collaborations/:id` - Accept/decline

### Upload
- `POST /api/upload/avatar` - Upload avatar to Firebase Storage

## User Types

1. **Influencer** - Creates reels, collaborates with brands
2. **Viewer** - Browses and shops fashion trends
3. **Brand** - Promotes products, finds influencers

## AI Matching

Brands and influencers are matched based on:
- Category overlap (gender/product fit)
- Age group relevance
- Gender alignment

Scores are calculated (0-100) and top matches are surfaced as "Suggested Collaborations".

## Environment Variables

See `.env.example` files in:
- `backend/server/.env.example`
- `apps/web-app/.env.example`
- Root `.env.example`
