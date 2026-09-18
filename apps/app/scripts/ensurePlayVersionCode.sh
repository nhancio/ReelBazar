#!/usr/bin/env bash
set -euo pipefail

# Store AABs must use a versionCode Play has never accepted. Query the console,
# set app.config.js to max(local, playMax + 1), and commit that bump if needed.
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NODE_BIN="/opt/homebrew/opt/node@20/bin"
if [[ ! -x "$NODE_BIN/node" ]]; then
  NODE_BIN="$(dirname "$(command -v node)")"
fi
export PATH="$NODE_BIN:/opt/homebrew/bin:$PATH"
cd "$PROJECT_ROOT"

node "$PROJECT_ROOT/scripts/syncAndroidVersionFromPlay.js"

if git diff --quiet -- app.config.js; then
  exit 0
fi

git add -- app.config.js
NEXT="$("$NODE_BIN/node" -p "require('./app.config.js').expo.android.versionCode")"
git commit -m "release(android): bump versionCode to ${NEXT} from Play Console" 2>/dev/null || true
echo "Committed Android versionCode ${NEXT} from Play Console."
