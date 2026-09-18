#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NODE20_BIN="/opt/homebrew/opt/node@20/bin"
JDK17_HOME="/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home"
ARTIFACT_DIR="${EAS_LOCAL_BUILD_ARTIFACTS_DIR:-$PROJECT_ROOT/artifacts}"
MIN_FREE_KB=$((10 * 1024 * 1024))

# `eas build --local` unpacks the project into $TMPDIR/eas-build-local-nodejs/<uuid>
# and only removes it when the build succeeds. Every failed or interrupted build
# strands several GB there, so the free-space check below eventually fails on a
# machine that is not actually short of space. Reclaim anything left by a build
# that is no longer running (untouched for over an hour) before measuring.
reclaim_stale_local_build_scratch() {
  local tmp_root="${TMPDIR:-/tmp}"
  local scratch="${tmp_root%/}/eas-build-local-nodejs"
  [[ -d "$scratch" ]] || return 0
  local before after
  before="$(df -Pk "$PROJECT_ROOT" | awk 'NR == 2 { print $4 }')"
  find "$scratch" -mindepth 1 -maxdepth 1 -type d -mmin +60 -exec rm -rf {} + 2>/dev/null || true
  rmdir "$scratch" 2>/dev/null || true
  after="$(df -Pk "$PROJECT_ROOT" | awk 'NR == 2 { print $4 }')"
  if [[ "$before" =~ ^[0-9]+$ && "$after" =~ ^[0-9]+$ && "$after" -gt "$before" ]]; then
    echo "Reclaimed $(( (after - before) / 1024 )) MB of stale EAS local build scratch from $scratch"
  fi
}

if [[ -x "$NODE20_BIN/node" ]]; then
  export PATH="$NODE20_BIN:/opt/homebrew/bin:$PATH"
  NODE_EXEC="$NODE20_BIN/node"
else
  NODE_EXEC="$(command -v node)"
fi

if [[ -d "$JDK17_HOME" ]]; then
  export JAVA_HOME="$JDK17_HOME"
fi

export NODE_ENV=production
export EXPO_PUBLIC_APP_ENV=production

cd "$PROJECT_ROOT"
bash "$PROJECT_ROOT/scripts/prepareReleaseCommit.sh"
bash "$PROJECT_ROOT/scripts/ensurePlayVersionCode.sh"
node "$PROJECT_ROOT/scripts/releasePreflight.js" android || node "$PROJECT_ROOT/scripts/playStorePreflight.js"

reclaim_stale_local_build_scratch

FREE_KB="$(df -Pk "$PROJECT_ROOT" | awk 'NR == 2 { print $4 }')"
if [[ "$FREE_KB" =~ ^[0-9]+$ && "$FREE_KB" -lt "$MIN_FREE_KB" ]]; then
  echo "Warning: Less than 10 GB of free disk space available (${FREE_KB} KB)." >&2
fi

APP_VERSION="$($NODE_EXEC -p "require('./app.config.js').expo.version")"
VERSION_CODE="$($NODE_EXEC -p "require('./app.config.js').expo.android.versionCode")"
mkdir -p "$ARTIFACT_DIR"
OUTPUT="$ARTIFACT_DIR/rava-${APP_VERSION}-${VERSION_CODE}.aab"

echo "Building signed Android AAB locally: $OUTPUT"
eas build \
  --platform android \
  --profile production \
  --local \
  --non-interactive \
  --output "$OUTPUT"

echo "Created $OUTPUT"
