#!/bin/bash
# Post-stop hook: gate 1 — block Stop if failure-log has unresolved entries.
#                 gate 2 — run tests for packages touched in this session.
# Success: silent (exit 0). Failure: output errors (exit 2).
#
# Full-monorepo `bun run test` on every stop was ~13s for a ~1100-test suite and ran even when
# the model had only edited docs. Opus 4.7 can judge when to run tests itself, so this hook now
# acts as a safety net that only kicks in for packages with staged/unstaged changes.
set -euo pipefail

cd "${CLAUDE_PROJECT_DIR:-.}"

LOG_FAILURE="/Users/mikiya/ws/claude-settings/hooks/log-failure.sh"
LOG_FILE="${CLAUDE_PROJECT_DIR:-.}/.claude/failure-log.jsonl"

# Gate 1: refuse to stop while unresolved lint/type errors are logged. This runs BEFORE the
# test-skip escape (SUGARA_SKIP_POST_STOP_TEST) because that escape is about skipping tests, not
# about ignoring known lint/type failures. Escape hatch for this gate: SUGARA_IGNORE_FAILURE_LOG=1.
if [ "${SUGARA_IGNORE_FAILURE_LOG:-0}" != "1" ] && [ -s "$LOG_FILE" ]; then
  count=$(wc -l < "$LOG_FILE" | tr -d ' ')
  cat >&2 <<EOF
[Harness] 未解決の failure が ${count} 件残っています (.claude/failure-log.jsonl)
セッション終了前に以下を実施してください:
  1. 'bun run check && bun run check-types' が zero error で通ることを確認
  2. zero error を確認できたら 'rm .claude/failure-log.jsonl' でクリア
  3. 本当に無視する場合のみ SUGARA_IGNORE_FAILURE_LOG=1 を設定
EOF
  exit 2
fi

# Short-circuit test execution when requested (e.g. long debug sessions, interactive work).
if [ "${SUGARA_SKIP_POST_STOP_TEST:-0}" = "1" ]; then
  exit 0
fi

# Gate 2: scope tests to packages with staged/unstaged/untracked changes.
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
