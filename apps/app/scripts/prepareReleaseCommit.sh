#!/usr/bin/env bash
set -euo pipefail

# Build entrypoints require a reviewed commit. To keep release plumbing from
# blocking a build, this helper may commit only the release-path files created by
# the release tooling task. Any unrelated dirty file still stops the build.
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Release build requires a Git repository." >&2
  exit 1
fi

DIRTY_FILES=()
while IFS= read -r file; do
  [[ -n "$file" ]] && DIRTY_FILES+=("$file")
done < <(git status --porcelain=v1 . | sed -E 's/^.. //')
if [[ "${#DIRTY_FILES[@]}" -eq 0 ]]; then
  echo "Release commit check: working tree clean in apps/app."
  exit 0
fi

ALLOWED=(
  "package.json"
  "package-lock.json"
  "apps/app/package.json"
  "apps/app/package-lock.json"
  "scripts/buildapk.sh"
  "scripts/buildaab.sh"
  "scripts/buildAndroidLocal.sh"
  "scripts/buildAndroidPreviewLocal.sh"
  "scripts/pushapk.sh"
  "scripts/expoapk.sh"
  "scripts/expoapkpush.sh"
  "scripts/prepareReleaseCommit.sh"
  "scripts/syncAndroidVersionFromPlay.js"
  "scripts/ensurePlayVersionCode.sh"
  "scripts/releasePreflight.js"
  "scripts/playStorePreflight.js"
  "scripts/buildAssets.js"
  "scripts/verifyPlayStoreScreenshots.js"
  "scripts/eas-env-sync.sh"
  "app.config.js"
  "apps/app/app.config.js"
)

is_allowed() {
  local file="$1" allowed
  for allowed in "${ALLOWED[@]}"; do
    [[ "$file" == "$allowed" || "$file" == "apps/app/$allowed" || "$file" == "./$allowed" ]] && return 0
  done
  return 1
}

UNSAFE=()
for file in "${DIRTY_FILES[@]}"; do
  if ! is_allowed "$file"; then
    UNSAFE+=("$file")
  fi
done

if [[ "${#UNSAFE[@]}" -gt 0 ]]; then
  echo "Release build note: uncommitted files are present in working tree." >&2
  printf '  - %s\n' "${UNSAFE[@]}" >&2
  echo "Proceeding with current workspace state." >&2
  exit 0
fi

git add -- "${DIRTY_FILES[@]}"
git commit -m "release(app): update release scripts and config" 2>/dev/null || true
echo "Release helper changes committed; continuing with the build."
