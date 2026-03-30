# Repository Level Harness Template — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 어떤 프로젝트에든 복사해서 바로 사용할 수 있는 범용 Claude Code 하네스 템플릿을 `templates/harness/`에 구현한다.

**Architecture:** Mirror 구조로 실제 프로젝트 디렉토리를 그대로 반영. `init-harness.sh`가 플레이스홀더 치환 + 모듈별 선택 설치를 담당. hook 스크립트는 `_lib/common.sh`를 source하여 보일러플레이트를 공유.

**Tech Stack:** Bash (hooks, scripts), GitHub Actions YAML (CI/CD), Markdown (CLAUDE.md, README, ESLint 가이드), JSON (settings.json)

**Spec:** `docs/superpowers/specs/2026-03-30-repo-level-harness-design.md`

---

## File Map

```
templates/harness/
├── .claude/
│   ├── settings.json.template
│   └── hooks/
│       ├── _lib/
│       │   └── common.sh
│       ├── PreToolUse/
│       │   ├── block-dangerous-commands.sh
│       │   └── warn-main-branch-edit.sh
│       └── PostToolUse/
│           └── auto-lint-on-write.sh
├── .github/
│   └── workflows/
│       ├── claude-review.yml
│       ├── ci.yml
│       └── cleanup-branches.yml
├── scripts/
│   ├── init-harness.sh
│   ├── health-check.sh
│   └── doc-check.sh
├── memory/
│   ├── MEMORY.md
│   └── _examples/
│       ├── user_role.md
│       ├── feedback_style.md
│       └── project_context.md
├── CLAUDE.md.template
├── .eslintrc.patterns.md
└── README.md
```

---

## Task 1: Hook 공유 라이브러리 (`_lib/common.sh`)

모든 hook의 기반. 먼저 구현해야 이후 hook에서 source 가능.

**Files:**

- Create: `templates/harness/.claude/hooks/_lib/common.sh`

- [ ] **Step 1: `common.sh` 작성**

```bash
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
if ! echo "$HOOK_INPUT" | jq empty 2>/dev/null; then
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
  echo "$HOOK_INPUT" | jq -r "$1 // empty"
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
```

- [ ] **Step 2: 실행 권한 부여**

Run: `chmod +x templates/harness/.claude/hooks/_lib/common.sh`

- [ ] **Step 3: 커밋**

```bash
git add templates/harness/.claude/hooks/_lib/common.sh
git commit -m "feat(harness): add hook shared library _lib/common.sh"
```

---

## Task 2: PreToolUse — `block-dangerous-commands.sh`

**Files:**

- Create: `templates/harness/.claude/hooks/PreToolUse/block-dangerous-commands.sh`

- [ ] **Step 1: 스크립트 작성**

```bash
#!/bin/bash
# block-dangerous-commands.sh — 위험한 명령어 차단
# 트리거: PreToolUse (matcher: Bash)
# 보안 모드: fail-closed (기본)

# === 설정 (init-harness.sh가 치환) ===
# BLOCKED_PATTERNS 배열: 정규식. 프로젝트별 패턴을 여기에 추가.
BLOCKED_PATTERNS=(
  'git push.*(--force|-f|--force-with-lease)'
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
```

- [ ] **Step 2: 실행 권한 부여**

Run: `chmod +x templates/harness/.claude/hooks/PreToolUse/block-dangerous-commands.sh`

- [ ] **Step 3: 커밋**

```bash
git add templates/harness/.claude/hooks/PreToolUse/block-dangerous-commands.sh
git commit -m "feat(harness): add block-dangerous-commands hook"
```

---

## Task 3: PreToolUse — `warn-main-branch-edit.sh`

**Files:**

- Create: `templates/harness/.claude/hooks/PreToolUse/warn-main-branch-edit.sh`

- [ ] **Step 1: 스크립트 작성**

```bash
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
```

