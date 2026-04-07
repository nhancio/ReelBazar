#!/usr/bin/env bash
# ReelBazaar — one command to build and publish everything.
#
# Default (./deploy.sh):
#   npm install → turbo build (web-app, landing, server) → verify artifacts
#   → firebase deploy --only hosting (PWA)
#   → vercel --prod (landing-page)
#   → vercel --prod (API / backend/server)
#
# Targets:
#   • Firebase Hosting  → apps/web-app/dist (SPA). firebase.json + .firebaserc at repo root.
#   • Vercel (landing)    → apps/landing-page (Next.js)
#   • Vercel (API)        → backend/server (serverless api/index.ts)
#
# Usage:
#   ./deploy.sh                    full deploy (default)
#   ./deploy.sh --push             deploy, then run gitpush.sh
#   ./deploy.sh --build-only       build + verify only (no cloud)
#   ./deploy.sh --ci               npm ci instead of npm install
#   ./deploy.sh --no-firebase      skip Firebase Hosting
#   ./deploy.sh --no-vercel        skip both Vercel deploys
#   ./deploy.sh --no-vercel-landing
#   ./deploy.sh --no-vercel-api
#   ./deploy.sh --help
#
# Tokens (optional; for CI or non-interactive CLI):
#   export FIREBASE_TOKEN="..."   # https://firebase.google.com/docs/cli#cli-ci-systems
#   export VERCEL_TOKEN="..."     # Vercel → Account Settings → Tokens
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

DO_PUSH=0
USE_CI=0
BUILD_ONLY=0
DEPLOY_FIREBASE=1
DEPLOY_VERCEL_LANDING=1
DEPLOY_VERCEL_API=1

for arg in "$@"; do
  case "$arg" in
    --push) DO_PUSH=1 ;;
    --no-push) DO_PUSH=0 ;; # explicit (default is already 0)
    --ci) USE_CI=1 ;;
    --build-only) BUILD_ONLY=1 ;;
    --no-firebase) DEPLOY_FIREBASE=0 ;;
    --no-vercel)
      DEPLOY_VERCEL_LANDING=0
      DEPLOY_VERCEL_API=0
      ;;
    --no-vercel-landing) DEPLOY_VERCEL_LANDING=0 ;;
    --no-vercel-api) DEPLOY_VERCEL_API=0 ;;
    --deploy)
      ;; # no-op: full deploy is the default
    --deploy-firebase)
      DEPLOY_FIREBASE=1
      DEPLOY_VERCEL_LANDING=0
      DEPLOY_VERCEL_API=0
      ;;
    --deploy-vercel)
      DEPLOY_FIREBASE=0
      DEPLOY_VERCEL_LANDING=1
      DEPLOY_VERCEL_API=1
      ;;
    --deploy-vercel-landing)
      DEPLOY_FIREBASE=0
      DEPLOY_VERCEL_LANDING=1
      DEPLOY_VERCEL_API=0
      ;;
    --deploy-vercel-api)
      DEPLOY_FIREBASE=0
      DEPLOY_VERCEL_LANDING=0
      DEPLOY_VERCEL_API=1
      ;;
    -h|--help)
      cat <<'EOF'
Usage: ./deploy.sh [options]

  Default: install dependencies, build all apps, deploy Firebase Hosting + both Vercel projects.

  --build-only          Build and verify only; do not deploy to Firebase or Vercel.
  --push                After deploy, run ./gitpush.sh (commit/push helper if present).
  --ci                  Use npm ci instead of npm install.

  --no-firebase         Skip Firebase Hosting deploy.
  --no-vercel           Skip both Vercel deploys.
  --no-vercel-landing   Skip landing-page on Vercel only.
  --no-vercel-api       Skip API on Vercel only.

  FIREBASE_TOKEN / VERCEL_TOKEN — optional; used when set (CI or token-based CLI).

  Legacy (deploy subset only):
    --deploy-firebase, --deploy-vercel, --deploy-vercel-landing, --deploy-vercel-api
EOF
      exit 0
      ;;
    *)
      echo "Unknown option: $arg (use --help)" >&2
      exit 1
      ;;
  esac
done

if [[ "$BUILD_ONLY" -eq 1 ]]; then
  DEPLOY_FIREBASE=0
  DEPLOY_VERCEL_LANDING=0
  DEPLOY_VERCEL_API=0
  DO_PUSH=0
fi

firebase_cmd() {
  if command -v firebase >/dev/null 2>&1; then
    firebase "$@"
  else
    npx --yes firebase-tools "$@"
  fi
}

