# Version History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 스토리보드의 변경 이력을 자동/수동으로 저장하고, 과거 버전을 미리보기한 뒤 전체 복원할 수 있는 시스템을 구축한다.

**Architecture:** `packages/db`에 `storyboard_versions` 테이블 추가 → `apps/api`에 `VersionsModule` 신규 생성 (REST 5 엔드포인트 + EventEmitter 브로드캐스트) → `apps/web`에 `versions/` 컴포넌트 폴더 신규 생성 후 기존 `editor.tsx` / `editor-store.ts` / `toolbar.tsx` / `collaboration.gateway.ts` / `collaboration.service.ts`에 최소 수정. 자동 스냅샷은 `flushStoryboard()` 내부에서 서버가 판단.

**Tech Stack:** Drizzle ORM (PostgreSQL), NestJS, Socket.io (EventEmitter 패턴), React 19, ReactFlow, Zustand, Vitest

**Spec:** `docs/superpowers/specs/2026-04-10-version-history-design.md`

---

## 파일 맵

### 신규 생성

| 파일                                                                        | 역할                                                          |
| --------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `packages/db/src/versions-schema.ts`                                        | storyboard_versions Drizzle 스키마                            |
| `packages/types/src/versions.ts`                                            | 공유 타입 (VersionDto, VersionMetadata, VersionRestoredEvent) |
| `apps/api/src/versions/versions.module.ts`                                  | NestJS 모듈                                                   |
| `apps/api/src/versions/versions.controller.ts`                              | REST 5 엔드포인트                                             |
| `apps/api/src/versions/versions.service.ts`                                 | CRUD + 보관 정책 + restore 로직                               |
| `apps/api/src/versions/dto/create-checkpoint.dto.ts`                        | 수동 체크포인트 DTO                                           |
| `apps/api/src/versions/__tests__/versions.service.test.ts`                  | 서비스 단위 테스트                                            |
| `apps/web/src/components/storyboard/versions/useVersions.ts`                | fetch + Socket room:restored 구독                             |
| `apps/web/src/components/storyboard/versions/VersionPanel.tsx`              | 우측 슬라이드인 버전 타임라인 패널                            |
| `apps/web/src/components/storyboard/versions/VersionPreviewModal.tsx`       | 읽기 전용 ReactFlow 미리보기 모달                             |
| `apps/web/src/components/storyboard/versions/SaveCheckpointDialog.tsx`      | 체크포인트 이름 입력 다이얼로그                               |
| `apps/web/src/components/storyboard/versions/__tests__/useVersions.test.ts` | 훅 단위 테스트                                                |

### 수정

| 파일                                                               | 변경 내용                                                                   |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| `packages/db/src/index.ts`                                         | versions-schema export 추가                                                 |
| `packages/types/src/index.ts`                                      | versions.ts export 추가                                                     |
| `apps/api/src/app.module.ts`                                       | VersionsModule import 추가                                                  |
| `apps/api/src/collaboration/collaboration.service.ts`              | `flushStoryboard()` 내 자동 스냅샷 트리거 추가                              |
| `apps/api/src/collaboration/collaboration.gateway.ts`              | `@OnEvent('version.restored')` 핸들러 추가                                  |
| `apps/web/src/stores/editor-store.ts`                              | `activeSidePanel` + `previewVersionId` 상태 추가 (기존 boolean 플래그 통합) |
| `apps/web/src/components/storyboard/panels/toolbar.tsx`            | 히스토리 버튼 추가 (blueprint 모드 시 숨김)                                 |
| `apps/web/src/components/storyboard/editor.tsx`                    | `useVersions` 연결, VersionPanel/Modal 렌더링, `room:restored` 처리         |
| `apps/web/src/components/storyboard/hooks/use-editor-shortcuts.ts` | `H` 키 → 히스토리 패널 토글                                                 |
| `apps/web/src/lib/api-client.ts`                                   | 버전 관련 API 함수 추가                                                     |

---

### Task 1: DB 스키마 + 마이그레이션

**Files:**

- Create: `packages/db/src/versions-schema.ts`
- Modify: `packages/db/src/index.ts`

- [ ] **Step 1: versions-schema.ts 생성**

```ts
// packages/db/src/versions-schema.ts
import {
  pgTable,
  text,
  integer,
  jsonb,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";
import { storyboards } from "./schema";
import { users } from "./schema";

export const storyboardVersions = pgTable(
  "storyboard_versions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    storyboardId: text("storyboard_id")
      .notNull()
      .references(() => storyboards.id, { onDelete: "cascade" }),
    createdBy: text("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    label: text("label"),
    content: jsonb("content").notNull(),
    contentVersion: integer("content_version").notNull(),
    restoredFromId: text("restored_from_id"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("uq_sv_content_version").on(
      table.storyboardId,
      table.contentVersion,
    ),
    index("idx_sv_list").on(table.storyboardId, table.createdAt),
  ],
);
```

- [ ] **Step 2: packages/db/src/index.ts에 export 추가**

`packages/db/src/index.ts`에서 `export * from "./versions-schema";` 한 줄 추가.

- [ ] **Step 3: 마이그레이션 생성**

```bash
cd /path/to/boardinary
pnpm --filter @repo/db db:generate
```

Expected: `packages/db/drizzle/migrations/0003_*.sql` 파일 생성됨.

- [ ] **Step 4: 마이그레이션에 부분 인덱스 수동 추가**

생성된 마이그레이션 SQL 파일 하단에 추가:

```sql
CREATE INDEX IF NOT EXISTS "idx_sv_auto_retention"
ON "storyboard_versions" ("storyboard_id", "created_at" ASC)
WHERE "label" IS NULL;
```

- [ ] **Step 5: 마이그레이션 실행**

```bash
docker compose up -d  # PostgreSQL 실행 중인지 확인
pnpm --filter @repo/db db:migrate
```

Expected: 마이그레이션 성공, `storyboard_versions` 테이블 생성됨.

- [ ] **Step 6: 커밋**

```bash
git add packages/db/src/versions-schema.ts packages/db/src/index.ts packages/db/drizzle/
git commit -m "feat: add storyboard_versions schema and migration"
```

---

### Task 2: 공유 타입 정의

**Files:**

- Create: `packages/types/src/versions.ts`
- Modify: `packages/types/src/index.ts`

- [ ] **Step 1: versions.ts 생성**

