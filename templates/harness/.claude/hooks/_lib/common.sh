#!/bin/bash
# .claude/hooks/_lib/common.sh — 모든 hook이 source하는 공유 유틸
# 보안 원칙: PreToolUse = fail-closed, PostToolUse = HOOK_FAIL_OPEN=1로 fail-open

# === jq 의존성 체크 ===
if ! command -v jq &>/dev/null; then
  if [ "${HOOK_FAIL_OPEN:-0}" = "1" ]; then
    echo "WARNING: jq not installed. Hook skipped." >&2
    exit 0
  else
    echo "BLOCKED: jq is required for security hooks. Install: brew install jq (macOS) / apt install jq (Linux)" >&2
    exit 2
  fi
fi

# === stdin에서 JSON 읽기 ===
HOOK_INPUT=$(cat)

# JSON 유효성 검증
if ! printf '%s' "$HOOK_INPUT" | jq empty 2>/dev/null; then
  if [ "${HOOK_FAIL_OPEN:-0}" = "1" ]; then
    echo "WARNING: Failed to parse hook input JSON. Hook skipped." >&2
    exit 0
  else
    echo "BLOCKED: Failed to parse hook input JSON." >&2
    exit 2
  fi
fi

# === 공통 필드 추출 헬퍼 ===
hook_get() {
  printf '%s' "$HOOK_INPUT" | jq -r "$1 // empty"
}

# === 명령어 정규화 (보안 매칭용) ===
# env VAR=x, command, sudo 프리픽스 제거 + 다중 공백 정규화
hook_normalize_command() {
  echo "$1" | sed -E 's/^(env[[:space:]]+[A-Z_]+=[^[:space:]]+[[:space:]]+|command[[:space:]]+|sudo[[:space:]]+)*//' | tr -s ' '
}

# === 표준 차단 함수 ===
hook_block() {
  echo "BLOCKED: $1" >&2
  exit 2
}

# === 표준 경고 함수 ===
hook_warn() {
  echo "WARNING: $1" >&2
}
