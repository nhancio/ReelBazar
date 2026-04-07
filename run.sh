#!/bin/bash
set -euo pipefail

# Starts all local dev services via Turbo:
# - backend/server    -> API (tsx watch src/index.ts)
# - apps/web-app      -> PWA frontend (vite)
# - apps/landing-page -> landing page (next dev -p 3001)
#
# Usage:
#   ./run.sh

echo "Installing dependencies..."
npm install

echo "Starting dev services (API + PWA + landing)..."
npm run dev
