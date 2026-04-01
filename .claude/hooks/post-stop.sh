#!/bin/bash
# Post-stop hook: run tests when Claude stops
# Success: silent (exit 0). Failure: output errors (exit 2).
set -euo pipefail

cd "${CLAUDE_PROJECT_DIR:-.}"

LOG_FAILURE="/Users/mikiya/ws/claude-settings/hooks/log-failure.sh"

output=$(bun run test 2>&1) || {
  [ -x "$LOG_FAILURE" ] && echo "$output" | "$LOG_FAILURE" test
  echo "$output" >&2
  exit 2
}
