# Repository Level Harness Engineering — Design Spec

## 개요

어떤 프로젝트에든 복사해서 바로 사용할 수 있는 범용 Claude Code 하네스 템플릿.
Boardinary 프로젝트에서 검증된 패턴을 추출하여, 프레임워크/도메인에 무관한 재사용 가능한 구성을 제공한다.

**배포 형태:** 현재 프로젝트 내 `templates/harness/`에 레퍼런스로 관리. 두 번째 프로젝트 적용 시 별도 리포로 분리(졸업).

**졸업 기준:** 두 번째 프로젝트에 적용 완료 + 해당 프로젝트에서 1주일 이상 안정적 사용 확인 시 별도 리포로 분리.

**범위 경계:**

- Repository Level (이 스펙): 프로젝트 무관한 범용 템플릿
- Application Level (별도 스펙): Boardinary 특화 하네스 (앱별 CLAUDE.md, 도메인 ESLint 룰, 특화 hooks 등)

**출처 구분:**

- Boardinary에서 추출한 검증된 패턴: hooks, claude-review, cleanup-branches, scripts, memory
- 새로 설계한 패턴: ci.yml (Boardinary는 개별 워크플로우 사용), init-harness.sh

---

## 디렉토리 구조

Mirror 구조 — 실제 프로젝트의 파일 배치를 그대로 반영하여 "복사하면 동작"을 목표로 한다.

```
templates/harness/
├── .claude/
│   ├── settings.json.template      # → 프로젝트/.claude/settings.json (팀 공유, 커밋 대상)
│   └── hooks/
│       ├── _lib/
│       │   └── common.sh           # 공유 유틸: jq 체크, stdin 파싱, exit 헬퍼
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
│   ├── init-harness.sh             # 플레이스홀더 치환 + 초기 설정 (멱등성)
│   ├── health-check.sh
│   └── doc-check.sh
├── memory/                          # → ~/.claude/projects/<hash>/memory/ 에 복사
│   ├── MEMORY.md
│   └── _examples/
│       ├── user_role.md
│       ├── feedback_style.md
│       └── project_context.md
├── CLAUDE.md.template
├── .eslintrc.patterns.md
└── README.md
```

### 파일 배치 규칙

| 템플릿 경로          | 복사 대상                           | 비고                    |
| -------------------- | ----------------------------------- | ----------------------- |
| `.claude/`           | 프로젝트 루트 `.claude/`            | 팀 공유, git 커밋       |
| `.github/`           | 프로젝트 루트 `.github/`            |                         |
| `scripts/`           | 프로젝트 루트 `scripts/`            |                         |
| `memory/`            | `~/.claude/projects/<hash>/memory/` | 사용자별, git 비추적    |
| `CLAUDE.md.template` | 프로젝트 루트 `CLAUDE.md`           | `.template` 확장자 제거 |

### settings.json 파일 구분

| 파일                          | 용도                              | 커밋 여부            |
| ----------------------------- | --------------------------------- | -------------------- |
| `.claude/settings.json`       | 팀 공유 설정 (hooks, permissions) | O — 이 템플릿의 대상 |
| `.claude/settings.local.json` | 개인 오버라이드                   | X — gitignore 대상   |
| `~/.claude/settings.json`     | 글로벌 사용자 설정                | 템플릿 범위 밖       |

---

## Claude Code Hooks

### Hook 입출력 규약

- hook 스크립트는 **stdin으로 JSON**을 받음 (`tool_name`, `tool_input`, `cwd`, `session_id` 등)
- `settings.json`의 `env` 블록은 모델에만 전달되고 **hook 서브프로세스에는 전달되지 않음**
- hook에서 필요한 설정값은 **스크립트 상단에 직접 정의**하거나, `SessionStart` hook에서 `$CLAUDE_ENV_FILE`에 기록
- exit 0: 통과, exit 2: BLOCK (차단)

### 환경 설정 전략

hook이 브랜치명/패키지매니저 등을 알아야 하므로, 두 가지 방식 중 택1:

**방식 A (추천): 스크립트 상단 상수 정의**

```bash
#!/bin/bash
MAIN_BRANCH="main"
DEVELOP_BRANCH="develop"
# ... 나머지 로직
```

