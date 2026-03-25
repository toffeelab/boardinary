# Phase 0 NestJS 통합 아키텍처 스펙

> 기존 `2026-03-25-phase0-foundation.md` 스펙의 아키텍처 변경 보충 문서.
> Phase 0 기반 인프라에 NestJS 백엔드를 추가하고, DB 접근을 중앙화한다.

## 1. 변경 동기

- Phase 3(실시간 협업)에서 WebSocket 서버가 필요 → 미리 NestJS 도입
- DB 접근 포인트를 NestJS 한 곳으로 통일 → 관리 포인트 최소화
- Next.js는 UI + 인증에 집중, NestJS는 비즈니스 로직 + DB에 집중

## 2. 전체 구조

```
boardinary/
├── apps/
│   ├── web/          # Next.js 16 (UI + Auth.js)     → port 4000
│   ├── api/          # NestJS (REST API + WebSocket)  → port 4001
│   └── docs/         # 문서 사이트                    → port 4002
├── packages/
│   ├── db/           # Drizzle 스키마 + DB 연결 (@repo/db)
│   ├── types/        # 공유 API DTO (@repo/types)
│   ├── ui/           # 공유 UI 컴포넌트 (@repo/ui)
│   ├── eslint-config/
│   └── typescript-config/
└── docker-compose.yml  # PostgreSQL → port 6432
```

### 포트 배정

| 서비스 | 포트 |
|--------|------|
| web (Next.js) | 4000 |
| api (NestJS) | 4001 |
| docs (Next.js) | 4002 |
| Drizzle Studio | 4003 |
| PostgreSQL | 6432 |

## 3. 통신 구조

```
브라우저 → Next.js (SSR/RSC) → NestJS API (REST) → PostgreSQL
                ↓
         Auth.js (JWT 발급)
                ↓
         JWT를 Authorization 헤더로 NestJS에 전달
```

- **Next.js → NestJS**: Server Action/Server Component에서 `fetch()` + JWT 헤더
- **NestJS → DB**: Drizzle ORM (`@repo/db` import)
- **Next.js → DB**: Auth.js 테이블만 직접 접근 (`@repo/db`에서 auth export만 사용)

## 4. DB 접근 규칙

| 앱 | DB 접근 범위 | 방법 |
|----|-------------|------|
| `apps/api` | 전체 테이블 | `@repo/db` 직접 import |
| `apps/web` | Auth.js 테이블만 (users, accounts, sessions, verification_tokens) | `@repo/db`에서 auth 테이블만 import |
| `apps/web` | 비즈니스 데이터 (organizations, projects, storyboards 등) | NestJS API 호출 |

## 5. 인증 흐름

### 서버 간 인증 (Next.js → NestJS)

Next.js에서 NestJS로의 호출은 모두 **서버 사이드** (Server Action/Server Component)에서 발생한다. 브라우저가 NestJS를 직접 호출하지 않으므로 **내부 서비스 인증**을 사용한다.

1. 사용자가 `/login`에서 Google/GitHub/매직링크로 로그인
2. Auth.js가 세션 발급 (Next.js 내부, `AUTH_SECRET` 사용)
3. Server Action에서 `auth()`로 세션 확인 → `userId` 획득
4. NestJS API 호출 시:
   - `X-Internal-Secret` 헤더: 서비스 간 인증 (공유 시크릿)
   - `X-User-Id` 헤더: 현재 사용자 ID 전달
5. NestJS의 `InternalAuthGuard`가 시크릿 검증 + userId 추출

> **Phase 3 (WebSocket)**: 브라우저가 NestJS에 직접 연결할 때 JWT passthrough 도입 예정. Phase 0에서는 불필요.

### 첫 가입 시 개인 조직 생성

Auth.js `createUser` 이벤트 시점에는 세션이 없으므로, 내부 서비스 인증 (`X-Internal-Secret`)으로 NestJS `POST /api/users/setup` 호출. 이 엔드포인트는 `InternalAuthGuard`만 적용 (JWT 불필요).

### API 클라이언트

```ts
// apps/web/src/lib/api-client.ts
const API_URL = process.env.API_URL ?? "http://localhost:4001";
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET!;

export async function apiClient<T>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    userId?: string;
    timeout?: number;
  } = {},
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeout ?? 5000);

  try {
    const res = await fetch(`${API_URL}${path}`, {
      method: options.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Secret": INTERNAL_SECRET,
        ...(options.userId ? { "X-User-Id": options.userId } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });

    if (!res.ok) {
      const error: ApiErrorResponse = await res.json().catch(() => ({
        statusCode: res.status,
        message: `API error: ${res.status}`,
      }));
      throw new Error(error.message);
    }

    return res.json();
  } finally {
    clearTimeout(timeoutId);
  }
}
```

