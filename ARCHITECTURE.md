# ARCHITECTURE.md — Boardinary 시스템 아키텍처

> CLAUDE.md의 상세 아키텍처 결정과 불변 조건을 집약한 문서.
> 핵심 신념 → [docs/design-docs/core-beliefs.md](docs/design-docs/core-beliefs.md)

## 시스템 개요

```
┌─────────────────────────────────────────────────────┐
│                    apps/web (Next.js 16)             │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────┐  │
│  │ App Router│  │Components│  │  Server Actions    │  │
│  │ (pages)  │  │ (UI)     │  │  (mutations)       │  │
│  └────┬─────┘  └────┬─────┘  └────────┬──────────┘  │
│       │              │                  │             │
│       └──────────────┴──────────────────┘             │
│                      │                                │
│              ┌───────▼────────┐                       │
│              │  data-access/  │ ← DB 접근 추상화      │
│              └───────┬────────┘                       │
│                      │                                │
│              ┌───────▼────────┐                       │
│              │    db/         │ ← Drizzle 스키마      │
│              └───────┬────────┘                       │
└──────────────────────┼──────────────────────────────┘
                       │
               ┌───────▼────────┐
               │  PostgreSQL    │
               │  (Neon / Docker)│
               └────────────────┘
```

## 레이어 구조

코드는 다음 레이어를 통해서만 흐를 수 있다 (상위 → 하위 방향만 허용):

```
App Router (pages/layouts) → Components → Server Actions
                                              │
                                    data-access/ (DB 쿼리 추상화)
                                              │
                                         db/ (Drizzle 스키마)
                                              │
                                         PostgreSQL
```

### 레이어별 역할

| 레이어 | 위치 | 역할 |
|--------|------|------|
| **App Router** | `apps/web/src/app/` | 페이지, 레이아웃, 라우트 핸들러 |
| **Components** | `apps/web/src/components/` | UI 컴포넌트 (Server/Client) |
| **Server Actions** | `apps/web/src/actions/` | 데이터 변경 (mutation) |
| **data-access** | `apps/web/src/data-access/` (예정) | DB 쿼리 추상화, 타입 정의 |
| **db** | `packages/db/src/` | Drizzle 스키마, 연결 |
| **Stores** | `apps/web/src/stores/` | Zustand UI 상태 |
| **lib** | `apps/web/src/lib/` | 유틸리티, 상수, 인증 헬퍼 |

---

## 불변 조건 (Invariants)

린터, 빌드, 코드 리뷰를 통해 강제한다. ESLint 규칙은 `boardinary-rules.js`에 정의.
`only-warn` 플러그인이 에러를 경고로 변환하지만, `--max-warnings 0` 플래그로 경고도 실패 처리.

| 규칙 | 강제 방법 | 비고 |
|------|----------|------|
| `any` 타입 사용 금지 | `@typescript-eslint/no-explicit-any` (tseslint recommended) | `unknown` 사용 |
| `console.log` 커밋 금지 | `no-console` (ESLint) | `console.warn/error`만 허용 |
| data-access 외부에서 DB 직접 import 금지 | `no-restricted-imports` (ESLint) | `@repo/db`, `drizzle-orm` 직접 import 차단 |
| Server Action에서 `getCurrentUserId()` 필수 | 코드 리뷰 | 직접 세션 접근 금지 |
| `apps/` 간 직접 import 금지 | `no-restricted-imports` (ESLint) | 공유 코드는 `packages/`로 |
| 패키지 간 순환 의존성 금지 | Turbo 빌드 | 빌드 실패로 감지 |
| 불필요한 `'use client'` 금지 | 코드 리뷰 | 기본은 Server Component |

---

## 데이터 흐름

### 읽기 (Server Component → DB)

```
Server Component
  └→ data-access 함수 호출 (async/await)
       └→ Drizzle 쿼리 실행
            └→ PostgreSQL 결과 반환
  └→ props로 Client Component에 전달
```

### 쓰기 (Client → Server Action → DB)

```
Client Component (사용자 인터랙션)
  └→ Server Action 호출
       └→ getCurrentUserId() 인증 확인
       └→ data-access 함수 호출
            └→ Drizzle insert/update/delete
       └→ revalidatePath() 캐시 무효화
```

