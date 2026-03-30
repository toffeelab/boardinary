# Phase 2b: Blueprint Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 사용자가 자주 쓰는 요소/흐름을 "블루프린트"로 저장하고 재사용하는 시스템 구축

**Architecture:** DB에 `blueprints` 테이블 추가 (pgEnum + CHECK constraint), NestJS CRUD API, 에디터 사이드바에 블루프린트 탭 추가. 캔버스에서 선택 → 저장, 사이드바에서 클릭 → 삽입. 블루프린트 편집은 StoryboardEditor를 `mode="blueprint"`로 재사용.

**Tech Stack:** Drizzle ORM, NestJS, @xyflow/react, Zustand, shadcn/ui Dialog

**Spec:** `docs/superpowers/specs/2026-03-30-phase2b-blueprint-library.md`

---

## File Structure

### New Files

- `packages/db/drizzle/migrations/0002_add_blueprints.sql` — 마이그레이션
- `packages/types/src/blueprints.ts` — BlueprintDto, CreateBlueprintDto, UpdateBlueprintDto
- `apps/api/src/blueprints/blueprints.module.ts` — NestJS 모듈
- `apps/api/src/blueprints/blueprints.controller.ts` — REST 컨트롤러
- `apps/api/src/blueprints/blueprints.service.ts` — 비즈니스 로직
- `apps/api/src/blueprints/dto/create-blueprint.dto.ts` — 생성 DTO
- `apps/api/src/blueprints/dto/update-blueprint.dto.ts` — 수정 DTO
- `apps/web/src/actions/blueprint-actions.ts` — Server Actions
- `apps/web/src/components/storyboard/panels/blueprint-panel.tsx` — 사이드바 블루프린트 탭
- `apps/web/src/components/storyboard/panels/save-blueprint-dialog.tsx` — 저장 다이얼로그
- `apps/web/src/components/storyboard/hooks/use-blueprint-actions.ts` — 저장/삽입 로직
- `apps/web/src/app/dashboard/[orgSlug]/blueprints/[id]/edit/page.tsx` — 편집 페이지
- `apps/web/src/lib/__tests__/blueprint-utils.test.ts` — 유닛 테스트

### Modified Files

- `packages/db/src/schema.ts` — blueprints 테이블 + enum 추가
- `packages/types/src/index.ts` — blueprints export 추가
- `apps/api/src/app.module.ts` — BlueprintsModule import
- `apps/web/src/components/storyboard/editor.tsx` — mode prop + 블루프린트 탭/저장 통합
- `apps/web/src/components/storyboard/panels/node-list-panel.tsx` — 탭 UI (요소/블루프린트)
- `apps/web/src/components/storyboard/panels/context-menu.tsx` — "블루프린트로 저장" 메뉴 항목
- `apps/web/src/components/storyboard/hooks/use-editor-shortcuts.ts` — Ctrl+Shift+S 단축키
- `apps/web/src/stores/editor-store.ts` — 블루프린트 탭 상태
- `apps/web/src/lib/api-client.ts` — 블루프린트 API 함수

---

### Task 1: DB 스키마 + 마이그레이션

**Files:**

- Modify: `packages/db/src/schema.ts`
- Create: `packages/db/drizzle/migrations/0002_add_blueprints.sql`

- [ ] **Step 1: schema.ts에 pgEnum + blueprints 테이블 추가**

```ts
// packages/db/src/schema.ts 하단에 추가

export const blueprintTypeEnum = pgEnum("blueprint_type", [
  "preset",
  "flow",
  "template",
]);

export const blueprintScopeEnum = pgEnum("blueprint_scope", [
  "personal",
  "organization",
  "project",
]);

export const blueprints = pgTable(
  "blueprints",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    type: blueprintTypeEnum("type").notNull(),
    scope: blueprintScopeEnum("scope").notNull(),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    orgId: text("org_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    projectId: text("project_id").references(() => projects.id, {
      onDelete: "cascade",
    }),
    name: text("name").notNull(),
    description: text("description"),
    content: jsonb("content").notNull().default({}),
    contentVersion: integer("content_version").notNull().default(1),
    tags: text("tags")
      .array()
      .default(sql`'{}'::text[]`),
    icon: text("icon"),
    color: text("color"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_blueprints_personal").on(table.createdBy),
    index("idx_blueprints_org").on(table.orgId, table.type),
    index("idx_blueprints_tags").using("gin", table.tags),
  ],
);
```