firebase_deploy_with_retry() {
  local attempt=1
  local max_attempts=2
  while [[ "$attempt" -le "$max_attempts" ]]; do
    if [[ -n "${FIREBASE_TOKEN:-}" ]]; then
      firebase_cmd deploy --only hosting --non-interactive --token "$FIREBASE_TOKEN" && return 0
    else
      firebase_cmd deploy --only hosting && return 0
    fi

    if [[ "$attempt" -lt "$max_attempts" ]]; then
      echo "WARN: Firebase deploy failed (attempt $attempt/$max_attempts). Retrying in 3s..."
      sleep 3
    fi
    attempt=$((attempt + 1))
  done

  echo "ERROR: Firebase deploy failed after $max_attempts attempts. Running with --debug for details..." >&2
  if [[ -n "${FIREBASE_TOKEN:-}" ]]; then
    firebase_cmd deploy --only hosting --non-interactive --token "$FIREBASE_TOKEN" --debug
  else
    firebase_cmd deploy --only hosting --debug
  fi
}

vercel_cmd() {
  if command -v vercel >/dev/null 2>&1; then
    vercel "$@"
  else
    npx --yes vercel "$@"
  fi
}

echo "==> ReelBazaar deploy — root: $ROOT"

if [[ "$USE_CI" -eq 1 ]]; then
  echo "==> Installing dependencies (npm ci)..."
  npm ci
else
  echo "==> Installing dependencies (npm install)..."
  npm install
fi

echo "==> Building: web-app, landing-page, server..."
npm run deploy:build

echo "==> Verifying build artifacts..."
ok=1
if [[ ! -f "$ROOT/apps/web-app/dist/index.html" ]]; then
  echo "ERROR: Missing apps/web-app/dist/index.html" >&2
  ok=0
fi
if [[ ! -d "$ROOT/apps/landing-page/.next" ]]; then
  echo "ERROR: Missing apps/landing-page/.next" >&2
  ok=0
fi
if [[ ! -f "$ROOT/backend/server/dist/index.js" ]]; then
  echo "ERROR: Missing backend/server/dist/index.js" >&2
  ok=0
fi
if [[ "$ok" -ne 1 ]]; then
  exit 1
fi

echo ""
echo "==> Build OK:"
echo "    Firebase Hosting (PWA):  apps/web-app/dist/"
echo "    Vercel landing:          apps/landing-page/.next/"
echo "    Vercel API:              backend/server (api/index.ts + src/)"
echo ""

if [[ "$BUILD_ONLY" -eq 1 ]]; then
  echo "==> --build-only: skipping cloud deploys."
else

if [[ "$DEPLOY_FIREBASE" -eq 1 ]]; then
  if [[ ! -f "$ROOT/.firebaserc" ]]; then
    echo "ERROR: Missing .firebaserc. Copy .firebaserc.example → .firebaserc and set your Firebase project id." >&2
    exit 1
  fi
  echo "==> Firebase Hosting deploy..."
  firebase_deploy_with_retry
fi

if [[ "$DEPLOY_VERCEL_LANDING" -eq 1 ]]; then
  echo "==> Vercel deploy (landing-page)..."
  cd "$ROOT/apps/landing-page"
  if [[ -n "${VERCEL_TOKEN:-}" ]]; then
    vercel_cmd deploy --prod --yes --token "$VERCEL_TOKEN"
  else
    vercel_cmd deploy --prod --yes
  fi
  cd "$ROOT"
fi

if [[ "$DEPLOY_VERCEL_API" -eq 1 ]]; then
  echo "==> Vercel deploy (API server)..."
  cd "$ROOT/backend/server"
  if [[ -n "${VERCEL_TOKEN:-}" ]]; then
    vercel_cmd deploy --prod --yes --token "$VERCEL_TOKEN"
  else
    vercel_cmd deploy --prod --yes
  fi
  cd "$ROOT"
fi

fi

echo ""
echo "==> Reminders:"
echo "    • Web app: build with VITE_API_URL pointing at your API (must end with /api), e.g. https://your-api.vercel.app/api"
echo "    • Vercel API project: set Firebase Admin + storage env vars in the dashboard."
echo ""

if [[ "$DO_PUSH" -eq 1 ]]; then
  if [[ -x "$ROOT/gitpush.sh" ]]; then
    echo "==> Running gitpush.sh..."
    "$ROOT/gitpush.sh"
  else
    echo "WARN: --push requested but gitpush.sh not found or not executable; skipping." >&2
  fi
fi

echo "==> Done."
