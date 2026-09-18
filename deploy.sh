#!/usr/bin/env bash
# Rava — one command to push to Git, then build and publish everything to Firebase.
#
# Deploy flow (per project policy: every deploy pushes to Git first):
#   1) Push   — ensure the 'origin' remote is correct, stage, commit (if there are
#               changes), and push the current branch to GitHub.
#   2) Deploy — this repo has NO CI/CD auto-deploy configured (no .github/workflows
#               directory exists, and no Netlify/Vercel git-integration is wired up —
#               only stale netlify.toml files remain under apps/*, unconnected). So a
#               manual Firebase deploy always runs right after the push:
#                 npm install → turbo build (web-app, landing, server) → verify
#                 artifacts → firebase deploy --only hosting,functions
#
# Targets:
#   • Firebase Hosting app      → reelbaazar             → apps/web-app/dist
#   • Firebase Hosting landing  → reelbaazar-landing     → apps/landing-page/out
#   • Firebase Functions API    → api (us-central1)      → backend/server
#
# Usage:
#   ./deploy.sh                     push to git, then full Firebase deploy (default)
#   ./deploy.sh "commit message"    push using this commit message, then deploy
#   ./deploy.sh --no-push           skip the git push step; deploy only
#   ./deploy.sh --build-only        build + verify only (no push, no cloud deploy)
#   ./deploy.sh --ci                npm ci instead of npm install
#   ./deploy.sh --hosting-only      deploy Firebase Hosting only
#   ./deploy.sh --functions-only    deploy Firebase Functions only
#   ./deploy.sh --no-firebase       push + build + verify, skip Firebase deploy
#   ./deploy.sh --help
#
# Token (optional; for CI or non-interactive CLI):
#   export FIREBASE_TOKEN="..."   # https://firebase.google.com/docs/cli#cli-ci-systems
#
# Git remote (optional overrides; defaults match this repo's known-good origin):
#   export REMOTE_URL="..."       # used to add/fix 'origin' if it's missing/wrong
#   export REMOTE_BRANCH="..."    # fallback branch name if HEAD is detached
#
set -euo pipefail
# Select the GitHub account for this repository before every push.
# Override GITHUB_ACCOUNT when a repository is intentionally owned by a different account.
GITHUB_ACCOUNT="${GITHUB_ACCOUNT:-didigamnithin}"

ensure_github_account() {
  command -v gh >/dev/null 2>&1 || {
    echo "GitHub CLI (gh) is required to push as $GITHUB_ACCOUNT." >&2
    echo "Install gh and authenticate with: gh auth login --hostname github.com" >&2
    return 1
  }
  gh auth token --hostname github.com --user "$GITHUB_ACCOUNT" >/dev/null 2>&1 || {
    echo "GitHub CLI is not authenticated as $GITHUB_ACCOUNT." >&2
    echo "Authenticate that account first, then rerun this deploy." >&2
    return 1
  }
  gh auth switch --hostname github.com --user "$GITHUB_ACCOUNT" >/dev/null || {
    echo "Could not switch GitHub CLI to $GITHUB_ACCOUNT." >&2
    return 1
  }
  echo "Using GitHub account: $GITHUB_ACCOUNT"
}

push_with_github_account() {
  ensure_github_account
  git push "$@"
}


ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

DO_PUSH=1
USE_CI=0
BUILD_ONLY=0
DEPLOY_FIREBASE=1
FIREBASE_ONLY="hosting,functions"
LANDING_SITE_ID="reelbaazar-landing"
FUNCTION_ENV_BACKUP_DIR=""
COMMIT_MSG=""

REMOTE_NAME="origin"
REMOTE_URL="${REMOTE_URL:-https://github.com/nhancio/ReelBazar.git}"
FALLBACK_BRANCH="${REMOTE_BRANCH:-main}"

usage() {
  cat <<'EOF'
Usage: ./deploy.sh [options] ["commit message"]

  Default: push to Git (add/commit/push), then install dependencies, build all
  apps, and deploy Firebase Hosting + Functions.

  "commit message"       Optional commit message for the push step.
                          Default: "chore: automated deployment update".

  --no-push              Skip the git push step; deploy only.
  --build-only           Build and verify only; no push, no Firebase deploy.
  --ci                   Use npm ci instead of npm install.

  --hosting-only         Deploy Firebase Hosting only.
  --functions-only       Deploy Firebase Functions only.
  --no-firebase          Push + build + verify, skip Firebase deploy.

  FIREBASE_TOKEN — optional; used when set (CI or token-based CLI).
  REMOTE_URL     — optional; overrides the 'origin' remote this script ensures.
  REMOTE_BRANCH  — optional; fallback branch name if HEAD is detached.
EOF
}

