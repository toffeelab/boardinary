# Phase 0 NestJS 통합 리팩터링 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 Phase 0 코드에 NestJS 백엔드를 추가하고, DB 접근을 NestJS로 중앙화한다. UI/Auth.js/스키마는 재사용, data-access/actions를 API 호출로 교체.

**Architecture:** Next.js(UI+Auth) → NestJS(REST API+DB). 서버 간 인증은 X-Internal-Secret + X-User-Id 헤더. DB 스키마는 packages/db 공유 패키지. API DTO는 packages/types.

**Tech Stack:** NestJS 10, @nestjs/passport, passport-jwt, Drizzle ORM, PostgreSQL 17

**Specs:**
- `docs/superpowers/specs/2026-03-25-phase0-foundation.md` (기존 Phase 0)
- `docs/superpowers/specs/2026-03-25-phase0-nestjs-integration.md` (NestJS 통합)

**Worktree:** `/Users/ubitoffee/dev/web/boardinary/.worktrees/phase0`

---

## 파일 구조

### 새로 생성

```
packages/
├── db/
│   ├── src/
│   │   ├── index.ts              # 전체 스키마 + db re-export (api용)
│   │   ├── auth-schema.ts        # auth 테이블만 export (web용)
│   │   ├── schema.ts             # 전체 Drizzle 스키마 (기존 이동)
│   │   └── connection.ts         # DB 연결
│   ├── drizzle/
│   │   └── migrations/           # 마이그레이션 (기존 이동)
│   ├── drizzle.config.ts
│   ├── package.json
│   └── tsconfig.json
├── types/
│   ├── src/
│   │   ├── index.ts
│   │   ├── common.ts             # ApiErrorResponse, PaginatedResponse
│   │   ├── organizations.ts      # OrganizationDto, etc.
│   │   ├── projects.ts           # ProjectDto, CreateProjectDto, etc.
│   │   └── storyboards.ts        # StoryboardDto, StoryboardMetaDto, etc.
│   ├── package.json
│   └── tsconfig.json

apps/api/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── auth/
│   │   ├── auth.module.ts
│   │   ├── internal-auth.guard.ts    # X-Internal-Secret 검증
│   │   └── current-user.decorator.ts # @CurrentUser() 데코레이터
│   ├── organizations/
│   │   ├── organizations.module.ts
│   │   ├── organizations.controller.ts
│   │   └── organizations.service.ts
│   ├── projects/
│   │   ├── projects.module.ts
│   │   ├── projects.controller.ts
│   │   └── projects.service.ts
│   ├── storyboards/
│   │   ├── storyboards.module.ts
│   │   ├── storyboards.controller.ts
│   │   └── storyboards.service.ts
│   └── users/
│       ├── users.module.ts
│       ├── users.controller.ts
│       └── users.service.ts
├── nest-cli.json
├── tsconfig.json
├── tsconfig.build.json
├── package.json
└── .env.example
```

### 수정할 파일

```
apps/web/
├── src/
│   ├── auth.ts                   # DB import를 @repo/db/auth-schema로 변경, createUser 이벤트를 API 호출로 변경
│   ├── lib/
│   │   ├── api-client.ts         # 새로 생성 — NestJS API 호출 헬퍼
│   │   └── auth.ts               # 기존 유지
│   ├── actions/
│   │   ├── project-actions.ts    # data-access → API 호출로 변경
│   │   └── storyboard-actions.ts # data-access → API 호출로 변경
│   ├── app/dashboard/
│   │   ├── [orgSlug]/layout.tsx  # data-access → API 호출로 변경
│   │   ├── [orgSlug]/page.tsx    # data-access → API 호출로 변경
│   │   ├── [orgSlug]/projects/*/page.tsx  # 동일
│   │   └── page.tsx              # data-access → API 호출로 변경
│   └── db/                       # 삭제 (packages/db로 이동)
│   └── data-access/              # 삭제 (NestJS 서비스로 대체)
├── package.json                  # dev 포트 4000, @repo/db 의존성 추가

docker-compose.yml                # 포트 6432로 변경
turbo.json                        # api 앱 추가
pnpm-workspace.yaml               # packages/db, packages/types 추가 (이미 packages/* 패턴)
```

---

## Task 1: packages/db 생성 (스키마 이동)

**Files:**
- Create: `packages/db/package.json`
- Create: `packages/db/tsconfig.json`
- Create: `packages/db/src/schema.ts` (기존 `apps/web/src/db/schema.ts` 이동)
- Create: `packages/db/src/connection.ts` (기존 `apps/web/src/db/index.ts` 기반)
- Create: `packages/db/src/index.ts` (전체 export)
- Create: `packages/db/src/auth-schema.ts` (auth 테이블만 export)
- Move: `apps/web/drizzle/` → `packages/db/drizzle/`
- Move: `apps/web/drizzle.config.ts` → `packages/db/drizzle.config.ts`

- [ ] **Step 1: packages/db/package.json 생성**

