#!/usr/bin/env bash
set -euo pipefail
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NODE20_BIN="/opt/homebrew/opt/node@20/bin"
if [[ -x "$NODE20_BIN/node" ]]; then
  export PATH="$NODE20_BIN:/opt/homebrew/bin:$PATH"
fi
export NODE_ENV=production EXPO_PUBLIC_APP_ENV=production
cd "$PROJECT_ROOT"
node "$PROJECT_ROOT/scripts/releasePreflight.js" ios
IPA_PATH="${1:-}"
if [[ -n "$IPA_PATH" ]]; then
  if [[ ! -f "$IPA_PATH" ]]; then
    echo "Missing iOS IPA artifact: $IPA_PATH" >&2
    exit 1
  fi
  echo "Submitting local IPA to App Store Connect / TestFlight: $IPA_PATH"
  eas submit --platform ios --profile production --path "$IPA_PATH" --non-interactive
else
  echo "Submitting latest EAS iOS production build to App Store Connect / TestFlight..."
  eas submit --platform ios --profile production --latest --non-interactive
fi
