# Phase 0: 기반 인프라 + 랜딩 + 대시보드 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** "가입 → 로그인 → 프로젝트 생성 → 빈 스토리보드 생성"까지의 전체 흐름을 완성한다.

**Architecture:** Next.js 16 App Router + Auth.js v5 (JWT) + Drizzle ORM + PostgreSQL. Server Components 기본, Server Actions로 mutation. `src/` 디렉토리 구조로 마이그레이션. 조직 → 프로젝트 → 스토리보드 3단계 계층.

**Tech Stack:** Next.js 16.2.0, Auth.js v5, Drizzle ORM, PostgreSQL 17 (Docker), Tailwind CSS v4, shadcn/ui, Zustand, lucide-react

**Spec:** `docs/superpowers/specs/2026-03-25-phase0-foundation.md`

---

## 파일 구조

### 새로 생성할 파일

```
apps/web/
├── src/
│   ├── app/
│   │   ├── layout.tsx                    # 루트 레이아웃 (ThemeProvider, 폰트)
│   │   ├── page.tsx                      # 랜딩 페이지
│   │   ├── globals.css                   # Tailwind v4 + shadcn 테마 변수
│   │   ├── login/
│   │   │   └── page.tsx                  # 로그인 페이지
│   │   ├── api/
│   │   │   └── auth/
│   │   │       └── [...nextauth]/
│   │   │           └── route.ts          # Auth.js API 라우트
│   │   ├── not-found.tsx                 # 커스텀 404 페이지
│   │   └── dashboard/
│   │       ├── layout.tsx                # 대시보드 최소 레이아웃 (인증 확인 + 탑바)
│   │       ├── page.tsx                  # 기본 조직으로 리다이렉트
│   │       ├── settings/
│   │       │   └── page.tsx              # 사용자 설정 (프로필, 테마)
│   │       └── [orgSlug]/
│   │           ├── layout.tsx            # 조직별 레이아웃 (사이드바)
│   │           ├── page.tsx              # 조직 대시보드 (프로젝트 목록)
│   │           └── projects/
│   │               ├── new/
│   │               │   └── page.tsx      # 프로젝트 생성 폼
│   │               └── [slug]/
│   │                   ├── page.tsx      # 프로젝트 상세 (스토리보드 목록)
│   │                   └── storyboards/
│   │                       ├── new/
│   │                       │   └── page.tsx  # 스토리보드 생성 폼
│   │                       └── [id]/
│   │                           └── page.tsx  # 스토리보드 상세
│   ├── auth.ts                           # Auth.js 메인 설정 (Node.js 전용)
│   ├── auth.config.ts                    # Auth.js Edge-safe 설정
│   ├── middleware.ts                     # Next.js 미들웨어 (라우트 보호)
│   ├── components/
│   │   ├── ui/                           # shadcn/ui 컴포넌트 (자동 생성)
│   │   ├── landing/
│   │   │   ├── hero-section.tsx          # 히어로 섹션
│   │   │   ├── features-section.tsx      # 기능 카드 섹션
│   │   │   └── cta-section.tsx           # CTA 섹션
│   │   ├── dashboard/
│   │   │   ├── sidebar.tsx               # 좌측 사이드바
│   │   │   ├── topbar.tsx                # 상단 탑바
│   │   │   ├── org-switcher.tsx          # 조직 전환 드롭다운
│   │   │   └── project-list.tsx          # 프로젝트 목록
│   │   └── shared/
│   │       ├── theme-toggle.tsx          # 다크모드 토글 버튼
│   │       └── empty-state.tsx           # 빈 상태 컴포넌트
│   ├── db/
│   │   ├── index.ts                      # DB 연결 (Drizzle + Neon/pg)
│   │   ├── schema.ts                     # 전체 Drizzle 스키마
│   │   └── seed.ts                       # 샘플 데이터 시드
│   ├── data-access/
│   │   ├── organizations.ts              # 조직 CRUD
│   │   ├── projects.ts                   # 프로젝트 CRUD
│   │   ├── storyboards.ts               # 스토리보드 CRUD
│   │   └── types.ts                      # 공유 타입 정의
│   ├── actions/
│   │   ├── organization-actions.ts       # 조직 Server Actions
│   │   ├── project-actions.ts            # 프로젝트 Server Actions
│   │   └── storyboard-actions.ts         # 스토리보드 Server Actions
│   ├── lib/
│   │   ├── auth.ts                       # getCurrentUserId, getOptionalUserId
│   │   ├── constants.ts                  # SYSTEM_USER_ID, DEFAULT_USER_ID 등
│   │   └── utils.ts                      # cn() 등 유틸리티
│   └── test/
│       ├── setup.ts                      # 테스트 setup (vitest)
│       └── helpers.ts                    # 테스트 헬퍼 (DB 초기화 등)
├── drizzle.config.ts                     # Drizzle Kit 설정
├── drizzle/
│   └── migrations/                       # 마이그레이션 SQL (자동 생성)
├── components.json                       # shadcn/ui 설정
├── postcss.config.mjs                    # PostCSS 설정 (Tailwind)
├── tailwind.config.ts                    # Tailwind 설정 (있다면 — v4는 CSS 기반)
└── .env.local.example                    # 환경변수 템플릿

docker-compose.yml                        # PostgreSQL 17 컨테이너 (루트)
```

---

## Task 1: 프로젝트 구조 마이그레이션 (app/ → src/app/)

**Files:**
- Move: `apps/web/app/*` → `apps/web/src/app/*`
- Modify: `apps/web/tsconfig.json`
- Modify: `apps/web/next.config.js`
- Delete: `apps/web/app/page.module.css`

- [ ] **Step 1: src 디렉토리 생성 및 파일 이동**

```bash
cd apps/web
mkdir -p src/app
mv app/layout.tsx app/page.tsx app/globals.css src/app/
mv app/fonts src/app/fonts
mv app/favicon.ico src/app/favicon.ico
rm -f app/page.module.css
rmdir app
```

- [ ] **Step 2: tsconfig.json에 paths 별칭 추가**

`apps/web/tsconfig.json`:
```json
{
  "extends": "@repo/typescript-config/nextjs.json",
  "compilerOptions": {
    "plugins": [{ "name": "next" }],
    "strictNullChecks": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["**/*.ts", "**/*.tsx", "next-env.d.ts", "next.config.js", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: 기본 page.tsx를 최소 플레이스홀더로 교체**

`apps/web/src/app/page.tsx`:
```tsx
export default function Home() {
  return (
    <main>
      <h1>Boardinary</h1>
      <p>게임 기획자 스토리보드 협업 툴</p>
    </main>
  );
}
```

- [ ] **Step 4: 빌드 확인**

```bash
pnpm --filter web build
```
Expected: 빌드 성공

- [ ] **Step 5: 커밋**

```bash
git add apps/web/src apps/web/tsconfig.json
git rm apps/web/app/page.module.css
git commit -m "refactor: migrate web app to src/ directory structure"
```

---

## Task 2: Tailwind CSS v4 + shadcn/ui 설정

**Files:**
- Create: `apps/web/src/app/globals.css` (덮어쓰기)
- Create: `apps/web/src/lib/utils.ts`
- Create: `apps/web/components.json`
- Create: `apps/web/postcss.config.mjs`
- Modify: `apps/web/package.json`
- Modify: `apps/web/src/app/layout.tsx`

- [ ] **Step 1: Tailwind v4 + shadcn 의존성 설치**

```bash
cd /path/to/worktree
pnpm --filter web add tailwindcss @tailwindcss/postcss class-variance-authority clsx tailwind-merge lucide-react
pnpm --filter web add -D @tailwindcss/cli
```

- [ ] **Step 2: PostCSS 설정 생성**

`apps/web/postcss.config.mjs`:
```js
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
```

- [ ] **Step 3: globals.css — Tailwind v4 + Purple/Violet 테마 변수**

`apps/web/src/app/globals.css`:
```css
@import "tailwindcss";

@custom-variant dark (&:is(.dark *));

@theme {
  --color-background: #ffffff;
  --color-foreground: #0c0a1a;
  --color-card: #ffffff;
  --color-card-foreground: #0c0a1a;
  --color-popover: #ffffff;
  --color-popover-foreground: #0c0a1a;
  --color-primary: #8b5cf6;
  --color-primary-foreground: #faf5ff;
  --color-secondary: #f3e8ff;
  --color-secondary-foreground: #2e1065;
  --color-muted: #f5f3ff;
  --color-muted-foreground: #6b7280;
  --color-accent: #f3e8ff;
  --color-accent-foreground: #2e1065;
  --color-destructive: #ef4444;
  --color-destructive-foreground: #ffffff;
  --color-border: #e9d5ff;
  --color-input: #e9d5ff;
  --color-ring: #8b5cf6;
  --color-sidebar-background: #faf5ff;
  --color-sidebar-foreground: #0c0a1a;
  --color-sidebar-primary: #8b5cf6;
  --color-sidebar-primary-foreground: #faf5ff;
  --color-sidebar-accent: #f3e8ff;
  --color-sidebar-accent-foreground: #2e1065;
  --color-sidebar-border: #e9d5ff;
  --radius: 0.625rem;
}