- 단순하고 디버깅 쉬움
- `init-harness.sh`가 플레이스홀더를 치환

**방식 B: SessionStart + CLAUDE_ENV_FILE**

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "",
        "hooks": ["sh .claude/hooks/session-init.sh"]
      }
    ]
  }
}
```

- `session-init.sh`가 `echo 'export MAIN_BRANCH=main' >> "$CLAUDE_ENV_FILE"` 실행
- 동적 값 필요 시 유용하나, v1에서는 과도

**v1은 방식 A 채택.** 정적 값이므로 스크립트 상단 정의로 충분.

### Hook 공유 라이브러리 (`_lib/common.sh`)

모든 hook 스크립트가 source하는 공통 유틸리티. 보일러플레이트 중복을 제거하고, 새 hook 추가 시 일관된 패턴을 보장.

```bash
#!/bin/bash
# .claude/hooks/_lib/common.sh — 모든 hook이 source하는 공유 유틸

# === jq 의존성 체크 ===
# 보안 원칙: fail-closed. jq 없으면 보호 hook이 동작할 수 없으므로 차단.
# PostToolUse(정보 제공용)에서만 통과시키려면 source 전에 HOOK_FAIL_OPEN=1 설정.
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

# JSON 파싱 실패 시 안전한 기본값 (빈 문자열)
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
# 프리픽스(env, command, sudo 등) 제거 + 다중 공백 정규화
hook_normalize_command() {
  echo "$1" | sed -E 's/^(env[[:space:]]+[A-Z_]+=[^[:space:]]+[[:space:]]+|command[[:space:]]+|sudo[[:space:]]+)*//' | tr -s ' '
}

# === 표준 차단 함수 (exit 2 + 사유 출력) ===
hook_block() {
  echo "BLOCKED: $1" >&2
  exit 2
}

# === 표준 경고 함수 (exit 0 + 메시지) ===
hook_warn() {
  echo "WARNING: $1" >&2
}
```

**사용 예시:**

```bash
#!/bin/bash
# PreToolUse hook — fail-closed (기본값)
source "$(dirname "$0")/../_lib/common.sh"

COMMAND=$(hook_get '.tool_input.command')
NORMALIZED=$(hook_normalize_command "$COMMAND")
# ... 정규화된 명령어로 패턴 매칭
```

```bash
#!/bin/bash
# PostToolUse hook — fail-open (정보 제공용)
HOOK_FAIL_OPEN=1
source "$(dirname "$0")/../_lib/common.sh"

