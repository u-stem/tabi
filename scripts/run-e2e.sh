#!/bin/bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BASE_URL="http://localhost:3000"
DEV_PID=""

cleanup() {
  if [ -n "$DEV_PID" ]; then
    # Kill process group to stop child processes (Next.js dev server)
    kill -- -"$DEV_PID" 2>/dev/null || kill "$DEV_PID" 2>/dev/null || true
    wait "$DEV_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

# Start dev server if not running
if ! curl -sf "$BASE_URL" > /dev/null 2>&1; then
  echo "Starting dev server..."
  cd "$PROJECT_ROOT"
  # Run in a new process group so cleanup can stop all child processes
  set -m
  bun run --filter @sugara/web dev &
  DEV_PID=$!
  set +m
  echo "Waiting for dev server..."
  for i in $(seq 1 60); do
    if curl -sf "$BASE_URL" > /dev/null 2>&1; then
      break
    fi
    sleep 1
  done
  if ! curl -sf "$BASE_URL" > /dev/null 2>&1; then
    echo "Dev server failed to start"
    exit 1
  fi
fi

# Run Playwright in Docker
# - npx is used because bun is not available in the Playwright Docker image
# - --add-host is needed for Linux (Docker Desktop on macOS resolves it automatically)
docker run --rm \
  -v "$PROJECT_ROOT:/work" \
  -w /work/apps/web \
  -e CI=1 \
  -e PLAYWRIGHT_BASE_URL="http://host.docker.internal:3000" \
  --add-host=host.docker.internal:host-gateway \
  mcr.microsoft.com/playwright:v1.58.2-noble \
  npx playwright test "$@"
