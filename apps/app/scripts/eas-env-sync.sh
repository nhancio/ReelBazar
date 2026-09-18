#!/usr/bin/env bash
# Push every EXPO_PUBLIC_* var from the local (gitignored) .env into EAS as
# environment variables, so EAS *cloud* builds inline them into the app binary.
#
# WHY: EAS Build servers do NOT read local .env files — they're gitignored and
# never uploaded (https://docs.expo.dev/eas/environment-variables/). Without this,
# process.env.EXPO_PUBLIC_FIREBASE_* / _GOOGLE_* are `undefined` in the APK, so
# firebaseEnabled === false and Google sign-in fails immediately. (Web works because
# deploy.sh runs `expo export` locally, where .env is present.)
#
# EXPO_PUBLIC_* values are client-safe by design → visibility=plaintext.
#
# Usage:
#   npm i -g eas-cli && eas login        # one-time
#   ./scripts/eas-env-sync.sh            # sync to all envs (development, preview, production)
#   ./scripts/eas-env-sync.sh preview    # sync to a single environment
#
# Idempotency note: `eas env:set` is create-oriented. If a var already exists in an
# environment this will report a soft failure for that one — that's fine, the value is
# already there. To CHANGE an existing value, update it in the Expo dashboard
# (Project → Environment variables) or `eas env:list` then delete + re-run.
set -uo pipefail
cd "$(dirname "$0")/.."

ENVS="${1:-development preview production}"

command -v eas >/dev/null 2>&1 || { echo "❌ eas-cli not found. Run: npm i -g eas-cli && eas login"; exit 1; }
[ -f .env ] || { echo "❌ .env not found in $(pwd)"; exit 1; }

count=0
# Match `EXPO_PUBLIC_NAME=value` lines only (skips comments/blanks). `read` gives the
# whole remainder (incl. any '=') to `value`, so base64/URL values survive intact.
while IFS='=' read -r name value; do
  case "$name" in
    EXPO_PUBLIC_GEMINI_API_KEY) echo "⏭  skip $name (server-only — must NOT ship in client)"; continue ;;
    EXPO_PUBLIC_*) ;;
    *) continue ;;
  esac
  value="${value%\"}"; value="${value#\"}"     # strip surrounding double quotes if any
  [ -n "$value" ] || { echo "⏭  skip $name (empty in .env)"; continue; }
  for env in $ENVS; do
    # EAS CLI reads stdin even in non-interactive mode. Detach it here so it cannot
    # consume the remaining `.env` lines from this loop after the first variable.
    if eas env:set --name "$name" --value "$value" --environment "$env" \
         --visibility plaintext --non-interactive </dev/null >/dev/null 2>&1; then
      echo "✅ $name → $env"
      count=$((count + 1))
    else
      echo "⚠️  $name → $env  (already exists or failed — update via dashboard if the value changed)"
    fi
  done
done < <(grep -E '^EXPO_PUBLIC_[A-Za-z0-9_]+=' .env)

echo
echo "Done ($count set). Verify with:  eas env:list --environment production"
