# Phase 0 디자인 스펙: 기반 인프라 + 랜딩 + 대시보드

## 1. 전체 Phase 로드맵

| Phase | 이름 | 핵심 | 의존성 |
|-------|------|------|--------|
| **0** | **기반 + 랜딩** | Auth, DB, 랜딩, 대시보드 | 없음 (현재 spec) |
| 1 | 코어 에디터 | 캔버스, DnD, 속성 편집, 저장 | Phase 0 |
| 2 | 템플릿 & 컴포넌트 | 장르 템플릿, 컴포넌트 라이브러리 | Phase 1 |
| 3 | 실시간 협업 + 멤버 초대 | WebSocket/CRDT, 프레즌스, **멤버 초대** | Phase 1 |
| 4 | 버전 관리 | 스냅샷, 타임라인, 복원 | Phase 1 |
| 5 | 주석 & 피드백 | 앵커링 주석, 스레드, 멘션 | Phase 3 |
| 6 | 내보내기 & 연동 | PDF/이미지, Jira/Slack | Phase 1 |
| 7a | AI 생성 & 분석 | 텍스트→초안, 보드 분석, 대사 생성 | Phase 1 |
| 7b | AI + 버전 연동 | AI 적용 시 자동 스냅샷 | Phase 4, 7a |

> **참고**: Phase 3에서 멤버 초대 기능 포함 필수 (Phase 0에서는 조직 자동 생성 + owner 멤버십만)

## 2. 인증 (Auth.js v5)

- **Provider**: Google OAuth + GitHub OAuth + 매직 링크 (Resend) — 3가지 모두
- **세션 전략**: JWT (DB 세션 없음, 단 Auth.js 어댑터 호환을 위해 sessions 테이블 정의 필요)
- **흐름**: `/login` → provider 선택 → 콜백 → `/dashboard`로 리다이렉트
- **첫 가입 시**: 개인 조직 자동 생성 (`{userName}의 워크스페이스`)
  - 레이스 컨디션 방지: `UNIQUE(owner_id) WHERE is_personal = true` partial unique index
  - `ON CONFLICT DO NOTHING` + 후속 SELECT로 중복 방지
- **미인증 접근**: `/dashboard` 이하 → `/login`으로 리다이렉트
- **매직 링크 남용 방지**: 이메일당 시간당 최대 5회 제한 (in-memory, 추후 Redis)

### 미들웨어 라우트 보호

| 라우트 패턴 | 접근 권한 |
|-------------|----------|
| `/`, `/login`, `/api/auth/*` | 공개 |
| `/dashboard/**` | 인증 필수 (미인증 시 `/login` 리다이렉트) |
| `/login` (인증 상태) | `/dashboard`로 리다이렉트 |

미들웨어 matcher: `['/dashboard/:path*', '/login']`

## 3. DB 스키마 (Drizzle + PostgreSQL)

**계층 구조**: 조직 → 프로젝트 → 스토리보드

### 테이블 설계

```
users
├── id (cuid, PK)
├── name (text)
├── email (text, UNIQUE)
├── email_verified (timestamp)
├── image (text)
└── created_at, updated_at

accounts (Auth.js 관리)
├── user_id (text, FK → users, ON DELETE CASCADE)
├── type (text) — 'oauth' | 'oidc' | 'email'
├── provider (text)
├── provider_account_id (text)
├── access_token (text)
├── refresh_token (text)
├── expires_at (integer)
├── token_type (text)
├── scope (text)
├── id_token (text)
├── session_state (text)
└── PK: (provider, provider_account_id)

sessions (Auth.js 어댑터 호환 — JWT 전략에서는 미사용)
├── session_token (text, PK)
├── user_id (text, FK → users, ON DELETE CASCADE)
└── expires (timestamp)

verification_tokens (Auth.js 매직 링크)
├── identifier (text)
├── token (text)
├── expires (timestamp)
└── PK: (identifier, token)

organizations
├── id (cuid, PK)
├── name (text, NOT NULL)
├── slug (text, UNIQUE)
├── description (text)
├── owner_id (text, FK → users, ON DELETE RESTRICT)
├── is_personal (boolean, DEFAULT false)
├── created_at, updated_at
└── PARTIAL UNIQUE: (owner_id) WHERE is_personal = true

org_members
├── PK: (org_id, user_id) — 복합 기본키
├── org_id (text, FK → organizations, ON DELETE CASCADE)
├── user_id (text, FK → users, ON DELETE CASCADE)
├── role (org_role enum: 'owner' | 'admin' | 'member', DEFAULT 'member')
└── joined_at (timestamp)

projects
├── id (cuid, PK)
├── org_id (text, FK → organizations, ON DELETE CASCADE)
├── name (text, NOT NULL)
├── description (text)
├── slug (text)
├── status (text: 'active' | 'archived', DEFAULT 'active')
├── created_at, updated_at
└── UNIQUE: (org_id, slug)

storyboards
├── id (cuid, PK)
├── project_id (text, FK → projects, ON DELETE CASCADE)
├── created_by (text, NULLABLE, FK → users, ON DELETE SET NULL)
├── updated_by (text, NULLABLE, FK → users, ON DELETE SET NULL)
├── name (text, NOT NULL)
├── description (text)
├── content (jsonb, DEFAULT '{}') — 캔버스 상태
├── content_version (integer, DEFAULT 0) — 콘텐츠 스키마 버전
├── genre (text) — 앱 레이어에서 검증 (Phase 2 템플릿 확장 대비)
├── tags (text[])
├── status (text: 'draft' | 'published' | 'archived', DEFAULT 'draft')
└── created_at, updated_at
```