FILE_PATH=$(hook_get '.tool_input.file_path')
# ... lint 실행 (실패해도 차단 안 함)
```

**보안 설계:**

- **PreToolUse (보호용):** fail-closed 기본값. jq 미설치/JSON 파싱 실패 시 차단 (exit 2)
- **PostToolUse (정보용):** `HOOK_FAIL_OPEN=1` 설정 시 fail-open. lint 같은 비보안 hook에 사용
- **`hook_normalize_command`:** `env VAR=x`, `command`, `sudo` 프리픽스 제거 + 공백 정규화로 우회 방지
- JSON 파싱 실패 시에도 보안 모드에 따라 차단/통과 분기

**확장 시 이점:**

- 새 hook 추가 시 `source common.sh` 한 줄로 jq 체크/파싱 해결
- jq fallback 전략 변경 시 한 곳만 수정
- `hook_get`, `hook_block`, `hook_warn`, `hook_normalize_command` 인터페이스가 hook 간 일관성 보장

### PreToolUse

#### `block-dangerous-commands.sh`

- **트리거:** `Bash` 도구 호출 시
- **입력:** stdin JSON → `hook_get '.tool_input.command'` → `hook_normalize_command`로 정규화
- **매칭 방식:** 정규화된 명령어에 대해 **정규식(regex)** 매칭. 단순 문자열 포함이 아님
- **차단 패턴 (기본):**

```bash
BLOCKED_PATTERNS=(
  'git push.*(--force|-f|--force-with-lease)'   # force push 전 변형
  'git push.*--delete'                           # 리모트 브랜치 삭제
  'git push [^ ]+ :'                             # colon 문법 리모트 삭제
  'git reset --hard'                             # 히스토리 파괴
  'git checkout \.'                              # 전체 워킹트리 되돌리기
  'git clean -[a-z]*f'                           # untracked 파일 강제 삭제
  'rm -rf /'                                     # 루트 삭제
  'drop table'                                   # DB 테이블 삭제 (대소문자 무시)
  'truncate table'                               # DB 테이블 비우기
  # 프로젝트별 패턴을 여기에 추가
)
```

- **동작:** 정규화된 명령어가 패턴에 매칭 시 exit 2 (BLOCK) + 사유를 stderr로 출력
- **대소문자:** SQL 패턴(`drop table`, `truncate table`)은 case-insensitive 매칭
- **커스터마이징:** 파일 상단 `BLOCKED_PATTERNS` 배열에 프로젝트별 정규식 추가

#### `warn-main-branch-edit.sh`

- **트리거:** `Edit`, `Write` 도구 호출 시
- **입력:** stdin JSON → `hook_get '.tool_input.file_path'` + `git rev-parse --abbrev-ref HEAD`로 현재 브랜치 확인
- **동작:** 현재 브랜치가 보호 브랜치이고, 대상 파일이 `docs/` 밖이면 exit 2 (BLOCK)
- **보호 브랜치:** 스크립트 상단 `PROTECTED_BRANCHES` 배열에 정의 (기본: main, develop)
- **detached HEAD 처리:** `git rev-parse --abbrev-ref HEAD`가 `HEAD`를 반환하면 (detached 상태), 경고 출력 후 통과. 이유: worktree에서 특정 커밋 체크아웃 시 발생할 수 있는 정상 시나리오

### PostToolUse

#### `auto-lint-on-write.sh`

- **트리거:** `Write`, `Edit` 도구 완료 후
- **입력:** stdin JSON에서 `tool_input.file_path` 추출
- **동작:** 변경 파일 확장자가 `LINT_EXTENSIONS` 배열에 포함되면 ESLint `--fix` 실행
- **`LINT_EXTENSIONS`:** 스크립트 상단 정의 (기본: `ts tsx js jsx`), 프로젝트별 변경 가능
- **출력:** fix 결과를 stderr로 (Claude 피드백)
- **실패 시:** exit 0 유지 (차단 아님, 정보만 제공)
- **성능 고려:** 단일 파일 대상이므로 속도 영향 미미. 대규모 자동 생성 시 병목이 되면 비활성화 가능 (README 안내)
- **보안 고려:** ESLint는 플러그인 코드를 실행함. 악성 `.eslintrc`/플러그인이 도입되면 이 hook을 통해 실행될 수 있음. README에 "hook이 실행하는 외부 도구의 보안은 프로젝트 책임"임을 명시
- **fail-open 설정:** `HOOK_FAIL_OPEN=1`로 source하여, lint 실패/jq 미설치 시에도 파일 쓰기를 차단하지 않음

### 의도적 제외

| 후보                           | 제외 이유                            |
| ------------------------------ | ------------------------------------ |
| 커밋 전 자동 type-check        | pre-commit hook(husky)이 담당 — 중복 |
| 세션 시작 시 health-check 자동 | CLAUDE.md 지시사항으로 충분          |
| 파일 읽기 시 보안 체크         | 과도한 간섭, false positive 위험     |

### Failure Modes

#### Hook 스크립트 크래시 시

| 상황                            | Claude Code 동작                                               | 대응                                                                                 |
| ------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------ | --- | ------------------------------------------------------------------------------- |
| `jq` 미설치로 hook 실패         | hook이 non-zero exit → **도구 호출 차단** (exit 2와 동일 취급) | hook 첫 줄에 `jq` 존재 확인: `command -v jq >/dev/null 2>&1                          |     | { echo "jq required" >&2; exit 0; }` — 미설치 시 통과(exit 0)시키고 경고만 출력 |
| hook 스크립트 permission denied | 실행 불가 → 차단                                               | `init-harness.sh`에서 `chmod +x` 자동 적용. README에 수동 방법 안내                  |
| hook 내 무한루프/타임아웃       | Claude Code가 hook 타임아웃 적용 (기본 10초)                   | 복잡한 로직 지양. 단순 패턴 매칭만 수행                                              |
| stdin JSON 파싱 실패            | 변수 비어있음 → 의도치 않은 차단/통과                          | 파싱 실패 시 기본 동작을 명시적으로 정의: PreToolUse는 **통과**(exit 0), 안전한 방향 |

#### `jq` 의존성 전략

`_lib/common.sh`에서 `HOOK_FAIL_OPEN` 플래그로 분기:

- **PreToolUse (보안용):** fail-closed (기본). jq 미설치 시 **차단** (exit 2) + 설치 안내 출력
- **PostToolUse (정보용):** `HOOK_FAIL_OPEN=1` 설정 시 fail-open. jq 미설치 시 경고 후 **통과** (exit 0)

이유: 보안 hook의 fail-open은 전체 보호 레이어를 무음으로 비활성화하므로 허용 불가. `deny` 리스트가 최후 방어선이지만, `deny`가 커버하지 않는 패턴(브랜치 보호, SQL 명령 등)은 hook이 유일한 방어선.

#### CI Secrets 미설정 시

| Secrets                   | 미설정 시 동작                                                  | 대응                                                                                                                                   |
| ------------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `CLAUDE_CODE_OAUTH_TOKEN` | claude-code-action step 실패 → 워크플로우 실패 → PR에 빨간 체크 | README "초기 설정"에 필수 Secrets 명시. 워크플로우에 `if: secrets.CLAUDE_CODE_OAUTH_TOKEN != ''` 조건 추가하여 미설정 시 graceful skip |

#### Hook 간 중복 차단

`deny` 리스트와 `block-dangerous-commands.sh`가 같은 명령을 잡는 경우:

- `deny`가 먼저 평가됨 (Claude Code 내부 로직) → hook까지 도달하지 않음
- 사용자에게 한 번만 차단 메시지 표시
- 이는 의도된 동작: `deny`는 최후 방어선, hook은 커스터마이징 가능한 상세 메시지 제공

#### 기존 프로젝트 적용 시

`init-harness.sh`가 처리하는 충돌 시나리오 — 아래 "init-harness.sh 멱등성 설계" 참조.

---

## CLAUDE.md 템플릿

골격 구조만 제공. 내용은 비워두고 섹션 가이드를 주석으로 포함.

```
# CLAUDE.md — {{PROJECT_NAME}}