- [ ] **Step 2: 마이그레이션 SQL 생성**

Run: `cd packages/db && pnpm db:generate`

수동으로 생성된 SQL에 CHECK constraint + trigger를 추가:

```sql
-- 0002_add_blueprints.sql 끝에 추가
ALTER TABLE blueprints ADD CONSTRAINT chk_blueprints_scope CHECK (
  (scope = 'personal'     AND org_id IS NULL     AND project_id IS NULL) OR
  (scope = 'organization' AND org_id IS NOT NULL AND project_id IS NULL) OR
  (scope = 'project'      AND org_id IS NOT NULL AND project_id IS NOT NULL)
);

ALTER TABLE blueprints ADD CONSTRAINT chk_blueprints_name_length
  CHECK (char_length(name) BETWEEN 1 AND 200);

CREATE TRIGGER trg_blueprints_updated_at
  BEFORE UPDATE ON blueprints
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

- [ ] **Step 3: 마이그레이션 실행 + 검증**

Run: `pnpm --filter @repo/db db:migrate`
Run: `pnpm --filter @repo/db build`

- [ ] **Step 4: 커밋**

```bash
git add packages/db/
git commit -m "feat: add blueprints table with pgEnum, CHECK constraints, and indexes"
```

---

### Task 2: 타입 정의

**Files:**

- Create: `packages/types/src/blueprints.ts`
- Modify: `packages/types/src/index.ts`

- [ ] **Step 1: BlueprintDto 타입 생성**

```ts
// packages/types/src/blueprints.ts