for arg in "$@"; do
  case "$arg" in
    --no-push) DO_PUSH=0 ;;
    --push) DO_PUSH=1 ;; # push is already the default step 1; kept for back-compat
    --ci) USE_CI=1 ;;
    --build-only) BUILD_ONLY=1 ;;
    --no-firebase) DEPLOY_FIREBASE=0 ;;
    --hosting-only) FIREBASE_ONLY="hosting" ;;
    --functions-only) FIREBASE_ONLY="functions" ;;
    --deploy|--deploy-firebase)
      ;; # no-op: full Firebase deploy is the default
    -h|--help)
      usage
      exit 0
      ;;
    -*)
      echo "Unknown option: $arg (use --help)" >&2
      exit 1
      ;;
    *)
      COMMIT_MSG="$arg"
      ;;
  esac
done

if [[ "$BUILD_ONLY" -eq 1 ]]; then
  DEPLOY_FIREBASE=0
  DO_PUSH=0
fi

# ---------------------------------------------------------------------------
# Step 1: push to Git
# ---------------------------------------------------------------------------

check_nested_repos() {
  local nested
  nested="$(find . -mindepth 2 -name ".git" \
    -not -path "./node_modules/*" \
    -not -path "*/node_modules/*" \
    2>/dev/null || true)"
  if [[ -n "$nested" ]]; then
    echo "WARN: Found nested git repositories under this project (not declared as" >&2
    echo "      submodules in .gitmodules). 'git add -A' will stage these as embedded" >&2
    echo "      gitlinks, not their file contents. Review before pushing:" >&2
    echo "$nested" | sed 's/^/         /' >&2
  fi
}

git_push() {
  if [[ ! -d "$ROOT/.git" ]]; then
    echo "ERROR: $ROOT is not a git repository yet (no .git directory)." >&2
    echo "       Run: git init && git remote add $REMOTE_NAME $REMOTE_URL" >&2
    echo "       then commit and re-run ./deploy.sh." >&2
    exit 1
  fi

  if ! git remote get-url "$REMOTE_NAME" >/dev/null 2>&1; then
    echo "==> No '$REMOTE_NAME' remote configured. Adding: $REMOTE_URL"
    git remote add "$REMOTE_NAME" "$REMOTE_URL"
  else
    local current_url
    current_url="$(git remote get-url "$REMOTE_NAME")"
    if [[ "$current_url" != "$REMOTE_URL" ]]; then
      echo "==> '$REMOTE_NAME' remote is '$current_url'; expected '$REMOTE_URL'. Fixing..."
      git remote set-url "$REMOTE_NAME" "$REMOTE_URL"
    fi
  fi

  check_nested_repos

  echo "==> Staging changes (git add -A)..."
  git add -A

  if git diff --cached --quiet; then
    echo "==> No staged changes to commit."
  else
    local msg="${COMMIT_MSG:-chore: automated deployment update}"
    echo "==> Committing: $msg"
    git commit -m "$msg"
  fi

  local branch
  branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
  if [[ -z "$branch" || "$branch" == "HEAD" ]]; then
    echo "WARN: Detached HEAD or no branch detected; using '$FALLBACK_BRANCH'." >&2
    branch="$FALLBACK_BRANCH"
  fi

  echo "==> Pushing '$branch' to $REMOTE_NAME..."
  if ! push_with_github_account -u "$REMOTE_NAME" "$branch"; then
    echo "ERROR: git push failed. Check your credentials/remote and try again." >&2
    exit 1
  fi
}

if [[ "$DO_PUSH" -eq 1 ]]; then
  echo "==> Step 1/2: push to Git"
  git_push
else
  echo "==> Step 1/2: push to Git — skipped (--no-push/--build-only)."
fi

# ---------------------------------------------------------------------------
# Step 2: deploy
#
# No CI/CD auto-deploy is wired up for this repo (confirmed: no .github/workflows,
# no connected Netlify/Vercel git integration), so the manual Firebase deploy below
# always runs after the push above — it is not redundant here.
# ---------------------------------------------------------------------------

firebase_cmd() {
  if command -v firebase >/dev/null 2>&1; then
    firebase "$@"
  else
    npx --yes firebase-tools "$@"
  fi
}

restore_function_env() {
  if [[ -z "$FUNCTION_ENV_BACKUP_DIR" || ! -d "$FUNCTION_ENV_BACKUP_DIR" ]]; then
    return 0
  fi

  local env_dir="$ROOT/backend/server"
  local file
  for file in "$FUNCTION_ENV_BACKUP_DIR/.env" "$FUNCTION_ENV_BACKUP_DIR/.env.reelbaazar"; do
    [[ -e "$file" ]] || continue
    mv "$file" "$env_dir/$(basename "$file")"
  done
  rmdir "$FUNCTION_ENV_BACKUP_DIR" 2>/dev/null || true
  FUNCTION_ENV_BACKUP_DIR=""
}

hide_function_env_for_deploy() {
  if [[ "$FIREBASE_ONLY" == "hosting" ]]; then
    return 0
  fi

  local env_dir="$ROOT/backend/server"
  local env_file
  local moved=0

  FUNCTION_ENV_BACKUP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/rava-functions-env.XXXXXX")"
  trap restore_function_env EXIT

  for env_file in "$env_dir/.env" "$env_dir/.env.reelbaazar"; do
    if [[ -f "$env_file" ]]; then
      mv "$env_file" "$FUNCTION_ENV_BACKUP_DIR/$(basename "$env_file")"
      moved=1
    fi
  done

  if [[ "$moved" -eq 1 ]]; then
    echo "==> Temporarily moved backend/server .env files out of the Functions source."
  else
    restore_function_env
  fi
}

ensure_landing_site() {
  if [[ "$FIREBASE_ONLY" == "functions" ]]; then
    return 0
  fi

  echo "==> Ensuring Firebase Hosting site exists: $LANDING_SITE_ID"
  if [[ -n "${FIREBASE_TOKEN:-}" ]]; then
    firebase_cmd hosting:sites:create "$LANDING_SITE_ID" --non-interactive --token "$FIREBASE_TOKEN" >/dev/null 2>&1 || true
  else
    firebase_cmd hosting:sites:create "$LANDING_SITE_ID" >/dev/null 2>&1 || true
  fi
}

firebase_deploy_with_retry() {
  local only="$1"
  local attempt=1
  local max_attempts=2

  while [[ "$attempt" -le "$max_attempts" ]]; do
    if [[ -n "${FIREBASE_TOKEN:-}" ]]; then
      firebase_cmd deploy --only "$only" --force --non-interactive --token "$FIREBASE_TOKEN" && return 0
    else
      firebase_cmd deploy --only "$only" --force && return 0
    fi

    if [[ "$attempt" -lt "$max_attempts" ]]; then
      echo "WARN: Firebase deploy failed (attempt $attempt/$max_attempts). Retrying in 3s..."
      sleep 3
    fi
    attempt=$((attempt + 1))
  done

  echo "ERROR: Firebase deploy failed after $max_attempts attempts. Running with --debug for details..." >&2
  if [[ -n "${FIREBASE_TOKEN:-}" ]]; then
    firebase_cmd deploy --only "$only" --force --non-interactive --token "$FIREBASE_TOKEN" --debug
  else
    firebase_cmd deploy --only "$only" --force --debug
  fi
}

echo "==> Step 2/2: build + deploy — root: $ROOT"

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
if [[ ! -f "$ROOT/apps/landing-page/out/index.html" ]]; then
  echo "ERROR: Missing apps/landing-page/out/index.html" >&2
  ok=0
fi
if [[ ! -f "$ROOT/backend/server/dist/firebase.js" ]]; then
  echo "ERROR: Missing backend/server/dist/firebase.js" >&2
  ok=0
fi
if [[ "$ok" -ne 1 ]]; then
  exit 1
fi

echo ""
echo "==> Build OK:"
echo "    Firebase Hosting app:      apps/web-app/dist/        (site: reelbaazar)"
echo "    Firebase Hosting landing:  apps/landing-page/out/    (site: reelbaazar-landing)"
echo "    Firebase Functions API:    backend/server/dist/firebase.js"
echo ""

if [[ "$BUILD_ONLY" -eq 1 ]]; then
  echo "==> --build-only: skipping cloud deploy."
elif [[ "$DEPLOY_FIREBASE" -eq 1 ]]; then
  if [[ ! -f "$ROOT/.firebaserc" ]]; then
    echo "ERROR: Missing .firebaserc. Copy .firebaserc.example to .firebaserc and set your Firebase project id." >&2
    exit 1
  fi
  echo "==> No CI/CD auto-deploy configured for this repo — running manual Firebase deploy."
  ensure_landing_site
  hide_function_env_for_deploy
  echo "==> Firebase deploy ($FIREBASE_ONLY)..."
  firebase_deploy_with_retry "$FIREBASE_ONLY"
  restore_function_env
else
  echo "==> --no-firebase: skipping cloud deploy."
fi

echo ""
echo "==> Reminders:"
echo "    • Connect app.rava.one to Firebase Hosting site reelbaazar."
echo "    • Connect rava.one to Firebase Hosting site reelbaazar-landing."
echo "    • The app calls the API through Firebase Hosting at /api/v1."
echo ""

echo "==> Done."