## 프로젝트 개요
## 기술 스택
## 프로젝트 구조
## 명령어
  ### 개발 / 빌드 / 테스트 / 데이터베이스
## 코드 컨벤션
  ### Import 규칙 / 상태 관리 / 타입 규칙 / 린팅 & 포매팅
## 개발 워크플로우
  ### Git Flow / 브랜치 네이밍 / 커밋 컨벤션 / PR 규칙
  ### Worktree 기반 작업 (선택 — 병렬 작업 시)
  ### 작업 순서 (선택 — Superpowers 스킬 사용 시)
## 참조 문서
## 금지 사항
```

**설계 원칙:**

- 섹션 순서 = 우선순위 (위에서부터 중요한 정보)
- 참조 문서 테이블에 "언제 참조" 컬럼 → 필요 시에만 읽기
- 금지 사항은 맨 아래이나 `IMPORTANT` 마커로 강조
- "Worktree 기반 작업", "작업 순서"는 선택적 섹션 (해당 시 추가)

---

## CI/CD 워크플로우

### `claude-review.yml` — PR 코드리뷰 (Claude)

Boardinary의 185줄 검증 워크플로우를 기반으로 범용화. `anthropics/claude-code-action@v1` 사용.

#### 트리거 및 조건

- **트리거:** PR `opened` / `synchronize` / `ready_for_review` + `issue_comment` (`@claude` 리리뷰 요청)
- **실행 조건:** draft PR 제외, issue_comment은 `@claude` 포함 시만
- **제외 경로:** `docs/**`, `*.md`, `.github/**`, lock 파일. **`.claude/**`는 제외하지 않음\*\* — hook 파일 변경은 보안 영향이 있으므로 반드시 리뷰 대상
- **Secrets 필요:** `CLAUDE_CODE_OAUTH_TOKEN` (claude-code-action에서 사용)
- **액션 버전:** `anthropics/claude-code-action@<SHA>` (특정 커밋 SHA 고정). `@v1` 같은 무빙 태그는 공급망 공격 벡터이므로 사용 금지. 구현 시 최신 릴리스의 full SHA를 README에 기록

#### 증분 판별 알고리즘

```
IF github.event.action == "synchronize":
  → 증분 모드 (before_sha = github.event.before)
  → git diff {before_sha}..HEAD 범위만 리뷰
ELSE:
  → 전체 모드
  → git diff origin/{{DEVELOP_BRANCH}} 전체 리뷰
```

증분 모드에서 `git diff` 실패 시 전체 모드로 fallback.

#### 워크플로우 구조 (4단계)

```
Step 1: Checkout (fetch-depth: 0)
Step 2: Determine review context (증분/전체 판별, before_sha 추출)
Step 3: Claude Code Action (리뷰 프롬프트 실행)
Step 4: Submit review decision (결과 파싱 → gh pr review)
```

#### 리뷰 프롬프트 구조 (범용화)

```
1. 리뷰 모드 지시 (전체/증분)
2. 전체 리뷰 절차:
   - PR 제목/본문 읽기 → 변경 파일 목록 → 제외 패턴 적용 → 파일별 개별 diff 읽기
3. 증분 리뷰 절차:
   - 이전 리뷰 조회 → 새 변경분만 diff → 이전 이슈 해결 여부 검증
4. 리뷰 본문 형식 (요약 → 잘된 점 → 이슈 등급별 → 판정)
5. 리뷰 기준 (🔴/🟡/🔵 정의)
6. 금지 사항 (전체 diff 한번에 읽기 금지, 직접 게시 금지 등)
```

**커스터마이징 포인트:**

- 파일 상단 `EXCLUDE_PATTERNS` 변수: 프로젝트별 제외 경로 추가 (예: 자동생성 코드)
- `{{REVIEW_MODEL}}` (기본: `claude-haiku-4-5-20251001`)
- `{{REVIEW_LANGUAGE}}` (기본: English)
- `{{DEVELOP_BRANCH}}` (기본: `develop`) — diff 기준 브랜치

#### 결과 파싱 및 게시 (Step 4)

Claude Code Action의 `execution_file` output에서 Python 스크립트로 결과 추출:

```
result에 "CHANGES_REQUESTED" 포함 → gh pr review --request-changes
result에 "APPROVED" 포함         → gh pr review --approve
그 외                            → gh pr comment (판정 불명확)
```

### `ci.yml` — 통합 품질 게이트 (새 설계)

> 참고: Boardinary는 개별 워크플로우(`e2e.yml`, `doc-check.yml`)를 사용. 이 통합 ci.yml은 범용 템플릿을 위해 새로 설계한 패턴.

```
lint (독립) ──┐
              ├──→ build ──→ e2e (조건부, paths 필터)
type-check (독립)─┘
test (독립, DB service 포함)
```

- lint + type-check 통과 → build 실행 → build 통과 → e2e 실행
- test는 독립 (DB 등 별도 환경)
- e2e/test job의 `services` 블록: sed 치환이 불가능한 멀티라인 YAML이므로, 플레이스홀더 대신 **주석으로 안내** (`# TODO: Add your database service here`)
- 명령어 전부 플레이스홀더: `{{LINT_CMD}}`, `{{BUILD_CMD}}`, `{{TEST_CMD}}`, `{{E2E_CMD}}`

### `cleanup-branches.yml` — 브랜치 자동 정리

- **스케줄:** 주간 크론 (일요일 03:00 UTC) + `workflow_dispatch` (수동 실행)
- **대상:** `{{BRANCH_PATTERN}}` (기본: `feature/*`) + 머지 완료 + `{{RETENTION_DAYS}}` (기본: 90일) 초과
- **보호:** main, develop 등 보호 브랜치 제외
- **안전장치:** dry-run 모드 기본. 실제 삭제 전 대상 목록을 워크플로우 로그에 출력. `workflow_dispatch`에 `dry_run` 입력 파라미터 (기본: `true`) — `false`로 설정 시에만 실제 삭제 수행. 크론 실행 시에도 dry-run이 기본이며, 실제 삭제를 활성화하려면 워크플로우 파일에서 `DRY_RUN` 환경변수를 `false`로 변경

---

## settings.json 템플릿

대상 파일: `.claude/settings.json` (팀 공유, 커밋 대상)

```jsonc
{
  "permissions": {
    "allow": [
      "Bash(git add:*)",
      "Bash(git commit:*)",
      "Bash(git push origin:*)", // origin만 허용 (임의 remote 방지)
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
      "Bash(git push --delete:*)", // 리모트 브랜치 삭제 방지
      "Bash(git reset --hard:*)",
      "Bash(git clean -f:*)", // untracked 강제 삭제 방지
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

**설계 결정:**

- `allow`에 자주 쓰는 안전한 명령 사전 등록 — 승인 피로 제거
- `deny`에 위험 명령 명시 — hooks와 이중 방어 (defense-in-depth). hooks가 실패하더라도 `deny`가 최후 방어선
- `env` 블록 사용하지 않음 — hook 서브프로세스에 전달되지 않으므로. 환경값은 각 hook 스크립트 상단에 직접 정의
- `matcher`의 `|` 구문: 여러 도구를 OR로 매칭 (예: `"Edit|Write"`)

---

## 스크립트

### `scripts/init-harness.sh` (신규) — 멱등성 설계

재실행 가능한 초기화 스크립트. 이미 적용된 항목은 스킵하고, 변경이 필요한 항목만 처리.

#### 실행 흐름

```
1. 모듈 선택 (대화형)
   [1/4] Claude Code Hooks (settings.json + hook 스크립트)?  [Y/n]
   [2/4] CI/CD Workflows?  [Y/n]
     ├── claude-review.yml?  [Y/n]
     ├── ci.yml?  [Y/n]
     └── cleanup-branches.yml?  [Y/n]
   [3/4] Scripts (health-check, doc-check)?  [Y/n]
   [4/4] Memory 초기 구조?  [Y/n]

2. 플레이스홀더 입력 (선택된 모듈에 필요한 값만)
   - 기본값 제시, Enter로 수락
   - 이전 실행 시 저장된 값이 있으면 해당 값을 기본값으로 표시
   - **입력값 검증:** 알파벳, 숫자, 하이픈, 언더스코어, 점, 슬래시, 공백만 허용
     (`[a-zA-Z0-9._/ -]`). 특수문자 포함 시 거부 + 재입력 요청
   - **sed 안전 치환:** 구분자를 `|`로 사용 (`sed "s|{{PLACEHOLDER}}|$VALUE|g"`)
     하여 입력값의 `/` 충돌 방지. 추가로 `$`, `` ` ``, `&` 문자 이스케이프 처리
   - 설정값을 .claude/.harness-config에 JSON으로 저장 (재실행 시 참조)
   - **민감정보 경고:** 입력값에 `token`, `secret`, `key`, `password` 포함 시
     "이 파일에 민감정보를 저장하지 마세요" 경고 출력

3. 파일별 처리 (선택된 모듈만)
   - *.template → sed 치환 → 확장자 제거
   - hook 스크립트 상단 상수 치환
   - 이미 존재하는 파일: 유형별 충돌 처리 (아래 참조)

4. 후처리
   - chmod +x hook 스크립트 + _lib/common.sh
   - memory/ → ~/.claude/projects/ 복사 (기존 MEMORY.md 있으면 스킵)
   - .gitignore에 .claude/settings.local.json, .claude/.harness-config 추가 (없으면)
```

**모듈-플레이스홀더 매핑:**

| 모듈                 | 필요한 플레이스홀더                                                   |
| -------------------- | --------------------------------------------------------------------- |
| Hooks                | `MAIN_BRANCH`, `DEVELOP_BRANCH`, `PACKAGE_MANAGER`, `LINT_EXTENSIONS` |
| claude-review.yml    | `REVIEW_MODEL`, `REVIEW_LANGUAGE`, `DEVELOP_BRANCH`                   |
| ci.yml               | `LINT_CMD`, `BUILD_CMD`, `TEST_CMD`, `E2E_CMD`, `TYPE_CHECK_CMD`      |
| cleanup-branches.yml | `BRANCH_PATTERN`, `RETENTION_DAYS`                                    |
| Scripts              | (없음 — 범용)                                                         |
| Memory               | `PROJECT_NAME`                                                        |

Hooks만 선택하면 CI 관련 플레이스홀더는 묻지 않음.

#### 충돌 처리

| 상황                              | 동작                                                                     |
| --------------------------------- | ------------------------------------------------------------------------ |
| `.claude/settings.json` 이미 존재 | **필드별 머지** (아래 참조)                                              |
| `CLAUDE.md` 이미 존재             | 항상 스킵 (사용자 콘텐츠 보호). 메시지로 안내                            |
| hook 스크립트 이미 존재           | 내용 동일하면 스킵, 다르면 diff 표시 → `[O]verwrite / [S]kip / [B]ackup` |
| `_lib/common.sh` 이미 존재        | 템플릿 버전이 더 높으면 업데이트 제안, 그 외 스킵                        |
| workflow 파일 이미 존재           | diff 표시 → `[O]verwrite / [S]kip / [B]ackup`                            |
| memory 이미 설치됨                | 스킵. `_examples/`만 없으면 복사                                         |

#### settings.json 머지 전략

기존 settings.json이 있을 때 전체 덮어쓰기가 아닌 **필드별 머지**를 수행:

```
permissions.allow  → 합집합 (기존 + 템플릿, 중복 제거)
permissions.deny   → 합집합 (기존 + 템플릿, 중복 제거)
hooks.PreToolUse   → 배열 머지 (기존 항목 유지 + 템플릿 신규 항목 추가)
hooks.PostToolUse  → 배열 머지 (동일 방식)
기타 필드          → 기존 값 우선 (템플릿이 덮어쓰지 않음)
```

**머지 판별 기준:** hook 배열 내 항목은 `hooks[0]` 값(스크립트 경로)으로 동일 여부 판단.

이 전략으로 사용자가 추가한 커스텀 hook, permission이 init-harness.sh 재실행 시에도 보존됨.

#### 저장되는 설정 파일

`.claude/.harness-config` (gitignore 대상):

```json
{
  "_warning": "Do not store secrets (tokens, keys, passwords) in this file.",
  "initialized_at": "2026-03-30T12:00:00Z",
  "version": "1.0.0",
  "modules": ["hooks", "claude-review", "ci", "scripts"],
  "values": {
    "PROJECT_NAME": "my-project",
    "MAIN_BRANCH": "main",
    "PACKAGE_MANAGER": "pnpm"
  }
}
```

자가 삭제하지 않음. 재실행 시 이전 설정을 기본값으로 사용.

#### 업그레이드 경로

v1에서 완전한 자동 업그레이드는 구현하지 않지만, **구조적으로 예약**:

**`init-harness.sh --check-update` 플래그:**

```
$ sh scripts/init-harness.sh --check-update

현재 설치 버전: 1.0.0
템플릿 버전:    1.1.0

변경사항:
  [NEW] .claude/hooks/PreToolUse/check-env-vars.sh
  [MOD] .claude/hooks/_lib/common.sh (hook_get 에러 핸들링 개선)
  [---] .github/workflows/ci.yml (변경 없음)

적용하시겠습니까? [y/N]
```

**동작 원리:**

- `.harness-config`의 `version`과 템플릿의 `version`을 비교
- 템플릿의 각 파일에 대해, 프로젝트에 존재 여부 + 내용 동일 여부 체크
- `[NEW]`: 템플릿에 있고 프로젝트에 없는 파일
- `[MOD]`: 양쪽 다 있지만 내용이 다른 파일 (diff 표시)
- `[---]`: 변경 없음

**v1 범위:** `--check-update` 플래그 자체는 v1에서 구현. 실제 자동 적용은 사용자 확인 후 위의 충돌 처리 + 머지 전략을 동일하게 적용.

### `scripts/health-check.sh`

- 현재 브랜치 + 클린 상태 확인
- DB 컨테이너 실행 여부 (docker)
- node_modules 존재 여부
- 최근 커밋 요약 (5개)
- 미머지 PR 목록
- exit 0 항상 (정보 제공, 차단 아님)

### `scripts/doc-check.sh`

- CLAUDE.md 내 참조 경로 실존 검증
- 참조 문서 테이블 경로 검증
- 깨진 링크 리포트
- exit 1 on failure (CI 연결 시 게이트 사용 가능)
- CI 워크플로우 연결은 선택적 (README에 연결 방법 안내)
- 범위: 범용 참조 검증만. 프로젝트 특화 검증(features.json, sprint contract 등)은 Application Level에서 추가

---

## 메모리 시스템 초기 구조

**중요:** Claude Code의 메모리는 `~/.claude/projects/<project-hash>/memory/`에 저장되며, 프로젝트 리포 안이 아님. 이 템플릿의 `memory/` 디렉토리는 **복사 소스**로, `init-harness.sh`가 올바른 경로에 설치한다.

```
memory/
├── MEMORY.md              # 인덱스 (200줄 이내 유지)
└── _examples/
    ├── user_role.md       # type: user 예시
    ├── feedback_style.md  # type: feedback 예시
    └── project_context.md # type: project 예시
```

예시 파일 형식:

```markdown
---
name: { { memory-name } }
description: { { one-line description } }
type: { { user|feedback|project|reference } }
---

{{내용}}
```

`_examples/`는 참고용. 실제 사용 시 삭제/수정.

---

## ESLint 커스텀 룰 가이드 (`.eslintrc.patterns.md`)

코드가 아닌 문서. 프레임워크 무관 패턴 안내.

| 패턴                   | 목적                         | 구현 방식                         |
| ---------------------- | ---------------------------- | --------------------------------- |
| Import 경계 강제       | 특정 모듈의 import 위치 제한 | no-restricted-imports + overrides |
| console.log 금지       | 프로덕션 디버그 로그 방지    | no-restricted-syntax              |
| 앱 간 직접 import 금지 | 모노레포 앱 간 결합 방지     | no-restricted-imports + 경로 패턴 |

각 패턴에 ESLint 9 flat config + legacy config 양쪽 예시 포함.

---

## README.md

1. **개요** — 이 템플릿이 뭔지, 왜 필요한지
2. **빠른 시작**
   - `scripts/init-harness.sh` 실행 방법
   - 필요한 GitHub Secrets (`ANTHROPIC_API_KEY`)
3. **플레이스홀더 목록** — 전체 목록 + 설명 + 기본값
4. **파일별 복사 위치** — 매핑 표
5. **구성요소별 사용법** — Hooks / CI / Scripts / Memory / CLAUDE.md
6. **커스터마이징 가이드** — Application Level로 확장하는 법
7. **졸업 기준** — 별도 리포로 분리하는 시점 + 방법

---

## 플레이스홀더 전체 목록

| 플레이스홀더          | 설명                  | 기본값                      |
| --------------------- | --------------------- | --------------------------- |
| `{{PROJECT_NAME}}`    | 프로젝트 이름         | —                           |
| `{{MAIN_BRANCH}}`     | 프로덕션 브랜치       | `main`                      |
| `{{DEVELOP_BRANCH}}`  | 통합 브랜치           | `develop`                   |
| `{{PACKAGE_MANAGER}}` | 패키지 매니저         | `pnpm`                      |
| `{{LINT_CMD}}`        | 린트 명령어           | `pnpm lint`                 |
| `{{BUILD_CMD}}`       | 빌드 명령어           | `pnpm build`                |
| `{{TEST_CMD}}`        | 테스트 명령어         | `pnpm test`                 |
| `{{E2E_CMD}}`         | E2E 테스트 명령어     | `pnpm test:e2e`             |
| `{{TYPE_CHECK_CMD}}`  | 타입체크 명령어       | `pnpm check-types`          |
| `{{REVIEW_MODEL}}`    | 리뷰 Claude 모델      | `claude-haiku-4-5-20251001` |
| `{{REVIEW_LANGUAGE}}` | 리뷰 언어             | `English`                   |
| `{{BRANCH_PATTERN}}`  | 정리 대상 브랜치 패턴 | `feature/*`                 |
| `{{RETENTION_DAYS}}`  | 브랜치 보존 기간      | `90`                        |
| `{{LINT_EXTENSIONS}}` | lint 대상 확장자      | `ts tsx js jsx`             |

> `DB_SERVICE`는 멀티라인 YAML이라 sed 치환 불가. ci.yml 내 주석(`# TODO: Add your database service here`)으로 안내.