---

## 인증 흐름

```
Auth.js v5 (OAuth/Magic Link)
  └→ JWT 세션 전략 (DB 세션 없음)
       └→ auth.ts: { auth, signIn, signOut, handlers }  ← Node.js 전용
       └→ auth.config.ts: Edge-safe 설정               ← Middleware
       └→ lib/auth.ts: getCurrentUserId()               ← Server Action 필수
```

### 인증 관련 파일

| 파일 | 역할 | 사용 환경 |
|------|------|----------|
| `apps/web/src/auth.ts` | `{ auth, signIn, signOut, handlers }` export | Node.js |
| `apps/web/src/auth.config.ts` | Edge-safe 설정 | Middleware |
| `apps/web/src/lib/auth.ts` | `getCurrentUserId()`, `getOptionalUserId()` | Server Action |

### 특수 사용자 ID

| ID | 용도 |
|----|------|
| `SYSTEM_USER_ID = 'system'` | 시스템 템플릿 데이터 |
| `DEFAULT_USER_ID = 'local-user'` | 로컬 개발/테스트 전용 |

### 필수 환경변수

`AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`, `AUTH_RESEND_KEY`, `AUTH_EMAIL_FROM`

---

## 상태 관리 결정

| 상태 유형 | 관리 방법 | 예시 |
|----------|----------|------|
| **DB 데이터** | Server Component에서 fetch → props 전달 | 프로젝트 목록, 스토리보드 데이터 |
| **UI 상태** | Zustand store | 사이드바 토글, 에디터 편집 상태 |
| **폼 상태** | React 19 useActionState | 폼 제출, 유효성 검사 |

**원칙**: 전역 상태 남용 금지 — props로 충분하면 props 사용

---

## Server / Client 분리

| 유형 | 기본값 | 사용 조건 |
|------|--------|----------|
| **Server Component** | ✅ 기본 | 데이터 fetching, 정적 UI |
| **Client Component** | `'use client'` 명시 | 사용자 인터랙션, 상태 의존 UI, 브라우저 API |

불필요한 `'use client'` 지정 금지 — 필요한 컴포넌트에만 사용

---

## Import 규칙

| 범위 | 규칙 | 예시 |
|------|------|------|
| 앱 내부 | 절대 경로 | `@/components/...`, `@/lib/...` |
| 패키지 간 | workspace 패키지명 | `@repo/ui/*`, `@repo/db` |
| 순서 | builtin → external → workspace → internal → relative | ESLint 강제 |

---

## 데이터베이스

| 환경 | DB | 연결 |
|------|-----|------|
| 프로덕션 | Neon PostgreSQL | `DATABASE_URL` (Neon 연결 문자열) |
| 로컬 개발 | Docker PostgreSQL 17 | `postgresql://postgres:postgres@localhost:6432/boardinary` |
| 테스트 | Docker PostgreSQL 17 | `boardinary_test` DB, TRUNCATE CASCADE로 격리 |

### 스키마 관리

- 스키마 정의: `packages/db/src/schema.ts` (Drizzle pgTable)
- 마이그레이션: `packages/db/drizzle/` (Drizzle Kit 생성 + 커스텀 SQL)
- **시드 업데이트**: DB 스키마 변경 시 시드 파일과 테스트 헬퍼도 동기화 필수

---

## 모노레포 패키지

| 패키지 | 경로 | 역할 |
|--------|------|------|
| `@repo/ui` | `packages/ui/src/` | 공유 UI 컴포넌트 |
| `@repo/db` | `packages/db/` | 공유 DB 스키마/연결 |
| `@repo/types` | `packages/types/` | 공유 타입 |
| `@repo/eslint-config` | `packages/eslint-config/` | `base.js`, `next.js`, `react-internal.js` |
| `@repo/typescript-config` | `packages/typescript-config/` | `base.json`, `nextjs.json`, `react-library.json` |

새 공유 패키지 추가 시 `pnpm-workspace.yaml`과 소비 패키지의 `package.json`에 의존성 추가