- [ ] **Step 2: 실행 권한 부여**

Run: `chmod +x templates/harness/.claude/hooks/PreToolUse/warn-main-branch-edit.sh`

- [ ] **Step 3: 커밋**

```bash
git add templates/harness/.claude/hooks/PreToolUse/warn-main-branch-edit.sh
git commit -m "feat(harness): add warn-main-branch-edit hook"
```

---

## Task 4: PostToolUse — `auto-lint-on-write.sh`

**Files:**

- Create: `templates/harness/.claude/hooks/PostToolUse/auto-lint-on-write.sh`

- [ ] **Step 1: 스크립트 작성**

```bash
#!/bin/bash
# auto-lint-on-write.sh — 파일 저장 후 자동 lint
# 트리거: PostToolUse (matcher: Write|Edit)
# 보안 모드: fail-open (lint는 정보 제공용)

# === 설정 (init-harness.sh가 치환) ===
LINT_EXTENSIONS=({{LINT_EXTENSIONS}})
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
```

- [ ] **Step 2: 실행 권한 부여**

Run: `chmod +x templates/harness/.claude/hooks/PostToolUse/auto-lint-on-write.sh`

- [ ] **Step 3: 커밋**

```bash
git add templates/harness/.claude/hooks/PostToolUse/auto-lint-on-write.sh
git commit -m "feat(harness): add auto-lint-on-write hook"
```

---

## Task 5: `settings.json.template`

**Files:**

- Create: `templates/harness/.claude/settings.json.template`

- [ ] **Step 1: 템플릿 작성**

```jsonc
{
  "permissions": {
    "allow": [
      "Bash(git add:*)",
      "Bash(git commit:*)",
      "Bash(git push origin:*)",
      "Bash(git checkout:*)",
      "Bash(git worktree:*)",
      "Bash(git branch:*)",
      "Bash(git log:*)",
      "Bash(git diff:*)",
      "Bash(git status:*)",
      "Bash(gh pr:*)",
      "Bash({{PACKAGE_MANAGER}}:*)",
      "Bash({{PACKAGE_MANAGER}} run:*)",
      "Bash(docker compose:*)",
    ],
    "deny": [
      "Bash(git push --force:*)",
      "Bash(git push -f:*)",
      "Bash(git push --force-with-lease:*)",
      "Bash(git push --delete:*)",
      "Bash(git reset --hard:*)",
      "Bash(git clean -f:*)",
    ],
  },
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": ["sh .claude/hooks/PreToolUse/block-dangerous-commands.sh"],
      },
      {
        "matcher": "Edit|Write",
        "hooks": ["sh .claude/hooks/PreToolUse/warn-main-branch-edit.sh"],
      },
    ],
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": ["sh .claude/hooks/PostToolUse/auto-lint-on-write.sh"],
      },
    ],
  },
}
```

- [ ] **Step 2: 커밋**

```bash
git add templates/harness/.claude/settings.json.template
git commit -m "feat(harness): add settings.json template"
```

---

## Task 6: `CLAUDE.md.template`

**Files:**

- Create: `templates/harness/CLAUDE.md.template`

- [ ] **Step 1: 템플릿 작성**