export interface BlueprintDto {
  id: string;
  type: "preset" | "flow" | "template";
  scope: "personal" | "organization" | "project";
  createdBy: string;
  orgId: string | null;
  projectId: string | null;
  name: string;
  description: string | null;
  content: Record<string, unknown>;
  contentVersion: number;
  tags: string[] | null;
  icon: string | null;
  color: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BlueprintMetaDto extends Omit<BlueprintDto, "content"> {}

export interface CreateBlueprintDto {
  type: "preset" | "flow";
  scope: "personal" | "organization";
  orgId?: string;
  name: string;
  description?: string;
  content: Record<string, unknown>;
  tags?: string[];
  icon?: string;
  color?: string;
}

export interface UpdateBlueprintDto {
  name?: string;
  description?: string;
  content?: Record<string, unknown>;
  tags?: string[];
  icon?: string;
  color?: string;
}
```

- [ ] **Step 2: index.ts에 export 추가**

```ts
// packages/types/src/index.ts 에 추가
export * from "./blueprints";
```

- [ ] **Step 3: 커밋**

```bash
git add packages/types/
git commit -m "feat: add Blueprint type definitions"
```

---

### Task 3: NestJS 백엔드 — BlueprintsModule

**Files:**

- Create: `apps/api/src/blueprints/dto/create-blueprint.dto.ts`
- Create: `apps/api/src/blueprints/dto/update-blueprint.dto.ts`
- Create: `apps/api/src/blueprints/blueprints.service.ts`
- Create: `apps/api/src/blueprints/blueprints.controller.ts`
- Create: `apps/api/src/blueprints/blueprints.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: DTO 생성**

```ts
// apps/api/src/blueprints/dto/create-blueprint.dto.ts
import { IsString, IsOptional, IsIn, IsArray, IsObject } from "class-validator";

export class CreateBlueprintDto {
  @IsIn(["preset", "flow"])
  type: "preset" | "flow";

  @IsIn(["personal", "organization"])
  scope: "personal" | "organization";

  @IsOptional()
  @IsString()
  orgId?: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsObject()
  content: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsString()
  color?: string;
}
```

```ts
// apps/api/src/blueprints/dto/update-blueprint.dto.ts
import { IsString, IsOptional, IsArray, IsObject } from "class-validator";

export class UpdateBlueprintDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsObject()
  content?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsString()
  color?: string;
}
```

- [ ] **Step 2: BlueprintsService 생성**

```ts
// apps/api/src/blueprints/blueprints.service.ts
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { db } from "@repo/db";
import { blueprints } from "@repo/db/schema";
import { eq, and, or } from "drizzle-orm";
import { CreateBlueprintDto } from "./dto/create-blueprint.dto";
import { UpdateBlueprintDto } from "./dto/update-blueprint.dto";

@Injectable()
export class BlueprintsService {
  async getBlueprints(userId: string, scope: string, orgId?: string) {
    if (scope === "personal") {
      return db
        .select({
          id: blueprints.id,
          type: blueprints.type,
          scope: blueprints.scope,
          createdBy: blueprints.createdBy,
          orgId: blueprints.orgId,
          projectId: blueprints.projectId,
          name: blueprints.name,
          description: blueprints.description,
          contentVersion: blueprints.contentVersion,
          tags: blueprints.tags,
          icon: blueprints.icon,
          color: blueprints.color,
          createdAt: blueprints.createdAt,
          updatedAt: blueprints.updatedAt,
        })
        .from(blueprints)
        .where(
          and(
            eq(blueprints.createdBy, userId),
            eq(blueprints.scope, "personal"),
          ),
        )
        .orderBy(blueprints.updatedAt);
    }

    if (scope === "organization" && orgId) {
      return db
        .select({
          id: blueprints.id,
          type: blueprints.type,
          scope: blueprints.scope,
          createdBy: blueprints.createdBy,
          orgId: blueprints.orgId,
          projectId: blueprints.projectId,
          name: blueprints.name,
          description: blueprints.description,
          contentVersion: blueprints.contentVersion,
          tags: blueprints.tags,
          icon: blueprints.icon,
          color: blueprints.color,
          createdAt: blueprints.createdAt,
          updatedAt: blueprints.updatedAt,
        })
        .from(blueprints)
        .where(
          and(
            eq(blueprints.orgId, orgId),
            eq(blueprints.scope, "organization"),
          ),
        )
        .orderBy(blueprints.updatedAt);
    }

    return [];
  }

  async getBlueprintById(id: string) {
    const rows = await db
      .select()
      .from(blueprints)
      .where(eq(blueprints.id, id))
      .limit(1);

    if (rows.length === 0) {
      throw new NotFoundException("Blueprint not found");
    }

    return rows[0];
  }

  async createBlueprint(userId: string, dto: CreateBlueprintDto) {
    const rows = await db
      .insert(blueprints)
      .values({
        type: dto.type,
        scope: dto.scope,
        createdBy: userId,
        orgId: dto.scope === "organization" ? dto.orgId : null,
        projectId: null,
        name: dto.name,
        description: dto.description ?? null,
        content: dto.content,
        tags: dto.tags ?? [],
        icon: dto.icon ?? null,
        color: dto.color ?? null,
      })
      .returning();

    return rows[0];
  }

  async updateBlueprint(id: string, userId: string, dto: UpdateBlueprintDto) {
    const existing = await this.getBlueprintById(id);

    // personal scope: 본인만 수정 가능
    if (existing.scope === "personal" && existing.createdBy !== userId) {
      throw new ForbiddenException("Cannot edit another user's blueprint");
    }

    const updateData: Record<string, unknown> = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.content !== undefined) updateData.content = dto.content;
    if (dto.tags !== undefined) updateData.tags = dto.tags;
    if (dto.icon !== undefined) updateData.icon = dto.icon;
    if (dto.color !== undefined) updateData.color = dto.color;

    if (Object.keys(updateData).length === 0) return existing;

    const rows = await db
      .update(blueprints)
      .set(updateData)
      .where(eq(blueprints.id, id))
      .returning();

    return rows[0];
  }

  async deleteBlueprint(id: string, userId: string) {
    const existing = await this.getBlueprintById(id);

    if (existing.scope === "personal" && existing.createdBy !== userId) {
      throw new ForbiddenException("Cannot delete another user's blueprint");
    }

    await db.delete(blueprints).where(eq(blueprints.id, id));
    return { success: true };
  }
}
```

- [ ] **Step 3: BlueprintsController 생성**

```ts
// apps/api/src/blueprints/blueprints.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
} from "@nestjs/common";
import { InternalAuthGuard } from "../auth/internal-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { BlueprintsService } from "./blueprints.service";
import { CreateBlueprintDto } from "./dto/create-blueprint.dto";
import { UpdateBlueprintDto } from "./dto/update-blueprint.dto";

@Controller("blueprints")
@UseGuards(InternalAuthGuard)
export class BlueprintsController {
  constructor(private readonly blueprintsService: BlueprintsService) {}

  @Get()
  async getBlueprints(
    @CurrentUser() userId: string,
    @Query("scope") scope: string,
    @Query("orgId") orgId?: string,
  ) {
    return this.blueprintsService.getBlueprints(userId, scope, orgId);
  }

  @Get(":id")
  async getBlueprint(@Param("id") id: string) {
    return this.blueprintsService.getBlueprintById(id);
  }

  @Post()
  async createBlueprint(
    @CurrentUser() userId: string,
    @Body() dto: CreateBlueprintDto,
  ) {
    return this.blueprintsService.createBlueprint(userId, dto);
  }

  @Patch(":id")
  async updateBlueprint(
    @CurrentUser() userId: string,
    @Param("id") id: string,
    @Body() dto: UpdateBlueprintDto,
  ) {
    return this.blueprintsService.updateBlueprint(id, userId, dto);
  }

  @Delete(":id")
  async deleteBlueprint(
    @CurrentUser() userId: string,
    @Param("id") id: string,
  ) {
    return this.blueprintsService.deleteBlueprint(id, userId);
  }
}
```

- [ ] **Step 4: BlueprintsModule + AppModule 등록**

```ts
// apps/api/src/blueprints/blueprints.module.ts
import { Module } from "@nestjs/common";
import { BlueprintsController } from "./blueprints.controller";
import { BlueprintsService } from "./blueprints.service";

@Module({
  controllers: [BlueprintsController],
  providers: [BlueprintsService],
})
export class BlueprintsModule {}
```

```ts
// apps/api/src/app.module.ts — imports 배열에 추가
import { BlueprintsModule } from "./blueprints/blueprints.module";

@Module({
  imports: [
    AuthModule,
    OrganizationsModule,
    ProjectsModule,
    StoryboardsModule,
    UsersModule,
    BlueprintsModule, // 추가
  ],
  controllers: [HealthController],
})
export class AppModule {}
```

- [ ] **Step 5: 빌드 검증 + 커밋**

Run: `pnpm --filter @repo/db build && pnpm --filter api build`

```bash
git add apps/api/src/blueprints/ apps/api/src/app.module.ts
git commit -m "feat: add NestJS blueprints CRUD API"
```

---

### Task 4: Server Actions + API 클라이언트

**Files:**

- Modify: `apps/web/src/lib/api-client.ts`
- Create: `apps/web/src/actions/blueprint-actions.ts`

- [ ] **Step 1: api-client.ts에 블루프린트 함수 추가**

```ts
// apps/web/src/lib/api-client.ts 에 추가

export async function getBlueprints(
  scope: "personal" | "organization",
  orgId?: string,
) {
  const params = new URLSearchParams({ scope });
  if (orgId) params.set("orgId", orgId);
  return apiClient<BlueprintMetaDto[]>(`/blueprints?${params}`);
}

export async function getBlueprintById(id: string) {
  return apiClient<BlueprintDto>(`/blueprints/${id}`);
}

export async function createBlueprint(data: CreateBlueprintDto) {
  return apiClient<BlueprintDto>("/blueprints", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateBlueprint(id: string, data: UpdateBlueprintDto) {
  return apiClient<BlueprintDto>(`/blueprints/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteBlueprint(id: string) {
  return apiClient<{ success: boolean }>(`/blueprints/${id}`, {
    method: "DELETE",
  });
}
```

- [ ] **Step 2: Server Actions 생성**

```ts
// apps/web/src/actions/blueprint-actions.ts
"use server";

import { getCurrentUserId } from "@/lib/auth";
import {
  getBlueprints as apiFetchBlueprints,
  getBlueprintById as apiFetchBlueprint,
  createBlueprint as apiCreateBlueprint,
  updateBlueprint as apiUpdateBlueprint,
  deleteBlueprint as apiDeleteBlueprint,
} from "@/lib/api-client";
import type { CreateBlueprintDto, UpdateBlueprintDto } from "@repo/types";

export async function fetchBlueprints(
  scope: "personal" | "organization",
  orgId?: string,
) {
  await getCurrentUserId();
  return apiFetchBlueprints(scope, orgId);
}

export async function fetchBlueprintById(id: string) {
  await getCurrentUserId();
  return apiFetchBlueprint(id);
}

export async function saveBlueprint(data: CreateBlueprintDto) {
  await getCurrentUserId();
  return apiCreateBlueprint(data);
}

export async function editBlueprint(id: string, data: UpdateBlueprintDto) {
  await getCurrentUserId();
  return apiUpdateBlueprint(id, data);
}

export async function removeBlueprint(id: string) {
  await getCurrentUserId();
  return apiDeleteBlueprint(id);
}
```

- [ ] **Step 3: 커밋**

```bash
git add apps/web/src/lib/api-client.ts apps/web/src/actions/blueprint-actions.ts
git commit -m "feat: add blueprint Server Actions and API client functions"
```

---

### Task 5: 블루프린트 유틸 + 테스트

**Files:**

- Create: `apps/web/src/lib/blueprint-utils.ts`
- Create: `apps/web/src/lib/__tests__/blueprint-utils.test.ts`

- [ ] **Step 1: 블루프린트 유틸 생성**

```ts
// apps/web/src/lib/blueprint-utils.ts
import type { Node, Edge } from "@xyflow/react";
import { createId } from "@paralleldrive/cuid2";

/**
 * 선택된 노드들과 관련 엣지를 블루프린트 content로 변환.
 * 노드 위치를 상대좌표(0,0 기준)로 변환하고, ID를 재생성.
 */
export function extractBlueprintContent(
  selectedNodes: Node[],
  allEdges: Edge[],
): { nodes: Node[]; edges: Edge[] } {
  if (selectedNodes.length === 0) return { nodes: [], edges: [] };

  const selectedIds = new Set(selectedNodes.map((n) => n.id));

  // 바운딩 박스 계산 → 상대좌표 변환
  const minX = Math.min(...selectedNodes.map((n) => n.position.x));
  const minY = Math.min(...selectedNodes.map((n) => n.position.y));

  // ID 매핑 (원본 → 새 ID)
  const idMap = new Map<string, string>();
  selectedNodes.forEach((n) => idMap.set(n.id, createId()));

  const nodes = selectedNodes.map((n) => ({
    ...n,
    id: idMap.get(n.id)!,
    position: {
      x: n.position.x - minX,
      y: n.position.y - minY,
    },
    selected: false,
    parentId:
      n.parentId && idMap.has(n.parentId) ? idMap.get(n.parentId) : undefined,
  }));

  // 선택된 노드 사이의 엣지만 포함
  const edges = allEdges
    .filter((e) => selectedIds.has(e.source) && selectedIds.has(e.target))
    .map((e) => ({
      ...e,
      id: createId(),
      source: idMap.get(e.source)!,
      target: idMap.get(e.target)!,
      selected: false,
    }));

  return { nodes, edges };
}

/**
 * 블루프린트 content를 캔버스에 삽입할 수 있는 노드/엣지로 변환.
 * ID를 새로 생성하고, offset 위치에 배치.
 */
export function instantiateBlueprint(
  content: { nodes: Node[]; edges: Edge[] },
  offset: { x: number; y: number },
): { nodes: Node[]; edges: Edge[] } {
  if (!content.nodes || content.nodes.length === 0) {
    return { nodes: [], edges: [] };
  }

  const idMap = new Map<string, string>();
  content.nodes.forEach((n) => idMap.set(n.id, createId()));

  const nodes = content.nodes.map((n) => ({
    ...n,
    id: idMap.get(n.id)!,
    position: {
      x: n.position.x + offset.x,
      y: n.position.y + offset.y,
    },
    selected: false,
    parentId:
      n.parentId && idMap.has(n.parentId) ? idMap.get(n.parentId) : undefined,
  }));

  const edges = (content.edges ?? []).map((e) => ({
    ...e,
    id: createId(),
    source: idMap.get(e.source) ?? e.source,
    target: idMap.get(e.target) ?? e.target,
    selected: false,
  }));

  return { nodes, edges };
}

/**
 * 선택된 노드 수에 따라 자동 타입 감지
 */
export function detectBlueprintType(nodeCount: number): "preset" | "flow" {
  return nodeCount <= 1 ? "preset" : "flow";
}
```

- [ ] **Step 2: 테스트 작성**

```ts
// apps/web/src/lib/__tests__/blueprint-utils.test.ts
import { describe, it, expect } from "vitest";
import {
  extractBlueprintContent,
  instantiateBlueprint,
  detectBlueprintType,
} from "../blueprint-utils";
import type { Node, Edge } from "@xyflow/react";

const makeNode = (id: string, x: number, y: number, type = "scene"): Node => ({
  id,
  type,
  position: { x, y },
  data: { title: `Node ${id}`, description: "" },
});

const makeEdge = (id: string, source: string, target: string): Edge => ({
  id,
  source,
  target,
});

describe("extractBlueprintContent", () => {
  it("빈 선택 → 빈 결과", () => {
    const result = extractBlueprintContent([], []);
    expect(result.nodes).toHaveLength(0);
    expect(result.edges).toHaveLength(0);
  });

  it("단일 노드 → preset (위치 0,0으로 정규화)", () => {
    const nodes = [makeNode("a", 100, 200)];
    const result = extractBlueprintContent(nodes, []);
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].position).toEqual({ x: 0, y: 0 });
    expect(result.nodes[0].id).not.toBe("a"); // 새 ID
  });