```ts
// packages/types/src/versions.ts
export interface VersionMetadata {
  added: number;
  removed: number;
  modified: number;
}

export interface VersionDto {
  id: string;
  storyboardId: string;
  createdBy: string | null;
  label: string | null;
  contentVersion: number;
  restoredFromId: string | null;
  metadata: VersionMetadata | null;
  createdAt: string; // ISO 8601
}

export interface VersionWithContentDto extends VersionDto {
  content: Record<string, unknown>;
}

export interface VersionRestoredEvent {
  storyboardId: string;
  content: Record<string, unknown>;
  contentVersion: number;
  restoredBy: string;
}
```

- [ ] **Step 2: packages/types/src/index.ts에 export 추가**

```ts
// 기존 export 아래에 추가
export * from "./versions";
```

- [ ] **Step 3: 커밋**

```bash
git add packages/types/src/versions.ts packages/types/src/index.ts
git commit -m "feat: add version history shared types"
```

---

### Task 3: VersionsService (API 핵심 로직)

**Files:**

- Create: `apps/api/src/versions/versions.service.ts`
- Create: `apps/api/src/versions/dto/create-checkpoint.dto.ts`
- Create: `apps/api/src/versions/__tests__/versions.service.test.ts`

- [ ] **Step 1: 테스트 파일 작성 (TDD)**

```ts
// apps/api/src/versions/__tests__/versions.service.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Test } from "@nestjs/testing";
import { VersionsService } from "../versions.service";
import {
  db,
  storyboardVersions,
  storyboards,
  users,
  organizations,
  orgMembers,
  projects,
} from "@repo/db";
import { eq, and } from "drizzle-orm";

// 테스트 데이터 헬퍼
async function createTestUser() {
  const [user] = await db
    .insert(users)
    .values({
      id: `test-user-${Date.now()}`,
      name: "Test User",
      email: `test-${Date.now()}@example.com`,
    })
    .returning();
  return user!;
}

async function createTestStoryboard(userId: string) {
  const [org] = await db
    .insert(organizations)
    .values({
      name: "Test Org",
      slug: `test-org-${Date.now()}`,
      ownerId: userId,
    })
    .returning();

  await db.insert(orgMembers).values({
    orgId: org!.id,
    userId,
    role: "owner",
  });

  const [project] = await db
    .insert(projects)
    .values({
      orgId: org!.id,
      createdBy: userId,
      name: "Test Project",
      slug: `test-project-${Date.now()}`,
    })
    .returning();

  const [storyboard] = await db
    .insert(storyboards)
    .values({
      projectId: project!.id,
      createdBy: userId,
      name: "Test Storyboard",
      content: {
        version: 1,
        viewport: { x: 0, y: 0, zoom: 1 },
        nodes: [],
        edges: [],
      },
      contentVersion: 10,
    })
    .returning();

  return storyboard!;
}

describe("VersionsService", () => {
  let service: VersionsService;
  let userId: string;
  let storyboardId: string;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [VersionsService],
    }).compile();
    service = module.get(VersionsService);

    const user = await createTestUser();
    userId = user.id;
    const storyboard = await createTestStoryboard(userId);
    storyboardId = storyboard.id;
  });

  afterEach(async () => {
    await db
      .delete(storyboardVersions)
      .where(eq(storyboardVersions.storyboardId, storyboardId));
    await db.delete(storyboards).where(eq(storyboards.id, storyboardId));
    await db.delete(users).where(eq(users.id, userId));
  });

  describe("createSnapshot", () => {
    it("자동 스냅샷을 생성한다 (label null)", async () => {
      const content = {
        version: 1,
        viewport: { x: 0, y: 0, zoom: 1 },
        nodes: [],
        edges: [],
      };
      const version = await service.createSnapshot(
        storyboardId,
        content,
        10,
        null,
        userId,
      );
      expect(version.label).toBeNull();
      expect(version.contentVersion).toBe(10);
    });

    it("수동 체크포인트를 생성한다 (label 있음)", async () => {
      const content = {
        version: 1,
        viewport: { x: 0, y: 0, zoom: 1 },
        nodes: [],
        edges: [],
      };
      const version = await service.createSnapshot(
        storyboardId,
        content,
        10,
        "v1.0 퀘스트 완성",
        userId,
      );
      expect(version.label).toBe("v1.0 퀘스트 완성");
    });

    it("동일 contentVersion 중복 저장 시 에러 없이 기존 버전 반환한다", async () => {
      const content = {
        version: 1,
        viewport: { x: 0, y: 0, zoom: 1 },
        nodes: [],
        edges: [],
      };
      await service.createSnapshot(storyboardId, content, 10, null, userId);
      // 두 번째 호출 — UNIQUE 충돌, 에러 throw 없이 처리
      const result = await service.createSnapshot(
        storyboardId,
        content,
        10,
        null,
        userId,
      );
      expect(result).toBeDefined();
    });
  });

  describe("pruneAutoVersions", () => {
    it("자동 버전이 50개 초과 시 가장 오래된 자동 버전 삭제", async () => {
      const content = {
        version: 1,
        viewport: { x: 0, y: 0, zoom: 1 },
        nodes: [],
        edges: [],
      };
      // 51개 자동 버전 생성
      for (let i = 1; i <= 51; i++) {
        await db.insert(storyboardVersions).values({
          storyboardId,
          createdBy: userId,
          label: null,
          content,
          contentVersion: i,
          createdAt: new Date(Date.now() + i * 1000),
        });
      }
      await service.pruneAutoVersions(storyboardId);
      const remaining = await db
        .select()
        .from(storyboardVersions)
        .where(and(eq(storyboardVersions.storyboardId, storyboardId)));
      expect(remaining.length).toBe(50);
    });

    it("수동 체크포인트는 삭제하지 않는다", async () => {
      const content = {
        version: 1,
        viewport: { x: 0, y: 0, zoom: 1 },
        nodes: [],
        edges: [],
      };
      // 50개 자동 + 1개 수동
      for (let i = 1; i <= 50; i++) {
        await db.insert(storyboardVersions).values({
          storyboardId,
          createdBy: userId,
          label: null,
          content,
          contentVersion: i,
        });
      }
      await db.insert(storyboardVersions).values({
        storyboardId,
        createdBy: userId,
        label: "중요 체크포인트",
        content,
        contentVersion: 51,
      });
      await service.pruneAutoVersions(storyboardId);
      const manualVersions = await db
        .select()
        .from(storyboardVersions)
        .where(and(eq(storyboardVersions.storyboardId, storyboardId)));
      const manual = manualVersions.find((v) => v.label === "중요 체크포인트");
      expect(manual).toBeDefined();
    });
  });

  describe("listVersions", () => {
    it("content 제외하고 목록 반환", async () => {
      const content = {
        version: 1,
        viewport: { x: 0, y: 0, zoom: 1 },
        nodes: [{ id: "n1" }],
        edges: [],
      };
      await service.createSnapshot(storyboardId, content, 10, null, userId);
      const versions = await service.listVersions(storyboardId);
      expect(versions.length).toBe(1);
      expect(
        (versions[0] as Record<string, unknown>)["content"],
      ).toBeUndefined();
    });
  });

  describe("getVersionById", () => {
    it("content 포함한 단건 반환", async () => {
      const content = {
        version: 1,
        viewport: { x: 0, y: 0, zoom: 1 },
        nodes: [],
        edges: [],
      };
      const created = await service.createSnapshot(
        storyboardId,
        content,
        10,
        null,
        userId,
      );
      const found = await service.getVersionById(created.id);
      expect(found.content).toEqual(content);
    });
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
pnpm --filter web test -- --reporter=verbose 2>&1 | head -30
```

