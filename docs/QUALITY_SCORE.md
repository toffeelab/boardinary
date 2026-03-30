# 품질 스코어 및 검증

## 품질 스코어

최종 업데이트: 2026-03-30

| 도메인 | 등급 | 비고 |
|--------|------|------|
| 타입 안전성 | A | `any` 사용 0건 |
| 테스트 커버리지 | C | E2E만 존재, unit 테스트 부족 |
| 문서 최신성 | B | 하네스 구조 도입으로 개선 중 |
| 아키텍처 준수 | B | data-access 패턴 대부분 준수 |
| 접근성 | D | 미검증 |
| 성능 | — | 측정 미실시 |

등급 기준: A(우수) B(양호) C(개선 필요) D(미흡) —(미측정)

## 기술 부채 추적

상세 목록 → [docs/exec-plans/tech-debt-tracker.md](exec-plans/tech-debt-tracker.md)

---

## 검증 체크리스트

구현 완료 후, PR 생성 전 반드시 수행해야 하는 검증 단계.

### 1. 자동 검증 (모든 변경에 필수)

| 단계     | 명령어              | 통과 기준               |
| -------- | ------------------- | ----------------------- |
| 테스트   | `pnpm --filter web test` | 0 failures         |
| Lint     | `pnpm lint`         | 0 errors (warning 허용) |
| 타입체크 | `pnpm check-types`  | 0 errors                |
| 빌드     | `pnpm build`        | exit 0                  |

### 2. 스펙 대비 요구사항 체크

플랜/스펙 문서를 다시 읽고 항목별로 구현 여부를 확인한다.

| 요구사항 | 상태 | 근거 (커밋 or 파일) |
| -------- | ---- | ------------------- |
| 기능 A   | ✅   | commit abc1234      |
| 기능 B   | ✅   | src/path/file.ts    |

누락된 요구사항이 있으면 구현 후 재검증.

### 3. E2E 검증 (화면 변경 시 필수)

화면(UI) 변경이 포함된 경우에만 수행. 데이터 레이어만 변경된 경우 스킵.

#### 사전 준비

```bash
pnpm --filter @repo/db db:seed:sample   # 샘플 데이터 시드
pnpm dev                           # 개발 서버 실행
```

#### Playwright MCP 검증 절차

| 단계 | MCP 도구                               | 목적                 |
| ---- | -------------------------------------- | -------------------- |
| 1    | `playwright_navigate`                  | 대상 페이지 접근     |
| 2    | `playwright_screenshot`                | 렌더링 결과 캡처     |
| 3    | `playwright_click` / `playwright_fill` | 주요 인터랙션 테스트 |
| 4    | `playwright_console_logs`              | 콘솔 에러 없음 확인  |

#### 스크린샷 보관

E2E 스크린샷은 PR에 첨부하기 위해 feature 브랜치에 임시 커밋한다.

```bash
BRANCH=$(git branch --show-current)
mkdir -p ".github/screenshots/${BRANCH}"
git add .github/screenshots/
git commit -m "chore: E2E 스크린샷 첨부"
```

#### 스크린샷 캡션 규칙

각 스크린샷 위에 캡션을 작성:

```markdown
### `/페이지경로` — 페이지 설명

확인 내용을 1~2문장으로 서술.

![alt text](스크린샷 URL)
```

### 4. 검증 결과 보고 형식

```markdown
## Verification

- **Tests**: N files, M tests — all pass
- **Lint**: 0 errors, 0 warnings
- **Types**: 0 errors
- **Build**: exit 0, N routes
- **E2E**: N pages verified, 0 console errors
- **Spec**: 모든 요구사항 충족
```
