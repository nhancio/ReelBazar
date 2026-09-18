#!/usr/bin/env bash
set -euo pipefail
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NODE20_BIN="/opt/homebrew/opt/node@20/bin"
if [[ -x "$NODE20_BIN/node" ]]; then
  export PATH="$NODE20_BIN:/opt/homebrew/bin:$PATH"
fi
export NODE_ENV=production EXPO_PUBLIC_APP_ENV=preview
cd "$PROJECT_ROOT"
./scripts/prepareReleaseCommit.sh
npm run verify
eas build --platform android --profile preview --non-interactive
