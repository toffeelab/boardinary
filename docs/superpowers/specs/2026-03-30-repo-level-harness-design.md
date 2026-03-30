# Repository Level Harness Engineering — Design Spec

## 개요

어떤 프로젝트에든 복사해서 바로 사용할 수 있는 범용 Claude Code 하네스 템플릿.
Boardinary 프로젝트에서 검증된 패턴을 추출하여, 프레임워크/도메인에 무관한 재사용 가능한 구성을 제공한다.

**배포 형태:** 현재 프로젝트 내 `templates/harness/`에 레퍼런스로 관리. 두 번째 프로젝트 적용 시 별도 리포로 분리(졸업).

**범위 경계:**

- Repository Level (이 스펙): 프로젝트 무관한 범용 템플릿
- Application Level (별도 스펙): Boardinary 특화 하네스 (앱별 CLAUDE.md, 도메인 ESLint 룰, 특화 hooks 등)

---

## 디렉토리 구조

Mirror 구조 — 실제 프로젝트의 파일 배치를 그대로 반영하여 "복사하면 동작"을 목표로 한다.

```
templates/harness/
├── .claude/
│   ├── settings.json.template
│   └── hooks/
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

## Claude Code Hooks

### PreToolUse

#### `block-dangerous-commands.sh`

- **트리거:** `Bash` 도구 호출 시
- **차단 대상:** `git push --force`, `git reset --hard`, `rm -rf /`, `drop table`, `git checkout .` 등
- **동작:** 매칭 시 exit 2 (BLOCK) + 사유 출력
- **커스터마이징:** 파일 상단 `BLOCKED_PATTERNS` 배열로 프로젝트별 패턴 추가

#### `warn-main-branch-edit.sh`

- **트리거:** `Edit`, `Write` 도구 호출 시
- **동작:** 현재 브랜치가 `$MAIN_BRANCH` 또는 `$DEVELOP_BRANCH`이고, 대상 파일이 `docs/` 밖이면 exit 2 (BLOCK)
- **의도:** 보호 브랜치에서의 코드 직접 수정 방지

### PostToolUse

#### `auto-lint-on-write.sh`

- **트리거:** `Write`, `Edit` 도구 완료 후
- **동작:** 변경 파일이 `*.ts` / `*.tsx`이면 ESLint `--fix` 실행
- **출력:** fix 결과를 stderr로 (Claude 피드백)
- **실패 시:** exit 0 유지 (차단 아님, 정보만 제공)

### 의도적 제외

| 후보                           | 제외 이유                            |
| ------------------------------ | ------------------------------------ |
| 커밋 전 자동 type-check        | pre-commit hook(husky)이 담당 — 중복 |
| 세션 시작 시 health-check 자동 | CLAUDE.md 지시사항으로 충분          |
| 파일 읽기 시 보안 체크         | 과도한 간섭, false positive 위험     |

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
## 참조 문서
## 금지 사항
```

**설계 원칙:**

- 섹션 순서 = 우선순위 (위에서부터 중요한 정보)
- 참조 문서 테이블에 "언제 참조" 컬럼 → 필요 시에만 읽기
- 금지 사항은 맨 아래이나 `IMPORTANT` 마커로 강조

---

## CI/CD 워크플로우

### `claude-review.yml` — PR 코드리뷰 (Claude)

- **트리거:** PR opened / synchronize / ready_for_review
- **제외 경로:** `docs/**`, `*.md`, `.github/**`, `.claude/**`, lock 파일
- **리뷰 모드:** 증분 (이전 리뷰 커밋 이후 변경분) vs 풀 (첫 리뷰) 자동 판별
- **리뷰 기준:** 🔴 Critical (머지 차단), 🟡 Important (수정 권장), 🔵 Suggestion (선택)
- **판정:** 🔵만 → APPROVED, 🔴 있으면 → CHANGES_REQUESTED
- **플레이스홀더:** `{{REVIEW_MODEL}}` (기본: claude-haiku-4-5-20251001), `{{REVIEW_LANGUAGE}}` (기본: English)
- **커스터마이징:** 파일 상단 `EXCLUDE_PATTERNS` 변수로 프로젝트별 필터 추가

### `ci.yml` — 통합 품질 게이트

```
lint (독립) ──┐
              ├──→ build ──→ e2e (조건부, paths 필터)
type-check (독립)─┘
test (독립, DB service 포함)
```

- lint + type-check 통과 → build 실행 → build 통과 → e2e 실행
- test는 독립 (DB 등 별도 환경)
- e2e job에 `{{DB_SERVICE}}` 플레이스홀더로 services 블록 포함
- 명령어 전부 플레이스홀더: `{{LINT_CMD}}`, `{{BUILD_CMD}}`, `{{TEST_CMD}}`, `{{E2E_CMD}}`

### `cleanup-branches.yml` — 브랜치 자동 정리

- **스케줄:** 주간 크론 (일요일 03:00 UTC)
- **대상:** `{{BRANCH_PATTERN}}` (기본: `feature/*`) + 머지 완료 + `{{RETENTION_DAYS}}` (기본: 90일) 초과
- **보호:** main, develop 등 보호 브랜치 제외

---

## settings.json 템플릿

```jsonc
{
  "permissions": {
    "allow": [
      "Bash(git add:*)",
      "Bash(git commit:*)",
      "Bash(git push:*)",
      "Bash(git checkout:*)",
      "Bash(git worktree:*)",
      "Bash(gh pr:*)",
      "Bash({{PACKAGE_MANAGER}}:*)",
      "Bash({{PACKAGE_MANAGER}} run:*)",
      "Bash(docker compose:*)",
    ],
    "deny": [],
  },
  "env": {
    "MAIN_BRANCH": "{{MAIN_BRANCH}}",
    "DEVELOP_BRANCH": "{{DEVELOP_BRANCH}}",
    "PACKAGE_MANAGER": "{{PACKAGE_MANAGER}}",
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
- `deny`는 비워둠 — hooks가 차단 담당 (이중 관리 방지)
- `env`로 hooks 스크립트에 환경 전달

---

## 스크립트

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
- CI 워크플로우 연결은 선택적 (README에 안내)

---

## 메모리 시스템 초기 구조

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
2. **초기 설정**
   - 플레이스홀더 전체 목록 + 설명 + 기본값
   - 필요한 GitHub Secrets (`ANTHROPIC_API_KEY` 등)
   - 파일별 복사 위치 매핑 표
3. **구성요소별 사용법** — Hooks / CI / Scripts / Memory / CLAUDE.md
4. **커스터마이징 가이드** — Application Level로 확장하는 법
5. **졸업 기준** — 별도 리포로 분리하는 시점 + 방법

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
| `{{DB_SERVICE}}`      | E2E용 DB 서비스 설정  | PostgreSQL 17               |