```markdown
# CLAUDE.md — {{PROJECT_NAME}}

## 프로젝트 개요

<!-- 1-2문장으로 프로젝트가 뭔지 -->

## 기술 스택

<!-- 주요 기술만 나열. 버전 포함 -->

## 프로젝트 구조

<!-- 디렉토리 트리 + 각 디렉토리 역할 -->

## 명령어

### 개발

<!-- pnpm dev, npm run dev 등 -->

### 빌드

<!-- pnpm build 등 -->

### 테스트

<!-- pnpm test 등 -->

### 데이터베이스

<!-- 해당하는 경우만. 마이그레이션, 시드 등 -->

## 코드 컨벤션

### Import 규칙

<!-- 절대경로/상대경로 규칙, import 순서 등 -->

### 상태 관리

<!-- 어떤 상태 관리 도구를 쓰고, 원칙은 뭔지 -->

### 타입 규칙

<!-- any 금지, 타입 정의 위치 등 -->

### 린팅 & 포매팅

<!-- ESLint, Prettier 설정 요약 -->

## 개발 워크플로우

### Git Flow

<!-- 브랜치 전략, 네이밍 규칙, 커밋 컨벤션 -->

### PR 규칙

<!-- PR 대상 브랜치, 리뷰 절차 -->

### Worktree 기반 작업

<!-- 선택 — 병렬 작업이 필요한 경우. 불필요하면 이 섹션 삭제 -->

### 작업 순서

<!-- 선택 — Superpowers 스킬 사용 시. 불필요하면 이 섹션 삭제 -->

## 참조 문서

<!-- | 문서 | 경로 | 언제 참조 | -->
<!-- | ---- | ---- | --------- | -->

## 금지 사항

<!-- IMPORTANT: 절대 하면 안 되는 것들을 여기에 나열 -->
```

- [ ] **Step 2: 커밋**

```bash
git add templates/harness/CLAUDE.md.template
git commit -m "feat(harness): add CLAUDE.md template skeleton"
```

---

## Task 7: CI/CD — `claude-review.yml`

**Files:**

- Create: `templates/harness/.github/workflows/claude-review.yml`
- Reference: `/Users/ubitoffee/dev/web/boardinary/.github/workflows/claude-review.yml` (Boardinary 검증 코드)

- [ ] **Step 1: Boardinary claude-review.yml을 기반으로 범용화**

변경 포인트:

- `{{REVIEW_MODEL}}`, `{{REVIEW_LANGUAGE}}`, `{{DEVELOP_BRANCH}}` 플레이스홀더 적용
- shadcn/ui 등 프로젝트 특화 제외 경로 제거 → `EXCLUDE_PATTERNS` 변수로 분리
- 리뷰 프롬프트에서 한국어 하드코딩 제거 → `{{REVIEW_LANGUAGE}}` 사용
- `.claude/**`를 제외 경로에서 제거 (보안: hook 변경은 리뷰 대상)
- `anthropics/claude-code-action@v1` → `@<SHA>` (현재 최신 릴리스 SHA 조회 후 적용)
- `if: secrets.CLAUDE_CODE_OAUTH_TOKEN != ''` 조건 추가 (Secrets 미설정 시 graceful skip)

반드시 포함해야 할 핵심 구조:

```yaml
# 제외 경로: .claude/**는 포함하지 않음 (hook 변경은 리뷰 대상)
on:
  pull_request:
    types: [opened, synchronize, ready_for_review]
    paths-ignore:
      - "docs/**"
      - "*.md"
      - ".github/screenshots/**"
      # .claude/**는 의도적으로 제외하지 않음 — 보안상 hook 변경 리뷰 필수
  issue_comment:
    types: [created]

jobs:
  review:
    # Secrets 미설정 시 graceful skip
    if: |
      (github.event_name == 'pull_request' && github.event.pull_request.draft == false) ||
      (github.event_name == 'issue_comment' && contains(github.event.comment.body, '@claude'))
    steps:
      - name: Check secrets
        id: secrets-check
        run: |
          if [ -z "${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}" ]; then
            echo "skip=true" >> $GITHUB_OUTPUT
          fi

      - name: Claude Code Action
        if: steps.secrets-check.outputs.skip != 'true'
        uses: anthropics/claude-code-action@<SHA> # SHA 고정, @v1 사용 금지
        with:
          claude_code_oauth_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
          claude_args: "--model {{REVIEW_MODEL}} ..."
```

- [ ] **Step 2: SHA 고정을 위한 최신 릴리스 확인**

Run: `gh api repos/anthropics/claude-code-action/releases/latest --jq '.tag_name'`
그 후 해당 태그의 커밋 SHA를 조회하여 워크플로우에 적용.

