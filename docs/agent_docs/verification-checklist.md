# Verification Checklist

구현 완료 후, PR 생성 전 반드시 수행해야 하는 검증 단계.

## 1. 자동 검증 (모든 변경에 필수)

| 단계     | 명령어              | 통과 기준               |
| -------- | ------------------- | ----------------------- |
| 테스트   | `pnpm --filter web test` | 0 failures         |
| Lint     | `pnpm lint`         | 0 errors (warning 허용) |
| 타입체크 | `pnpm check-types`  | 0 errors                |
| 빌드     | `pnpm build`        | exit 0                  |

## 2. 스펙 대비 요구사항 체크

플랜/스펙 문서를 다시 읽고 항목별로 구현 여부를 확인한다.

```markdown
| 요구사항 | 상태 | 근거 (커밋 or 파일) |
| -------- | ---- | ------------------- |
| 기능 A   | ✅   | commit abc1234      |
| 기능 B   | ✅   | src/path/file.ts    |
```

누락된 요구사항이 있으면 구현 후 재검증.

## 3. E2E 검증 (화면 변경 시 필수)

화면(UI) 변경이 포함된 경우에만 수행. 데이터 레이어만 변경된 경우 스킵.

### 사전 준비

```bash
pnpm --filter web db:seed:sample   # 샘플 데이터 시드
pnpm dev                           # 개발 서버 실행 (turbo dev)
```

### Playwright MCP 검증 절차

| 단계 | MCP 도구                               | 목적                 |
| ---- | -------------------------------------- | -------------------- |
| 1    | `playwright_navigate`                  | 대상 페이지 접근     |
| 2    | `playwright_screenshot`                | 렌더링 결과 캡처     |
| 3    | `playwright_click` / `playwright_fill` | 주요 인터랙션 테스트 |
| 4    | `playwright_console_logs`              | 콘솔 에러 없음 확인  |

### 검증 대상 페이지 결정 기준

- 새로 생성된 라우트 → 필수 검증
- 수정된 라우트 → 변경 부분 검증
- 공유 컴포넌트(`@repo/ui`) 수정 → 영향받는 모든 앱의 페이지 검증

### 스크린샷 보관

E2E 스크린샷은 PR에 첨부하기 위해 feature 브랜치에 임시 커밋한다.

```bash
# 1. feature 브랜치 이름으로 폴더 생성 후 스크린샷 저장
BRANCH=$(git branch --show-current)
mkdir -p ".github/screenshots/${BRANCH}"
# (스크린샷 파일을 해당 폴더에 저장)

# 2. feature 브랜치에 커밋
git add .github/screenshots/
git commit -m "chore: E2E 스크린샷 첨부"

# 3. PR 본문에서 참조 (squash merge 시 develop에 포함되지 않음)
# ![설명](https://raw.githubusercontent.com/<owner>/boardinary/<branch>/.github/screenshots/<branch>/<파일명>)
```

### 스크린샷 캡션 규칙

이미지만 첨부하지 말고, 각 스크린샷 위에 캡션을 작성할 것:

```markdown
### `/페이지경로` — 페이지 설명

확인 내용을 1~2문장으로 서술. 어떤 기능이 정상 동작하는지, 무엇을 검증했는지 기록.

![alt text](스크린샷 URL)
```

## 4. 검증 결과 보고 형식

```markdown
## Verification

- **Tests**: N files, M tests — all pass
- **Lint**: 0 errors, 0 warnings
- **Types**: 0 errors
- **Build**: exit 0, N routes
- **E2E**: N pages verified, 0 console errors
- **Spec**: 모든 요구사항 충족 (체크리스트 참조)
```
