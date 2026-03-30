# CLAUDE.md — Boardinary 프로젝트 가이드

게임 기획자 스토리보드 협업 툴. Turborepo 모노레포 + Next.js 16 App Router + TypeScript + PostgreSQL.

## 세션 시작 프로토콜

```bash
./scripts/health-check.sh              # 환경 상태 확인
git log --oneline -10                  # 최근 변경 확인
cat progress/current-sprint.md         # 현재 Sprint 확인
```

## 기술 스택

- **모노레포**: Turborepo 2, pnpm workspace (npm/yarn 금지)
- Next.js 16.2.0 (App Router, RSC), React 19, TypeScript 5
- Tailwind CSS v4, shadcn/ui (lucide 아이콘)
- PostgreSQL (Drizzle ORM, Neon 프로덕션 / Docker 로컬), Zustand (UI 상태)
- Auth.js v5 (Google/GitHub OAuth + 매직 링크), JWT 세션 전략
- ESLint 9 (flat config) + Prettier + husky + lint-staged

## 모노레포 구조

```
boardinary/
├── ARCHITECTURE.md          # 시스템 아키텍처 + 불변 조건
├── apps/
│   ├── web/                 # 메인 웹앱 (Next.js 16, port 4000)
│   ├── api/                 # REST API 서버 (NestJS, port 4001)
│   └── docs/                # 문서 사이트 (Next.js 16, port 4002)
├── packages/
│   ├── db/                  # 공유 DB 스키마/연결 (@repo/db)
│   ├── types/               # 공유 타입 (@repo/types)
│   ├── ui/                  # 공유 UI 컴포넌트 (@repo/ui)
│   ├── eslint-config/       # 공유 ESLint 설정 (@repo/eslint-config)
│   └── typescript-config/   # 공유 TypeScript 설정
├── docs/                    # 지식 베이스 (아래 "참조 문서 맵" 참조)
├── scripts/                 # init.sh, health-check.sh, doc-check.sh, generate-docs.sh
└── progress/                # features.json, current-sprint.md
```

## 명령어

```bash
# 루트 (Turborepo)
pnpm dev                    # 모든 앱 동시 실행
pnpm build                  # 모든 앱/패키지 빌드
pnpm lint                   # 모든 패키지 린트
pnpm check-types            # 모든 패키지 타입 체크
pnpm format                 # Prettier 포매팅

# 특정 앱/패키지
pnpm --filter web dev       # web 앱만 dev 서버
pnpm --filter web build     # web 앱만 빌드

# 데이터베이스
pnpm --filter @repo/db db:generate    # 스키마 → 마이그레이션 SQL
pnpm --filter @repo/db db:migrate     # 마이그레이션 실행
pnpm --filter @repo/db db:studio      # Drizzle Studio (DB GUI)
pnpm --filter @repo/db db:seed:sample # 샘플 데이터 시드
pnpm --filter web test                # 테스트 실행 (Docker PG 필요)

# 로컬 개발 시작
docker compose up -d                    # PostgreSQL (port 6432)
pnpm --filter @repo/db db:migrate       # 마이그레이션
pnpm dev                                # 전체 실행 (web:4000, api:4001, docs:4002)
```

## 개발 워크플로우

### Git Flow

```
main (프로덕션) ← develop (통합) ← feature/<YYYY-MM-DD>/<이름>
```

- conventional commits (feat:, fix:, refactor:, chore:)
- PR은 반드시 `develop` 대상, Claude 자동 리뷰 → squash merge

### 작업 순서

1. **요구사항 분석** → `brainstorming` 스킬 (메인 디렉토리)
2. **계획 수립** → `writing-plans` + Sprint 계약 작성 (메인 디렉토리)
3. **worktree 생성** → `using-git-worktrees` 스킬
4. **TDD 개발** → `test-driven-development` (worktree에서)
5. **검증** → `verification-before-completion` → [QUALITY_SCORE.md](docs/QUALITY_SCORE.md)
6. **코드 리뷰** → `requesting-code-review`
7. **완료** → `finishing-a-development-branch` (PR `--base develop`)

상세 → [docs/PLANS.md](docs/PLANS.md) | Worktree → [docs/WORKTREE.md](docs/WORKTREE.md)

### Superpowers 스킬

**프로세스:** brainstorming, writing-plans, test-driven-development, verification-before-completion, requesting-code-review, finishing-a-development-branch, dispatching-parallel-agents
**도메인:** frontend-design, frontend-developer, simplify

## 참조 문서 맵

| 문서 | 경로 | 언제 참조 |
|------|------|----------|
| **시스템 아키텍처** | [`ARCHITECTURE.md`](ARCHITECTURE.md) | 레이어 구조, 불변 조건, 데이터 흐름 |
| **프론트엔드 컨벤션** | [`docs/FRONTEND.md`](docs/FRONTEND.md) | UI, 스타일링, 반응형 |
| **품질 스코어/검증** | [`docs/QUALITY_SCORE.md`](docs/QUALITY_SCORE.md) | PR 전 검증 체크리스트 |
| **계획 수립 가이드** | [`docs/PLANS.md`](docs/PLANS.md) | Sprint 계약, Generator-Evaluator 패턴 |
| **Worktree 가이드** | [`docs/WORKTREE.md`](docs/WORKTREE.md) | 병렬 작업, 포트 관리 |
| **Workflow 수정** | [`docs/WORKFLOW.md`](docs/WORKFLOW.md) | .github/workflows/ 수정 절차 |
| **개발 도구/MCP** | [`docs/TOOLS.md`](docs/TOOLS.md) | Serena, Chrome DevTools, context7 |
| **핵심 신념** | [`docs/design-docs/core-beliefs.md`](docs/design-docs/core-beliefs.md) | 프로젝트 원칙 |
| **기술 부채** | [`docs/exec-plans/tech-debt-tracker.md`](docs/exec-plans/tech-debt-tracker.md) | 알려진 부채 목록 |
| **제품 명세서** | [`docs/product-specs/`](docs/product-specs/) | 기능명세서, 유저플로우 |
| **기술 참조** | [`docs/references/`](docs/references/) | LLM 친화 라이브러리 문서 |
| **진행 추적** | [`progress/features.json`](progress/features.json) | 기능별 완료 상태 |

## 불변 조건 (핵심)

- `any` 금지 → `unknown` 사용. `console.log` 커밋 금지
- DB 접근은 `data-access/` 레이어만. Server Action에서 `getCurrentUserId()` 필수
- `apps/` 간 직접 import 금지 → `packages/`로 추출
- 상세 → [ARCHITECTURE.md](ARCHITECTURE.md)

## 금지 사항

- main, develop 브랜치에 직접 코드 커밋/push 금지 (docs/ 커밋은 예외)
- 메인 디렉토리에서 코드 구현 금지 — 반드시 worktree에서 작업
- *.db, .env.local 커밋 금지
- npm/yarn 사용 금지 — pnpm만 사용
- 패키지 간 순환 의존성 금지
