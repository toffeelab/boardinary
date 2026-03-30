# Claude Code Harness Template

Claude Code를 안전하게 사용하기 위한 가드레일 + 자동화 템플릿입니다.
Hook, CI/CD workflow, 유틸리티 스크립트, Memory 구조, CLAUDE.md 템플릿을 한 번에 설치합니다.

---

## 1. 이게 뭔가요? (Before / After)

| 상황 | Before (harness 없이) | After (harness 설치 후) |
|------|----------------------|------------------------|
| force push | Claude가 `git push --force` 자유롭게 실행 | Hook이 자동 차단하고 BLOCKED 메시지 출력 |
| 보호 브랜치 수정 | main/develop 브랜치에서 코드 직접 수정 가능 | Hook이 차단하고 feature 브랜치 사용 안내 |
| PR 코드 리뷰 | 매번 수동으로 리뷰해야 함 | Claude가 PR을 자동 리뷰하고 APPROVED/CHANGES REQUESTED 판정 |
| CLAUDE.md 작성 | 처음부터 직접 작성 | 섹션별 가이드가 포함된 템플릿 제공 |
| 머지된 브랜치 정리 | 오래된 브랜치가 쌓임 | 주간 스케줄로 자동 정리 (cleanup-branches workflow) |

---

## 2. 빠른 시작 (5분)

### Step 1. 템플릿 복사

```bash
cp -r templates/harness/ /path/to/your-project/
```

### Step 2. 초기화 스크립트 실행

```bash
cd /path/to/your-project
sh scripts/init-harness.sh --defaults
```

`--defaults`를 빼면 interactive 모드로 실행되어 각 모듈과 설정 값을 하나씩 선택할 수 있습니다.

### Step 3. 테스트

Claude Code에서 아래 명령을 시도해 보세요:

```
git push --force origin main
```

`BLOCKED: Command matches blocked pattern` 메시지가 출력되면 정상 작동하는 것입니다.

---

## 3. 필요한 사전 준비

| 항목 | 설치 방법 | 용도 |
|------|----------|------|
| jq | `brew install jq` (macOS) / `apt install jq` (Linux) | Hook이 JSON 파싱에 사용. 없으면 보안 hook이 차단 모드로 동작 |
| GitHub Secrets: `CLAUDE_CODE_OAUTH_TOKEN` | GitHub repo > Settings > Secrets and variables > Actions에서 추가 | Claude PR 자동 리뷰 workflow에서 사용 |

---

## 4. 구성요소별 설명

| 구성요소 | 설명 |
|---------|------|
| **Hooks** | Claude가 파일을 수정하거나 명령을 실행하기 전/후에 자동으로 실행되는 검사 스크립트 |
| **CI/CD** | PR을 올리면 GitHub에서 자동으로 실행되는 코드 리뷰 + 빌드/테스트 |
| **Scripts** | 개발 환경 상태를 확인하거나 문서 무결성을 검사하는 유틸리티 |
| **Memory** | Claude가 대화 간에 기억하는 정보를 저장하는 구조 |
| **CLAUDE.md** | Claude에게 프로젝트 규칙을 알려주는 가이드 문서 |

### Hooks 상세

| 파일 | 트리거 | 역할 |
|------|--------|------|
| `block-dangerous-commands.sh` | PreToolUse (Bash) | `git push --force`, `rm -rf /`, `DROP TABLE` 등 위험 명령 차단 |
| `warn-main-branch-edit.sh` | PreToolUse (Edit\|Write) | 보호 브랜치에서 코드 파일 수정 시 차단 (docs/ 경로는 허용) |
| `auto-lint-on-write.sh` | PostToolUse (Write\|Edit) | 파일 저장 후 해당 파일에 자동 lint 실행 |
| `_lib/common.sh` | (공유 라이브러리) | 모든 hook이 source하는 JSON 파싱, 차단/경고 함수 모음 |

### CI/CD Workflows 상세

| 파일 | 역할 |
|------|------|
| `claude-review.yml` | PR 생성/업데이트 시 Claude가 코드 리뷰 수행, APPROVED 또는 CHANGES REQUESTED 판정 |
| `ci.yml` | PR마다 lint, type-check, test, build, E2E 자동 실행 |
| `cleanup-branches.yml` | 매주 일요일 03:00 UTC에 머지 완료된 오래된 브랜치 자동 삭제 |

### Scripts 상세

| 파일 | 역할 |
|------|------|
| `health-check.sh` | Git 상태, Docker 컨테이너, node_modules, 최근 커밋, 열린 PR 한눈에 확인 |
| `doc-check.sh` | CLAUDE.md 안의 파일 경로 참조가 실제로 존재하는지 검사 |
| `init-harness.sh` | 템플릿 파일 복사 + placeholder 치환 + settings.json 머지 (초기화 스크립트) |

---

## 5. 커스터마이징 예시

### 예시 1: 차단 패턴 추가

`block-dangerous-commands.sh`의 `BLOCKED_PATTERNS` 배열에 원하는 정규식을 추가합니다:

```bash
# .claude/hooks/PreToolUse/block-dangerous-commands.sh

BLOCKED_PATTERNS=(
  # ... 기존 패턴들 ...
  'npm publish'              # 실수로 패키지 배포 방지
  'docker system prune -a'   # 전체 Docker 캐시 삭제 방지
)
```

### 예시 2: 새로운 커스텀 hook 만들기

DB 마이그레이션 명령을 실행하기 전에 확인하는 hook을 만드는 예시입니다.

**Step 1.** Hook 파일 생성

```bash
cat > .claude/hooks/PreToolUse/warn-migration.sh << 'EOF'
#!/bin/bash
# warn-migration.sh — DB 마이그레이션 실행 전 경고
source "$(dirname "$0")/../_lib/common.sh"

COMMAND=$(hook_get '.tool_input.command')
[ -z "$COMMAND" ] && exit 0

if echo "$COMMAND" | grep -qE 'migrate|db:push'; then
  hook_warn "DB 마이그레이션을 실행하려고 합니다. 실행 환경을 확인하세요."
fi

exit 0
EOF
```

**Step 2.** 실행 권한 부여

```bash
chmod +x .claude/hooks/PreToolUse/warn-migration.sh
```

**Step 3.** `.claude/settings.json`의 hooks 섹션에 등록

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          "sh .claude/hooks/PreToolUse/block-dangerous-commands.sh",
          "sh .claude/hooks/PreToolUse/warn-migration.sh"
        ]
      }
    ]
  }
}
```

---

## 6. 트러블슈팅 FAQ

### Q. Hook이 동작하지 않아요

**A.** 다음을 확인하세요:

1. `.claude/settings.json` 파일이 프로젝트 루트에 있는지 확인
2. `settings.json`의 hooks 섹션에 해당 hook 경로가 등록되어 있는지 확인
3. hook 파일에 실행 권한이 있는지 확인: `chmod +x .claude/hooks/PreToolUse/block-dangerous-commands.sh`
4. `init-harness.sh`를 실행했는지 확인 (`.template` 파일은 자동으로 `.json`으로 변환됩니다)

### Q. "BLOCKED: jq is required" 메시지가 나와요

**A.** jq가 설치되지 않은 환경입니다. 보안 hook(PreToolUse)은 fail-closed 원칙으로, jq 없이는 모든 명령을 차단합니다.

```bash
# macOS
brew install jq

