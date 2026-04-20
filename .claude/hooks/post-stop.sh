#!/bin/bash
# Post-stop hook: run tests *for the packages touched in this session* when Claude stops.
# Success: silent (exit 0). Failure: output errors (exit 2).
#
# Full-monorepo `bun run test` on every stop was ~13s for a ~1100-test suite and ran even when
# the model had only edited docs. Opus 4.7 can judge when to run tests itself, so this hook now
# acts as a safety net that only kicks in for packages with staged/unstaged changes.
set -euo pipefail

cd "${CLAUDE_PROJECT_DIR:-.}"

LOG_FAILURE="/Users/mikiya/ws/claude-settings/hooks/log-failure.sh"

# Short-circuit when the whole hook is disabled (e.g. long debug sessions, interactive work).
if [ "${SUGARA_SKIP_POST_STOP_TEST:-0}" = "1" ]; then
  exit 0
fi

# Collect the set of changed package filters. Looking at both staged and unstaged changes covers
# both mid-session edits and staged-but-not-committed state. Untracked files are picked up too.
changed=$(git status --porcelain 2>/dev/null | awk '{print $2}' || true)
if [ -z "$changed" ]; then
  exit 0
fi

filters=()
add_filter() {
  for existing in "${filters[@]:-}"; do
    [ "$existing" = "$1" ] && return
  done
  filters+=("$1")
}

while IFS= read -r path; do
  [ -z "$path" ] && continue
  case "$path" in
    apps/web/*)        add_filter "--filter=@sugara/web" ;;
    apps/api/*)        add_filter "--filter=@sugara/api" ;;
    packages/shared/*) add_filter "--filter=@sugara/shared" ;;
  esac
done <<< "$changed"

# No touched packages → nothing to run.
if [ "${#filters[@]}" -eq 0 ]; then
  exit 0
fi

output=$(bun run "${filters[@]}" test 2>&1) || {
  [ -x "$LOG_FAILURE" ] && echo "$output" | "$LOG_FAILURE" test
  echo "$output" >&2
  exit 2
}