- [ ] **Step 3: SHA 고정 검증**

Run: `grep -c '@v1' templates/harness/.github/workflows/claude-review.yml`
Expected: 0 (무빙 태그 없음)

- [ ] **Step 3: 커밋**

```bash
git add templates/harness/.github/workflows/claude-review.yml
git commit -m "feat(harness): add claude-review CI workflow template"
```

---

## Task 8: CI/CD — `ci.yml`

**Files:**

- Create: `templates/harness/.github/workflows/ci.yml`

- [ ] **Step 1: ci.yml 작성**

구조 (스펙 413-427행):

```yaml
# Job 의존성:
# lint (독립) ──┐
#               ├──→ build ──→ e2e (조건부)
# type-check (독립)─┘
# test (독립)
```

플레이스홀더 (5개 전부 사용):

- lint job: `{{LINT_CMD}}`
- type-check job: `{{TYPE_CHECK_CMD}}`
- build job: `{{BUILD_CMD}}`
- test job: `{{TEST_CMD}}`
- e2e job: `{{E2E_CMD}}`

e2e/test의 services 블록: `# TODO: Add your database service here` 주석
크론 실행 시에도 `DRY_RUN` 기본값은 `true` — 워크플로우 파일에서 명시적으로 `false`로 변경해야 실제 삭제

- [ ] **Step 2: 커밋**

```bash
git add templates/harness/.github/workflows/ci.yml
git commit -m "feat(harness): add ci.yml workflow template"
```

---

## Task 9: CI/CD — `cleanup-branches.yml`

**Files:**

- Create: `templates/harness/.github/workflows/cleanup-branches.yml`

- [ ] **Step 1: 워크플로우 작성**

- 크론: 일요일 03:00 UTC + `workflow_dispatch` (dry_run 입력 파라미터, 기본 `true`)
- `DRY_RUN` 환경변수로 dry-run 기본
- `{{BRANCH_PATTERN}}`, `{{RETENTION_DAYS}}` 플레이스홀더
- 보호 브랜치(main, develop) 명시적 제외

- [ ] **Step 2: 커밋**

```bash
git add templates/harness/.github/workflows/cleanup-branches.yml
git commit -m "feat(harness): add cleanup-branches workflow template"
```

---

## Task 10: Scripts — `init-harness.sh`

가장 복잡한 컴포넌트. 멱등성 + 모듈 선택 + 플레이스홀더 치환 + 충돌 처리.

**Files:**

- Create: `templates/harness/scripts/init-harness.sh`

- [ ] **Step 1: 기본 구조 작성**

```bash
#!/bin/bash
set -euo pipefail

VERSION="1.0.0"
HARNESS_CONFIG=".claude/.harness-config"

# 색상 출력
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info()  { echo -e "${GREEN}✓${NC} $1"; }
warn()  { echo -e "${YELLOW}!${NC} $1"; }
error() { echo -e "${RED}✗${NC} $1"; }
```

- [ ] **Step 2: 사전 검사 + --defaults / --check-update 플래그 파싱**

```bash
# 플래그 파싱
DEFAULTS_MODE=false
CHECK_UPDATE=false
while [[ $# -gt 0 ]]; do
  case $1 in
    --defaults) DEFAULTS_MODE=true; shift ;;
    --check-update) CHECK_UPDATE=true; shift ;;
    *) error "Unknown flag: $1"; exit 1 ;;
  esac
done

# 사전 검사
if ! command -v jq &>/dev/null; then
  error "jq is required. Install: brew install jq (macOS) / apt install jq (Linux)"
  exit 1
fi
if ! git rev-parse --is-inside-work-tree &>/dev/null; then
  error "Not a git repository."
  exit 1
fi
```

- [ ] **Step 3: 모듈 선택 함수 (한 줄 설명 포함)**