Expected: `VersionsService` 없어서 import 에러.

- [ ] **Step 3: create-checkpoint.dto.ts 생성**

```ts
// apps/api/src/versions/dto/create-checkpoint.dto.ts
import { IsString, MaxLength } from "class-validator";

export class CreateCheckpointDto {
  @IsString()
  @MaxLength(100)
  label!: string;
}
```

- [ ] **Step 4: versions.service.ts 생성**

```ts
// apps/api/src/versions/versions.service.ts
import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { db, storyboardVersions, storyboards } from "@repo/db";
import { eq, and, isNull, isNotNull, sql, desc, asc } from "drizzle-orm";
import type { VersionMetadata } from "@repo/types";

const MAX_AUTO_VERSIONS = 50;

@Injectable()
export class VersionsService {
  /** 스냅샷 생성 (자동: label=null, 수동: label=string) */
  async createSnapshot(
    storyboardId: string,
    content: Record<string, unknown>,
    contentVersion: number,
    label: string | null,
    createdBy: string,
    restoredFromId?: string,
  ) {
    const metadata = this.calcMetadata(content);

    try {
      const [version] = await db
        .insert(storyboardVersions)
        .values({
          storyboardId,
          createdBy,
          label,
          content,
          contentVersion,
          restoredFromId: restoredFromId ?? null,
          metadata,
        })
        .onConflictDoNothing()
        .returning();

      if (!version) {
        // UNIQUE 충돌 — 이미 존재하는 버전 반환
        const [existing] = await db
          .select()
          .from(storyboardVersions)
          .where(
            and(
              eq(storyboardVersions.storyboardId, storyboardId),
              eq(storyboardVersions.contentVersion, contentVersion),
            ),
          )
          .limit(1);
        return existing!;
      }

      return version;
    } catch {
      const [existing] = await db
        .select()
        .from(storyboardVersions)
        .where(
          and(
            eq(storyboardVersions.storyboardId, storyboardId),
            eq(storyboardVersions.contentVersion, contentVersion),
          ),
        )
        .limit(1);
      return existing!;
    }
  }

  /** 자동 버전 50개 초과 시 가장 오래된 자동 버전 삭제 */
  async pruneAutoVersions(storyboardId: string): Promise<void> {
    const autoVersions = await db
      .select({ id: storyboardVersions.id })
      .from(storyboardVersions)
      .where(
        and(
          eq(storyboardVersions.storyboardId, storyboardId),
          isNull(storyboardVersions.label),
        ),
      )
      .orderBy(asc(storyboardVersions.createdAt));

    if (autoVersions.length <= MAX_AUTO_VERSIONS) return;

    const toDelete = autoVersions.slice(
      0,
      autoVersions.length - MAX_AUTO_VERSIONS,
    );
    for (const v of toDelete) {
      await db
        .delete(storyboardVersions)
        .where(eq(storyboardVersions.id, v.id));
    }
  }

  /** 버전 목록 (content 제외) */
  async listVersions(storyboardId: string) {
    return db
      .select({
        id: storyboardVersions.id,
        storyboardId: storyboardVersions.storyboardId,
        createdBy: storyboardVersions.createdBy,
        label: storyboardVersions.label,
        contentVersion: storyboardVersions.contentVersion,
        restoredFromId: storyboardVersions.restoredFromId,
        metadata: storyboardVersions.metadata,
        createdAt: storyboardVersions.createdAt,
      })
      .from(storyboardVersions)
      .where(eq(storyboardVersions.storyboardId, storyboardId))
      .orderBy(desc(storyboardVersions.createdAt));
  }

  /** 단건 조회 (content 포함) */
  async getVersionById(versionId: string) {
    const [version] = await db
      .select()
      .from(storyboardVersions)
      .where(eq(storyboardVersions.id, versionId))
      .limit(1);
    if (!version) throw new NotFoundException("Version not found");
    return version;
  }

  /** 버전 삭제 — 수동(label IS NOT NULL)만 허용 */
  async deleteVersion(versionId: string): Promise<void> {
    const version = await this.getVersionById(versionId);
    if (version.label === null) {
      throw new UnprocessableEntityException(
        "Auto-generated versions cannot be deleted",
      );
    }
    await db
      .delete(storyboardVersions)
      .where(eq(storyboardVersions.id, versionId));
  }

  /** 복원: 선택한 버전 content를 storyboard에 적용하고 새 스냅샷 생성 */
  async restoreVersion(
    storyboardId: string,
    versionId: string,
    restoredBy: string,
  ) {
    const version = await this.getVersionById(versionId);
    if (version.storyboardId !== storyboardId) {
      throw new NotFoundException("Version not found");
    }

    return await db.transaction(async (tx) => {
      // advisory lock으로 동시 복원 방지
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtext(${storyboardId}))`,
      );

      // 현재 contentVersion 조회
      const [current] = await tx
        .select({ contentVersion: storyboards.contentVersion })
        .from(storyboards)
        .where(eq(storyboards.id, storyboardId))
        .limit(1);
      if (!current) throw new NotFoundException("Storyboard not found");

      const newVersion = current.contentVersion + 1;

      // storyboard content 교체
      await tx
        .update(storyboards)
        .set({
          content: version.content as never,
          contentVersion: newVersion,
          updatedAt: new Date(),
        })
        .where(eq(storyboards.id, storyboardId));

      // 복원 스냅샷 생성
      const [snapshot] = await tx
        .insert(storyboardVersions)
        .values({
          storyboardId,
          createdBy: restoredBy,
          label: null,
          content: version.content as never,
          contentVersion: newVersion,
          restoredFromId: versionId,
          metadata: { added: 0, removed: 0, modified: 0 },
        })
        .returning();

      return { snapshot: snapshot!, contentVersion: newVersion };
    });
  }

  /** 변경 요약 계산 */
  private calcMetadata(content: Record<string, unknown>): VersionMetadata {
    const nodes = (content["nodes"] as Array<unknown>) ?? [];
    const edges = (content["edges"] as Array<unknown>) ?? [];
    return {
      added: nodes.length,
      removed: 0,
      modified: edges.length,
    };
  }
}
```

- [ ] **Step 5: 테스트 실행 — 통과 확인**

```bash
pnpm --filter web test -- --reporter=verbose 2>&1 | grep -E "PASS|FAIL|✓|✗"
```

Expected: `VersionsService` 테스트 모두 PASS.

- [ ] **Step 6: 커밋**

```bash
git add apps/api/src/versions/
git commit -m "feat: add VersionsService with snapshot, prune, restore logic"
```

---

### Task 4: VersionsController + Module

**Files:**

- Create: `apps/api/src/versions/versions.controller.ts`
- Create: `apps/api/src/versions/versions.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: versions.controller.ts 생성**