  it("다중 노드 → flow (상대좌표 변환 + 엣지 포함)", () => {
    const nodes = [makeNode("a", 100, 100), makeNode("b", 300, 200)];
    const edges = [
      makeEdge("e1", "a", "b"),
      makeEdge("e2", "a", "external"), // 외부 연결 → 제외
    ];
    const result = extractBlueprintContent(nodes, edges);
    expect(result.nodes).toHaveLength(2);
    expect(result.nodes[0].position).toEqual({ x: 0, y: 0 });
    expect(result.nodes[1].position).toEqual({ x: 200, y: 100 });
    expect(result.edges).toHaveLength(1); // 내부 엣지만
    expect(result.edges[0].source).toBe(result.nodes[0].id);
    expect(result.edges[0].target).toBe(result.nodes[1].id);
  });

  it("parentId가 선택 내 → 재매핑", () => {
    const parent = makeNode("p", 0, 0, "group");
    const child = { ...makeNode("c", 10, 10), parentId: "p" };
    const result = extractBlueprintContent([parent, child], []);
    expect(result.nodes[1].parentId).toBe(result.nodes[0].id);
  });

  it("parentId가 선택 외 → undefined", () => {
    const child = { ...makeNode("c", 10, 10), parentId: "external-parent" };
    const result = extractBlueprintContent([child], []);
    expect(result.nodes[0].parentId).toBeUndefined();
  });
});