모듈 배열 + 각 모듈의 설명 + 필요 플레이스홀더 매핑 구현.
`--defaults`이면 모든 모듈 선택.

- [ ] **Step 4: 플레이스홀더 입력 함수**

입력값 검증 (`[a-zA-Z0-9._/ -]`만 허용), sed 구분자 `|`, 민감 키워드 경고, 힌트 표시.
`.harness-config` 존재 시 이전 값을 기본값으로 표시.

- [ ] **Step 5: 파일 처리 함수 (치환 + 충돌 처리)**

- `*.template` → sed 치환 → 확장자 제거
- hook 스크립트 상단 상수 치환
- 충돌 시: settings.json은 머지 전략, CLAUDE.md는 스킵, 나머지는 diff → O/S/B 선택

- [ ] **Step 6: settings.json 머지 함수**

jq로 기존 파일과 템플릿의 permissions.allow/deny 합집합, hooks 배열 머지 (경로 기준 중복 제거).

- [ ] **Step 7: 후처리 + 완료 메시지**

chmod +x, memory 복사, .gitignore 업데이트, .harness-config 저장, 완료 메시지 출력.

- [ ] **Step 8: --check-update 구현**

.harness-config 버전과 스크립트 VERSION 비교, 파일별 NEW/MOD/unchanged 감지.

- [ ] **Step 9: 커밋**

```bash
git add templates/harness/scripts/init-harness.sh
git commit -m "feat(harness): add init-harness.sh with idempotent modular setup"
```

---

## Task 11: Scripts — `health-check.sh`

**Files:**

- Create: `templates/harness/scripts/health-check.sh`

- [ ] **Step 1: 스크립트 작성**

체크 항목 5개:

1. 현재 브랜치 + 클린 상태 (`git status --porcelain`)
2. Docker 컨테이너 실행 여부 (`docker compose ps`)
3. node_modules 존재 여부
4. 최근 커밋 5개 (`git log --oneline -5`)
5. 미머지 PR 목록 (`gh pr list --state open` — gh 미설치 시 스킵)

출력: 구조화된 섹션 형식. exit 0 항상.

- [ ] **Step 2: 실행 권한 + 커밋**

```bash
chmod +x templates/harness/scripts/health-check.sh
git add templates/harness/scripts/health-check.sh
git commit -m "feat(harness): add health-check script"
```

---

## Task 12: Scripts — `doc-check.sh`

**Files:**

- Create: `templates/harness/scripts/doc-check.sh`

- [ ] **Step 1: 스크립트 작성**

체크 항목:

1. CLAUDE.md에서 참조된 파일 경로 추출 (정규식으로 backtick 내 경로 파싱)
2. 각 경로 실존 여부 확인
3. 참조 문서 테이블의 경로 검증
4. 결과 리포트: 유효/깨진/총 개수

exit 1 on failure, exit 0 on success.

- [ ] **Step 2: 실행 권한 + 커밋**

```bash
chmod +x templates/harness/scripts/doc-check.sh
git add templates/harness/scripts/doc-check.sh
git commit -m "feat(harness): add doc-check script"
```

---

## Task 13: Memory 초기 구조

**Files:**

- Create: `templates/harness/memory/MEMORY.md`
- Create: `templates/harness/memory/_examples/user_role.md`
- Create: `templates/harness/memory/_examples/feedback_style.md`
- Create: `templates/harness/memory/_examples/project_context.md`

- [ ] **Step 1: MEMORY.md 인덱스 작성**

```markdown
# {{PROJECT_NAME}} — Memory Index

<!-- 메모리 파일 포인터만 기록. 내용은 각 파일에. 200줄 이내 유지. -->

## Examples (삭제 가능)

- [user_role](_examples/user_role.md) — 사용자 역할/선호도 기록 예시
- [feedback_style](_examples/feedback_style.md) — 피드백 기록 예시
- [project_context](_examples/project_context.md) — 프로젝트 맥락 기록 예시
```

