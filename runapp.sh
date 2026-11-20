#!/usr/bin/env bash
#
# Run ONLY the new /myacc app (rava.one/myacc) locally:
#   - backend/server    -> API (tsx watch)        http://localhost:4000
#   - apps/landing-page -> /myacc (next dev)      http://localhost:3001/myacc
#
# The old apps (web-app PWA on :3000, Expo app, old landing sections) are NOT
# started. The old landing page is still reachable at /legacy in the browser.
#
# Usage:
#   ./runapp.sh            start backend + landing, open /myacc in the browser
#   ./runapp.sh --no-open  start without opening the browser
#   ./stop.sh              stop (also stops these services)
#
# Ctrl+C stops both services.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

OPEN_BROWSER=1
for arg in "$@"; do
  case "$arg" in
    --no-open) OPEN_BROWSER=0 ;;
    -h|--help)
      echo "Usage: ./runapp.sh [--no-open]"
      echo "  Starts the /myacc app only: backend API on :4000 + landing on :3001/myacc"
      exit 0
      ;;
    *) echo "Unknown option: $arg (use --help)" >&2; exit 1 ;;
  esac
done

command -v node >/dev/null 2>&1 || { echo "Node.js is required." >&2; exit 1; }
command -v npm  >/dev/null 2>&1 || { echo "npm is required." >&2; exit 1; }

# Dependencies (workspaces hoist to the repo root; install once, not every run).
if [ ! -d node_modules ]; then
  echo "Installing dependencies..."
  npm install
fi

# Backend env: needed for Firebase + (optionally) Meta keys. Sample-card mode
# works with the example file untouched; real Instagram data needs the
# INSTAGRAM_* / META_DISCOVERY_* values filled in (see backend/server/.env.example).
if [ ! -f backend/server/.env ]; then
  cp backend/server/.env.example backend/server/.env
  echo "Created backend/server/.env from .env.example (sample card works; add Meta keys for live data)."
fi
if grep -q '^INSTAGRAM_REDIRECT_URI=https://rava.one' backend/server/.env 2>/dev/null; then
  echo "Note: INSTAGRAM_REDIRECT_URI in backend/server/.env points at production."
  echo "      For local Instagram login use http://localhost:3001/myacc and whitelist"
  echo "      that exact URI in your Meta app dashboard. @handle/sample flows are unaffected."
fi

# Free-port check so we fail loudly instead of attaching to someone else's server.
for port in 4000 3001; do
  if command -v lsof >/dev/null 2>&1 && lsof -ti ":$port" >/dev/null 2>&1; then
    echo "Port $port is already in use. Run ./stop.sh first, then ./runapp.sh" >&2
    exit 1
  fi
done

PIDS=()
cleanup() {
  echo ""
  echo "Stopping /myacc app..."
  for pid in "${PIDS[@]:-}"; do
    [ -n "$pid" ] && kill -TERM "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null || true
}
trap cleanup INT TERM EXIT

echo "================================================="
echo "Rava /myacc — local app"
echo "  API:     http://localhost:4000/api/v1/instagram/config"
echo "  App:     http://localhost:3001/myacc"
echo "  Legacy:  http://localhost:3001/legacy (old landing, kept aside)"
echo "================================================="

(cd backend/server && npm run dev) &
PIDS+=($!)

# Inline env wins over any .env.local, so local always talks to the local API.
(cd apps/landing-page && NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1 npm run dev) &
PIDS+=($!)

# Wait until both answer, then open the app.
ready=0
for _ in $(seq 1 60); do
  if curl -fs http://localhost:4000/api/v1/instagram/config >/dev/null 2>&1 \
     && curl -fs http://localhost:3001/myacc >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 1
done

if [ "$ready" = 1 ]; then
  echo ""
  echo "Ready → http://localhost:3001/myacc  (Ctrl+C to stop)"
  if [ "$OPEN_BROWSER" = 1 ] && [ "$(uname -s)" = "Darwin" ]; then
    open http://localhost:3001/myacc >/dev/null 2>&1 || true
  fi
else
  echo "Services are taking a while to come up — check the logs above. App: http://localhost:3001/myacc" >&2
fi

wait