# Ubuntu/Debian
sudo apt install jq
```

### Q. CI에서 Claude 리뷰가 안 돌아요

**A.** GitHub Secrets에 `CLAUDE_CODE_OAUTH_TOKEN`이 설정되어 있는지 확인하세요.

1. GitHub repo > Settings > Secrets and variables > Actions
2. `CLAUDE_CODE_OAUTH_TOKEN` 이름으로 OAuth token 추가
3. 토큰이 없으면 workflow는 경고만 출력하고 리뷰를 건너뜁니다

### Q. init-harness.sh를 다시 실행해도 되나요?

**A.** 네, 안전합니다. 이 스크립트는 **멱등성**을 보장합니다:

- 이미 존재하는 파일은 diff를 보여주고 덮어쓸지 물어봅니다
- `settings.json`은 기존 설정과 새 설정을 field-level 머지합니다
- 이전 실행 시 입력한 값은 `.claude/.harness-config`에 저장되어 다음 실행의 기본값으로 사용됩니다

### Q. 기본 패턴(BLOCKED_PATTERNS 등)을 수정했는데, init-harness.sh를 재실행하면 덮어써지나요?

**A.** 아닙니다. 재실행 시 기존 파일과 새 파일의 차이를 보여주고 선택지를 제공합니다:

- 기존 파일 유지
- 새 파일로 교체
- diff 확인 후 결정

직접 수정한 내용은 "기존 파일 유지"를 선택하면 보존됩니다.

### Q. 어떤 파일이 어디로 가나요?

**A.** 아래 [8. 파일별 복사 위치](#8-파일별-복사-위치) 섹션의 매핑 테이블을 참고하세요.

---

## 7. 용어집

| 용어 | 설명 |
|------|------|
| **Hook** | Claude Code가 도구를 사용하기 전/후에 자동으로 실행되는 셸 스크립트. 조건에 따라 작업을 차단하거나 경고를 표시합니다. |
| **PreToolUse** | Claude가 도구(Bash, Edit, Write 등)를 실행하기 **전**에 트리거되는 hook 타입. 위험한 작업을 사전에 차단할 때 사용합니다. |
| **PostToolUse** | Claude가 도구를 실행한 **후**에 트리거되는 hook 타입. 자동 lint처럼 후속 작업을 수행할 때 사용합니다. |
| **fail-closed** | 오류 발생 시 작업을 **차단**하는 보안 원칙. jq가 없거나 JSON 파싱에 실패하면 해당 명령을 실행하지 않습니다. PreToolUse hook의 기본 동작입니다. |
| **fail-open** | 오류 발생 시 작업을 **허용**하는 원칙. lint 같은 정보 제공용 hook에 사용합니다. 실패해도 Claude의 작업을 막지 않습니다. |
| **멱등성 (idempotent)** | 같은 작업을 여러 번 실행해도 결과가 동일한 성질. `init-harness.sh`는 여러 번 실행해도 안전합니다. |
| **플레이스홀더 (placeholder)** | 템플릿 파일 안에 `{{KEY}}` 형식으로 들어 있는 변수. `init-harness.sh` 실행 시 실제 값으로 치환됩니다. |

---

## 8. 파일별 복사 위치

| 템플릿 경로 | 설치 대상 경로 | 비고 |
|------------|---------------|------|
| `.claude/hooks/PreToolUse/block-dangerous-commands.sh` | `.claude/hooks/PreToolUse/block-dangerous-commands.sh` | 위험 명령 차단 hook |
| `.claude/hooks/PreToolUse/warn-main-branch-edit.sh` | `.claude/hooks/PreToolUse/warn-main-branch-edit.sh` | 보호 브랜치 수정 차단 hook |
| `.claude/hooks/PostToolUse/auto-lint-on-write.sh` | `.claude/hooks/PostToolUse/auto-lint-on-write.sh` | 자동 lint hook |
| `.claude/hooks/_lib/common.sh` | `.claude/hooks/_lib/common.sh` | hook 공유 라이브러리 |
| `.claude/settings.json.template` | `.claude/settings.json` | 권한 + hook 등록 설정 (`.template` 확장자 제거됨) |
| `.github/workflows/claude-review.yml` | `.github/workflows/claude-review.yml` | Claude PR 자동 리뷰 |
| `.github/workflows/ci.yml` | `.github/workflows/ci.yml` | CI 파이프라인 |
| `.github/workflows/cleanup-branches.yml` | `.github/workflows/cleanup-branches.yml` | 브랜치 자동 정리 |
| `CLAUDE.md.template` | `CLAUDE.md` | 프로젝트 가이드 문서 (`.template` 확장자 제거됨) |
| `memory/MEMORY.md` | `.claude/memory/MEMORY.md` | Memory 인덱스 |
| `memory/_examples/*.md` | `.claude/memory/_examples/*.md` | Memory 예시 파일 |
| `scripts/init-harness.sh` | `scripts/init-harness.sh` | 초기화 스크립트 |
| `scripts/health-check.sh` | `scripts/health-check.sh` | 개발 환경 상태 확인 |
| `scripts/doc-check.sh` | `scripts/doc-check.sh` | CLAUDE.md 참조 경로 검사 |

---

## 9. 플레이스홀더 전체 목록

| 플레이스홀더 | 설명 | 기본값 |
|-------------|------|--------|
| `{{PROJECT_NAME}}` | 프로젝트 이름 (CLAUDE.md, Memory에 사용) | `My Project` |
| `{{MAIN_BRANCH}}` | 메인(프로덕션) 브랜치 이름 | `main` |
| `{{DEVELOP_BRANCH}}` | 개발(통합) 브랜치 이름 | `develop` |
| `{{PACKAGE_MANAGER}}` | 패키지 매니저 (settings.json 허용 명령에 사용) | `pnpm` |
| `{{LINT_EXTENSIONS}}` | 자동 lint 대상 파일 확장자 | `"ts" "tsx" "js" "jsx"` |
| `{{REVIEW_MODEL}}` | Claude PR 리뷰에 사용할 모델 | `sonnet` |
| `{{REVIEW_LANGUAGE}}` | Claude PR 리뷰 작성 언어 | `Korean` |
| `{{LINT_CMD}}` | lint 실행 명령어 (CI workflow에 사용) | `pnpm lint` |
| `{{BUILD_CMD}}` | 빌드 실행 명령어 (CI workflow에 사용) | `pnpm build` |
| `{{TEST_CMD}}` | 테스트 실행 명령어 (CI workflow에 사용) | `pnpm test` |
| `{{E2E_CMD}}` | E2E 테스트 실행 명령어 (CI workflow에 사용) | `pnpm test:e2e` |
| `{{TYPE_CHECK_CMD}}` | 타입 체크 실행 명령어 (CI workflow에 사용) | `pnpm check-types` |
| `{{BRANCH_PATTERN}}` | 자동 정리 대상 브랜치 glob 패턴 | `feature/*` |
| `{{RETENTION_DAYS}}` | 머지된 브랜치 보존 일수 (이후 자동 삭제) | `90` |

---

## 10. 졸업 기준

이 템플릿은 프로젝트 안에 직접 복사해서 사용하는 방식입니다.
다음 조건을 충족하면, 별도 repository로 분리하여 여러 프로젝트에서 공유하는 것을 고려하세요:

- 두 번째 프로젝트에도 이 harness를 적용했다
- 첫 번째 프로젝트에서 1주일 이상 안정적으로 사용했다

분리하면 버전 관리, 업데이트 배포, 팀 간 공유가 쉬워집니다.