- [ ] **Step 2: 예시 파일 3개 작성**

각 파일에 frontmatter (name, description, type) + 짧은 예시 내용.

- [ ] **Step 3: 커밋**

```bash
git add templates/harness/memory/
git commit -m "feat(harness): add memory system initial structure"
```

---

## Task 14: `.eslintrc.patterns.md`

**Files:**

- Create: `templates/harness/.eslintrc.patterns.md`

- [ ] **Step 1: ESLint 패턴 가이드 문서 작성**

3개 패턴 (Import 경계, console.log, 앱 간 import) × 2개 설정 형식 (flat config, legacy).
각 패턴: 목적, 왜 필요한지, ESLint 설정 예시 코드, 테스트 방법.

- [ ] **Step 2: 커밋**

```bash
git add templates/harness/.eslintrc.patterns.md
git commit -m "feat(harness): add ESLint custom rule patterns guide"
```

---

## Task 15: `README.md`

**Files:**

- Create: `templates/harness/README.md`

- [ ] **Step 1: README 작성**

스펙 README 섹션 (733-870행)의 전체 구조를 구현:

1. Before/After 비교표
2. 빠른 시작 (5분) — `--defaults` 포함
3. 사전 준비 (jq, Secrets)
4. 구성요소별 설명 테이블
5. 커스터마이징 예시 (패턴 추가, hook 추가 — 코드 블록)
6. 트러블슈팅 FAQ (6개 Q&A)
7. 용어집 (7개)
8. 파일별 복사 위치 매핑 표
9. 플레이스홀더 전체 목록 (14개)
10. 졸업 기준

- [ ] **Step 2: 커밋**

```bash
git add templates/harness/README.md
git commit -m "feat(harness): add README with beginner-friendly guide"
```

---

## Task 16: 통합 검증

- [ ] **Step 1: 디렉토리 구조 검증**

Run: `find templates/harness -type f | sort`
Expected: 스펙의 File Map과 1:1 매칭 (17개 파일)

- [ ] **Step 2: 플레이스홀더 사용 검증**

Run: `grep -r '{{' templates/harness/ --include='*.sh' --include='*.template' --include='*.yml' | grep -v '_examples' | sort`
Expected: 스펙의 플레이스홀더 14개만 사용됨, 미지원 플레이스홀더 없음

- [ ] **Step 3: 실행 권한 검증**

Run: `find templates/harness -name '*.sh' ! -executable`
Expected: 출력 없음 (모든 .sh가 실행 가능)

- [ ] **Step 4: shellcheck 검증 (가능한 경우)**

Run: `shellcheck templates/harness/.claude/hooks/_lib/common.sh templates/harness/.claude/hooks/PreToolUse/*.sh templates/harness/.claude/hooks/PostToolUse/*.sh templates/harness/scripts/*.sh`
Expected: 심각한 경고 없음

- [ ] **Step 5: 보안 검증 — SHA 고정 + 리뷰 제외 경로**

Run: `grep -c '@v1' templates/harness/.github/workflows/claude-review.yml`
Expected: 0 (무빙 태그 없음)

Run: `grep '.claude/' templates/harness/.github/workflows/claude-review.yml | grep -c 'paths-ignore\|ignore'`
Expected: 0 (.claude/가 제외 경로에 없어야 함)

- [ ] **Step 6: init-harness.sh .gitignore 처리 검증**

init-harness.sh 코드에 `.claude/settings.local.json`과 `.claude/.harness-config`를 `.gitignore`에 추가하는 로직이 있는지 확인.

Run: `grep -c 'settings.local.json\|harness-config' templates/harness/scripts/init-harness.sh`
Expected: 2 이상

- [ ] **Step 7: 최종 커밋**

```bash
git add -A templates/harness/
git commit -m "feat(harness): complete repository-level harness template v1.0.0"
```
