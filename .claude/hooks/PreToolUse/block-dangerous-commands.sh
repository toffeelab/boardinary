#!/bin/bash
# block-dangerous-commands.sh — 위험한 명령어 차단
# 트리거: PreToolUse (matcher: Bash)
# 보안 모드: fail-closed (기본)

# === 설정 (init-harness.sh가 치환) ===
# BLOCKED_PATTERNS 배열: 정규식. 프로젝트별 패턴을 여기에 추가.
BLOCKED_PATTERNS=(
  'git push.*(--force| -f\b|--force-with-lease)'
  'git push.*--delete'
  'git push [^ ]+ :'
  'git reset --hard'
  'git checkout \.'
  'git clean -[a-z]*f'
  'rm -rf /'
  'drop table'
  'truncate table'
)

# SQL 패턴 (case-insensitive 매칭 대상)
SQL_PATTERNS=('drop table' 'truncate table')

source "$(dirname "$0")/../_lib/common.sh"

COMMAND=$(hook_get '.tool_input.command')
[ -z "$COMMAND" ] && exit 0

NORMALIZED=$(hook_normalize_command "$COMMAND")
LOWER_NORMALIZED=$(echo "$NORMALIZED" | tr '[:upper:]' '[:lower:]')

for pattern in "${BLOCKED_PATTERNS[@]}"; do
  is_sql=false
  for sql_pat in "${SQL_PATTERNS[@]}"; do
    [ "$pattern" = "$sql_pat" ] && is_sql=true && break
  done

  if [ "$is_sql" = true ]; then
    if echo "$LOWER_NORMALIZED" | grep -qE "$pattern"; then
      hook_block "Command matches blocked pattern: $pattern"
    fi
  else
    if echo "$NORMALIZED" | grep -qE "$pattern"; then
      hook_block "Command matches blocked pattern: $pattern"
    fi
  fi
done

exit 0