Server Action에서 사용:
```ts
// apps/web/src/actions/project-actions.ts
"use server";
import { getCurrentUserId } from "@/lib/auth";
import { apiClient } from "@/lib/api-client";

export async function createProjectAction(formData: FormData) {
  const userId = await getCurrentUserId();
  const orgSlug = formData.get("orgSlug") as string;

  await apiClient(`/api/organizations/${orgSlug}/projects`, {
    method: "POST",
    body: { name, description },
    userId,
  });
}
```

### DB 접근 경계 강화

`packages/db`는 전체 스키마를 포함하지만, `apps/web`은 `auth-schema.ts` export만 사용해야 한다.

**Phase 0 강화 방법**: 컨벤션 + 코드 리뷰로 강화. `apps/web`에서 `@repo/db`의 비즈니스 테이블(organizations, projects 등)을 import하면 리뷰에서 reject.

**추후 강화**: ESLint 커스텀 룰 또는 `@repo/db-auth` 별도 패키지 분리.

## 6. `packages/db` 구조

```
packages/db/
├── src/
│   ├── index.ts           # DB 연결 + 전체 스키마 re-export
│   ├── schema.ts          # 전체 Drizzle 스키마 (기존 apps/web/src/db/schema.ts 이동)
│   ├── auth-schema.ts     # Auth.js 테이블만 분리 export (web에서 사용)
│   └── types.ts           # 스키마에서 infer된 타입
├── drizzle/
│   └── migrations/        # 마이그레이션 SQL
├── drizzle.config.ts
├── package.json           # name: "@repo/db"
└── tsconfig.json
```

**export 구분:**
```ts
// packages/db/src/index.ts — 전체 (api에서 사용)
export * from "./schema";
export { db } from "./connection";

// packages/db/src/auth-schema.ts — auth만 (web에서 사용)
export { users, accounts, sessions, verificationTokens } from "./schema";
export { db } from "./connection";
```

## 7. `packages/types` 구조

```
packages/types/
├── src/
│   ├── index.ts
│   ├── organizations.ts   # OrganizationDto, CreateOrganizationDto 등
│   ├── projects.ts        # ProjectDto, CreateProjectDto 등
│   ├── storyboards.ts     # StoryboardDto, StoryboardMetaDto 등
│   └── common.ts          # PaginatedResponse, ErrorResponse 등
├── package.json           # name: "@repo/types"
└── tsconfig.json
```

## 8. `apps/api` 구조 (NestJS)

```
apps/api/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── auth/
│   │   ├── auth.module.ts
│   │   ├── jwt.strategy.ts       # AUTH_SECRET으로 JWT 검증
│   │   └── jwt-auth.guard.ts
│   ├── organizations/
│   │   ├── organizations.module.ts
│   │   ├── organizations.controller.ts
│   │   └── organizations.service.ts
│   ├── projects/
│   │   ├── projects.module.ts
│   │   ├── projects.controller.ts
│   │   └── projects.service.ts
│   └── storyboards/
│       ├── storyboards.module.ts
│       ├── storyboards.controller.ts
│       └── storyboards.service.ts
├── package.json
├── tsconfig.json
├── tsconfig.build.json
└── nest-cli.json
```

### NestJS 주요 의존성

- `@nestjs/core`, `@nestjs/common`, `@nestjs/platform-express`
- `@nestjs/passport`, `passport-jwt` — JWT 검증
- `@nestjs/config` — 환경변수 관리
- `@repo/db` — DB 접근
- `@repo/types` — DTO 타입

## 9. REST API 엔드포인트 (Phase 0)

모든 엔드포인트는 `InternalAuthGuard` 적용 (X-Internal-Secret + X-User-Id 검증).
`/api/health`와 `/api/users/setup`은 인증 예외.

> **Path parameter 규칙**: 조직은 항상 `orgSlug`, 프로젝트는 `projectSlug`으로 통일 (human-readable URL). 스토리보드는 `id` 사용.