```json
{
  "name": "@repo/db",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./auth": "./src/auth-schema.ts",
    "./schema": "./src/schema.ts",
    "./connection": "./src/connection.ts"
  },
  "scripts": {
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:studio": "drizzle-kit studio --port 4003",
    "check-types": "tsc --noEmit"
  },
  "dependencies": {
    "drizzle-orm": "^0.45.1",
    "postgres": "^3.4.8",
    "@paralleldrive/cuid2": "^3.3.0"
  },
  "devDependencies": {
    "@repo/typescript-config": "workspace:*",
    "drizzle-kit": "^0.31.1",
    "typescript": "5.9.2"
  }
}
```

- [ ] **Step 2: packages/db/tsconfig.json 생성**

```json
{
  "extends": "@repo/typescript-config/base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: 스키마 파일 이동**

```bash
cd /path/to/worktree
mkdir -p packages/db/src
cp apps/web/src/db/schema.ts packages/db/src/schema.ts
```

- [ ] **Step 4: connection.ts 생성**

`packages/db/src/connection.ts`:
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

- [ ] **Step 5: index.ts (전체 export)**

`packages/db/src/index.ts`:
```ts
export * from "./schema";
export { db } from "./connection";
```

- [ ] **Step 6: auth-schema.ts (auth 테이블만)**

`packages/db/src/auth-schema.ts`:
```ts
export { users, accounts, sessions, verificationTokens } from "./schema";
export { db } from "./connection";
```

- [ ] **Step 7: drizzle.config.ts 이동 및 수정**

```bash
cp apps/web/drizzle.config.ts packages/db/drizzle.config.ts
cp -r apps/web/drizzle packages/db/drizzle
```

`packages/db/drizzle.config.ts` 수정:
```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./drizzle/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

- [ ] **Step 8: pnpm install로 패키지 등록**

```bash
pnpm install
```

- [ ] **Step 9: 타입 체크**

```bash
pnpm --filter @repo/db check-types
```

- [ ] **Step 10: 커밋**

```bash
git add packages/db
git commit -m "feat: create @repo/db shared package with Drizzle schema"
```

---

## Task 2: packages/types 생성 (API DTO)

**Files:**
- Create: `packages/types/package.json`
- Create: `packages/types/tsconfig.json`
- Create: `packages/types/src/index.ts`
- Create: `packages/types/src/common.ts`
- Create: `packages/types/src/organizations.ts`
- Create: `packages/types/src/projects.ts`
- Create: `packages/types/src/storyboards.ts`

- [ ] **Step 1: package.json**

```json
{
  "name": "@repo/types",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./*": "./src/*.ts"
  },
  "scripts": {
    "check-types": "tsc --noEmit"
  },
  "devDependencies": {
    "@repo/typescript-config": "workspace:*",
    "typescript": "5.9.2"
  }
}
```

- [ ] **Step 2: tsconfig.json**