```ts
// apps/api/src/versions/versions.controller.ts
import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { CurrentUserId } from "../auth/current-user.decorator";
import { VersionsService } from "./versions.service";
import { StoryboardsService } from "../storyboards/storyboards.service";
import { CreateCheckpointDto } from "./dto/create-checkpoint.dto";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { CollaborationRedisService } from "../collaboration/collaboration-redis.service";
import { CollaborationService } from "../collaboration/collaboration.service";
import type { VersionRestoredEvent } from "@repo/types";

@Controller("storyboards/:storyboardId/versions")
export class VersionsController {
  constructor(
    private readonly versionsService: VersionsService,
    private readonly storyboardsService: StoryboardsService,
    private readonly collaborationService: CollaborationService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Get()
  async listVersions(
    @CurrentUserId() userId: string,
    @Param("storyboardId") storyboardId: string,
  ) {
    await this.storyboardsService.ensureStoryboardAccess(storyboardId, userId);
    return this.versionsService.listVersions(storyboardId);
  }

  @Get(":versionId")
  async getVersion(
    @CurrentUserId() userId: string,
    @Param("storyboardId") storyboardId: string,
    @Param("versionId") versionId: string,
  ) {
    await this.storyboardsService.ensureStoryboardAccess(storyboardId, userId);
    return this.versionsService.getVersionById(versionId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createCheckpoint(
    @CurrentUserId() userId: string,
    @Param("storyboardId") storyboardId: string,
    @Body() dto: CreateCheckpointDto,
  ) {
    await this.storyboardsService.ensureStoryboardAccess(storyboardId, userId);

    // Redis에서 현재 상태 읽어서 스냅샷 생성
    const state = await this.collaborationService.getRoomState(
      storyboardId,
      -1,
    );
    const content = state.content ?? {
      version: 1,
      viewport: { x: 0, y: 0, zoom: 1 },
      nodes: [],
      edges: [],
    };

    return this.versionsService.createSnapshot(
      storyboardId,
      content as Record<string, unknown>,
      state.version,
      dto.label,
      userId,
    );
  }

  @Post(":versionId/restore")
  @HttpCode(HttpStatus.CREATED)
  async restoreVersion(
    @CurrentUserId() userId: string,
    @Param("storyboardId") storyboardId: string,
    @Param("versionId") versionId: string,
  ) {
    await this.storyboardsService.ensureStoryboardAccess(storyboardId, userId);

    const { snapshot, contentVersion } =
      await this.versionsService.restoreVersion(
        storyboardId,
        versionId,
        userId,
      );

    // Redis 강제 재로드
    await this.collaborationService.initRoomFromDb(storyboardId, true);

    // 브로드캐스트
    const event: VersionRestoredEvent = {
      storyboardId,
      content: snapshot.content as Record<string, unknown>,
      contentVersion,
      restoredBy: userId,
    };
    this.eventEmitter.emit("version.restored", event);

    return snapshot;
  }

  @Delete(":versionId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteVersion(
    @CurrentUserId() userId: string,
    @Param("storyboardId") storyboardId: string,
    @Param("versionId") versionId: string,
  ) {
    await this.storyboardsService.ensureStoryboardAccess(storyboardId, userId);
    await this.versionsService.deleteVersion(versionId);
  }
}
```

- [ ] **Step 2: versions.module.ts 생성**

```ts
// apps/api/src/versions/versions.module.ts
import { Module } from "@nestjs/common";
import { VersionsController } from "./versions.controller";
import { VersionsService } from "./versions.service";
import { StoryboardsModule } from "../storyboards/storyboards.module";
import { CollaborationModule } from "../collaboration/collaboration.module";

@Module({
  imports: [StoryboardsModule, CollaborationModule],
  controllers: [VersionsController],
  providers: [VersionsService],
  exports: [VersionsService],
})
export class VersionsModule {}
```

- [ ] **Step 3: app.module.ts에 VersionsModule 추가**

`apps/api/src/app.module.ts`에서:

```ts
// 기존 import 목록에 추가
import { VersionsModule } from "./versions/versions.module";

// @Module imports 배열에 추가
VersionsModule,
```

- [ ] **Step 4: StoryboardsModule exports 확인**

`apps/api/src/storyboards/storyboards.module.ts`에 `exports: [StoryboardsService]` 있는지 확인. 없으면 추가:

```ts
@Module({
  controllers: [StoryboardsController],
  providers: [StoryboardsService],
  exports: [StoryboardsService], // 추가
})
export class StoryboardsModule {}
```

- [ ] **Step 5: CollaborationModule exports 확인**

`apps/api/src/collaboration/collaboration.module.ts`에 `exports: [CollaborationService]` 있는지 확인. 없으면 추가.

- [ ] **Step 6: initRoomFromDb에 forceReload 파라미터 추가**

`apps/api/src/collaboration/collaboration.service.ts`의 `initRoomFromDb` 시그니처 수정:

```ts
async initRoomFromDb(storyboardId: string, forceReload = false): Promise<number> {
  const storyboard = await this.storyboardsService.getStoryboardById(storyboardId);
  const dbVersion = storyboard.contentVersion;
  const redisVersion = await this.redis.getVersion(storyboardId);

  // forceReload=true면 항상 재로드 (복원 후 필수)
  if (!forceReload && redisVersion > 0 && redisVersion >= dbVersion) return redisVersion;

  await this.redis.clearRoom(storyboardId);
  // ... 이하 기존 코드 동일
```

- [ ] **Step 7: API 빌드 확인**

```bash
pnpm --filter api build 2>&1 | tail -20
```

Expected: 빌드 성공, 에러 없음.

