#!/bin/bash
# Post-edit hook: run biome check + type check on the affected package
# Success: silent (exit 0). Failure: output errors (exit 2).
set -euo pipefail

cd "${CLAUDE_PROJECT_DIR:-.}"

# Determine which package was edited from the tool input
file_path=$(jq -r '.tool_input.file_path // empty')
if [ -z "$file_path" ]; then
  exit 0
fi

# Map file path to package filter
case "$file_path" in
  */apps/web/*)   filter="--filter @sugara/web" ;;
  */apps/api/*)   filter="--filter @sugara/api" ;;
  */packages/shared/*) filter="--filter @sugara/shared" ;;
  *) exit 0 ;; # Files outside packages (root config, docs, etc.)
esac

errors=""

# Biome check (lint + format) on the affected package
output=$(bun run $filter check 2>&1) || errors="${errors}${output}\n"

# TypeScript type check on the affected package
output=$(bun run $filter check-types 2>&1) || errors="${errors}${output}\n"

if [ -n "$errors" ]; then
  echo "$errors" >&2
  exit 2
fi