```json
{
  "extends": "@repo/typescript-config/base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: common.ts**

`packages/types/src/common.ts`:
```ts
export interface ApiErrorResponse {
  statusCode: number;
  message: string;
  error?: string;
  details?: unknown;
}
```

- [ ] **Step 4: organizations.ts**

`packages/types/src/organizations.ts`:
```ts
export interface OrganizationDto {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  ownerId: string;
  isPersonal: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationWithRoleDto extends OrganizationDto {
  role: "owner" | "admin" | "member";
}

export interface SetupUserDto {
  userId: string;
  name: string | null;
}
```

- [ ] **Step 5: projects.ts**

`packages/types/src/projects.ts`:
```ts
export interface ProjectDto {
  id: string;
  orgId: string;
  name: string;
  description: string | null;
  slug: string;
  status: "active" | "archived";
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectDto {
  name: string;
  description?: string;
}

export interface UpdateProjectDto {
  name?: string;
  description?: string;
}
```

- [ ] **Step 6: storyboards.ts**

`packages/types/src/storyboards.ts`:
```ts
export interface StoryboardDto {
  id: string;
  projectId: string;
  createdBy: string | null;
  updatedBy: string | null;
  name: string;
  description: string | null;
  content: Record<string, unknown>;
  contentVersion: number;
  genre: string | null;
  tags: string[] | null;
  status: "draft" | "published" | "archived";
  createdAt: string;
  updatedAt: string;
}

export type StoryboardMetaDto = Omit<StoryboardDto, "content">;

export interface CreateStoryboardDto {
  name: string;
  description?: string;
  genre?: string;
}

export interface UpdateStoryboardDto {
  name?: string;
  description?: string;
  genre?: string;
  tags?: string[];
}
```

- [ ] **Step 7: index.ts**

`packages/types/src/index.ts`:
```ts
export * from "./common";
export * from "./organizations";
export * from "./projects";
export * from "./storyboards";
```

- [ ] **Step 8: pnpm install + 타입 체크**

```bash
pnpm install
pnpm --filter @repo/types check-types
```

- [ ] **Step 9: 커밋**

```bash
git add packages/types
git commit -m "feat: create @repo/types shared package with API DTOs"
```

---

## Task 3: apps/api NestJS 스캐폴딩

**Files:**
- Create: `apps/api/` 전체 NestJS 프로젝트

- [ ] **Step 1: NestJS 프로젝트 생성 (수동 — CLI 사용 안 함)**

`apps/api/package.json`:
```json
{
  "name": "api",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "nest start --watch",
    "build": "nest build",
    "start": "node dist/main",
    "lint": "eslint --max-warnings 0",
    "check-types": "tsc --noEmit"
  },
  "dependencies": {
    "@nestjs/common": "^10.4.15",
    "@nestjs/core": "^10.4.15",
    "@nestjs/config": "^3.3.0",
    "@nestjs/platform-express": "^10.4.15",
    "@repo/db": "workspace:*",
    "@repo/types": "workspace:*",
    "class-transformer": "^0.5.1",
    "class-validator": "^0.14.2",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.1"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.4.9",
    "@nestjs/schematics": "^10.2.3",
    "@repo/eslint-config": "workspace:*",
    "@repo/typescript-config": "workspace:*",
    "@types/express": "^5.0.0",
    "@types/node": "^22.15.3",
    "eslint": "^9.39.1",
    "typescript": "5.9.2"
  }
}
```

- [ ] **Step 2: tsconfig.json + tsconfig.build.json**

`apps/api/tsconfig.json`:
```json
{
  "extends": "@repo/typescript-config/base.json",
  "compilerOptions": {
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

`apps/api/tsconfig.build.json`:
```json
{
  "extends": "./tsconfig.json",
  "exclude": ["node_modules", "dist", "test", "**/*spec.ts"]
}
```

- [ ] **Step 3: nest-cli.json**

`apps/api/nest-cli.json`:
```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "tsConfigPath": "tsconfig.build.json"
  }
}
```

- [ ] **Step 4: main.ts**

`apps/api/src/main.ts`:
```ts
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix("api");

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = process.env.PORT ?? 4001;
  await app.listen(port);
}

bootstrap();
```

- [ ] **Step 5: app.module.ts**

`apps/api/src/app.module.ts`:
```ts
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuthModule } from "./auth/auth.module";
import { OrganizationsModule } from "./organizations/organizations.module";
import { ProjectsModule } from "./projects/projects.module";
import { StoryboardsModule } from "./storyboards/storyboards.module";
import { UsersModule } from "./users/users.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    UsersModule,
    OrganizationsModule,
    ProjectsModule,
    StoryboardsModule,
  ],
})
export class AppModule {}
```

- [ ] **Step 6: auth 모듈 (InternalAuthGuard)**

`apps/api/src/auth/auth.module.ts`:
```ts
import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { InternalAuthGuard } from "./internal-auth.guard";

@Module({
  providers: [
    {
      provide: APP_GUARD,
      useClass: InternalAuthGuard,
    },
  ],
})
export class AuthModule {}
```

`apps/api/src/auth/internal-auth.guard.ts`:
```ts
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { IS_PUBLIC_KEY } from "./public.decorator";

@Injectable()
export class InternalAuthGuard implements CanActivate {
  constructor(
    private configService: ConfigService,
    private reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const secret = request.headers["x-internal-secret"];
    const userId = request.headers["x-user-id"];

    const expectedSecret = this.configService.get<string>("INTERNAL_API_SECRET");

    if (!secret || secret !== expectedSecret) {
      throw new UnauthorizedException("Invalid internal secret");
    }

    if (!userId) {
      throw new UnauthorizedException("Missing user ID");
    }

    request.userId = userId;
    return true;
  }
}
```

`apps/api/src/auth/public.decorator.ts`:
```ts
import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_KEY = "isPublic";
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

`apps/api/src/auth/current-user.decorator.ts`:
```ts
import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export const CurrentUserId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    return request.userId;
  },
);
```

- [ ] **Step 6b: eslint.config.js**

`apps/api/eslint.config.js`:
```js
import { config } from "@repo/eslint-config/base";
export default config;
```

> NestJS는 CJS 모드로 동작하지만 eslint config는 ESM으로 작성. `@repo/eslint-config`의 base 설정을 사용.

- [ ] **Step 7: .env.example**

`apps/api/.env.example`:
```env
DATABASE_URL=postgresql://boardinary:boardinary@localhost:6432/boardinary
INTERNAL_API_SECRET=generate-with-openssl-rand-base64-32
PORT=4001
```

- [ ] **Step 8: pnpm install**

```bash
pnpm install
```

- [ ] **Step 9: 빌드 확인**

```bash
pnpm --filter api build
```

- [ ] **Step 10: 커밋**

```bash
git add apps/api
git commit -m "feat: scaffold NestJS API with internal auth guard"
```

---

## Task 4: NestJS 비즈니스 모듈 (organizations, projects, storyboards, users)

**Files:**
- Create: `apps/api/src/organizations/*.ts`
- Create: `apps/api/src/projects/*.ts`
- Create: `apps/api/src/storyboards/*.ts`
- Create: `apps/api/src/users/*.ts`

**중요: class-validator DTO**

`@repo/types`의 인터페이스는 타입 계약용이다. NestJS 컨트롤러에서는 `class-validator` 데코레이터가 있는 **클래스**를 사용해야 `ValidationPipe`가 동작한다. 각 모듈의 컨트롤러에서 직접 DTO 클래스를 정의하거나, `apps/api/src/dto/` 폴더에 모은다.

예시:
```ts
// apps/api/src/projects/dto/create-project.dto.ts
import { IsString, IsOptional, MaxLength } from "class-validator";
import type { CreateProjectDto as ICreateProjectDto } from "@repo/types";

export class CreateProjectDto implements ICreateProjectDto {
  @IsString()
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
```

모든 컨트롤러의 `@Body()` 파라미터에는 이 클래스를 사용한다. `@repo/types` 인터페이스는 `implements`로 타입 일관성을 보장.

- [ ] **Step 1: Users 모듈 (첫 가입 시 조직 생성)**

`apps/api/src/users/users.module.ts`:
```ts
import { Module } from "@nestjs/common";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";

@Module({
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
```

`apps/api/src/users/users.service.ts`:
```ts
import { Injectable } from "@nestjs/common";
import { db, organizations, orgMembers } from "@repo/db";
import { and, eq } from "drizzle-orm";

@Injectable()
export class UsersService {
  async setupUser(userId: string, name: string | null) {
    const slug =
      name?.toLowerCase().replace(/\s+/g, "-") ?? `user-${userId.slice(0, 8)}`;

    await db.transaction(async (tx) => {
      let [org] = await tx
        .insert(organizations)
        .values({
          name: `${name ?? "내"}의 워크스페이스`,
          slug: `${slug}-${userId.slice(0, 6)}`,
          ownerId: userId,
          isPersonal: true,
        })
        .onConflictDoNothing()
        .returning();

      if (!org) {
        [org] = await tx
          .select()
          .from(organizations)
          .where(
            and(
              eq(organizations.ownerId, userId),
              eq(organizations.isPersonal, true),
            ),
          )
          .limit(1);
      }

      if (org) {
        await tx
          .insert(orgMembers)
          .values({ orgId: org.id, userId, role: "owner" })
          .onConflictDoNothing();
      }
    });
  }
}
```

`apps/api/src/users/users.controller.ts`:
```ts
import { Controller, Post, Body, Headers } from "@nestjs/common";
import { UsersService } from "./users.service";
import type { SetupUserDto } from "@repo/types";

@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post("setup")
  async setup(@Body() body: SetupUserDto) {
    await this.usersService.setupUser(body.userId, body.name);
    return { success: true };
  }
}
```

- [ ] **Step 2: Organizations 모듈**

`apps/api/src/organizations/organizations.module.ts`:
```ts
import { Module } from "@nestjs/common";
import { OrganizationsController } from "./organizations.controller";
import { OrganizationsService } from "./organizations.service";

@Module({
  controllers: [OrganizationsController],
  providers: [OrganizationsService],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
```

`apps/api/src/organizations/organizations.service.ts`:
```ts
import { Injectable, NotFoundException, ForbiddenException } from "@nestjs/common";
import { eq, and } from "drizzle-orm";
import { db, organizations, orgMembers } from "@repo/db";

@Injectable()
export class OrganizationsService {
  async getOrganizationsByUserId(userId: string) {
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

  async getOrganizationBySlug(slug: string) {
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.slug, slug))
      .limit(1);
    return org ?? null;
  }

  async getPersonalOrganization(userId: string) {
    const [org] = await db
      .select()
      .from(organizations)
      .where(
        and(eq(organizations.ownerId, userId), eq(organizations.isPersonal, true)),
      )
      .limit(1);
    return org ?? null;
  }

  async ensureOrgMember(orgSlug: string, userId: string) {
    const org = await this.getOrganizationBySlug(orgSlug);
    if (!org) throw new NotFoundException("Organization not found");

    const [member] = await db
      .select()
      .from(orgMembers)
      .where(and(eq(orgMembers.orgId, org.id), eq(orgMembers.userId, userId)))
      .limit(1);

    if (!member) throw new ForbiddenException("Not a member of this organization");
    return org;
  }
}
```

`apps/api/src/organizations/organizations.controller.ts`:
```ts
import { Controller, Get, Param } from "@nestjs/common";
import { CurrentUserId } from "../auth/current-user.decorator";
import { OrganizationsService } from "./organizations.service";

@Controller("organizations")
export class OrganizationsController {
  constructor(private readonly orgsService: OrganizationsService) {}

  @Get()
  async list(@CurrentUserId() userId: string) {
    return this.orgsService.getOrganizationsByUserId(userId);
  }

  @Get(":orgSlug")
  async getBySlug(
    @Param("orgSlug") orgSlug: string,
    @CurrentUserId() userId: string,
  ) {
    return this.orgsService.ensureOrgMember(orgSlug, userId);
  }
}
```

- [ ] **Step 3: Projects 모듈**

`apps/api/src/projects/projects.module.ts`:
```ts
import { Module } from "@nestjs/common";
import { ProjectsController } from "./projects.controller";
import { ProjectsService } from "./projects.service";
import { OrganizationsModule } from "../organizations/organizations.module";

@Module({
  imports: [OrganizationsModule],
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
```

`apps/api/src/projects/projects.service.ts`:
```ts
import { Injectable, NotFoundException } from "@nestjs/common";
import { eq, and } from "drizzle-orm";
import { db, projects } from "@repo/db";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

@Injectable()
export class ProjectsService {
  async getProjectsByOrgId(orgId: string) {
    return db
      .select()
      .from(projects)
      .where(and(eq(projects.orgId, orgId), eq(projects.status, "active")))
      .orderBy(projects.createdAt);
  }

  async getProjectBySlug(orgId: string, slug: string) {
    const [project] = await db
      .select()
      .from(projects)
      .where(and(eq(projects.orgId, orgId), eq(projects.slug, slug)))
      .limit(1);
    if (!project) throw new NotFoundException("Project not found");
    return project;
  }

  async createProject(orgId: string, data: { name: string; description?: string }) {
    const slug = slugify(data.name) || `project-${Date.now()}`;
    const [project] = await db
      .insert(projects)
      .values({
        orgId,
        name: data.name,
        description: data.description ?? null,
        slug,
      })
      .returning();
    return project!;
  }

  async updateProject(id: string, data: { name?: string; description?: string }) {
    const [project] = await db
      .update(projects)
      .set(data)
      .where(eq(projects.id, id))
      .returning();
    if (!project) throw new NotFoundException("Project not found");
    return project;
  }

  async deleteProject(id: string) {
    await db.update(projects).set({ status: "archived" }).where(eq(projects.id, id));
  }
}
```

`apps/api/src/projects/projects.controller.ts`:
```ts
import { Controller, Get, Post, Patch, Delete, Param, Body } from "@nestjs/common";
import { CurrentUserId } from "../auth/current-user.decorator";
import { OrganizationsService } from "../organizations/organizations.service";
import { ProjectsService } from "./projects.service";
import type { CreateProjectDto, UpdateProjectDto } from "@repo/types";

@Controller("organizations/:orgSlug/projects")
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly orgsService: OrganizationsService,
  ) {}

  @Get()
  async list(
    @Param("orgSlug") orgSlug: string,
    @CurrentUserId() userId: string,
  ) {
    const org = await this.orgsService.ensureOrgMember(orgSlug, userId);
    return this.projectsService.getProjectsByOrgId(org.id);
  }

  @Post()
  async create(
    @Param("orgSlug") orgSlug: string,
    @CurrentUserId() userId: string,
    @Body() body: CreateProjectDto,
  ) {
    const org = await this.orgsService.ensureOrgMember(orgSlug, userId);
    return this.projectsService.createProject(org.id, body);
  }

  @Get(":projectSlug")
  async getBySlug(
    @Param("orgSlug") orgSlug: string,
    @Param("projectSlug") projectSlug: string,
    @CurrentUserId() userId: string,
  ) {
    const org = await this.orgsService.ensureOrgMember(orgSlug, userId);
    return this.projectsService.getProjectBySlug(org.id, projectSlug);
  }

  @Patch(":projectSlug")
  async update(
    @Param("orgSlug") orgSlug: string,
    @Param("projectSlug") projectSlug: string,
    @CurrentUserId() userId: string,
    @Body() body: UpdateProjectDto,
  ) {
    const org = await this.orgsService.ensureOrgMember(orgSlug, userId);
    const project = await this.projectsService.getProjectBySlug(org.id, projectSlug);
    return this.projectsService.updateProject(project.id, body);
  }

  @Delete(":projectSlug")
  async delete(
    @Param("orgSlug") orgSlug: string,
    @Param("projectSlug") projectSlug: string,
    @CurrentUserId() userId: string,
  ) {
    const org = await this.orgsService.ensureOrgMember(orgSlug, userId);
    const project = await this.projectsService.getProjectBySlug(org.id, projectSlug);
    await this.projectsService.deleteProject(project.id);
  }
}
```

- [ ] **Step 4: Storyboards 모듈**

`apps/api/src/storyboards/storyboards.module.ts`:
```ts
import { Module } from "@nestjs/common";
import { StoryboardsController } from "./storyboards.controller";
import { StoryboardsService } from "./storyboards.service";
import { ProjectsModule } from "../projects/projects.module";
import { OrganizationsModule } from "../organizations/organizations.module";

@Module({
  imports: [ProjectsModule, OrganizationsModule],
  controllers: [StoryboardsController],
  providers: [StoryboardsService],
})
export class StoryboardsModule {}
```

`apps/api/src/storyboards/storyboards.service.ts`:
```ts
import { Injectable, NotFoundException, ForbiddenException } from "@nestjs/common";
import { eq, and, ne } from "drizzle-orm";
import { db, storyboards, projects, orgMembers } from "@repo/db";

@Injectable()
export class StoryboardsService {
  async getStoryboardsByProjectId(projectId: string) {
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

  async getStoryboardById(id: string) {
    const [storyboard] = await db
      .select()
      .from(storyboards)
      .where(eq(storyboards.id, id))
      .limit(1);
    if (!storyboard) throw new NotFoundException("Storyboard not found");
    return storyboard;
  }

  /** 스토리보드 → 프로젝트 → 조직 경로로 멤버십 확인 */
  async ensureStoryboardAccess(storyboardId: string, userId: string) {
    const storyboard = await this.getStoryboardById(storyboardId);
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, storyboard.projectId))
      .limit(1);
    if (!project) throw new NotFoundException("Project not found");

    const [member] = await db
      .select()
      .from(orgMembers)
      .where(and(eq(orgMembers.orgId, project.orgId), eq(orgMembers.userId, userId)))
      .limit(1);
    if (!member) throw new ForbiddenException("Not authorized");
  }

  async createStoryboard(
    projectId: string,
    userId: string,
    data: { name: string; description?: string; genre?: string },
  ) {
    const [storyboard] = await db
      .insert(storyboards)
      .values({
        projectId,
        createdBy: userId,
        updatedBy: userId,
        name: data.name,
        description: data.description ?? null,
        genre: data.genre ?? null,
        content: {},
        contentVersion: 0,
      })
      .returning();
    return storyboard!;
  }

  async updateStoryboard(
    id: string,
    userId: string,
    data: { name?: string; description?: string; genre?: string; tags?: string[] },
  ) {
    const [storyboard] = await db
      .update(storyboards)
      .set({ ...data, updatedBy: userId })
      .where(eq(storyboards.id, id))
      .returning();
    if (!storyboard) throw new NotFoundException("Storyboard not found");
    return storyboard;
  }

  async deleteStoryboard(id: string) {
    await db.update(storyboards).set({ status: "archived" }).where(eq(storyboards.id, id));
  }
}
```

`apps/api/src/storyboards/storyboards.controller.ts`:
```ts
import { Controller, Get, Post, Patch, Delete, Param, Body } from "@nestjs/common";
import { CurrentUserId } from "../auth/current-user.decorator";
import { OrganizationsService } from "../organizations/organizations.service";
import { ProjectsService } from "../projects/projects.service";
import { StoryboardsService } from "./storyboards.service";
import type { CreateStoryboardDto, UpdateStoryboardDto } from "@repo/types";