### 인덱스 전략

```sql
-- organizations
CREATE UNIQUE INDEX idx_organizations_slug ON organizations(slug);
CREATE UNIQUE INDEX idx_organizations_personal ON organizations(owner_id) WHERE is_personal = true;

-- org_members (PK가 org_id, user_id이므로 org_id 단독 조회 커버)
CREATE INDEX idx_org_members_user_id ON org_members(user_id);

-- projects
CREATE INDEX idx_projects_org_id ON projects(org_id);
CREATE INDEX idx_projects_org_status ON projects(org_id, status);
CREATE UNIQUE INDEX idx_projects_org_slug ON projects(org_id, slug);

-- storyboards
CREATE INDEX idx_storyboards_project_id ON storyboards(project_id);
CREATE INDEX idx_storyboards_project_status ON storyboards(project_id, status);
CREATE INDEX idx_storyboards_created_by ON storyboards(created_by);
CREATE INDEX idx_storyboards_tags ON storyboards USING gin(tags);
```

> **Phase 1에서 추가**: `search_text` 컬럼 + GIN tsvector 인덱스, `thumbnail_url` 컬럼

### CASCADE 전략

| FK | 동작 | 이유 |
|----|------|------|
| `accounts.user_id → users` | CASCADE | Auth.js 요구사항 |
| `sessions.user_id → users` | CASCADE | Auth.js 요구사항 |
| `organizations.owner_id → users` | RESTRICT | 소유권 이전 먼저 필요 |
| `org_members.org_id → organizations` | CASCADE | 조직 삭제 시 멤버십 정리 |
| `org_members.user_id → users` | CASCADE | 사용자 삭제 시 멤버십 정리 |
| `projects.org_id → organizations` | CASCADE | 조직 라이프사이클 |
| `storyboards.project_id → projects` | CASCADE | 프로젝트 라이프사이클 |
| `storyboards.created_by → users` | SET NULL | 스토리보드 보존, 작성자 표시만 제거 |
| `storyboards.updated_by → users` | SET NULL | 스토리보드 보존, 편집자 표시만 제거 |

### updated_at 자동 갱신

PostgreSQL 트리거로 자동 갱신 (마이그레이션에 포함):

```sql
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 각 테이블에 적용
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
-- organizations, projects, storyboards에도 동일 적용
```

### 데이터 저장 전략

- **하이브리드 접근**: 메타데이터(이름, 장르, 태그)는 정규화 컬럼, 캔버스 상태는 jsonb
- **content**: Phase 0에서는 빈 객체 `{}`. Phase 1 스키마 초안:
  ```json
  {
    "version": 1,
    "viewport": { "x": 0, "y": 0, "zoom": 1 },
    "elements": [
      { "id": "...", "type": "...", "position": {}, "size": {}, "properties": {}, "ports": [] }
    ],
    "connections": [
      { "id": "...", "sourceElementId": "...", "sourcePortId": "...", "targetElementId": "...", "targetPortId": "...", "label": "" }
    ]
  }
  ```
- **content_version**: 스키마 버전 추적. Zod로 버전별 검증. 콘텐츠 마이그레이션 시 활용
- **content 크기 제한**: 최대 5MB. 클라이언트/서버 양쪽에서 검증
- **AI 접근**: jsonb에서 전체 문서를 한 번에 꺼내서 컨텍스트로 제공
- **쿼리 성능**: 단건 조회(PK), 목록(메타 컬럼만 SELECT — content 제외), 검색(Phase 1 GIN 인덱스)
- **genre**: text 컬럼 + 앱 레이어 검증. Phase 2 템플릿에서 장르 목록이 확장되므로 enum 대신 유연하게

### 삭제 정책

- **Phase 0**: `status: archived`로 논리 삭제 (프로젝트, 스토리보드). 물리 삭제 없음
- **조직**: Phase 0에서는 삭제 불가 (owner_id RESTRICT). 추후 소유권 이전 + 삭제 기능
- **사용자 탈퇴**: Phase 0 범위 외. 추후 GDPR 대응 시 설계
- **Phase 4 이후**: `deleted_at` 타임스탬프 도입하여 스냅샷/코멘트 참조 보존