```
GET    /api/health                                         → 헬스 체크 (인증 불필요)

POST   /api/users/setup                                    → 첫 가입 시 개인 조직 생성 (InternalAuthGuard만, userId 헤더)

GET    /api/organizations                                  → 내 조직 목록
GET    /api/organizations/:orgSlug                         → 조직 상세

GET    /api/organizations/:orgSlug/projects                → 프로젝트 목록
POST   /api/organizations/:orgSlug/projects                → 프로젝트 생성
GET    /api/organizations/:orgSlug/projects/:projectSlug   → 프로젝트 상세
PATCH  /api/organizations/:orgSlug/projects/:projectSlug   → 프로젝트 수정
DELETE /api/organizations/:orgSlug/projects/:projectSlug   → 프로젝트 삭제(아카이브)

GET    /api/organizations/:orgSlug/projects/:projectSlug/storyboards     → 스토리보드 목록
POST   /api/organizations/:orgSlug/projects/:projectSlug/storyboards     → 스토리보드 생성
GET    /api/storyboards/:id                                              → 스토리보드 상세
PATCH  /api/storyboards/:id                                              → 스토리보드 수정
DELETE /api/storyboards/:id                                              → 스토리보드 삭제(아카이브)
```

### 인가 (Authorization)

- 모든 조직 관련 엔드포인트: `OrgMemberGuard` — 요청 userId가 해당 조직의 멤버인지 확인
- Phase 0에서는 역할 구분 없이 **멤버이면 모든 CRUD 가능**
- Phase 3+에서 `@Roles('owner', 'admin')` 데코레이터 + `RolesGuard` 추가

### 에러 응답 계약

모든 에러는 NestJS 기본 예외 필터 형식을 따름:

```ts
// @repo/types/src/common.ts
export interface ApiErrorResponse {
  statusCode: number;
  message: string;
  error?: string;       // NestJS 기본 에러명 (e.g. "Not Found")
  details?: unknown;    // 유효성 검증 에러 상세
}
```

### 입력 유효성 검증

- NestJS 글로벌 `ValidationPipe` 적용: `whitelist: true`, `forbidNonWhitelisted: true`
- `apps/api`에서 `class-validator` + `class-transformer` 사용
- DTO 클래스는 `@repo/types` 인터페이스를 구현
- 스토리보드 `content` 크기 제한: 최대 5MB (커스텀 파이프)

## 10. 기존 코드 변경 요약

| 영역 | 변경 |
|------|------|
| `apps/web/src/db/` | → `packages/db/`로 이동 |
| `apps/web/src/data-access/` | **삭제** → NestJS 서비스로 대체 |
| `apps/web/src/actions/` | `fetch()` → NestJS API 호출로 변경 |
| `apps/web/src/auth.ts` | DB import를 `@repo/db`의 auth-schema에서 가져오도록 수정. createUser 이벤트에서 NestJS API 호출 |
| `docker-compose.yml` | 포트 5434 → 6432 변경 |
| `apps/web/package.json` | dev 포트 → 4000 |
| `turbo.json` | api 앱 추가, dev 태스크에 api 포함 |
| `CLAUDE.md` | 명령어 섹션 업데이트 (DB 명령어 → `@repo/db`, 포트 변경, api 앱 추가) |
| 새로 추가 | `apps/api/`, `packages/db/`, `packages/types/` |

## 11. 환경변수

### apps/web/.env.local
```env
AUTH_SECRET=...
AUTH_GOOGLE_ID=...
AUTH_GOOGLE_SECRET=...
AUTH_GITHUB_ID=...
AUTH_GITHUB_SECRET=...
AUTH_RESEND_KEY=...
AUTH_EMAIL_FROM=noreply@boardinary.com
DATABASE_URL=postgresql://boardinary:boardinary@localhost:6432/boardinary
API_URL=http://localhost:4001
INTERNAL_API_SECRET=... (apps/api와 동일한 값)
NEXT_PUBLIC_APP_URL=http://localhost:4000
```

### apps/api/.env
```env
DATABASE_URL=postgresql://boardinary:boardinary@localhost:6432/boardinary
INTERNAL_API_SECRET=... (apps/web과 동일한 값)
PORT=4001
```

> `AUTH_SECRET`은 apps/api에서 더 이상 불필요 — Phase 0에서는 JWT가 아닌 내부 시크릿으로 인증

## 12. 개발 환경

```bash
docker compose up -d                    # PostgreSQL (6432)
pnpm --filter @repo/db db:migrate      # 마이그레이션
pnpm dev                                # turbo가 web(4000) + api(4001) + docs(4002) 동시 실행
```

## 13. 기존 Phase 0 스펙과의 관계

이 문서는 기존 Phase 0 스펙(`2026-03-25-phase0-foundation.md`)을 **대체하지 않고 보충**합니다:
- DB 스키마, 인덱스, CASCADE 전략, 테마, UI 디자인 → 기존 스펙 유지
- 아키텍처, 통신, 패키지 구조, API 엔드포인트 → 이 문서가 우선

기존 스펙의 "Mutation 패턴" 섹션(Server Actions 직접 DB 접근)은 이 문서의 "Server Actions → NestJS API 호출" 패턴으로 대체됩니다.