@layer base {
  .dark {
    --color-background: #0c0a1a;
    --color-foreground: #e2e8f0;
    --color-card: #1e1b3a;
    --color-card-foreground: #e2e8f0;
    --color-popover: #1e1b3a;
    --color-popover-foreground: #e2e8f0;
    --color-primary: #a78bfa;
    --color-primary-foreground: #0c0a1a;
    --color-secondary: #2e2854;
    --color-secondary-foreground: #e2e8f0;
    --color-muted: #1e1b3a;
    --color-muted-foreground: #a1a1c7;
    --color-accent: #2e2854;
    --color-accent-foreground: #e2e8f0;
    --color-destructive: #f87171;
    --color-destructive-foreground: #0c0a1a;
    --color-border: #2e2854;
    --color-input: #2e2854;
    --color-ring: #a78bfa;
    --color-sidebar-background: #0c0a1a;
    --color-sidebar-foreground: #e2e8f0;
    --color-sidebar-primary: #a78bfa;
    --color-sidebar-primary-foreground: #0c0a1a;
    --color-sidebar-accent: #2e2854;
    --color-sidebar-accent-foreground: #e2e8f0;
    --color-sidebar-border: #2e2854;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

- [ ] **Step 4: cn() 유틸리티 생성**

`apps/web/src/lib/utils.ts`:
```ts
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 5: shadcn/ui 초기화**

```bash
cd apps/web
pnpm dlx shadcn@latest init
```

설정 선택:
- Style: New York
- Base color: Custom (이미 globals.css에 정의)
- CSS variables: Yes
- Tailwind CSS: v4
- Components path: `src/components/ui`
- Utils path: `src/lib/utils`

> 만약 `components.json`이 자동 생성되지 않으면 수동으로 생성:

`apps/web/components.json`:
```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/app/globals.css",
    "baseColor": "neutral",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  }
}
```

- [ ] **Step 6: 기본 shadcn 컴포넌트 설치**

```bash
cd apps/web
pnpm dlx shadcn@latest add button card input label separator avatar dropdown-menu sheet skeleton badge
```

- [ ] **Step 7: layout.tsx 업데이트 (Tailwind 적용)**

`apps/web/src/app/layout.tsx`:
```tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Boardinary — 게임 기획자 스토리보드 협업 툴",
  description: "게임 스토리보드를 시각적으로 설계하고, 팀과 실시간으로 협업하세요.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 8: 빌드 확인**

```bash
pnpm --filter web build
```
Expected: 빌드 성공, Tailwind 스타일 적용

- [ ] **Step 9: 커밋**

```bash
git add apps/web/src apps/web/components.json apps/web/postcss.config.mjs apps/web/package.json
git commit -m "feat: setup Tailwind CSS v4 + shadcn/ui with Purple/Violet theme"
```

---

## Task 3: 다크모드 지원 (ThemeProvider + 토글)

**Files:**
- Create: `apps/web/src/components/shared/theme-provider.tsx`
- Create: `apps/web/src/components/shared/theme-toggle.tsx`
- Modify: `apps/web/src/app/layout.tsx`
- Modify: `apps/web/package.json`

- [ ] **Step 1: next-themes 설치**

```bash
pnpm --filter web add next-themes
```

- [ ] **Step 2: ThemeProvider 생성**

`apps/web/src/components/shared/theme-provider.tsx`:
```tsx
"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
```

- [ ] **Step 3: ThemeToggle 생성**

`apps/web/src/components/shared/theme-toggle.tsx`:
```tsx
"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">테마 전환</span>
    </Button>
  );
}
```

- [ ] **Step 4: layout.tsx에 ThemeProvider 적용**

`apps/web/src/app/layout.tsx` — body 내부를 ThemeProvider로 감싸기:
```tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/shared/theme-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Boardinary — 게임 기획자 스토리보드 협업 툴",
  description: "게임 스토리보드를 시각적으로 설계하고, 팀과 실시간으로 협업하세요.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 5: 빌드 확인**

```bash
pnpm --filter web build
```
Expected: 빌드 성공

- [ ] **Step 6: 커밋**

```bash
git add apps/web/src apps/web/package.json
git commit -m "feat: add dark mode support with next-themes"
```

---

## Task 4: Docker + PostgreSQL + Drizzle ORM 설정

**Files:**
- Create: `docker-compose.yml` (프로젝트 루트)
- Create: `apps/web/src/db/index.ts`
- Create: `apps/web/src/db/schema.ts`
- Create: `apps/web/drizzle.config.ts`
- Create: `apps/web/.env.local.example`
- Modify: `apps/web/package.json`

- [ ] **Step 1: docker-compose.yml 생성**

`docker-compose.yml` (프로젝트 루트):
```yaml
services:
  postgres:
    image: postgres:17
    container_name: boardinary-postgres
    restart: unless-stopped
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: boardinary
      POSTGRES_PASSWORD: boardinary
      POSTGRES_DB: boardinary
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./init-test-db.sql:/docker-entrypoint-initdb.d/init-test-db.sql

volumes:
  pgdata:
```

- [ ] **Step 2: 테스트 DB 초기화 SQL**

`init-test-db.sql` (프로젝트 루트):
```sql
CREATE DATABASE boardinary_test;
```

- [ ] **Step 3: Drizzle 의존성 설치**

```bash
pnpm --filter web add drizzle-orm postgres
pnpm --filter web add -D drizzle-kit @types/pg
```

- [ ] **Step 4: 환경변수 템플릿 생성**

`apps/web/.env.local.example`:
```env
# Database
DATABASE_URL=postgresql://boardinary:boardinary@localhost:5432/boardinary

# Auth.js
AUTH_SECRET=generate-with-openssl-rand-base64-32
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
AUTH_GITHUB_ID=
AUTH_GITHUB_SECRET=
AUTH_RESEND_KEY=
AUTH_EMAIL_FROM=noreply@boardinary.com

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

- [ ] **Step 5: DB 연결 모듈 생성**

`apps/web/src/db/index.ts`:
```ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is required");
}

const client = postgres(connectionString);

export const db = drizzle(client, { schema });
```

- [ ] **Step 6: Drizzle 스키마 생성 (전체)**

`apps/web/src/db/schema.ts`:
```ts
import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  pgEnum,
  primaryKey,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";

// ============================================================
// Enums
// ============================================================

export const orgRoleEnum = pgEnum("org_role", ["owner", "admin", "member"]);

// ============================================================
// Auth.js 테이블
// ============================================================

export const users = pgTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("image"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refreshToken: text("refresh_token"),
    accessToken: text("access_token"),
    expiresAt: integer("expires_at"),
    tokenType: text("token_type"),
    scope: text("scope"),
    idToken: text("id_token"),
    sessionState: text("session_state"),
  },
  (table) => [
    primaryKey({ columns: [table.provider, table.providerAccountId] }),
  ],
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.identifier, table.token] }),
  ],
);

// ============================================================
// 비즈니스 테이블
// ============================================================

export const organizations = pgTable(
  "organizations",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    isPersonal: boolean("is_personal").default(false).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_organizations_slug").on(table.slug),
    uniqueIndex("idx_organizations_personal")
      .on(table.ownerId)
      .where(sql`is_personal = true`),
  ],
);

export const orgMembers = pgTable(
  "org_members",
  {
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: orgRoleEnum("role").notNull().default("member"),
    joinedAt: timestamp("joined_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.orgId, table.userId] }),
    index("idx_org_members_user_id").on(table.userId),
  ],
);

export const projects = pgTable(
  "projects",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    slug: text("slug").notNull(),
    status: text("status", { enum: ["active", "archived"] })
      .default("active")
      .notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_projects_org_id").on(table.orgId),
    index("idx_projects_org_status").on(table.orgId, table.status),
    uniqueIndex("idx_projects_org_slug").on(table.orgId, table.slug),
  ],
);

export const storyboards = pgTable(
  "storyboards",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    createdBy: text("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    updatedBy: text("updated_by").references(() => users.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    description: text("description"),
    content: jsonb("content").default({}).notNull(),
    contentVersion: integer("content_version").default(0).notNull(),
    genre: text("genre"),
    tags: text("tags").array(),
    status: text("status", { enum: ["draft", "published", "archived"] })
      .default("draft")
      .notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_storyboards_project_id").on(table.projectId),
    index("idx_storyboards_project_status").on(table.projectId, table.status),
    index("idx_storyboards_created_by").on(table.createdBy),
    index("idx_storyboards_tags").using("gin", table.tags),
  ],
);
```

