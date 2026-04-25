#!/bin/bash
# Post-edit hook: run biome check + type check on the affected package.
# Success: silent (exit 0). Failure: output errors (exit 2).
# Skips files that don't affect lint/type-check (docs, data, config, SQL migrations) to avoid
# wasted work and false positives from the post-Edit transient state (e.g. a follow-up Edit
# that consumes a just-added import hasn't fired yet).
#
# failure-log.jsonl is treated as CURRENT state (not append-only history): before appending new
# failures we prune entries for this package+category. Stop hook blocks on any remaining entry,
# so the log must accurately reflect unresolved failures.
set -euo pipefail

cd "${CLAUDE_PROJECT_DIR:-.}"

LOG_FAILURE="/Users/mikiya/ws/claude-settings/hooks/log-failure.sh"
LOG_FILE="${CLAUDE_PROJECT_DIR:-.}/.claude/failure-log.jsonl"

# Read stdin once (hook framework pipes JSON with tool_input)
input=$(cat)

# Determine which package was edited from the tool input
file_path=$(echo "$input" | jq -r '.tool_input.file_path // empty')
if [ -z "$file_path" ]; then
  exit 0
fi

# Skip non-code files that won't produce lint/type-check errors
case "$file_path" in
  *.md|*.mdx|*.json|*.jsonc|*.toml|*.yaml|*.yml|*.sql|*.txt|*.sh|*.env*|*.gitignore|*.lockb|*.lock)
    exit 0 ;;
esac

# Map file path to package filter + package name
case "$file_path" in
  */apps/web/*)        filter="--filter @sugara/web";    pkg="@sugara/web" ;;
  */apps/api/*)        filter="--filter @sugara/api";    pkg="@sugara/api" ;;
  */packages/shared/*) filter="--filter @sugara/shared"; pkg="@sugara/shared" ;;
  *) exit 0 ;; # Files outside packages (root config, docs, etc.)
esac

# Drop stale entries for this package+category from the log before recording fresh state.
prune_log() {
  local category="$1"
  [ -f "$LOG_FILE" ] || return 0
  local tmp
  tmp=$(mktemp)
  jq -c --arg pkg "$pkg" --arg cat "$category" \
    'select(.category != $cat or (.error | startswith($pkg + " ") | not))' \
    "$LOG_FILE" > "$tmp" 2>/dev/null || cp "$LOG_FILE" "$tmp"
  if [ -s "$tmp" ]; then
    mv "$tmp" "$LOG_FILE"
  else
    rm -f "$LOG_FILE" "$tmp"
  fi
}

run_check() {
  local category="$1"
  local cmd="$2"
  local output rc
  set +e
  output=$(bun run $filter $cmd 2>&1)
  rc=$?
  set -e
  prune_log "$category"
  if [ $rc -ne 0 ]; then
    errors="${errors}${output}\n"
    [ -x "$LOG_FAILURE" ] && echo "$output" | "$LOG_FAILURE" "$category"
  fi
}

errors=""
run_check check       check
run_check check-types check-types

if [ -n "$errors" ]; then
  echo -e "$errors" >&2
  exit 2
fi