- [ ] **Step 8: 커밋**

```bash
git add apps/api/src/versions/ apps/api/src/app.module.ts apps/api/src/storyboards/ apps/api/src/collaboration/collaboration.service.ts
git commit -m "feat: add VersionsController, VersionsModule, and forceReload to initRoomFromDb"
```

---

### Task 5: 자동 스냅샷 — flushStoryboard 연동

**Files:**

- Modify: `apps/api/src/collaboration/collaboration.service.ts`
- Modify: `apps/api/src/collaboration/collaboration.module.ts`

- [ ] **Step 1: CollaborationModule에 VersionsModule import**

`apps/api/src/collaboration/collaboration.module.ts`:

```ts
import { VersionsModule } from "../versions/versions.module";

@Module({
  imports: [VersionsModule, /* 기존 imports */],
  // ...
})
```

> **주의:** 순환 의존 방지 — VersionsModule은 CollaborationModule을 import하지 않는다.

- [ ] **Step 2: CollaborationService에 VersionsService 주입 + flushStoryboard 수정**

`apps/api/src/collaboration/collaboration.service.ts`:

```ts
// import 추가
import { VersionsService } from "../versions/versions.service";

// constructor 수정
constructor(
  private readonly redis: CollaborationRedisService,
  private readonly storyboardsService: StoryboardsService,
  private readonly versionsService: VersionsService, // 추가
) {}

// flushStoryboard 수정
async flushStoryboard(storyboardId: string): Promise<void> {
  const nodes = await this.redis.getAllNodes(storyboardId);
  const edges = await this.redis.getAllEdges(storyboardId);
  const version = await this.redis.getVersion(storyboardId);

  const content = {
    version: 1,
    viewport: { x: 0, y: 0, zoom: 1 },
    nodes,
    edges,
  };

  await this.storyboardsService.updateStoryboard(storyboardId, "system", {
    content: content as never,
    contentVersion: version - 1,
  });

  await this.redis.clearDirty(storyboardId);

  // 자동 스냅샷 트리거 (version % 10 === 0)
  if (version > 0 && version % 10 === 0) {
    try {
      await this.versionsService.createSnapshot(
        storyboardId,
        content as Record<string, unknown>,
        version - 1,
        null,
        "system",
      );
      await this.versionsService.pruneAutoVersions(storyboardId);
    } catch {
      // 스냅샷 실패가 flush를 막으면 안 됨
    }
  }
}
```

- [ ] **Step 3: 빌드 확인**

```bash
pnpm --filter api build 2>&1 | tail -10
```

Expected: 빌드 성공.

- [ ] **Step 4: 커밋**

```bash
git add apps/api/src/collaboration/
git commit -m "feat: auto-snapshot in flushStoryboard every 10 versions"
```

---

### Task 6: Gateway — room:restored 브로드캐스트

**Files:**

- Modify: `apps/api/src/collaboration/collaboration.gateway.ts`

- [ ] **Step 1: @OnEvent('version.restored') 핸들러 추가**

`apps/api/src/collaboration/collaboration.gateway.ts`에 추가:

```ts
// import 추가
import type { VersionRestoredEvent } from "@repo/types";

// class 내부에 추가
@OnEvent("version.restored")
handleVersionRestored(payload: VersionRestoredEvent) {
  this.server.to(payload.storyboardId).emit("room:restored", {
    content: payload.content,
    contentVersion: payload.contentVersion,
    restoredBy: payload.restoredBy,
  });
}
```

- [ ] **Step 2: API 빌드 + 타입 체크**

```bash
pnpm --filter api build 2>&1 | tail -10
pnpm check-types 2>&1 | grep -E "error|Error" | head -20
```

Expected: 에러 없음.

- [ ] **Step 3: 커밋**

```bash
git add apps/api/src/collaboration/collaboration.gateway.ts
git commit -m "feat: broadcast room:restored on version restore"
```

---

### Task 7: 공유 types + api-client 함수

**Files:**

- Modify: `apps/web/src/lib/api-client.ts`

- [ ] **Step 1: api-client.ts에 버전 API 함수 추가**

`apps/web/src/lib/api-client.ts` 하단에 추가:

```ts
// Version History
import type { VersionDto, VersionWithContentDto } from "@repo/types";

export async function listVersions(userId: string, storyboardId: string) {
  return apiClient<VersionDto[]>(`/api/storyboards/${storyboardId}/versions`, {
    userId,
  });
}

export async function getVersionById(
  userId: string,
  storyboardId: string,
  versionId: string,
) {
  return apiClient<VersionWithContentDto>(
    `/api/storyboards/${storyboardId}/versions/${versionId}`,
    { userId },
  );
}

export async function createCheckpoint(
  userId: string,
  storyboardId: string,
  label: string,
) {
  return apiClient<VersionDto>(`/api/storyboards/${storyboardId}/versions`, {
    method: "POST",
    body: { label },
    userId,
  });
}

export async function restoreVersion(
  userId: string,
  storyboardId: string,
  versionId: string,
) {
  return apiClient<VersionDto>(
    `/api/storyboards/${storyboardId}/versions/${versionId}/restore`,
    {
      method: "POST",
      userId,
    },
  );
}

export async function deleteVersion(
  userId: string,
  storyboardId: string,
  versionId: string,
) {
  return apiClient<void>(
    `/api/storyboards/${storyboardId}/versions/${versionId}`,
    {
      method: "DELETE",
      userId,
    },
  );
}
```

- [ ] **Step 2: 커밋**

```bash
git add apps/web/src/lib/api-client.ts
git commit -m "feat: add version history API client functions"
```

---

### Task 8: editor-store.ts — activeSidePanel 상태 추가

**Files:**

- Modify: `apps/web/src/stores/editor-store.ts`

- [ ] **Step 1: activeSidePanel + previewVersionId 추가**

`apps/web/src/stores/editor-store.ts`의 `EditorState` interface에 추가:

```ts
// interface EditorState에 추가
activeSidePanel: "comments" | "versions" | null;
previewVersionId: string | null;
setActiveSidePanel: (panel: "comments" | "versions" | null) => void;
setPreviewVersionId: (id: string | null) => void;
```

store 구현부에 추가:

```ts
// 초기값
activeSidePanel: null,
previewVersionId: null,

// 액션
setActiveSidePanel: (panel) => set({ activeSidePanel: panel }),
setPreviewVersionId: (id) => set({ previewVersionId: id }),
```

> **주의:** `activeSidePanel`은 `persist` 대상에서 제외 (persist partialize에 포함하지 않음).

- [ ] **Step 2: 타입 체크**

