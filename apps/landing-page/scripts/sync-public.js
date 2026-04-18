/**
 * Copies static assets into apps/landing-page/public for Next.js.
 *
 * When Vercel "Root Directory" is `apps/landing-page`, two levels up from the
 * package root is the filesystem root, so `../../public` becomes `/public` and
 * does NOT point at the monorepo. We therefore:
 * 1) Prefer env RAVA_PUBLIC_SOURCE if set (absolute path to repo public/)
 * 2) Else use ../../public from this package only if that directory exists
 * 3) Else if apps/landing-page/public already has required files, skip (OK)
 * 4) Else fail with a clear message
 */
const fs = require("fs");
const path = require("path");

const landingRoot = path.join(__dirname, "..");
const dest = path.join(landingRoot, "public");

function hasRequiredAssets(dir) {
  const logo = path.join(dir, "logo", "logo.jpeg");
  const video = path.join(dir, "media", "hero-video.mp4");
  return fs.existsSync(logo) && fs.existsSync(video);
}

function resolveSourceDir() {
  const env = process.env.RAVA_PUBLIC_SOURCE;
  if (env && fs.existsSync(env)) {
    return env;
  }

  const monorepoTwoUp = path.join(landingRoot, "..", "..", "public");
  if (fs.existsSync(monorepoTwoUp) && hasRequiredAssets(monorepoTwoUp)) {
    return monorepoTwoUp;
  }

  const monorepoOneUp = path.join(landingRoot, "..", "public");
  if (fs.existsSync(monorepoOneUp) && hasRequiredAssets(monorepoOneUp)) {
    return monorepoOneUp;
  }

  return null;
}

const source = resolveSourceDir();

if (source) {
  if (fs.existsSync(dest)) {
    fs.rmSync(dest, { recursive: true, force: true });
  }
  fs.cpSync(source, dest, { recursive: true });
  console.log("sync-public: copied", source, "->", dest);
  process.exit(0);
}

if (hasRequiredAssets(dest)) {
  console.log("sync-public: keeping existing", dest, "(no monorepo public/ in this environment)");
  process.exit(0);
}

console.error(
  "sync-public: no static assets found.\n" +
    "  - Commit apps/landing-page/public/ (logo/, media/, site.webmanifest), or\n" +
    "  - Set RAVA_PUBLIC_SOURCE to your repo public/ folder path, or\n" +
    "  - Use Vercel Root Directory = monorepo root and build from apps/landing-page.\n" +
    "  Expected at minimum: public/logo/logo.jpeg and public/media/hero-video.mp4"
);
process.exit(1);
