#!/bin/bash
# warn-main-branch-edit.sh — 보호 브랜치에서 코드 수정 차단
# 트리거: PreToolUse (matcher: Edit|Write)
# 보안 모드: fail-closed (기본)

# === 설정 (init-harness.sh가 치환) ===
PROTECTED_BRANCHES=("{{MAIN_BRANCH}}" "{{DEVELOP_BRANCH}}")
ALLOWED_PATHS=("docs/")

source "$(dirname "$0")/../_lib/common.sh"

# 플레이스홀더 미치환 가드
if [[ "${PROTECTED_BRANCHES[0]}" == *"{{"* ]]; then
  hook_warn "Placeholders not substituted. Run init-harness.sh first. Hook skipped."
  exit 0
fi

FILE_PATH=$(hook_get '.tool_input.file_path')
[ -z "$FILE_PATH" ] && exit 0

# 허용 경로 체크
for allowed in "${ALLOWED_PATHS[@]}"; do
  if [[ "$FILE_PATH" == "$allowed"* ]]; then
    exit 0
  fi
done

# 현재 브랜치 확인
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")

# detached HEAD — 경고 후 통과
if [ "$CURRENT_BRANCH" = "HEAD" ] || [ -z "$CURRENT_BRANCH" ]; then
  hook_warn "Detached HEAD state detected. Branch protection skipped."
  exit 0
fi

# 보호 브랜치 체크
for branch in "${PROTECTED_BRANCHES[@]}"; do
  if [ "$CURRENT_BRANCH" = "$branch" ]; then
    hook_block "Cannot edit files on protected branch '$branch'. Use a feature branch or worktree."
  fi
done

exit 0
