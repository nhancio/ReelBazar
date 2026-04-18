/**
 * Files are served from `apps/landing-page/public` (commit this folder for Vercel when
 * the project Root Directory is `apps/landing-page`). Locally, `predev`/`prebuild` runs
 * `scripts/sync-public.js` to copy from the monorepo `public/` when present.
 */
export const MEDIA = {
  logo: "/logo/logo.jpeg",
  heroVideo: "/media/hero-video.mp4",
  insight1: "/media/img-lp1.jpeg",
  insight2: "/media/img-lp2.jpeg",
  insight3: "/media/img-lp3.jpeg",
} as const;