```bash
pnpm check-types 2>&1 | grep "editor-store" | head -10
```

Expected: 에러 없음.

- [ ] **Step 3: 커밋**

```bash
git add apps/web/src/stores/editor-store.ts
git commit -m "feat: add activeSidePanel and previewVersionId to editor store"
```

---

### Task 9: useVersions 훅

**Files:**

- Create: `apps/web/src/components/storyboard/versions/useVersions.ts`
- Create: `apps/web/src/components/storyboard/versions/__tests__/useVersions.test.ts`

- [ ] **Step 1: 테스트 파일 작성 (TDD)**

```ts
// apps/web/src/components/storyboard/versions/__tests__/useVersions.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useVersions } from "../useVersions";

vi.mock("@/lib/api-client", () => ({
  listVersions: vi.fn().mockResolvedValue([
    {
      id: "v1",
      storyboardId: "sb1",
      createdBy: "user1",
      label: null,
      contentVersion: 10,
      restoredFromId: null,
      metadata: { added: 3, removed: 0, modified: 1 },
      createdAt: "2026-04-10T14:00:00.000Z",
    },
  ]),
  restoreVersion: vi.fn().mockResolvedValue({ id: "v2" }),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/stores/editor-store", () => ({
  useEditorStore: () => ({
    setActiveSidePanel: vi.fn(),
    clearHistory: vi.fn(),
  }),
}));

describe("useVersions", () => {
  it("버전 목록을 로드한다", async () => {
    const { result } = renderHook(() =>
      useVersions({ storyboardId: "sb1", userId: "user1", socket: null }),
    );
    await waitFor(() => {
      expect(result.current.versions).toHaveLength(1);
      expect(result.current.versions[0]!.id).toBe("v1");
    });
  });

  it("초기 로딩 상태는 true", () => {
    const { result } = renderHook(() =>
      useVersions({ storyboardId: "sb1", userId: "user1", socket: null }),
    );
    expect(result.current.isLoading).toBe(true);
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
pnpm --filter web test -- --reporter=verbose 2>&1 | grep "useVersions" | head -10
```

Expected: import 에러로 실패.

- [ ] **Step 3: useVersions.ts 생성**

```ts
// apps/web/src/components/storyboard/versions/useVersions.ts
"use client";

import { useState, useEffect, useCallback } from "react";
import type { Socket } from "socket.io-client";
import type { VersionDto } from "@repo/types";
import {
  listVersions,
  createCheckpoint,
  restoreVersion as apiRestoreVersion,
  deleteVersion as apiDeleteVersion,
} from "@/lib/api-client";
import { useEditorStore } from "@/stores/editor-store";

interface UseVersionsOptions {
  storyboardId: string;
  userId: string;
  socket: Socket | null;
  onRestored?: (payload: {
    content: Record<string, unknown>;
    contentVersion: number;
    restoredBy: string;
  }) => void;
}

export function useVersions({
  storyboardId,
  userId,
  socket,
  onRestored,
}: UseVersionsOptions) {
  const [versions, setVersions] = useState<VersionDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { setActiveSidePanel } = useEditorStore();

  const fetchVersions = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await listVersions(userId, storyboardId);
      setVersions(data ?? []);
    } finally {
      setIsLoading(false);
    }
  }, [userId, storyboardId]);

  useEffect(() => {
    void fetchVersions();
  }, [fetchVersions]);

  // room:restored 소켓 이벤트 구독
  useEffect(() => {
    if (!socket) return;
    const handler = (payload: {
      content: Record<string, unknown>;
      contentVersion: number;
      restoredBy: string;
    }) => {
      onRestored?.(payload);
      void fetchVersions(); // 버전 목록 새로고침
      setActiveSidePanel(null);
    };
    socket.on("room:restored", handler);
    return () => {
      socket.off("room:restored", handler);
    };
  }, [socket, onRestored, fetchVersions, setActiveSidePanel]);

  const saveCheckpoint = useCallback(
    async (label: string) => {
      await createCheckpoint(userId, storyboardId, label);
      await fetchVersions();
    },
    [userId, storyboardId, fetchVersions],
  );

  const restore = useCallback(
    async (versionId: string) => {
      await apiRestoreVersion(userId, storyboardId, versionId);
      // 실제 UI 업데이트는 room:restored 소켓 이벤트가 처리
    },
    [userId, storyboardId],
  );

  const deleteVer = useCallback(
    async (versionId: string) => {
      await apiDeleteVersion(userId, storyboardId, versionId);
      await fetchVersions();
    },
    [userId, storyboardId, fetchVersions],
  );

  return {
    versions,
    isLoading,
    saveCheckpoint,
    restore,
    deleteVersion: deleteVer,
    refetch: fetchVersions,
  };
}
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

```bash
pnpm --filter web test -- --reporter=verbose 2>&1 | grep -E "useVersions|✓|✗" | head -20
```

Expected: 테스트 PASS.

- [ ] **Step 5: 커밋**

```bash
git add apps/web/src/components/storyboard/versions/
git commit -m "feat: add useVersions hook with socket room:restored subscription"
```

---

### Task 10: VersionPanel + SaveCheckpointDialog UI

**Files:**

- Create: `apps/web/src/components/storyboard/versions/VersionPanel.tsx`
- Create: `apps/web/src/components/storyboard/versions/SaveCheckpointDialog.tsx`

- [ ] **Step 1: SaveCheckpointDialog.tsx 생성**

```tsx
// apps/web/src/components/storyboard/versions/SaveCheckpointDialog.tsx
"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface SaveCheckpointDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (label: string) => Promise<void>;
}