> **Note**: Drizzle ORM은 `.where()` 절로 partial unique index를 지원합니다. `drizzle-kit generate` 시 자동으로 SQL에 반영됩니다.

- [ ] **Step 7: CUID2 의존성 설치**

```bash
pnpm --filter web add @paralleldrive/cuid2
```

- [ ] **Step 8: Drizzle Kit 설정**

`apps/web/drizzle.config.ts`:
```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

- [ ] **Step 9: package.json에 DB 스크립트 추가**

`apps/web/package.json`의 `scripts`에 추가:
```json
{
  "scripts": {
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:studio": "drizzle-kit studio",
    "db:seed:sample": "tsx src/db/seed.ts"
  }
}
```

tsx 의존성 설치:
```bash
pnpm --filter web add -D tsx
```

- [ ] **Step 10: Docker 기동 + 마이그레이션 생성 및 실행**

```bash
docker compose up -d
```

`.env.local` 파일 생성 (커밋 안 함):
```bash
cp apps/web/.env.local.example apps/web/.env.local
# DATABASE_URL은 이미 기본값이 맞음
# AUTH_SECRET 생성:
echo "AUTH_SECRET=$(openssl rand -base64 32)" >> apps/web/.env.local
```

마이그레이션 생성 + 실행:
```bash
pnpm --filter web db:generate
pnpm --filter web db:migrate
```

- [ ] **Step 11: updated_at 트리거 + partial unique index 커스텀 마이그레이션**

마이그레이션 생성 후, `drizzle/migrations/` 폴더에 커스텀 SQL 파일 추가:

`apps/web/drizzle/migrations/0001_custom_triggers.sql`:
```sql
-- updated_at 자동 갱신 트리거 함수
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 각 테이블에 트리거 적용
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_storyboards_updated_at
  BEFORE UPDATE ON storyboards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

```

마이그레이션 재실행:
```bash
pnpm --filter web db:migrate
```

- [ ] **Step 12: 빌드 확인**

```bash
pnpm --filter web build
```
Expected: 빌드 성공

- [ ] **Step 13: 커밋**

```bash
git add docker-compose.yml init-test-db.sql apps/web/src/db apps/web/drizzle apps/web/drizzle.config.ts apps/web/package.json apps/web/.env.local.example
git commit -m "feat: setup PostgreSQL + Drizzle ORM with full Phase 0 schema"
```

---

## Task 5: Auth.js v5 설정

**Files:**
- Create: `apps/web/src/auth.config.ts`
- Create: `apps/web/src/auth.ts`
- Create: `apps/web/src/app/api/auth/[...nextauth]/route.ts`
- Create: `apps/web/src/middleware.ts`
- Create: `apps/web/src/lib/auth.ts`
- Create: `apps/web/src/lib/constants.ts`
- Modify: `apps/web/package.json`

- [ ] **Step 1: Auth.js 의존성 설치**

```bash
pnpm --filter web add next-auth@5 @auth/drizzle-adapter
pnpm --filter web add resend                # 매직 링크용
```

- [ ] **Step 2: 상수 정의**

`apps/web/src/lib/constants.ts`:
```ts
export const SYSTEM_USER_ID = "system";
export const DEFAULT_USER_ID = "local-user";

export const AUTH_ROUTES = {
  LOGIN: "/login",
  DASHBOARD: "/dashboard",
  API_AUTH: "/api/auth",
} as const;

export const ORG_ROLES = {
  OWNER: "owner",
  ADMIN: "admin",
  MEMBER: "member",
} as const;
```

- [ ] **Step 3: Auth.js Edge-safe 설정**

`apps/web/src/auth.config.ts`:
```ts
import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";

export default {
  providers: [Google, GitHub],
  pages: {
    signIn: "/login",
  },
} satisfies NextAuthConfig;
```

- [ ] **Step 4: Auth.js 메인 설정 (Node.js 전용)**

`apps/web/src/auth.ts`:
```ts
import NextAuth from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import Resend from "next-auth/providers/resend";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  users,
  accounts,
  sessions,
  verificationTokens,
  organizations,
  orgMembers,
} from "@/db/schema";
import authConfig from "./auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  session: { strategy: "jwt" },
  ...authConfig,
  providers: [
    ...authConfig.providers,
    Resend({
      from: process.env.AUTH_EMAIL_FROM ?? "noreply@boardinary.com",
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      // 첫 가입 시 개인 조직 자동 생성
      if (!user.id) return;

      const slug =
        user.name?.toLowerCase().replace(/\s+/g, "-") ??
        `user-${user.id.slice(0, 8)}`;

      try {
        await db.transaction(async (tx) => {
          let [org] = await tx
            .insert(organizations)
            .values({
              name: `${user.name ?? "내"}의 워크스페이스`,
              slug: `${slug}-${user.id.slice(0, 6)}`,
              ownerId: user.id!,
              isPersonal: true,
            })
            .onConflictDoNothing()
            .returning();

          // onConflictDoNothing 시 returning()이 빈 배열 → 기존 조직 조회
          if (!org) {
            [org] = await tx
              .select()
              .from(organizations)
              .where(
                and(
                  eq(organizations.ownerId, user.id!),
                  eq(organizations.isPersonal, true),
                ),
              )
              .limit(1);
          }

          if (org) {
            await tx
              .insert(orgMembers)
              .values({
                orgId: org.id,
                userId: user.id!,
                role: "owner",
              })
              .onConflictDoNothing();
          }
        });
      } catch {
        // 예기치 않은 오류 시 무시 (앱 크래시 방지)
      }
    },
  },
});
```

- [ ] **Step 5: Auth.js API 라우트**

`apps/web/src/app/api/auth/[...nextauth]/route.ts`:
```ts
import { handlers } from "@/auth";