@Controller()
export class StoryboardsController {
  constructor(
    private readonly storyboardsService: StoryboardsService,
    private readonly projectsService: ProjectsService,
    private readonly orgsService: OrganizationsService,
  ) {}

  @Get("organizations/:orgSlug/projects/:projectSlug/storyboards")
  async list(
    @Param("orgSlug") orgSlug: string,
    @Param("projectSlug") projectSlug: string,
    @CurrentUserId() userId: string,
  ) {
    const org = await this.orgsService.ensureOrgMember(orgSlug, userId);
    const project = await this.projectsService.getProjectBySlug(org.id, projectSlug);
    return this.storyboardsService.getStoryboardsByProjectId(project.id);
  }

  @Post("organizations/:orgSlug/projects/:projectSlug/storyboards")
  async create(
    @Param("orgSlug") orgSlug: string,
    @Param("projectSlug") projectSlug: string,
    @CurrentUserId() userId: string,
    @Body() body: CreateStoryboardDto,
  ) {
    const org = await this.orgsService.ensureOrgMember(orgSlug, userId);
    const project = await this.projectsService.getProjectBySlug(org.id, projectSlug);
    return this.storyboardsService.createStoryboard(project.id, userId, body);
  }

  @Get("storyboards/:id")
  async getById(
    @Param("id") id: string,
    @CurrentUserId() userId: string,
  ) {
    await this.storyboardsService.ensureStoryboardAccess(id, userId);
    return this.storyboardsService.getStoryboardById(id);
  }