export function SaveCheckpointDialog({
  open,
  onClose,
  onSave,
}: SaveCheckpointDialogProps) {
  const [label, setLabel] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!label.trim()) return;
    setIsSaving(true);
    try {
      await onSave(label.trim());
      setLabel("");
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>체크포인트 저장</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label htmlFor="checkpoint-label">이름</Label>
          <Input
            id="checkpoint-label"
            placeholder="예: v2.0 퀘스트 분기 확정"
            value={label}
            maxLength={100}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleSave();
            }}
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            취소
          </Button>
          <Button onClick={handleSave} disabled={!label.trim() || isSaving}>
            {isSaving ? "저장 중..." : "저장"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: VersionPanel.tsx 생성**

```tsx
// apps/web/src/components/storyboard/versions/VersionPanel.tsx
"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { X, Star, RotateCcw, Trash2, BookmarkPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { useEditorStore } from "@/stores/editor-store";
import { SaveCheckpointDialog } from "./SaveCheckpointDialog";
import type { VersionDto } from "@repo/types";

interface VersionPanelProps {
  versions: VersionDto[];
  isLoading: boolean;
  onSelectVersion: (versionId: string) => void;
  onRestore: (versionId: string) => Promise<void>;
  onDelete: (versionId: string) => Promise<void>;
  onSaveCheckpoint: (label: string) => Promise<void>;
}

export function VersionPanel({
  versions,
  isLoading,
  onSelectVersion,
  onRestore,
  onDelete,
  onSaveCheckpoint,
}: VersionPanelProps) {
  const { setActiveSidePanel } = useEditorStore();
  const [checkpointDialogOpen, setCheckpointDialogOpen] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  const handleRestoreConfirm = async () => {
    if (!restoreTarget) return;
    setIsRestoring(true);
    try {
      await onRestore(restoreTarget);
    } finally {
      setIsRestoring(false);
      setRestoreTarget(null);
    }
  };

  return (
    <div className="flex h-full w-72 flex-col border-l border-border bg-card">
      {/* 헤더 */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="text-sm font-semibold">버전 히스토리</span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setCheckpointDialogOpen(true)}
            title="체크포인트 저장"
          >
            <BookmarkPlus className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setActiveSidePanel(null)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* 버전 목록 */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
            로딩 중...
          </div>
        ) : versions.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <p>저장된 버전이 없습니다.</p>
            <p className="text-xs">편집 후 자동으로 저장됩니다.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {versions.map((v) => (
              <div
                key={v.id}
                className="group flex cursor-pointer flex-col gap-1 px-4 py-3 hover:bg-accent"
                onClick={() => onSelectVersion(v.id)}
              >
                <div className="flex items-center gap-1.5">
                  {v.label && (
                    <Star className="h-3 w-3 shrink-0 fill-amber-400 text-amber-400" />
                  )}
                  <span className="truncate text-sm font-medium">
                    {v.label ?? "자동저장"}
                  </span>
                  {v.restoredFromId && (
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                      복원됨
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(v.createdAt), "M월 d일 HH:mm", {
                      locale: ko,
                    })}
                  </span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      title="이 버전으로 복원"
                      onClick={(e) => {
                        e.stopPropagation();
                        setRestoreTarget(v.id);
                      }}
                    >
                      <RotateCcw className="h-3 w-3" />
                    </Button>
                    {v.label && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive"
                        title="삭제"
                        onClick={(e) => {
                          e.stopPropagation();
                          void onDelete(v.id);
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
                {v.metadata && (
                  <span className="text-xs text-muted-foreground">
                    +{v.metadata.added} -{v.metadata.removed}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* 복원 확인 다이얼로그 */}
      <AlertDialog
        open={!!restoreTarget}
        onOpenChange={(o) => !o && setRestoreTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>버전 복원</AlertDialogTitle>
            <AlertDialogDescription>
              이 버전으로 복원하면 현재 작업이 새 버전으로 저장된 뒤 선택한
              버전으로 되돌아갑니다. 협업 중인 팀원의 화면도 즉시 복원됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRestoring}>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRestoreConfirm}
              disabled={isRestoring}
            >
              {isRestoring ? "복원 중..." : "복원"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 체크포인트 저장 다이얼로그 */}
      <SaveCheckpointDialog
        open={checkpointDialogOpen}
        onClose={() => setCheckpointDialogOpen(false)}
        onSave={onSaveCheckpoint}
      />
    </div>
  );
}
```

- [ ] **Step 3: 커밋**

```bash
git add apps/web/src/components/storyboard/versions/VersionPanel.tsx apps/web/src/components/storyboard/versions/SaveCheckpointDialog.tsx
git commit -m "feat: add VersionPanel and SaveCheckpointDialog components"
```

---

### Task 11: VersionPreviewModal

**Files:**

- Create: `apps/web/src/components/storyboard/versions/VersionPreviewModal.tsx`

- [ ] **Step 1: VersionPreviewModal.tsx 생성**

```tsx
// apps/web/src/components/storyboard/versions/VersionPreviewModal.tsx
"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  ReactFlow,
  ReactFlowProvider,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { getVersionById } from "@/lib/api-client";
import { migrateContent } from "@/lib/content-migration";
import type { StoryboardContentV1 } from "@repo/types";
import { sceneNode } from "../nodes/scene-node";
import { eventNode } from "../nodes/event-node";
import { branchNode } from "../nodes/branch-node";
import { dialogueNode } from "../nodes/dialogue-node";
import { conditionNode } from "../nodes/condition-node";
import { noteNode } from "../nodes/note-node";

const nodeTypes = {
  scene: sceneNode,
  event: eventNode,
  branch: branchNode,
  dialogue: dialogueNode,
  condition: conditionNode,
  note: noteNode,
};

interface VersionPreviewModalProps {
  versionId: string | null;
  storyboardId: string;
  userId: string;
  onClose: () => void;
  onRestore: (versionId: string) => Promise<void>;
}

export function VersionPreviewModal({
  versionId,
  storyboardId,
  userId,
  onClose,
  onRestore,
}: VersionPreviewModalProps) {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  useEffect(() => {
    if (!versionId) return;
    setIsLoading(true);
    getVersionById(userId, storyboardId, versionId)
      .then((v) => {
        const content = migrateContent(v.content) as StoryboardContentV1;
        setNodes(
          (content.nodes ?? []).map((n) => ({
            id: n.id,
            type: n.type,
            position: n.position,
            data: n.data,
          })),
        );
        setEdges(
          (content.edges ?? []).map((e) => ({
            id: e.id,
            source: e.source,
            target: e.target,
            ...(e.sourceHandle ? { sourceHandle: e.sourceHandle } : {}),
            ...(e.label ? { label: e.label } : {}),
          })),
        );
      })
      .finally(() => setIsLoading(false));
  }, [versionId, userId, storyboardId]);

  const handleRestore = async () => {
    if (!versionId) return;
    setIsRestoring(true);
    try {
      await onRestore(versionId);
      onClose();
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <Dialog open={!!versionId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>버전 미리보기</DialogTitle>
        </DialogHeader>
        <div className="h-[60vh] rounded-md border border-border bg-background">
          {isLoading ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              로딩 중...
            </div>
          ) : (
            <ReactFlowProvider key={versionId}>
              <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                nodesDraggable={false}
                nodesConnectable={false}
                elementsSelectable={false}
                panOnDrag
                zoomOnScroll
                fitView
              />
            </ReactFlowProvider>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isRestoring}>
            닫기
          </Button>
          <Button onClick={handleRestore} disabled={isRestoring || isLoading}>
            {isRestoring ? "복원 중..." : "이 버전으로 복원"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: 커밋**

```bash
git add apps/web/src/components/storyboard/versions/VersionPreviewModal.tsx
git commit -m "feat: add VersionPreviewModal with read-only ReactFlow preview"
```

---

### Task 12: editor.tsx + toolbar.tsx + use-editor-shortcuts.ts 연결

**Files:**

- Modify: `apps/web/src/components/storyboard/editor.tsx`
- Modify: `apps/web/src/components/storyboard/panels/toolbar.tsx`
- Modify: `apps/web/src/components/storyboard/hooks/use-editor-shortcuts.ts`

- [ ] **Step 1: toolbar.tsx — 히스토리 버튼 추가**

`toolbar.tsx`에서 `ToolbarProps` interface 수정:

```ts
interface ToolbarProps {
  onAddNode: (type: StoryboardNodeType) => void;
  onOpenTemplates?: () => void;
  onToggleHistory?: () => void; // 추가 — storyboard 모드만
}
```

JSX 내 버튼 추가 (onOpenTemplates 버튼 옆에):

```tsx
{
  onToggleHistory && (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onToggleHistory}
      title="버전 히스토리 (H)"
    >
      <History className="h-4 w-4" />
      히스토리
    </Button>
  );
}
```

`import { ClipboardList, History } from "lucide-react";` 추가.

- [ ] **Step 2: use-editor-shortcuts.ts — H 키 추가**

`apps/web/src/components/storyboard/hooks/use-editor-shortcuts.ts`에서 keydown 핸들러 내부에 추가:

```ts
// 편집 중인 경우 단축키 차단
const target = e.target as HTMLElement;
const isEditing =
  target.tagName === "INPUT" ||
  target.tagName === "TEXTAREA" ||
  target.isContentEditable;
