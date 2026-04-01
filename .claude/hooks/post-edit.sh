#!/bin/bash
# Post-edit hook: run biome check + type check after edits
# Success: silent (exit 0). Failure: output errors (exit 2).
set -euo pipefail

cd "${CLAUDE_PROJECT_DIR:-.}"

errors=""

# Biome check (lint + format)
output=$(bun run check 2>&1) || errors="${errors}${output}\n"

# TypeScript type check
output=$(bun run check-types 2>&1) || errors="${errors}${output}\n"

if [ -n "$errors" ]; then
  echo "$errors" >&2
  exit 2
fi
