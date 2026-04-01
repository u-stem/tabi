#!/bin/bash
# Post-stop hook: run tests when Claude stops
# Success: silent (exit 0). Failure: output errors (exit 2).
set -euo pipefail

cd "${CLAUDE_PROJECT_DIR:-.}"

output=$(bun run test 2>&1) || { echo "$output" >&2; exit 2; }