describe("instantiateBlueprint", () => {
  it("빈 content → 빈 결과", () => {
    const result = instantiateBlueprint(
      { nodes: [], edges: [] },
      { x: 0, y: 0 },
    );
    expect(result.nodes).toHaveLength(0);
  });

  it("offset 적용 + 새 ID 생성", () => {
    const content = {
      nodes: [makeNode("a", 0, 0), makeNode("b", 200, 100)],
      edges: [makeEdge("e1", "a", "b")],
    };
    const result = instantiateBlueprint(content, { x: 500, y: 300 });
    expect(result.nodes[0].position).toEqual({ x: 500, y: 300 });
    expect(result.nodes[1].position).toEqual({ x: 700, y: 400 });
    expect(result.nodes[0].id).not.toBe("a");
    expect(result.edges[0].source).toBe(result.nodes[0].id);
    expect(result.edges[0].target).toBe(result.nodes[1].id);
  });
});

describe("detectBlueprintType", () => {
  it("0 또는 1개 → preset", () => {
    expect(detectBlueprintType(0)).toBe("preset");
    expect(detectBlueprintType(1)).toBe("preset");
  });

  it("2개 이상 → flow", () => {
    expect(detectBlueprintType(2)).toBe("flow");
    expect(detectBlueprintType(10)).toBe("flow");
  });
});
```

- [ ] **Step 3: 테스트 실행**

Run: `pnpm --filter web test`
Expected: 모든 테스트 통과

- [ ] **Step 4: 커밋**

```bash
git add apps/web/src/lib/blueprint-utils.ts apps/web/src/lib/__tests__/blueprint-utils.test.ts
git commit -m "feat: add blueprint extraction/instantiation utils with tests"
```

---

### Task 6: 블루프린트 저장 다이얼로그

**Files:**

- Create: `apps/web/src/components/storyboard/panels/save-blueprint-dialog.tsx`
- Modify: `apps/web/src/components/storyboard/panels/context-menu.tsx`

- [ ] **Step 1: SaveBlueprintDialog 컴포넌트 생성**

shadcn/ui Dialog 사용. 이름, 설명, 공유범위(personal/organization), 태그 입력 폼.
타입은 선택된 노드 수로 자동 감지. 제출 시 `saveBlueprint` Server Action 호출.

- [ ] **Step 2: context-menu.tsx에 "블루프린트로 저장" 메뉴 항목 추가**

기존 정렬/분배/그룹 메뉴 아래에 Separator + "블루프린트로 저장" 항목 추가.
클릭 시 SaveBlueprintDialog 오픈.

- [ ] **Step 3: 커밋**

```bash
git add apps/web/src/components/storyboard/panels/save-blueprint-dialog.tsx apps/web/src/components/storyboard/panels/context-menu.tsx
git commit -m "feat: add save-as-blueprint dialog and context menu item"
```

---

### Task 7: 사이드바 블루프린트 탭

**Files:**

- Create: `apps/web/src/components/storyboard/panels/blueprint-panel.tsx`
- Modify: `apps/web/src/components/storyboard/panels/node-list-panel.tsx`
- Modify: `apps/web/src/stores/editor-store.ts`
- Modify: `apps/web/src/components/storyboard/editor.tsx`

- [ ] **Step 1: editor-store.ts에 블루프린트 탭 상태 추가**

```ts
// editor-store.ts에 추가
leftPanelTab: "elements" | "blueprints";
setLeftPanelTab: (tab: "elements" | "blueprints") => void;
```

- [ ] **Step 2: BlueprintPanel 컴포넌트 생성**

내 블루프린트 + 조직 블루프린트 목록 표시. scope별 그룹. 각 항목에 이름, 타입 뱃지, 설명.
클릭 → `instantiateBlueprint()` → 캔버스에 삽입.
"편집" 버튼 → `/dashboard/[orgSlug]/blueprints/[id]/edit`로 이동.
"삭제" 버튼 → 확인 후 `removeBlueprint()` 호출.

- [ ] **Step 3: node-list-panel.tsx에 탭 UI 추가**

패널 상단에 "요소" | "블루프린트" 탭 버튼. 선택된 탭에 따라 NodeListPanel 내용 또는 BlueprintPanel 렌더링.

- [ ] **Step 4: editor.tsx에 블루프린트 삽입 핸들러 통합**

BlueprintPanel의 onInsert 콜백을 editor.tsx에서 처리. `instantiateBlueprint()`로 노드/엣지 생성 → `setNodes`/`setEdges`에 추가 → 히스토리에 기록 → 자동저장 트리거.

- [ ] **Step 5: 커밋**

```bash
git add apps/web/src/components/storyboard/panels/blueprint-panel.tsx apps/web/src/components/storyboard/panels/node-list-panel.tsx apps/web/src/stores/editor-store.ts apps/web/src/components/storyboard/editor.tsx
git commit -m "feat: add blueprint panel tab in sidebar with insert functionality"
```

---

### Task 8: Ctrl+Shift+S 단축키 + 에디터 통합

**Files:**

- Modify: `apps/web/src/components/storyboard/hooks/use-editor-shortcuts.ts`
- Modify: `apps/web/src/components/storyboard/editor.tsx`

- [ ] **Step 1: use-editor-shortcuts.ts에 Ctrl+Shift+S 추가**

```ts
// Ctrl+Shift+S → "블루프린트로 저장" 다이얼로그 열기
if (e.ctrlKey && e.shiftKey && e.key === "S") {
  e.preventDefault();
  onSaveAsBlueprint?.();
}
```

- [ ] **Step 2: editor.tsx에 다이얼로그 상태 + 콜백 연결**

`useState`로 `isSaveBlueprintOpen` 관리. 선택된 노드들을 `extractBlueprintContent()`로 변환하여 다이얼로그에 전달. 저장 완료 시 블루프린트 목록 리프레시.

- [ ] **Step 3: 커밋**

```bash
git add apps/web/src/components/storyboard/hooks/use-editor-shortcuts.ts apps/web/src/components/storyboard/editor.tsx
git commit -m "feat: add Ctrl+Shift+S shortcut for save-as-blueprint"
```

---

### Task 9: 블루프린트 편집 페이지

**Files:**

- Create: `apps/web/src/app/dashboard/[orgSlug]/blueprints/[id]/edit/page.tsx`
- Modify: `apps/web/src/components/storyboard/editor.tsx`

- [ ] **Step 1: 편집 페이지 생성**

Server Component. `fetchBlueprintById(id)` → `StoryboardEditor`에 `mode="blueprint"` + `blueprintId` + `initialContent` 전달.

```tsx
// apps/web/src/app/dashboard/[orgSlug]/blueprints/[id]/edit/page.tsx
import { fetchBlueprintById } from "@/actions/blueprint-actions";
import { StoryboardEditor } from "@/components/storyboard/editor";
import { notFound } from "next/navigation";

