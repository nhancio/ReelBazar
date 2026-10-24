#!/usr/bin/env bash
# =============================================================================
# Rava — Unified Deploy Script (Git + Expo Android & iOS + Firebase)
# =============================================================================
#
# Pipeline:
#   Step 1: Verify & Preflight — Lint, TypeScript check, & Android/iOS preflight
#   Step 2: Push to Git        — Stage, commit, and push branch to GitHub
#   Step 3: Push to Expo       — Publish OTA update + queue EAS builds for
#                                Android & iOS (preview or production profile)
#   Step 4: Firebase Deploy    — Optional web-app / landing / functions deploy
#
# Usage:
#   ./deploy.sh                               Push to Git + Push to Expo (Android & iOS)
#   ./deploy.sh "feat: native UI & theme"     Custom commit & EAS update message
#   ./deploy.sh --profile production          Use EAS 'production' profile (default: preview)
#   ./deploy.sh --android-only                Push to Git + Expo Android only
#   ./deploy.sh --ios-only                    Push to Git + Expo iOS only
#   ./deploy.sh --ota-only                    Push to Git + EAS Update (OTA) only (skip cloud binary build)
#   ./deploy.sh --wait                        Wait for EAS cloud builds to finish
#   ./deploy.sh --submit                      Also run eas submit for Android & iOS
#   ./deploy.sh --sync-env                    Sync EXPO_PUBLIC_* from apps/app/.env to EAS before deploy
#   ./deploy.sh --with-firebase               Also build & deploy Firebase Hosting + Functions
#   ./deploy.sh --no-expo                     Skip Expo deploy (Git + Firebase only)
#   ./deploy.sh --no-push                     Skip Git push
#   ./deploy.sh --help                        Show usage help
# =============================================================================

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$ROOT/apps/app"
cd "$ROOT"

NODE20_BIN="/opt/homebrew/opt/node@20/bin"
if [[ -x "$NODE20_BIN/node" ]]; then
  export PATH="$NODE20_BIN:/opt/homebrew/bin:$PATH"
fi

GITHUB_ACCOUNT="${GITHUB_ACCOUNT:-didigamnithin}"
REMOTE_NAME="origin"
REMOTE_URL="${REMOTE_URL:-https://github.com/nhancio/ReelBazar.git}"
FALLBACK_BRANCH="${REMOTE_BRANCH:-main}"

DO_VERIFY=1
DO_PUSH=1
DO_EXPO=1
DO_EXPO_OTA=1
DO_EXPO_BUILD=1
DO_ANDROID=1
DO_IOS=1
DO_SUBMIT=0
DO_SYNC_ENV=0
EAS_PROFILE="${EAS_PROFILE:-preview}"
EAS_WAIT_FLAG="--no-wait"

DEPLOY_FIREBASE=0
USE_CI=0
BUILD_ONLY=0
FIREBASE_ONLY="hosting,functions"
LANDING_SITE_ID="reelbaazar-landing"
FUNCTION_ENV_BACKUP_DIR=""
COMMIT_MSG=""

usage() {
  cat <<'EOF'
Usage: ./deploy.sh [options] ["commit message"]

  Default: Verify (lint + tsc + preflight) -> Push to Git -> Push to Expo (OTA + Android & iOS EAS builds).

Options:
  "commit message"       Commit & EAS update message (default: "chore: deploy Rava to Git, Android, and iOS")
  --profile <name>       EAS profile: development | preview | production (default: preview)
  --production           Shorthand for --profile production
  --preview              Shorthand for --profile preview
  --android-only         Target Android only for Expo build/update
  --ios-only             Target iOS only for Expo build/update
  --ota-only             Publish EAS Update (OTA) to Android & iOS without queueing new cloud binaries
  --no-ota               Skip EAS Update (OTA); run EAS cloud builds only
  --no-build             Alias for --ota-only
  --wait                 Wait for EAS cloud builds to complete (default: --no-wait)
  --submit               Submit latest Android & iOS builds to Google Play / TestFlight
  --sync-env             Sync apps/app/.env EXPO_PUBLIC_* variables to EAS before deploying
  --no-expo              Skip Expo Android/iOS step
  --no-push              Skip Git commit & push step
  --no-verify            Skip lint/typecheck verification step
  --with-firebase        Also build & deploy Firebase Hosting + Functions
  --hosting-only         Deploy Firebase Hosting only (implies --with-firebase)
  --functions-only       Deploy Firebase Functions only (implies --with-firebase)
  --no-firebase          Skip Firebase deploy (default unless --with-firebase is passed)
  --build-only           Verify and build only; no Git push, no Expo/Firebase deploy
  --ci                   Use npm ci instead of npm install when building Firebase targets
  -h, --help             Show this help message
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --profile)
      EAS_PROFILE="${2:-preview}"
      shift 2
      ;;
    --production)
      EAS_PROFILE="production"
      shift
      ;;
    --preview)
      EAS_PROFILE="preview"
      shift
      ;;
    --android-only)
      DO_ANDROID=1
      DO_IOS=0
      shift
      ;;
    --ios-only)
      DO_ANDROID=0
      DO_IOS=1
      shift
      ;;
    --ota-only|--no-build)
      DO_EXPO_OTA=1
      DO_EXPO_BUILD=0
      shift
      ;;
    --no-ota)
      DO_EXPO_OTA=0
      shift
      ;;
    --wait)
      EAS_WAIT_FLAG="--wait"
      shift
      ;;
    --no-wait)
      EAS_WAIT_FLAG="--no-wait"
      shift
      ;;
    --submit)
      DO_SUBMIT=1
      shift
      ;;
    --sync-env)
      DO_SYNC_ENV=1
      shift
      ;;
    --no-expo)
      DO_EXPO=0
      shift
      ;;
    --no-push)
      DO_PUSH=0
      shift
      ;;
    --push)
      DO_PUSH=1
      shift
      ;;
    --no-verify)
      DO_VERIFY=0
      shift
      ;;
    --with-firebase|--deploy|--deploy-firebase)
      DEPLOY_FIREBASE=1
      shift
      ;;
    --no-firebase)
      DEPLOY_FIREBASE=0
      shift
      ;;
    --hosting-only)
      DEPLOY_FIREBASE=1
      FIREBASE_ONLY="hosting"
      shift
      ;;
    --functions-only)
      DEPLOY_FIREBASE=1
      FIREBASE_ONLY="functions"
      shift
      ;;
    --ci)
      USE_CI=1
      shift
      ;;
    --build-only)
      BUILD_ONLY=1
      DO_PUSH=0
      DO_EXPO=0
      DEPLOY_FIREBASE=0
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    -*)
      echo "Unknown option: $1 (use --help)" >&2
      exit 1
      ;;
    *)
      COMMIT_MSG="$1"
      shift
      ;;
  esac
