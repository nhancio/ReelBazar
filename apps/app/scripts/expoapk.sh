#!/usr/bin/env bash
set -euo pipefail
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NODE20_BIN="/opt/homebrew/opt/node@20/bin"
if [[ -x "$NODE20_BIN/node" ]]; then
  export PATH="$NODE20_BIN:/opt/homebrew/bin:$PATH"
fi
PROFILE="${EAS_PROFILE:-preview}"
WAIT_FLAG="${EAS_WAIT_FLAG:---no-wait}"
export NODE_ENV=production EXPO_PUBLIC_APP_ENV="$PROFILE"
cd "$PROJECT_ROOT"
./scripts/prepareReleaseCommit.sh
node "$PROJECT_ROOT/scripts/releasePreflight.js" android
npm run verify
eas build --platform android --profile "$PROFILE" --non-interactive $WAIT_FLAG
