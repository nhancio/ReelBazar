#!/usr/bin/env bash
set -euo pipefail
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NODE20_BIN="/opt/homebrew/opt/node@20/bin"
if [[ -x "$NODE20_BIN/node" ]]; then
  export PATH="$NODE20_BIN:/opt/homebrew/bin:$PATH"
  NODE_EXEC="$NODE20_BIN/node"
else
  NODE_EXEC="$(command -v node)"
fi
export NODE_ENV=production EXPO_PUBLIC_APP_ENV=production
cd "$PROJECT_ROOT"
node "$PROJECT_ROOT/scripts/releasePreflight.js" android
node "$PROJECT_ROOT/scripts/syncAndroidVersionFromPlay.js" --check
APP_VERSION="$($NODE_EXEC -p "require('./app.config.js').expo.version")"
VERSION_CODE="$($NODE_EXEC -p "require('./app.config.js').expo.android.versionCode")"
ARTIFACT_DIR="${EAS_LOCAL_BUILD_ARTIFACTS_DIR:-$PROJECT_ROOT/artifacts}"
AAB="${1:-$ARTIFACT_DIR/rava-${APP_VERSION}-${VERSION_CODE}.aab}"
if [[ ! -f "$AAB" ]]; then
  echo "Missing Android App Bundle: $AAB" >&2
  echo 'Build it first with ./scripts/buildaab.sh' >&2
  exit 1
fi
echo "Submitting local AAB to Google Play Internal testing: $AAB"
eas submit --platform android --profile production --path "$AAB"