done

DEPLOY_MSG="${COMMIT_MSG:-chore: deploy Rava native UI update to Git, Android, and iOS}"

# ---------------------------------------------------------------------------
# Step 1: Verify & Preflight (apps/app)
# ---------------------------------------------------------------------------
if [[ "$DO_VERIFY" -eq 1 ]]; then
  echo ""
  echo "====================================================================="
  echo "==> Step 1/4: Verify & Preflight (Expo Lint + TypeScript + Preflight)"
  echo "====================================================================="
  (
    cd "$APP_DIR"
    npm run verify
    if [[ "$DO_ANDROID" -eq 1 && "$DO_IOS" -eq 1 ]]; then
      node scripts/releasePreflight.js
    elif [[ "$DO_ANDROID" -eq 1 ]]; then
      node scripts/releasePreflight.js android
    elif [[ "$DO_IOS" -eq 1 ]]; then
      node scripts/releasePreflight.js ios
    fi
  )
else
  echo "==> Step 1/4: Verify & Preflight — skipped (--no-verify)."
fi

# ---------------------------------------------------------------------------
# Step 2: Push to Git
# ---------------------------------------------------------------------------
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

check_nested_repos() {
  local nested
  nested="$(find . -mindepth 2 -name ".git" \
    -not -path "./node_modules/*" \
    -not -path "*/node_modules/*" \
    2>/dev/null || true)"
  if [[ -n "$nested" ]]; then
    echo "WARN: Found nested git repositories under this project:" >&2
    echo "$nested" | sed 's/^/         /' >&2
  fi
}

git_push() {
  if [[ ! -d "$ROOT/.git" ]]; then
    echo "ERROR: $ROOT is not a git repository yet (no .git directory)." >&2
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
    echo "==> Committing: $DEPLOY_MSG"
    git commit -m "$DEPLOY_MSG"
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
  echo ""
  echo "====================================================================="
  echo "==> Step 2/4: Push to Git"
  echo "====================================================================="
  git_push
else
  echo "==> Step 2/4: Push to Git — skipped (--no-push)."
fi

# ---------------------------------------------------------------------------
# Step 3: Push to Expo -> Android & iOS
# ---------------------------------------------------------------------------
eas_cmd() {
  if command -v eas >/dev/null 2>&1; then
    eas "$@"
  else
    npx --yes eas-cli "$@"
  fi
}

deploy_expo() {
  cd "$APP_DIR"
  export NODE_ENV=production
  export EXPO_PUBLIC_APP_ENV="$EAS_PROFILE"

  if [[ "$DO_SYNC_ENV" -eq 1 ]]; then
    echo "==> Syncing EXPO_PUBLIC_* environment variables to EAS ($EAS_PROFILE)..."
    bash "$APP_DIR/scripts/eas-env-sync.sh" "$EAS_PROFILE" || true
  fi

  local ota_platform="all"
  if [[ "$DO_ANDROID" -eq 1 && "$DO_IOS" -eq 0 ]]; then
    ota_platform="android"
  elif [[ "$DO_ANDROID" -eq 0 && "$DO_IOS" -eq 1 ]]; then
    ota_platform="ios"
  fi

  # 3a. EAS Update (instant OTA bundle push to Android & iOS)
  if [[ "$DO_EXPO_OTA" -eq 1 ]]; then
    echo ""
    echo "==> [Expo OTA] Publishing EAS Update to branch '$EAS_PROFILE' (platform: $ota_platform)..."
    if eas_cmd update --branch "$EAS_PROFILE" --platform "$ota_platform" --message "$DEPLOY_MSG" --non-interactive; then
      echo "✅ [Expo OTA] Published update to '$EAS_PROFILE' ($ota_platform)."
    else
      echo "⚠️  [Expo OTA] eas update returned a non-zero status (continuing to binary builds)." >&2
    fi
  fi

  # 3b. EAS Build — Android
  if [[ "$DO_EXPO_BUILD" -eq 1 && "$DO_ANDROID" -eq 1 ]]; then
    echo ""
    echo "==> [Expo Android] Triggering EAS Build (profile: $EAS_PROFILE, wait: $EAS_WAIT_FLAG)..."
    if eas_cmd build --platform android --profile "$EAS_PROFILE" --message "$DEPLOY_MSG" --non-interactive "$EAS_WAIT_FLAG"; then
      echo "✅ [Expo Android] Build queued/completed on EAS ($EAS_PROFILE)."
    else
      echo "⚠️  [Expo Android] Cloud build could not be queued non-interactively." >&2
      echo "   Tip: Run 'cd apps/app && npm run expo:apk' or './scripts/buildapk.sh' for local APK build." >&2
    fi
  fi

  # 3c. EAS Build — iOS
  if [[ "$DO_EXPO_BUILD" -eq 1 && "$DO_IOS" -eq 1 ]]; then
    echo ""
    echo "==> [Expo iOS] Triggering EAS Build (profile: $EAS_PROFILE, wait: $EAS_WAIT_FLAG)..."
    if eas_cmd build --platform ios --profile "$EAS_PROFILE" --message "$DEPLOY_MSG" --non-interactive "$EAS_WAIT_FLAG"; then
      echo "✅ [Expo iOS] Build queued/completed on EAS ($EAS_PROFILE)."
    else
      echo "⚠️  [Expo iOS] Cloud build requires interactive Apple Developer credentials or provisioning setup." >&2
      echo "   Tip: Run 'cd apps/app && eas build --platform ios --profile $EAS_PROFILE' once interactively to link Apple credentials." >&2
    fi
  fi

  # 3d. Optional Store Submission (Google Play & App Store Connect / TestFlight)
  if [[ "$DO_SUBMIT" -eq 1 ]]; then
    if [[ "$DO_ANDROID" -eq 1 ]]; then
      echo ""
      echo "==> [Expo Submit Android] Submitting latest Android build to Google Play..."
      eas_cmd submit --platform android --profile production --latest --non-interactive || true
    fi
    if [[ "$DO_IOS" -eq 1 ]]; then
      echo ""
      echo "==> [Expo Submit iOS] Submitting latest iOS build to App Store Connect / TestFlight..."
      eas_cmd submit --platform ios --profile production --latest --non-interactive || true
    fi
  fi

  cd "$ROOT"
}

if [[ "$DO_EXPO" -eq 1 ]]; then
  echo ""
  echo "====================================================================="
  echo "==> Step 3/4: Push to Expo (Android: $DO_ANDROID | iOS: $DO_IOS | Profile: $EAS_PROFILE)"
  echo "====================================================================="
  deploy_expo
else
  echo "==> Step 3/4: Push to Expo — skipped (--no-expo)."
fi

# ---------------------------------------------------------------------------
# Step 4: Optional Firebase Web & Functions Deploy
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

  echo "ERROR: Firebase deploy failed after $max_attempts attempts." >&2
  return 1
}

if [[ "$DEPLOY_FIREBASE" -eq 1 || "$BUILD_ONLY" -eq 1 ]]; then
  echo ""
  echo "====================================================================="
  echo "==> Step 4/4: Build & Deploy Firebase ($FIREBASE_ONLY)"
  echo "====================================================================="
  if [[ "$USE_CI" -eq 1 ]]; then
    npm ci
  else
    npm install
  fi
  npm run deploy:build

  if [[ "$BUILD_ONLY" -eq 0 ]]; then
    ensure_landing_site
    hide_function_env_for_deploy
    firebase_deploy_with_retry "$FIREBASE_ONLY"
    restore_function_env
  fi
else
  echo "==> Step 4/4: Firebase deploy — skipped (pass --with-firebase to include)."
fi

echo ""
echo "====================================================================="
echo "==> Rava Deployment Pipeline Complete!"
echo "    • Git:      pushed to $REMOTE_NAME"
echo "    • Expo OTA: branch '$EAS_PROFILE' (Android & iOS)"
echo "    • Android:  EAS Build ($EAS_PROFILE)"
echo "    • iOS:      EAS Build ($EAS_PROFILE)"
echo "====================================================================="
