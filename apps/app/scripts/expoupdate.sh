#!/usr/bin/env bash
set -euo pipefail
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NODE20_BIN="/opt/homebrew/opt/node@20/bin"
if [[ -x "$NODE20_BIN/node" ]]; then
  export PATH="$NODE20_BIN:/opt/homebrew/bin:$PATH"
fi
BRANCH="${EAS_BRANCH:-preview}"
PLATFORM="${EAS_PLATFORM:-all}"
MESSAGE="${1:-chore(app): OTA update for Android & iOS}"
export NODE_ENV=production EXPO_PUBLIC_APP_ENV="$BRANCH"
cd "$PROJECT_ROOT"
npm run verify
eas update --branch "$BRANCH" --platform "$PLATFORM" --message "$MESSAGE" --non-interactive
