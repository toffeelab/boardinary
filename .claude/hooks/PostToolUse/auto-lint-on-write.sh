#!/usr/bin/env bash
# auto-lint-on-write.sh — 파일 저장 후 자동 lint
# 트리거: PostToolUse (matcher: Write|Edit)
# 보안 모드: fail-open (lint는 정보 제공용)

# === 설정 (init-harness.sh가 치환) ===
LINT_EXTENSIONS=(ts tsx)
LINT_CMD="npx eslint --fix"

HOOK_FAIL_OPEN=1
source "$(dirname "$0")/../_lib/common.sh"

# 플레이스홀더 미치환 가드
if [[ "${LINT_EXTENSIONS[0]}" == *"{{"* ]]; then
  hook_warn "Placeholders not substituted. Run init-harness.sh first. Hook skipped."
  exit 0
fi

FILE_PATH=$(hook_get '.tool_input.file_path')
[ -z "$FILE_PATH" ] && exit 0

# 파일 존재 확인
[ ! -f "$FILE_PATH" ] && exit 0

# 확장자 체크
EXT="${FILE_PATH##*.}"
MATCH=false
for ext in "${LINT_EXTENSIONS[@]}"; do
  [ "$EXT" = "$ext" ] && MATCH=true && break
done
[ "$MATCH" = false ] && exit 0

# lint 실행
$LINT_CMD "$FILE_PATH" 2>&1 | while IFS= read -r line; do
  echo "$line" >&2
done

exit 0