if (isEditing) return;

if (e.key === "h" || e.key === "H") {
  e.preventDefault();
  toggleHistory?.();
}
```

`useEditorShortcuts`의 options에 `toggleHistory?: () => void` 추가.

- [ ] **Step 3: editor.tsx — useVersions 연결 + 컴포넌트 렌더링**

`editor.tsx` 내 import 추가:

```ts
import { useVersions } from "./versions/useVersions";
import { VersionPanel } from "./versions/VersionPanel";
import { VersionPreviewModal } from "./versions/VersionPreviewModal";
import { toast } from "sonner";
```

`EditorInner` 컴포넌트 내부에 추가 (storyboard 모드 전용):

```ts
const {
  setActiveSidePanel,
  activeSidePanel,
  previewVersionId,
  setPreviewVersionId,
  clearHistory,
} = useEditorStore();

// room:restored 핸들러
const handleRestored = useCallback(
  (payload: {
    content: Record<string, unknown>;
    contentVersion: number;
    restoredBy: string;
  }) => {
    const migrated = migrateContent(payload.content) as StoryboardContentV1;
    const newNodes = migrated.nodes.map((n) => ({
      id: n.id,
      type: n.type,
      position: n.position,
      data: n.data,
    }));
    const newEdges = migrated.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      ...(e.sourceHandle ? { sourceHandle: e.sourceHandle } : {}),
      ...(e.label ? { label: e.label } : {}),
    }));
    isRemoteUpdateRef.current = true;
    setNodes(newNodes);
    setEdges(newEdges);
    nodesRef.current = newNodes;
    edgesRef.current = newEdges;
    isRemoteUpdateRef.current = false;
    clearHistory();
    toast.success("버전이 복원되었습니다.");
  },
  [setNodes, setEdges, clearHistory],
);

const {
  versions,
  isLoading: versionsLoading,
  saveCheckpoint,
  restore,
  deleteVersion,
} = useVersions({
  storyboardId: props.mode !== "blueprint" ? props.storyboardId : "",
  userId: props.mode !== "blueprint" ? props.userId : "",
  socket,
  onRestored: handleRestored,
});
```

JSX 렌더링에 추가:

```tsx
{
  /* 버전 패널 (storyboard 모드만) */
}
{
  props.mode !== "blueprint" && activeSidePanel === "versions" && (
    <VersionPanel
      versions={versions}
      isLoading={versionsLoading}
      onSelectVersion={(id) => setPreviewVersionId(id)}
      onRestore={restore}
      onDelete={deleteVersion}
      onSaveCheckpoint={saveCheckpoint}
    />
  );
}

{
  /* 버전 미리보기 모달 (storyboard 모드만) */
}
{
  props.mode !== "blueprint" && (
    <VersionPreviewModal
      versionId={previewVersionId}
      storyboardId={props.storyboardId}
      userId={props.userId}
      onClose={() => setPreviewVersionId(null)}
      onRestore={restore}
    />
  );
}
```

`Toolbar`에 `onToggleHistory` prop 전달:

```tsx
<Toolbar
  onAddNode={handleAddNode}
  onOpenTemplates={...}
  onToggleHistory={props.mode !== "blueprint"
    ? () => setActiveSidePanel(activeSidePanel === "versions" ? null : "versions")
    : undefined
  }
/>
```

`useEditorShortcuts`에 `toggleHistory` 전달:

```ts
useEditorShortcuts({
  // ... 기존 props
  toggleHistory:
    props.mode !== "blueprint"
      ? () =>
          setActiveSidePanel(activeSidePanel === "versions" ? null : "versions")
      : undefined,
});
```

- [ ] **Step 4: 타입 체크 + 빌드**

```bash
pnpm check-types 2>&1 | grep -E "error|Error" | head -20
pnpm --filter web build 2>&1 | tail -20
```

Expected: 에러 없음.

- [ ] **Step 5: 커밋**

```bash
git add apps/web/src/components/storyboard/
git commit -m "feat: integrate version history into editor — panel, shortcuts, room:restored"
```

---

### Task 13: 린트 + 빌드 최종 검증

- [ ] **Step 1: 전체 린트**

```bash
pnpm lint 2>&1 | grep -E "error|Error" | head -30
```

Expected: 에러 없음.

- [ ] **Step 2: 전체 타입 체크**

```bash
pnpm check-types 2>&1 | grep -E "error|Error" | head -30
```

Expected: 에러 없음.

- [ ] **Step 3: 전체 빌드**

```bash
pnpm build 2>&1 | tail -20
```

Expected: 빌드 성공.

- [ ] **Step 4: 테스트 실행**

```bash
pnpm --filter web test 2>&1 | tail -20
```

Expected: 모든 테스트 PASS.

- [ ] **Step 5: 최종 커밋**

```bash
git add -A
git commit -m "chore: version history final lint and build verification"
```