export default async function BlueprintEditPage({
  params,
}: {
  params: Promise<{ orgSlug: string; id: string }>;
}) {
  const { orgSlug, id } = await params;
  let blueprint;
  try {
    blueprint = await fetchBlueprintById(id);
  } catch {
    notFound();
  }

  return (
    <div className="flex h-full flex-col">
      <StoryboardEditor
        mode="blueprint"
        blueprintId={blueprint.id}
        blueprintName={blueprint.name}
        initialContent={blueprint.content as Record<string, unknown>}
        contentVersion={blueprint.contentVersion}
      />
    </div>
  );
}
```

- [ ] **Step 2: editor.tsx에 mode prop 분기 추가**

```ts
interface StoryboardEditorProps {
  // 기존 props...
  mode?: "storyboard" | "blueprint";
  blueprintId?: string;
  blueprintName?: string;
}
```

mode="blueprint"일 때:

- 헤더에 "블루프린트 편집 중: {name}" 표시
- 자동저장 대상을 `editBlueprint(blueprintId, { content })` 로 변경
- 사이드바 블루프린트 탭 비활성화 (편집 중인 블루프린트 자체)
- "뒤로가기" 버튼 → 이전 페이지로 돌아가기

- [ ] **Step 3: 커밋**

```bash
git add apps/web/src/app/dashboard/[orgSlug]/blueprints/ apps/web/src/components/storyboard/editor.tsx
git commit -m "feat: add blueprint edit page reusing StoryboardEditor with mode=blueprint"
```

---

### Task 10: 전체 검증

- [ ] **Step 1: 유닛 테스트**

Run: `pnpm --filter web test`
Expected: 기존 30 + 새 8+ = 38+ 테스트 통과

- [ ] **Step 2: 빌드 검증**

Run: `pnpm build`
Expected: 전체 빌드 성공

- [ ] **Step 3: 타입 체크**

Run: `pnpm check-types`
Expected: 성공

- [ ] **Step 4: 최종 커밋 (필요 시)**

```bash
git add -A
git commit -m "fix: address build/type issues from Phase 2b integration"
```