  @Patch("storyboards/:id")
  async update(
    @Param("id") id: string,
    @CurrentUserId() userId: string,
    @Body() body: UpdateStoryboardDto,
  ) {
    await this.storyboardsService.ensureStoryboardAccess(id, userId);
    return this.storyboardsService.updateStoryboard(id, userId, body);
  }

  @Delete("storyboards/:id")
  async delete(
    @Param("id") id: string,
    @CurrentUserId() userId: string,
  ) {
    await this.storyboardsService.ensureStoryboardAccess(id, userId);
    await this.storyboardsService.deleteStoryboard(id);
  }
}
```

- [ ] **Step 5: Health check endpoint**

`apps/api/src/app.module.ts`에 health controller 추가 — 또는 `app.controller.ts` 생성:

`apps/api/src/health.controller.ts`:
```ts
import { Controller, Get } from "@nestjs/common";
import { Public } from "./auth/public.decorator";

@Controller("health")
export class HealthController {
  @Public()
  @Get()
  check() {
    return { status: "ok" };
  }
}
```

`app.module.ts`에 `HealthController` 추가:
```ts
controllers: [HealthController],
```

- [ ] **Step 6: 빌드 확인**

```bash
pnpm --filter api build
```

- [ ] **Step 7: 커밋**

```bash
git add apps/api
git commit -m "feat: add NestJS business modules (orgs, projects, storyboards, users)"
```

---

## Task 5: Docker 포트 변경 + turbo.json 업데이트

**Files:**
- Modify: `docker-compose.yml` (5434 → 6432)
- Modify: `turbo.json` (api 앱 추가)
- Modify: `apps/web/package.json` (dev 포트 4000)

- [ ] **Step 1: docker-compose.yml 포트 변경**

`docker-compose.yml`에서 `"5434:5432"` → `"6432:5432"` 변경.

- [ ] **Step 2: turbo.json 업데이트**

`turbo.json`의 build outputs에 NestJS `dist/` 추가, env vars 추가:

build.outputs를 `[".next/**", "!.next/cache/**", "dist/**"]`로 수정.

```json
{
  "build": {
    "env": [
      "DATABASE_URL",
      "AUTH_SECRET",
      "AUTH_GOOGLE_ID",
      "AUTH_GOOGLE_SECRET",
      "AUTH_GITHUB_ID",
      "AUTH_GITHUB_SECRET",
      "AUTH_RESEND_KEY",
      "AUTH_EMAIL_FROM",
      "NEXT_PUBLIC_APP_URL",
      "API_URL",
      "INTERNAL_API_SECRET",
      "PORT"
    ]
  }
}
```

- [ ] **Step 3: apps/web dev 포트 변경**

`apps/web/package.json` scripts.dev: `"next dev --port 3000"` → `"next dev --port 4000"`

- [ ] **Step 4: apps/web에 @repo/db, @repo/types 의존성 추가**

```bash
cd apps/web
# package.json에 추가
```

`apps/web/package.json` dependencies에 추가:
```json
"@repo/db": "workspace:*",
"@repo/types": "workspace:*"
```

- [ ] **Step 5: pnpm install**

```bash
pnpm install
```

- [ ] **Step 6: 커밋**

```bash
git add docker-compose.yml turbo.json apps/web/package.json
git commit -m "chore: update ports (PG 6432, web 4000) and add api to turbo"
```

---

## Task 6: apps/web 리팩터링 (API 호출로 전환)

**Files:**
- Create: `apps/web/src/lib/api-client.ts`
- Modify: `apps/web/src/auth.ts` (DB import → @repo/db/auth, createUser → API 호출)
- Modify: `apps/web/src/actions/project-actions.ts` (API 호출로 변경)
- Modify: `apps/web/src/actions/storyboard-actions.ts` (API 호출로 변경)
- Modify: `apps/web/src/app/dashboard/page.tsx` (API 호출)
- Modify: `apps/web/src/app/dashboard/[orgSlug]/layout.tsx` (API 호출)
- Modify: `apps/web/src/app/dashboard/[orgSlug]/page.tsx` (API 호출)
- Modify: `apps/web/src/app/dashboard/[orgSlug]/projects/*/page.tsx` (API 호출)
- Delete: `apps/web/src/data-access/` (전체)
- Delete: `apps/web/src/db/` (전체 — packages/db로 이동됨)

- [ ] **Step 1: api-client.ts 생성**

`apps/web/src/lib/api-client.ts`:
```ts
import type { ApiErrorResponse } from "@repo/types";

const API_URL = process.env.API_URL ?? "http://localhost:4001";
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET ?? "";

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
  const timeoutId = setTimeout(
    () => controller.abort(),
    options.timeout ?? 5000,
  );

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

- [ ] **Step 2: auth.ts 수정 (DB import를 @repo/db/auth로)**

`apps/web/src/auth.ts`에서:
- `import { db } from "@/db"` → `import { db } from "@repo/db/auth"`
- `import { users, accounts, sessions, verificationTokens, organizations, orgMembers } from "@/db/schema"` → `import { users, accounts, sessions, verificationTokens } from "@repo/db/auth"`
- `createUser` 이벤트에서 직접 DB 접근 → `apiClient` 호출로 변경

수정된 `auth.ts`:
```ts
import NextAuth, { type NextAuthResult } from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import Resend from "next-auth/providers/resend";
import { db, users, accounts, sessions, verificationTokens } from "@repo/db/auth";
import authConfig from "./auth.config";

const API_URL = process.env.API_URL ?? "http://localhost:4001";
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET ?? "";

const nextAuth = NextAuth({
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
      if (!user.id) return;
      try {
        await fetch(`${API_URL}/api/users/setup`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Internal-Secret": INTERNAL_SECRET,
            "X-User-Id": user.id,
          },
          body: JSON.stringify({
            userId: user.id,
            name: user.name ?? null,
          }),
        });
      } catch {
        // Prevent app crash
      }
    },
  },
});

export const handlers: NextAuthResult["handlers"] = nextAuth.handlers;
export const auth: NextAuthResult["auth"] = nextAuth.auth;
export const signIn: NextAuthResult["signIn"] = nextAuth.signIn;
export const signOut: NextAuthResult["signOut"] = nextAuth.signOut;
```

- [ ] **Step 3: Server Actions 수정 (API 호출)**

`apps/web/src/actions/project-actions.ts` — data-access import를 모두 제거하고 apiClient로 교체.

`apps/web/src/actions/storyboard-actions.ts` — 동일하게 교체.

구현 세부사항: 기존 data-access 함수 호출을 `apiClient()` 호출로 1:1 대응. 예를 들어:
- `getOrganizationBySlug(orgSlug)` → `apiClient<OrganizationDto>(`/api/organizations/${orgSlug}`, { userId })`
- `createProject(data)` → `apiClient<ProjectDto>(`/api/organizations/${orgSlug}/projects`, { method: "POST", body: data, userId })`
- `getProjectBySlug(org.id, projectSlug)` → `apiClient<ProjectDto>(`/api/organizations/${orgSlug}/projects/${projectSlug}`, { userId })`

- [ ] **Step 4: 대시보드 페이지들 수정 (API 호출)**

모든 dashboard 페이지에서:
- `import { ... } from "@/data-access/..."` 제거
- `import { apiClient } from "@/lib/api-client"` 추가
- `import { getCurrentUserId } from "@/lib/auth"` 유지
- 직접 DB 호출 → `apiClient` 호출로 변경

- [ ] **Step 5: data-access 및 db 디렉토리 삭제**

```bash
rm -rf apps/web/src/data-access
rm -rf apps/web/src/db
```

- [ ] **Step 6: apps/web .env.local 업데이트**

`API_URL=http://localhost:4001` 및 `INTERNAL_API_SECRET=...` 추가.
`DATABASE_URL` 포트를 6432로 변경.

- [ ] **Step 7: 빌드 확인**

```bash
pnpm build
```

- [ ] **Step 8: 커밋**

```bash
git add -A
git commit -m "refactor: replace direct DB access with NestJS API calls in web app"
```

---

## Task 7: seed 스크립트 이동 + 전체 검증

**Files:**
- Move: `apps/web/src/db/seed.ts` → `packages/db/src/seed.ts`
- Modify: `packages/db/package.json` (seed 스크립트)
- Modify: `apps/web/package.json` (db 스크립트 제거)

- [ ] **Step 1: seed.ts를 packages/db로 이동**

```bash
cp apps/web/src/db/seed.ts packages/db/src/seed.ts
```

import를 상대 경로로 수정 (이미 상대 경로면 그대로):
```ts
import { db } from "./connection";
import { users, organizations, orgMembers, projects, storyboards } from "./schema";
```

- [ ] **Step 2: packages/db/package.json에 seed 스크립트 추가**

```json
"db:seed:sample": "tsx src/seed.ts"
```

tsx devDependency 추가:
```json
"tsx": "^4.19.4"
```

- [ ] **Step 3: apps/web/package.json에서 DB 스크립트 제거**

`db:generate`, `db:migrate`, `db:studio`, `db:seed:sample` 스크립트 삭제.
`drizzle-kit`, `tsx`, `@types/pg` devDependencies 삭제.
`drizzle-orm`, `postgres`, `@paralleldrive/cuid2` dependencies에서 삭제 (이제 @repo/db가 제공).

- [ ] **Step 4: CLAUDE.md 업데이트**

DB 관련 명령어 섹션에서:
```
pnpm --filter web db:generate   → pnpm --filter @repo/db db:generate
pnpm --filter web db:migrate    → pnpm --filter @repo/db db:migrate
pnpm --filter web db:studio     → pnpm --filter @repo/db db:studio
pnpm --filter web db:seed:sample → pnpm --filter @repo/db db:seed:sample
```

포트 변경 반영:
```
web: port 4000
api: port 4001
docs: port 4002
PostgreSQL: port 6432
```

- [ ] **Step 5: 전체 검증**

```bash
pnpm install
pnpm check-types    # 모든 패키지 타입 체크
pnpm lint           # 모든 패키지 린트
pnpm build          # 전체 빌드
```

- [ ] **Step 6: 커밋**

```bash
git add -A
git commit -m "chore: move seed to @repo/db, remove direct DB deps from web, update CLAUDE.md"
```

---

## 의존성 요약

### 새 패키지

| 패키지 | 용도 |
|--------|------|
| `@nestjs/core`, `@nestjs/common`, `@nestjs/platform-express` | NestJS 코어 |
| `@nestjs/config` | 환경변수 관리 |
| `@nestjs/cli`, `@nestjs/schematics` | NestJS CLI/빌드 |
| `class-validator`, `class-transformer` | 입력 유효성 검증 |
| `reflect-metadata` | NestJS 데코레이터 |
| `rxjs` | NestJS 의존성 |

### 이동되는 패키지 (apps/web → packages/db)

| 패키지 | 이동 |
|--------|------|
| `drizzle-orm`, `postgres`, `@paralleldrive/cuid2` | apps/web → packages/db |
| `drizzle-kit`, `tsx` | apps/web devDeps → packages/db devDeps |

## 태스크 의존성

```
Task 1 (packages/db) → Task 2 (packages/types) → Task 3 (NestJS 스캐폴딩)
                                                    ↓
Task 5 (포트/설정) ←────────────────── Task 4 (비즈니스 모듈)
        ↓
Task 6 (web 리팩터링) → Task 7 (seed 이동 + 전체 검증)
```