export const { GET, POST } = handlers;
```

- [ ] **Step 6: 미들웨어 (라우트 보호)**

`apps/web/src/middleware.ts`:
```ts
import NextAuth from "next-auth";
import authConfig from "./auth.config";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;

  const isAuthRoute = nextUrl.pathname.startsWith("/api/auth");
  const isLoginPage = nextUrl.pathname === "/login";
  const isDashboard = nextUrl.pathname.startsWith("/dashboard");

  // Auth API 라우트는 항상 통과
  if (isAuthRoute) return;

  // 로그인 페이지: 인증 상태면 대시보드로 리다이렉트
  if (isLoginPage) {
    if (isLoggedIn) {
      return Response.redirect(new URL("/dashboard", nextUrl));
    }
    return;
  }

  // 대시보드: 미인증이면 로그인으로 리다이렉트
  if (isDashboard && !isLoggedIn) {
    const callbackUrl = nextUrl.pathname + nextUrl.search;
    return Response.redirect(
      new URL(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`, nextUrl),
    );
  }
});

export const config = {
  matcher: ["/dashboard/:path*", "/login"],
};
```

- [ ] **Step 7: auth 헬퍼 함수**

`apps/web/src/lib/auth.ts`:
```ts
import { redirect } from "next/navigation";
import { auth } from "@/auth";

export async function getCurrentUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  return session.user.id;
}

export async function getOptionalUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}
```

- [ ] **Step 8: 빌드 확인**

```bash
pnpm --filter web build
```
Expected: 빌드 성공 (AUTH_SECRET 등 환경변수가 .env.local에 있어야 함)

- [ ] **Step 9: 커밋**

```bash
git add apps/web/src/auth.ts apps/web/src/auth.config.ts apps/web/src/middleware.ts apps/web/src/lib/auth.ts apps/web/src/lib/constants.ts apps/web/src/app/api apps/web/package.json
git commit -m "feat: setup Auth.js v5 with Google/GitHub OAuth + magic link"
```

---

## Task 6: data-access 레이어

**Files:**
- Create: `apps/web/src/data-access/types.ts`
- Create: `apps/web/src/data-access/organizations.ts`
- Create: `apps/web/src/data-access/projects.ts`
- Create: `apps/web/src/data-access/storyboards.ts`

- [ ] **Step 1: 공유 타입 정의**

`apps/web/src/data-access/types.ts`:
```ts
import type {
  organizations,
  projects,
  storyboards,
  orgMembers,
} from "@/db/schema";

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;

export type OrgMember = typeof orgMembers.$inferSelect;
export type NewOrgMember = typeof orgMembers.$inferInsert;

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;

export type Storyboard = typeof storyboards.$inferSelect;
export type NewStoryboard = typeof storyboards.$inferInsert;

/** 목록 조회 시 content 제외한 스토리보드 메타 */
export type StoryboardMeta = Omit<Storyboard, "content">;
```

- [ ] **Step 2: organizations data-access**

`apps/web/src/data-access/organizations.ts`:
```ts
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { organizations, orgMembers } from "@/db/schema";

export async function getOrganizationsByUserId(userId: string) {
  return db
    .select({
      id: organizations.id,
      name: organizations.name,
      slug: organizations.slug,
      description: organizations.description,
      ownerId: organizations.ownerId,
      isPersonal: organizations.isPersonal,
      role: orgMembers.role,
      createdAt: organizations.createdAt,
      updatedAt: organizations.updatedAt,
    })
    .from(orgMembers)
    .innerJoin(organizations, eq(orgMembers.orgId, organizations.id))
    .where(eq(orgMembers.userId, userId));
}

export async function getOrganizationBySlug(slug: string) {
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, slug))
    .limit(1);
  return org ?? null;
}

export async function getPersonalOrganization(userId: string) {
  const [org] = await db
    .select()
    .from(organizations)
    .where(
      and(
        eq(organizations.ownerId, userId),
        eq(organizations.isPersonal, true),
      ),
    )
    .limit(1);
  return org ?? null;
}

export async function isOrgMember(orgId: string, userId: string) {
  const [member] = await db
    .select()
    .from(orgMembers)
    .where(
      and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId)),
    )
    .limit(1);
  return !!member;
}
```

- [ ] **Step 3: projects data-access**

`apps/web/src/data-access/projects.ts`:
```ts
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { projects } from "@/db/schema";
import type { NewProject } from "./types";

export async function getProjectsByOrgId(orgId: string) {
  return db
    .select()
    .from(projects)
    .where(and(eq(projects.orgId, orgId), eq(projects.status, "active")))
    .orderBy(projects.createdAt);
}

export async function getProjectBySlug(orgId: string, slug: string) {
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.orgId, orgId), eq(projects.slug, slug)))
    .limit(1);
  return project ?? null;
}

export async function createProject(data: NewProject) {
  const [project] = await db.insert(projects).values(data).returning();
  return project!;
}

export async function updateProject(
  id: string,
  data: Partial<Pick<NewProject, "name" | "description" | "status">>,
) {
  const [project] = await db
    .update(projects)
    .set(data)
    .where(eq(projects.id, id))
    .returning();
  return project ?? null;
}

export async function deleteProject(id: string) {
  await db
    .update(projects)
    .set({ status: "archived" })
    .where(eq(projects.id, id));
}
```

- [ ] **Step 4: storyboards data-access**

`apps/web/src/data-access/storyboards.ts`:
```ts
import { eq, and, ne } from "drizzle-orm";
import { db } from "@/db";
import { storyboards } from "@/db/schema";
import type { NewStoryboard } from "./types";

/** 목록 조회 — content 제외하여 성능 최적화 */
export async function getStoryboardsByProjectId(projectId: string) {
  return db
    .select({
      id: storyboards.id,
      projectId: storyboards.projectId,
      createdBy: storyboards.createdBy,
      updatedBy: storyboards.updatedBy,
      name: storyboards.name,
      description: storyboards.description,
      contentVersion: storyboards.contentVersion,
      genre: storyboards.genre,
      tags: storyboards.tags,
      status: storyboards.status,
      createdAt: storyboards.createdAt,
      updatedAt: storyboards.updatedAt,
    })
    .from(storyboards)
    .where(
      and(
        eq(storyboards.projectId, projectId),
        ne(storyboards.status, "archived"),
      ),
    )
    .orderBy(storyboards.createdAt);
}

/** 단건 조회 — content 포함 */
export async function getStoryboardById(id: string) {
  const [storyboard] = await db
    .select()
    .from(storyboards)
    .where(eq(storyboards.id, id))
    .limit(1);
  return storyboard ?? null;
}

export async function createStoryboard(data: NewStoryboard) {
  const [storyboard] = await db
    .insert(storyboards)
    .values(data)
    .returning();
  return storyboard!;
}

export async function updateStoryboard(
  id: string,
  data: Partial<
    Pick<
      NewStoryboard,
      "name" | "description" | "genre" | "tags" | "status" | "updatedBy"
    >
  >,
) {
  const [storyboard] = await db
    .update(storyboards)
    .set(data)
    .where(eq(storyboards.id, id))
    .returning();
  return storyboard ?? null;
}

export async function deleteStoryboard(id: string) {
  await db
    .update(storyboards)
    .set({ status: "archived" })
    .where(eq(storyboards.id, id));
}
```

- [ ] **Step 5: 타입 체크**

```bash
pnpm --filter web check-types
```
Expected: 타입 에러 없음

- [ ] **Step 6: 커밋**

```bash
git add apps/web/src/data-access
git commit -m "feat: add data-access layer for organizations, projects, storyboards"
```

---

## Task 7: Server Actions

**Files:**
- Create: `apps/web/src/actions/project-actions.ts`
- Create: `apps/web/src/actions/storyboard-actions.ts`

- [ ] **Step 1: 프로젝트 Server Actions**

`apps/web/src/actions/project-actions.ts`:
```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUserId } from "@/lib/auth";
import {
  createProject,
  updateProject,
  deleteProject,
} from "@/data-access/projects";
import { getOrganizationBySlug, isOrgMember } from "@/data-access/organizations";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

export async function createProjectAction(formData: FormData) {
  const userId = await getCurrentUserId();
  const orgSlug = formData.get("orgSlug") as string;
  const name = (formData.get("name") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || null;

  if (!name) {
    return { error: "프로젝트 이름을 입력해주세요." };
  }

  const org = await getOrganizationBySlug(orgSlug);
  if (!org) {
    return { error: "조직을 찾을 수 없습니다." };
  }

  const isMember = await isOrgMember(org.id, userId);
  if (!isMember) {
    return { error: "이 조직에 접근 권한이 없습니다." };
  }

  const slug = slugify(name) || `project-${Date.now()}`;

  try {
    await createProject({
      orgId: org.id,
      name,
      description,
      slug,
    });
  } catch {
    return { error: "프로젝트 생성에 실패했습니다. 이름을 변경해보세요." };
  }

  revalidatePath(`/dashboard/${orgSlug}`);
  redirect(`/dashboard/${orgSlug}/projects/${slug}`);
}

export async function updateProjectAction(formData: FormData) {
  const userId = await getCurrentUserId();
  const projectId = formData.get("projectId") as string;
  const orgSlug = formData.get("orgSlug") as string;
  const name = (formData.get("name") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || null;

  if (!name) {
    return { error: "프로젝트 이름을 입력해주세요." };
  }

  const org = await getOrganizationBySlug(orgSlug);
  if (!org || !(await isOrgMember(org.id, userId))) {
    return { error: "접근 권한이 없습니다." };
  }

  await updateProject(projectId, { name, description });
  revalidatePath(`/dashboard/${orgSlug}`);
  return { success: true };
}

export async function deleteProjectAction(formData: FormData) {
  const userId = await getCurrentUserId();
  const projectId = formData.get("projectId") as string;
  const orgSlug = formData.get("orgSlug") as string;

  const org = await getOrganizationBySlug(orgSlug);
  if (!org || !(await isOrgMember(org.id, userId))) {
    return { error: "접근 권한이 없습니다." };
  }

  await deleteProject(projectId);
  revalidatePath(`/dashboard/${orgSlug}`);
  redirect(`/dashboard/${orgSlug}`);
}
```

- [ ] **Step 2: 스토리보드 Server Actions**

`apps/web/src/actions/storyboard-actions.ts`:
```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUserId } from "@/lib/auth";
import {
  createStoryboard,
  updateStoryboard,
  deleteStoryboard,
} from "@/data-access/storyboards";
import { getProjectBySlug } from "@/data-access/projects";
import { getOrganizationBySlug, isOrgMember } from "@/data-access/organizations";

export async function createStoryboardAction(formData: FormData) {
  const userId = await getCurrentUserId();
  const orgSlug = formData.get("orgSlug") as string;
  const projectSlug = formData.get("projectSlug") as string;
  const name = (formData.get("name") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || null;
  const genre = (formData.get("genre") as string)?.trim() || null;

  if (!name) {
    return { error: "스토리보드 이름을 입력해주세요." };
  }

  const org = await getOrganizationBySlug(orgSlug);
  if (!org || !(await isOrgMember(org.id, userId))) {
    return { error: "접근 권한이 없습니다." };
  }

  const project = await getProjectBySlug(org.id, projectSlug);
  if (!project) {
    return { error: "프로젝트를 찾을 수 없습니다." };
  }

  const storyboard = await createStoryboard({
    projectId: project.id,
    createdBy: userId,
    updatedBy: userId,
    name,
    description,
    genre,
    content: {},
    contentVersion: 0,
  });

  revalidatePath(`/dashboard/${orgSlug}/projects/${projectSlug}`);
  redirect(
    `/dashboard/${orgSlug}/projects/${projectSlug}/storyboards/${storyboard.id}`,
  );
}

export async function updateStoryboardAction(formData: FormData) {
  const userId = await getCurrentUserId();
  const storyboardId = formData.get("storyboardId") as string;
  const orgSlug = formData.get("orgSlug") as string;
  const projectSlug = formData.get("projectSlug") as string;
  const name = (formData.get("name") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || null;
  const genre = (formData.get("genre") as string)?.trim() || null;

  if (!name) {
    return { error: "스토리보드 이름을 입력해주세요." };
  }

  const org = await getOrganizationBySlug(orgSlug);
  if (!org || !(await isOrgMember(org.id, userId))) {
    return { error: "접근 권한이 없습니다." };
  }

  await updateStoryboard(storyboardId, {
    name,
    description,
    genre,
    updatedBy: userId,
  });

  revalidatePath(`/dashboard/${orgSlug}/projects/${projectSlug}`);
  return { success: true };
}

export async function deleteStoryboardAction(formData: FormData) {
  const userId = await getCurrentUserId();
  const storyboardId = formData.get("storyboardId") as string;
  const orgSlug = formData.get("orgSlug") as string;
  const projectSlug = formData.get("projectSlug") as string;

  const org = await getOrganizationBySlug(orgSlug);
  if (!org || !(await isOrgMember(org.id, userId))) {
    return { error: "접근 권한이 없습니다." };
  }

  await deleteStoryboard(storyboardId);
  revalidatePath(`/dashboard/${orgSlug}/projects/${projectSlug}`);
  redirect(`/dashboard/${orgSlug}/projects/${projectSlug}`);
}
```

- [ ] **Step 3: 타입 체크**

```bash
pnpm --filter web check-types
```
Expected: 타입 에러 없음

- [ ] **Step 4: 커밋**

```bash
git add apps/web/src/actions
git commit -m "feat: add Server Actions for project and storyboard CRUD"
```

---

## Task 8: 로그인 페이지

**Files:**
- Create: `apps/web/src/app/login/page.tsx`

- [ ] **Step 1: 로그인 페이지 구현**

`apps/web/src/app/login/page.tsx`:
```tsx
import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Boardinary</CardTitle>
          <CardDescription>
            게임 스토리보드를 설계하고 협업하세요
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* OAuth Providers */}
          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: "/dashboard" });
            }}
          >
            <Button variant="outline" className="w-full" type="submit">
              Google로 계속하기
            </Button>
          </form>

          <form
            action={async () => {
              "use server";
              await signIn("github", { redirectTo: "/dashboard" });
            }}
          >
            <Button variant="outline" className="w-full" type="submit">
              GitHub로 계속하기
            </Button>
          </form>

          <div className="relative">
            <Separator />
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
              또는
            </span>
          </div>

          {/* Magic Link */}
          <form
            action={async (formData: FormData) => {
              "use server";
              const email = formData.get("email") as string;
              await signIn("resend", { email, redirectTo: "/dashboard" });
            }}
            className="space-y-2"
          >
            <Label htmlFor="email">이메일</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="your@email.com"
              required
            />
            <Button className="w-full" type="submit">
              매직 링크로 로그인
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: 빌드 확인**

```bash
pnpm --filter web build
```
Expected: 빌드 성공

- [ ] **Step 3: 커밋**

```bash
git add apps/web/src/app/login
git commit -m "feat: add login page with Google/GitHub OAuth + magic link"
```

---

## Task 9: 대시보드 레이아웃 (사이드바 + 탑바)

**Files:**
- Create: `apps/web/src/app/dashboard/layout.tsx` (최소 레이아웃: 탑바만)
- Create: `apps/web/src/app/dashboard/page.tsx` (기본 조직 리다이렉트)
- Create: `apps/web/src/app/dashboard/[orgSlug]/layout.tsx` (조직별 레이아웃: 사이드바)
- Create: `apps/web/src/app/not-found.tsx`
- Create: `apps/web/src/components/dashboard/sidebar.tsx`
- Create: `apps/web/src/components/dashboard/topbar.tsx`
- Create: `apps/web/src/components/dashboard/org-switcher.tsx`
- Create: `apps/web/src/components/shared/empty-state.tsx`

- [ ] **Step 1: 빈 상태 컴포넌트**

`apps/web/src/components/shared/empty-state.tsx`:
```tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionHref,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Icon className="mb-4 h-12 w-12 text-muted-foreground" />
      <h3 className="mb-2 text-lg font-semibold">{title}</h3>
      <p className="mb-6 max-w-sm text-sm text-muted-foreground">
        {description}
      </p>
      {actionLabel && actionHref && (
        <Button asChild>
          <Link href={actionHref}>{actionLabel}</Link>
        </Button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 조직 전환 드롭다운**

`apps/web/src/components/dashboard/org-switcher.tsx`:
```tsx
"use client";

import { useRouter } from "next/navigation";
import { Building2, ChevronDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface OrgItem {
  id: string;
  name: string;
  slug: string;
  isPersonal: boolean;
}

interface OrgSwitcherProps {
  organizations: OrgItem[];
  currentOrgSlug: string;
}

export function OrgSwitcher({ organizations, currentOrgSlug }: OrgSwitcherProps) {
  const router = useRouter();
  const currentOrg = organizations.find((o) => o.slug === currentOrgSlug);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="w-full justify-between px-3">
          <div className="flex items-center gap-2 truncate">
            <Building2 className="h-4 w-4 shrink-0" />
            <span className="truncate text-sm font-medium">
              {currentOrg?.name ?? "조직 선택"}
            </span>
          </div>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {organizations.map((org) => (
          <DropdownMenuItem
            key={org.id}
            onClick={() => router.push(`/dashboard/${org.slug}`)}
            className={org.slug === currentOrgSlug ? "bg-accent" : ""}
          >
            <Building2 className="mr-2 h-4 w-4" />
            <span className="truncate">{org.name}</span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>
          <Plus className="mr-2 h-4 w-4" />
          새 조직 (추후 지원)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

- [ ] **Step 3: 사이드바**

`apps/web/src/components/dashboard/sidebar.tsx`:
```tsx
import Link from "next/link";
import { FolderOpen, Settings, LayoutDashboard } from "lucide-react";
import { OrgSwitcher } from "./org-switcher";
import { Separator } from "@/components/ui/separator";

interface ProjectItem {
  id: string;
  name: string;
  slug: string;
}

interface OrgItem {
  id: string;
  name: string;
  slug: string;
  isPersonal: boolean;
}

interface SidebarProps {
  organizations: OrgItem[];
  currentOrgSlug: string;
  projects: ProjectItem[];
}

export function Sidebar({ organizations, currentOrgSlug, projects }: SidebarProps) {
  return (
    <aside className="flex h-full w-64 flex-col border-r border-sidebar-border bg-sidebar-background">
      {/* 조직 전환 */}
      <div className="p-3">
        <OrgSwitcher
          organizations={organizations}
          currentOrgSlug={currentOrgSlug}
        />
      </div>

      <Separator />

      {/* 네비게이션 */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        <Link
          href={`/dashboard/${currentOrgSlug}`}
          className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent"
        >
          <LayoutDashboard className="h-4 w-4" />
          대시보드
        </Link>

        <div className="pt-4">
          <p className="mb-2 px-3 text-xs font-semibold uppercase text-muted-foreground">
            프로젝트
          </p>
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/dashboard/${currentOrgSlug}/projects/${project.slug}`}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent"
            >
              <FolderOpen className="h-4 w-4" />
              <span className="truncate">{project.name}</span>
            </Link>
          ))}
        </div>
      </nav>

      <Separator />

      {/* 하단 설정 */}
      <div className="p-3">
        <Link
          href="/dashboard/settings"
          className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent"
        >
          <Settings className="h-4 w-4" />
          설정
        </Link>
      </div>
    </aside>
  );
}
```

- [ ] **Step 4: 탑바**

`apps/web/src/components/dashboard/topbar.tsx`:
```tsx
import Link from "next/link";
import { auth, signOut } from "@/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { LogOut, User } from "lucide-react";

export async function Topbar() {
  const session = await auth();
  const user = session?.user;

  return (
    <header className="flex h-14 items-center justify-between border-b px-6">
      <div className="flex items-center gap-4">
        <span className="text-lg font-bold text-primary">Boardinary</span>
      </div>

      <div className="flex items-center gap-2">
        <ThemeToggle />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full">
              <Avatar className="h-8 w-8">
                <AvatarImage src={user?.image ?? undefined} />
                <AvatarFallback>
                  {user?.name?.charAt(0)?.toUpperCase() ?? <User className="h-4 w-4" />}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium">{user?.name}</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/dashboard/settings">설정</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            >
              <DropdownMenuItem asChild>
                <button type="submit" className="w-full">
                  <LogOut className="mr-2 h-4 w-4" />
                  로그아웃
                </button>
              </DropdownMenuItem>
            </form>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
```

- [ ] **Step 5: 대시보드 최소 레이아웃 (탑바만)**

`apps/web/src/app/dashboard/layout.tsx`:
```tsx
import { Topbar } from "@/components/dashboard/topbar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen flex-col">
      <Topbar />
      <div className="flex-1 overflow-hidden">{children}</div>
    </div>
  );
}
```

- [ ] **Step 5b: 조직별 레이아웃 (사이드바)**

`apps/web/src/app/dashboard/[orgSlug]/layout.tsx`:
```tsx
import { notFound } from "next/navigation";
import { getCurrentUserId } from "@/lib/auth";
import {
  getOrganizationsByUserId,
  getOrganizationBySlug,
  isOrgMember,
} from "@/data-access/organizations";
import { getProjectsByOrgId } from "@/data-access/projects";
import { Sidebar } from "@/components/dashboard/sidebar";

export default async function OrgLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const userId = await getCurrentUserId();

  const org = await getOrganizationBySlug(orgSlug);
  if (!org) notFound();

  const isMember = await isOrgMember(org.id, userId);
  if (!isMember) notFound();

  const orgs = await getOrganizationsByUserId(userId);
  const projects = await getProjectsByOrgId(org.id);

  return (
    <div className="flex flex-1 overflow-hidden">
      <Sidebar
        organizations={orgs.map((o) => ({
          id: o.id,
          name: o.name,
          slug: o.slug,
          isPersonal: o.isPersonal,
        }))}
        currentOrgSlug={orgSlug}
        projects={projects.map((p) => ({
          id: p.id,
          name: p.name,
          slug: p.slug,
        }))}
      />
      <main className="flex-1 overflow-y-auto p-6">{children}</main>
    </div>
  );
}
```

- [ ] **Step 5c: 커스텀 404 페이지**

`apps/web/src/app/not-found.tsx`:
```tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <h1 className="text-4xl font-bold">404</h1>
      <p className="mt-2 text-muted-foreground">페이지를 찾을 수 없습니다.</p>
      <Button asChild className="mt-6">
        <Link href="/">홈으로 돌아가기</Link>
      </Button>
    </div>
  );
}
```

- [ ] **Step 6: 대시보드 메인 페이지 (기본 조직으로 리다이렉트)**

`apps/web/src/app/dashboard/page.tsx`:
```tsx
import { redirect } from "next/navigation";
import { getCurrentUserId } from "@/lib/auth";
import { getPersonalOrganization } from "@/data-access/organizations";

export default async function DashboardPage() {
  const userId = await getCurrentUserId();
  const personalOrg = await getPersonalOrganization(userId);

  if (personalOrg) {
    redirect(`/dashboard/${personalOrg.slug}`);
  }

  // 개인 조직이 없는 경우 (비정상 상태)
  return (
    <div className="flex items-center justify-center py-16">
      <p className="text-muted-foreground">워크스페이스를 초기화하는 중...</p>
    </div>
  );
}
```

- [ ] **Step 7: 빌드 확인**

```bash
pnpm --filter web build
```
Expected: 빌드 성공

- [ ] **Step 8: 커밋**

```bash
git add apps/web/src/app/dashboard apps/web/src/components/dashboard apps/web/src/components/shared/empty-state.tsx
git commit -m "feat: add dashboard layout with sidebar, topbar, and org switcher"
```

---

## Task 10: 조직 대시보드 + 프로젝트 CRUD 페이지

**Files:**
- Create: `apps/web/src/app/dashboard/[orgSlug]/page.tsx`
- Create: `apps/web/src/app/dashboard/[orgSlug]/projects/new/page.tsx`
- Create: `apps/web/src/app/dashboard/[orgSlug]/projects/[slug]/page.tsx`
- Create: `apps/web/src/components/dashboard/project-list.tsx`

- [ ] **Step 1: 프로젝트 목록 컴포넌트**

`apps/web/src/components/dashboard/project-list.tsx`:
```tsx
import Link from "next/link";
import { FolderOpen } from "lucide-react";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface ProjectItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  updatedAt: Date;
}

interface ProjectListProps {
  projects: ProjectItem[];
  orgSlug: string;
}

export function ProjectList({ projects, orgSlug }: ProjectListProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {projects.map((project) => (
        <Link
          key={project.id}
          href={`/dashboard/${orgSlug}/projects/${project.slug}`}
        >
          <Card className="transition-colors hover:border-primary/50">
            <CardHeader>
              <div className="flex items-center gap-2">
                <FolderOpen className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">{project.name}</CardTitle>
              </div>
              {project.description && (
                <CardDescription className="line-clamp-2">
                  {project.description}
                </CardDescription>
              )}
            </CardHeader>
          </Card>
        </Link>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: 조직 대시보드 페이지**

`apps/web/src/app/dashboard/[orgSlug]/page.tsx`:
```tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import { Plus, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCurrentUserId } from "@/lib/auth";
import {
  getOrganizationBySlug,
  isOrgMember,
} from "@/data-access/organizations";
import { getProjectsByOrgId } from "@/data-access/projects";
import { ProjectList } from "@/components/dashboard/project-list";
import { EmptyState } from "@/components/shared/empty-state";

export default async function OrgDashboardPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const userId = await getCurrentUserId();

  const org = await getOrganizationBySlug(orgSlug);
  if (!org) notFound();

  const isMember = await isOrgMember(org.id, userId);
  if (!isMember) notFound();

  const projects = await getProjectsByOrgId(org.id);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{org.name}</h1>
          <p className="text-sm text-muted-foreground">
            프로젝트 {projects.length}개
          </p>
        </div>
        <Button asChild>
          <Link href={`/dashboard/${orgSlug}/projects/new`}>
            <Plus className="mr-2 h-4 w-4" />
            새 프로젝트
          </Link>
        </Button>
      </div>

      {projects.length > 0 ? (
        <ProjectList
          projects={projects.map((p) => ({
            id: p.id,
            name: p.name,
            slug: p.slug,
            description: p.description,
            updatedAt: p.updatedAt,
          }))}
          orgSlug={orgSlug}
        />
      ) : (
        <EmptyState
          icon={FolderOpen}
          title="아직 프로젝트가 없습니다"
          description="첫 번째 프로젝트를 만들어 게임 스토리보드를 시작하세요."
          actionLabel="프로젝트 만들기"
          actionHref={`/dashboard/${orgSlug}/projects/new`}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: 프로젝트 생성 페이지**

`apps/web/src/app/dashboard/[orgSlug]/projects/new/page.tsx`:
```tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getCurrentUserId } from "@/lib/auth";
import { getOrganizationBySlug, isOrgMember } from "@/data-access/organizations";
import { createProjectAction } from "@/actions/project-actions";

export default async function NewProjectPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const userId = await getCurrentUserId();

  const org = await getOrganizationBySlug(orgSlug);
  if (!org) notFound();

  const isMember = await isOrgMember(org.id, userId);
  if (!isMember) notFound();

  return (
    <div className="mx-auto max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle>새 프로젝트</CardTitle>
          <CardDescription>
            게임 프로젝트를 생성하고 스토리보드를 만들어보세요.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createProjectAction} className="space-y-4">
            <input type="hidden" name="orgSlug" value={orgSlug} />
            <div className="space-y-2">
              <Label htmlFor="name">프로젝트 이름</Label>
              <Input
                id="name"
                name="name"
                placeholder="예: 판타지 RPG 메인 퀘스트"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">설명 (선택)</Label>
              <Input
                id="description"
                name="description"
                placeholder="프로젝트에 대한 간단한 설명"
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" className="flex-1">
                프로젝트 생성
              </Button>
              <Button variant="outline" asChild>
                <Link href={`/dashboard/${orgSlug}`}>취소</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 4: 프로젝트 상세 페이지 (스토리보드 목록)**

`apps/web/src/app/dashboard/[orgSlug]/projects/[slug]/page.tsx`:
```tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import { Plus, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentUserId } from "@/lib/auth";
import { getOrganizationBySlug, isOrgMember } from "@/data-access/organizations";
import { getProjectBySlug } from "@/data-access/projects";
import { getStoryboardsByProjectId } from "@/data-access/storyboards";
import { EmptyState } from "@/components/shared/empty-state";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ orgSlug: string; slug: string }>;
}) {
  const { orgSlug, slug } = await params;
  const userId = await getCurrentUserId();

  const org = await getOrganizationBySlug(orgSlug);
  if (!org) notFound();

  const isMember = await isOrgMember(org.id, userId);
  if (!isMember) notFound();

  const project = await getProjectBySlug(org.id, slug);
  if (!project) notFound();

  const storyboards = await getStoryboardsByProjectId(project.id);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{project.name}</h1>
          {project.description && (
            <p className="text-sm text-muted-foreground">
              {project.description}
            </p>
          )}
        </div>
        <Button asChild>
          <Link href={`/dashboard/${orgSlug}/projects/${slug}/storyboards/new`}>
            <Plus className="mr-2 h-4 w-4" />
            새 스토리보드
          </Link>
        </Button>
      </div>

      {storyboards.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {storyboards.map((sb) => (
            <Link
              key={sb.id}
              href={`/dashboard/${orgSlug}/projects/${slug}/storyboards/${sb.id}`}
            >
              <Card className="transition-colors hover:border-primary/50">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-primary" />
                      <CardTitle className="text-base">{sb.name}</CardTitle>
                    </div>
                    {sb.genre && (
                      <Badge variant="secondary">{sb.genre}</Badge>
                    )}
                  </div>
                  {sb.description && (
                    <CardDescription className="line-clamp-2">
                      {sb.description}
                    </CardDescription>
                  )}
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={FileText}
          title="아직 스토리보드가 없습니다"
          description="첫 번째 스토리보드를 만들어 게임 흐름을 시각화하세요."
          actionLabel="스토리보드 만들기"
          actionHref={`/dashboard/${orgSlug}/projects/${slug}/storyboards/new`}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 5: 빌드 확인**

```bash
pnpm --filter web build
```
Expected: 빌드 성공

- [ ] **Step 6: 커밋**

```bash
git add apps/web/src/app/dashboard/\\[orgSlug\\] apps/web/src/components/dashboard/project-list.tsx
git commit -m "feat: add org dashboard and project CRUD pages"
```

---

## Task 11: 스토리보드 CRUD 페이지

**Files:**
- Create: `apps/web/src/app/dashboard/[orgSlug]/projects/[slug]/storyboards/new/page.tsx`
- Create: `apps/web/src/app/dashboard/[orgSlug]/projects/[slug]/storyboards/[id]/page.tsx`

- [ ] **Step 1: 스토리보드 생성 페이지**

`apps/web/src/app/dashboard/[orgSlug]/projects/[slug]/storyboards/new/page.tsx`:
```tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getCurrentUserId } from "@/lib/auth";
import { getOrganizationBySlug, isOrgMember } from "@/data-access/organizations";
import { getProjectBySlug } from "@/data-access/projects";
import { createStoryboardAction } from "@/actions/storyboard-actions";

const GENRES = [
  "RPG",
  "FPS",
  "액션",
  "어드벤처",
  "퍼즐",
  "전략",
  "시뮬레이션",
  "기타",
];

export default async function NewStoryboardPage({
  params,
}: {
  params: Promise<{ orgSlug: string; slug: string }>;
}) {
  const { orgSlug, slug } = await params;
  const userId = await getCurrentUserId();

  const org = await getOrganizationBySlug(orgSlug);
  if (!org) notFound();

  const isMember = await isOrgMember(org.id, userId);
  if (!isMember) notFound();

  const project = await getProjectBySlug(org.id, slug);
  if (!project) notFound();

  return (
    <div className="mx-auto max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle>새 스토리보드</CardTitle>
          <CardDescription>
            {project.name}에 새로운 스토리보드를 추가합니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createStoryboardAction} className="space-y-4">
            <input type="hidden" name="orgSlug" value={orgSlug} />
            <input type="hidden" name="projectSlug" value={slug} />

            <div className="space-y-2">
              <Label htmlFor="name">스토리보드 이름</Label>
              <Input
                id="name"
                name="name"
                placeholder="예: 메인 퀘스트 — 1장: 시작의 마을"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">설명 (선택)</Label>
              <Input
                id="description"
                name="description"
                placeholder="스토리보드에 대한 간단한 설명"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="genre">장르 (선택)</Label>
              <select
                id="genre"
                name="genre"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">장르 선택...</option>
                {GENRES.map((genre) => (
                  <option key={genre} value={genre}>
                    {genre}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-2">
              <Button type="submit" className="flex-1">
                스토리보드 생성
              </Button>
              <Button variant="outline" asChild>
                <Link href={`/dashboard/${orgSlug}/projects/${slug}`}>취소</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: 스토리보드 상세 페이지 (Phase 0: 메타정보만)**

`apps/web/src/app/dashboard/[orgSlug]/projects/[slug]/storyboards/[id]/page.tsx`:
```tsx
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentUserId } from "@/lib/auth";
import { getOrganizationBySlug, isOrgMember } from "@/data-access/organizations";
import { getProjectBySlug } from "@/data-access/projects";
import { getStoryboardById } from "@/data-access/storyboards";

export default async function StoryboardDetailPage({
  params,
}: {
  params: Promise<{ orgSlug: string; slug: string; id: string }>;
}) {
  const { orgSlug, slug, id } = await params;
  const userId = await getCurrentUserId();

  const org = await getOrganizationBySlug(orgSlug);
  if (!org) notFound();

  const isMember = await isOrgMember(org.id, userId);
  if (!isMember) notFound();

  const project = await getProjectBySlug(org.id, slug);
  if (!project) notFound();

  const storyboard = await getStoryboardById(id);
  if (!storyboard || storyboard.projectId !== project.id) notFound();

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{storyboard.name}</h1>
          {storyboard.genre && (
            <Badge variant="secondary">{storyboard.genre}</Badge>
          )}
          <Badge variant="outline">{storyboard.status}</Badge>
        </div>
        {storyboard.description && (
          <p className="mt-1 text-sm text-muted-foreground">
            {storyboard.description}
          </p>
        )}
      </div>

      {/* Phase 1에서 에디터 캔버스가 들어갈 영역 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">캔버스 에디터</CardTitle>
          <CardDescription>
            Phase 1에서 스토리보드 에디터가 여기에 연결됩니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-96 items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/20">
            <p className="text-sm text-muted-foreground">
              에디터 영역 — Phase 1에서 구현 예정
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: 빌드 확인**

```bash
pnpm --filter web build
```
Expected: 빌드 성공

- [ ] **Step 4: 커밋**

```bash
git add apps/web/src/app/dashboard/\\[orgSlug\\]/projects/\\[slug\\]/storyboards
git commit -m "feat: add storyboard creation and detail pages"
```

---

## Task 12: 랜딩 페이지

**Files:**
- Create: `apps/web/src/components/landing/hero-section.tsx`
- Create: `apps/web/src/components/landing/features-section.tsx`
- Create: `apps/web/src/components/landing/cta-section.tsx`
- Modify: `apps/web/src/app/page.tsx`

- [ ] **Step 1: 히어로 섹션**

`apps/web/src/components/landing/hero-section.tsx`:
```tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export function HeroSection() {
  return (
    <section className="flex flex-col items-center justify-center px-6 py-24 text-center">
      <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
        게임 스토리보드를{" "}
        <span className="text-primary">시각적으로 설계</span>하고{" "}
        <span className="text-primary">팀과 협업</span>하세요
      </h1>
      <p className="mt-6 max-w-xl text-lg text-muted-foreground">
        Boardinary는 게임 기획자를 위한 스토리보드 협업 도구입니다.
        복잡한 게임 흐름을 직관적으로 설계하고, 팀과 실시간으로 작업하세요.
      </p>
      <div className="mt-8 flex gap-4">
        <Button asChild size="lg">
          <Link href="/login">
            시작하기
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: 기능 소개 섹션**

`apps/web/src/components/landing/features-section.tsx`:
```tsx
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Workflow, Users, Sparkles, GitBranch } from "lucide-react";

const features = [
  {
    icon: Workflow,
    title: "비주얼 스토리보드",
    description:
      "드래그 앤 드롭으로 게임 흐름을 설계하세요. 씬, 이벤트, 분기를 시각적으로 연결합니다.",
  },
  {
    icon: Users,
    title: "실시간 협업",
    description:
      "팀원과 동시에 스토리보드를 편집하세요. 변경 사항이 즉시 반영됩니다.",
  },
  {
    icon: GitBranch,
    title: "버전 관리",
    description:
      "모든 변경 이력을 추적하고, 이전 버전으로 손쉽게 되돌릴 수 있습니다.",
  },
  {
    icon: Sparkles,
    title: "AI 어시스턴트",
    description:
      "AI가 스토리 흐름을 분석하고, 누락된 요소를 찾아 개선점을 제안합니다.",
  },
];

export function FeaturesSection() {
  return (
    <section className="mx-auto max-w-5xl px-6 py-16">
      <h2 className="mb-12 text-center text-3xl font-bold">
        게임 기획을 위한 모든 것
      </h2>
      <div className="grid gap-6 sm:grid-cols-2">
        {features.map((feature) => (
          <Card key={feature.title}>
            <CardHeader>
              <feature.icon className="mb-2 h-8 w-8 text-primary" />
              <CardTitle>{feature.title}</CardTitle>
              <CardDescription>{feature.description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 3: CTA 섹션**

`apps/web/src/components/landing/cta-section.tsx`:
```tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function CtaSection() {
  return (
    <section className="px-6 py-16 text-center">
      <h2 className="text-2xl font-bold">지금 바로 시작하세요</h2>
      <p className="mt-2 text-muted-foreground">
        무료로 시작하고, 팀과 함께 성장하세요.
      </p>
      <Button asChild size="lg" className="mt-6">
        <Link href="/login">무료로 시작하기</Link>
      </Button>
    </section>
  );
}
```

- [ ] **Step 4: 랜딩 페이지 조립**

`apps/web/src/app/page.tsx`:
```tsx
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { HeroSection } from "@/components/landing/hero-section";
import { FeaturesSection } from "@/components/landing/features-section";
import { CtaSection } from "@/components/landing/cta-section";
import { ThemeToggle } from "@/components/shared/theme-toggle";

export default async function Home() {
  const session = await auth();
  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between px-6 py-4">
        <span className="text-xl font-bold text-primary">Boardinary</span>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link
            href="/login"
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            로그인
          </Link>
        </div>
      </header>
      <HeroSection />
      <FeaturesSection />
      <CtaSection />
      <footer className="px-6 py-8 text-center text-sm text-muted-foreground">
        &copy; 2026 Boardinary. All rights reserved.
      </footer>
    </div>
  );
}
```

- [ ] **Step 5: 빌드 확인**

```bash
pnpm --filter web build
```
Expected: 빌드 성공

- [ ] **Step 6: 커밋**

```bash
git add apps/web/src/components/landing apps/web/src/app/page.tsx
git commit -m "feat: add minimal landing page with hero, features, and CTA"
```

---

## Task 13: 사용자 설정 페이지

**Files:**
- Create: `apps/web/src/app/dashboard/settings/page.tsx`

- [ ] **Step 1: 설정 페이지 (프로필 + 테마)**

`apps/web/src/app/dashboard/settings/page.tsx`:
```tsx
import { auth } from "@/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { User } from "lucide-react";

export default async function SettingsPage() {
  const session = await auth();
  const user = session?.user;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">설정</h1>

      {/* 프로필 */}
      <Card>
        <CardHeader>
          <CardTitle>프로필</CardTitle>
          <CardDescription>계정 정보를 확인합니다.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <Avatar className="h-16 w-16">
            <AvatarImage src={user?.image ?? undefined} />
            <AvatarFallback>
              <User className="h-8 w-8" />
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-lg font-medium">{user?.name ?? "사용자"}</p>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </div>
        </CardContent>
      </Card>

      {/* 테마 */}
      <Card>
        <CardHeader>
          <CardTitle>테마</CardTitle>
          <CardDescription>라이트/다크 모드를 전환합니다.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <ThemeToggle />
          <span className="text-sm text-muted-foreground">
            시스템 설정에 따라 자동 전환되거나, 수동으로 전환할 수 있습니다.
          </span>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: 빌드 확인**

```bash
pnpm --filter web build
```
Expected: 빌드 성공

- [ ] **Step 3: 커밋**

```bash
git add apps/web/src/app/dashboard/settings
git commit -m "feat: add user settings page with profile and theme toggle"
```

---

## Task 14: 시드 데이터 + .gitignore 업데이트

**Files:**
- Create: `apps/web/src/db/seed.ts`
- Modify: `.gitignore`

- [ ] **Step 1: 시드 스크립트**

`apps/web/src/db/seed.ts`:
```ts
import { db } from "./index";
import {
  users,
  organizations,
  orgMembers,
  projects,
  storyboards,
} from "./schema";

const DEFAULT_USER_ID = "local-user";

async function seed() {
  console.log("Seeding database...");

  // 기본 사용자
  const [user] = await db
    .insert(users)
    .values({
      id: DEFAULT_USER_ID,
      name: "로컬 개발자",
      email: "dev@boardinary.local",
    })
    .onConflictDoNothing()
    .returning();

  if (!user) {
    console.log("User already exists, skipping...");
    return;
  }

  // 개인 조직
  const [org] = await db
    .insert(organizations)
    .values({
      name: "로컬 개발자의 워크스페이스",
      slug: "local-dev",
      ownerId: user.id,
      isPersonal: true,
    })
    .returning();

  // 멤버십
  await db.insert(orgMembers).values({
    orgId: org!.id,
    userId: user.id,
    role: "owner",
  });

  // 샘플 프로젝트
  const [project] = await db
    .insert(projects)
    .values({
      orgId: org!.id,
      name: "판타지 RPG 메인 퀘스트",
      slug: "fantasy-rpg-main-quest",
      description: "판타지 RPG의 메인 퀘스트 스토리보드",
    })
    .returning();

  // 샘플 스토리보드
  await db.insert(storyboards).values([
    {
      projectId: project!.id,
      createdBy: user.id,
      updatedBy: user.id,
      name: "1장: 시작의 마을",
      description: "플레이어가 처음 시작하는 마을의 이벤트 흐름",
      genre: "RPG",
      content: {},
      contentVersion: 0,
    },
    {
      projectId: project!.id,
      createdBy: user.id,
      updatedBy: user.id,
      name: "2장: 첫 던전",
      description: "마을 외곽 동굴 던전 탐험",
      genre: "RPG",
      content: {},
      contentVersion: 0,
    },
  ]);

  console.log("Seed complete!");
}

seed()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  });
```

- [ ] **Step 2: .gitignore에 .superpowers 추가**

루트 `.gitignore`에 추가:
```
# Superpowers brainstorm sessions
.superpowers/
```

- [ ] **Step 3: 커밋**

```bash
git add apps/web/src/db/seed.ts .gitignore
git commit -m "feat: add sample data seed script and update .gitignore"
```

---

## Task 15: 전체 검증

- [ ] **Step 1: Docker 기동 확인**

```bash
docker compose up -d
```

- [ ] **Step 2: 마이그레이션 + 시드 실행**

```bash
pnpm --filter web db:migrate
pnpm --filter web db:seed:sample
```

- [ ] **Step 3: 타입 체크**

```bash
pnpm check-types
```
Expected: 에러 없음

- [ ] **Step 4: 린트**

```bash
pnpm lint
```
Expected: 에러 없음

- [ ] **Step 5: 전체 빌드**

```bash
pnpm build
```
Expected: 모든 앱/패키지 빌드 성공

- [ ] **Step 6: 개발 서버 실행 및 수동 확인**

```bash
pnpm --filter web dev
```

확인 항목:
1. `http://localhost:3000` → 랜딩 페이지 표시 (비로그인 상태)
2. 다크모드 토글 동작
3. `/login` → 로그인 페이지 표시
4. `/dashboard` → `/login`으로 리다이렉트 (미인증)
5. OAuth 로그인 후 → 대시보드 표시 (환경변수 설정 시)

- [ ] **Step 7: 최종 커밋 (있다면)**

남아있는 변경사항이 있으면 커밋:
```bash
git add -A
git commit -m "chore: final Phase 0 cleanup and verification"
```

---

## 의존성 요약

| 패키지 | 용도 |
|--------|------|
| `tailwindcss`, `@tailwindcss/postcss`, `@tailwindcss/cli` | Tailwind CSS v4 |
| `class-variance-authority`, `clsx`, `tailwind-merge` | shadcn/ui 유틸리티 |
| `lucide-react` | 아이콘 |
| `next-themes` | 다크모드 |
| `drizzle-orm`, `postgres` | ORM + PG 드라이버 |
| `drizzle-kit` | 마이그레이션 도구 |
| `@paralleldrive/cuid2` | CUID 생성 |
| `next-auth@5`, `@auth/drizzle-adapter` | 인증 |
| `resend` | 매직 링크 이메일 |
| `tsx` | 시드 스크립트 실행 |

## 참고 사항

- 모든 파일 생성 시 CLAUDE.md의 import 순서 규칙 준수: builtin → external → workspace (@repo/) → internal (@/) → relative
- `'use client'`는 반드시 필요한 컴포넌트에만 지정 (ThemeProvider, ThemeToggle, OrgSwitcher)
- data-access 함수는 모두 `async` — 호출 시 `await` 필수
- Server Actions에서는 항상 `getCurrentUserId()`로 인증 확인
- DB 직접 import 금지 — data-access 레이어를 통해 접근
