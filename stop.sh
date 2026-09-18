#!/usr/bin/env bash
#
# Stop everything started by ./run.sh (Turbo dev: backend API, web-app PWA, landing page).
#
# ./run.sh runs `npm run dev` -> `turbo run dev`, which fans out to:
#   - backend/server    -> API           (tsx watch src/index.ts)   port 4000
#   - apps/web-app      -> PWA frontend  (vite)                     port 3000
#   - apps/landing-page -> landing page  (next dev -p 3001)         port 3001
#
# Usage:
#   ./stop.sh [-h|--help]
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

for arg in "$@"; do
  case "$arg" in
    -h|--help)
      echo "Usage: ./stop.sh"
      echo "  Stops Rava's dev services started by ./run.sh:"
      echo "    - backend API        (tsx watch src/index.ts) on port 4000"
      echo "    - web-app PWA        (vite)                   on port 3000"
      echo "    - landing page       (next dev -p 3001)       on port 3001"
      echo "  Also stops the Turbo orchestrator process itself."
      exit 0
      ;;
    *)
      echo "Unknown option: $arg (use --help)" >&2
      exit 1
      ;;
  esac
done

is_our_process() {
  local pid="$1"
  local cmd
  cmd="$(ps -ww -p "$pid" -o command= 2>/dev/null || true)"
  [[ -z "$cmd" ]] && return 1
  [[ "$cmd" == *"$ROOT"* ]] && return 0
  [[ "$cmd" == *"tsx watch src/index.ts"* ]] && return 0
  [[ "$cmd" == *"turbo run dev"* ]] && return 0
  [[ "$cmd" == *"next dev"*"3001"* ]] && return 0
  # vite/next may show up without the full repo path on some setups
  [[ "$cmd" == *"vite"* && "$cmd" == *"web-app"* ]] && return 0
  [[ "$cmd" == *"reelbazaar"* || "$cmd" == *"reelbaazar"* ]] && return 0
  return 1
}

kill_pid_gracefully() {
  local pid="$1"
  local label="$2"
  if ! kill -0 "$pid" 2>/dev/null; then
    return 0
  fi
  echo "  stopping $label (pid $pid)"
  kill -TERM "$pid" 2>/dev/null || true
}

wait_pid_gone() {
  local pid="$1"
  local i
  for i in 1 2 3 4 5 6 7 8 9 10; do
    kill -0 "$pid" 2>/dev/null || return 0
    sleep 0.3
  done
  echo "  pid $pid still alive, sending SIGKILL"
  kill -KILL "$pid" 2>/dev/null || true
}

kill_port() {
  local port="$1"
  local label="$2"
  if ! command -v lsof >/dev/null 2>&1; then
    return 0
  fi
  local pids
  pids="$(lsof -ti ":$port" 2>/dev/null || true)"
  [ -z "$pids" ] && return 0
  local killed=0
  for pid in $pids; do
    if is_our_process "$pid"; then
      kill_pid_gracefully "$pid" "$label :$port"
      wait_pid_gone "$pid"
      killed=1
    fi
  done
  if [ "$killed" = 0 ] && [ -n "$pids" ]; then
    echo "  port $port in use by non-Rava process(es); left running"
  fi
}

kill_by_pattern() {
  local pattern="$1"
  local label="$2"
  local pids
  pids="$(pgrep -f "$pattern" 2>/dev/null || true)"
  [ -z "$pids" ] && return 0
  for pid in $pids; do
    if is_our_process "$pid"; then
      kill_pid_gracefully "$pid" "$label"
      wait_pid_gone "$pid"
    fi
  done
}

echo "================================================="
echo "Stopping Rava workspace"
echo "================================================="

echo "Turbo orchestrator (npm run dev)..."
kill_by_pattern "${ROOT}.*turbo run dev" "turbo"

echo "Backend API (port 4000)..."
kill_port 4000 "tsx/API"
kill_by_pattern "tsx watch src/index.ts" "tsx watch"

echo "Web-app PWA (port 3000)..."
kill_port 3000 "vite/web-app"

echo "Landing page (port 3001)..."
kill_port 3001 "next/landing-page"

# Second pass — Turbo/Next sometimes leave a child worker behind
sleep 0.5
kill_port 3000 "vite (cleanup)"
kill_port 3001 "next (cleanup)"
kill_port 4000 "tsx (cleanup)"

echo ""
echo "Done. Rava dev services should be stopped."
if command -v lsof >/dev/null 2>&1; then
  remaining=""
  for port in 3000 3001 4000; do
    if lsof -ti ":$port" >/dev/null 2>&1; then
      remaining="${remaining} ${port}"
    fi
  done
  if [ -n "$remaining" ]; then
    echo "Note: port(s) still in use:${remaining} (may be another app)."
  fi
fi
