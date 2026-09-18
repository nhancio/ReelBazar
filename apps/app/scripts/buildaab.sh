#!/usr/bin/env bash
set -euo pipefail
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
bash "$PROJECT_ROOT/scripts/prepareReleaseCommit.sh"
exec bash "$PROJECT_ROOT/scripts/buildAndroidLocal.sh" "$@"