## 4. UI 디자인 시스템

- **액센트 컬러**: Purple / Violet (기본 브랜드 컬러)
- **테마**: 라이트/다크 모드 전환 (Phase 0부터)
- **전환 방식**: 시스템 설정 따라가기 + 수동 토글 (헤더에 배치)
- **테마 저장**: `localStorage` + Zustand 동기화 (Phase 0). 추후 DB 저장 가능
- **기반**: Tailwind CSS v4 `dark:` variant + shadcn/ui CSS 변수
- **확장성**: CSS 변수 기반이므로 추후 테마 컬러 변경 기능 추가 가능

## 5. 랜딩 페이지 (`/`)

- **미니멀 구성**: 히어로 섹션 + 핵심 가치 제안 (3-4개 카드) + CTA (로그인/시작하기)
- 에디터 스크린샷은 Phase 1 이후 추가
- 비로그인 상태에서만 표시, 로그인 시 `/dashboard`로 리다이렉트

## 6. 대시보드 레이아웃

- **사이드바 + 탑바 하이브리드** (GitHub/Jira 스타일)
  - **좌측 사이드바**: 조직 전환, 프로젝트 목록 트리
  - **상단 탑바**: 검색, 다크모드 토글, 프로필/설정
  - **본문**: 프로젝트/스토리보드 콘텐츠

### UI 상태 처리

- **빈 상태**: 프로젝트 없는 신규 사용자 → 온보딩 프롬프트 ("첫 프로젝트를 만들어보세요")
- **로딩 상태**: 사이드바/본문에 스켈레톤 UI
- **에러 상태**: Error Boundary + 재시도 UI
- **404**: 유효하지 않은 slug/id → 커스텀 not-found 페이지

## 7. Phase 0 유저 플로우

```
비로그인 → 랜딩(/) → 로그인(/login)
  → Google/GitHub/매직링크 선택
  → 콜백 처리
  → 첫 가입이면 개인 조직 자동 생성
  → 대시보드(/dashboard/{orgSlug})
    → 사이드바에서 조직/프로젝트 탐색
    → 프로젝트 생성 (이름, 설명)
    → 스토리보드 생성 (이름, 장르 선택)
    → 스토리보드 상세 페이지 (Phase 0: 메타정보만, Phase 1에서 에디터 연결)
```

## 8. 라우트 구조

```
/                                    → 랜딩 페이지 (비로그인)
/login                               → 로그인 페이지
/api/auth/[...nextauth]              → Auth.js API 라우트

/dashboard                           → 기본 조직으로 리다이렉트
/dashboard/[orgSlug]                 → 조직 대시보드 (프로젝트 목록)
/dashboard/[orgSlug]/projects/new    → 프로젝트 생성
/dashboard/[orgSlug]/projects/[slug] → 프로젝트 상세 (스토리보드 목록)
/dashboard/[orgSlug]/projects/[slug]/storyboards/new   → 스토리보드 생성
/dashboard/[orgSlug]/projects/[slug]/storyboards/[id]  → 스토리보드 상세
/dashboard/settings                  → 사용자 설정 (프로필, 테마)
```

> **URL에 orgSlug 포함**: 멀티 조직 시 URL 모호성 해소. 북마크/공유 링크에서 조직 컨텍스트 유지.

## 9. Mutation 패턴

- **기본**: Next.js Server Actions (RSC-first 접근)
- **모든 Server Action**: `getCurrentUserId()` 호출로 인증 확인
- **data-access 레이어**: DB 직접 import 금지. `data-access/` 함수를 통해 접근
- **API Routes**: Phase 6 웹훅/외부 연동에서만 사용

## 10. 기술 스택 (Phase 0)

- Next.js 16 (App Router, RSC)
- Auth.js v5 (Google/GitHub OAuth + 매직 링크)
- Drizzle ORM + PostgreSQL (Neon prod / Docker local)
- Tailwind CSS v4 + shadcn/ui (Purple/Violet 테마)
- Zustand (UI 상태: 사이드바 토글, 테마 등)

## 11. Phase 0 범위 외 (이연 항목)

| 항목 | 이연 시점 | 이유 |
|------|----------|------|
| `search_text` 컬럼 + GIN tsvector | Phase 1 | 에디터 없이 검색할 콘텐츠 없음 |
| `thumbnail_url` 컬럼 | Phase 1 | 에디터 완성 후 프리뷰 생성 |
| `deleted_at` 소프트 삭제 | Phase 4 | 버전 관리와 함께 도입 |
| `position` 정렬 컬럼 | Phase 1+ | Phase 0은 created_at 정렬로 충분 |
| 멤버 초대 UI | Phase 3 | 실시간 협업과 함께 |
| 사용자 탈퇴/GDPR | 추후 | Phase 0 범위 외 |
