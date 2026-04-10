# Comments & Feedback 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 스토리보드 노드/캔버스에 주석을 달고, 실시간으로 팀원과 공유하며, 스레드형 답글과 해결 상태를 관리한다.

**Architecture:** `packages/db`에 `comments` / `comment_replies` 테이블 추가 → `apps/api`에 `CommentsModule` 신규 생성 (REST 7 엔드포인트 + Socket.io 6 이벤트 브로드캐스트) → `apps/web`에 `comments/` 컴포넌트 폴더 신규 생성 후 기존 `editor.tsx` / `editor-store.ts` / `toolbar.tsx` / `canvas.tsx`에 최소 수정.

**Tech Stack:** Drizzle ORM (PostgreSQL), NestJS, Socket.io, React 19, ReactFlow, Zustand, Vitest

---

## 파일 맵

### 신규 생성

| 파일                                                                        | 역할                                              |
| --------------------------------------------------------------------------- | ------------------------------------------------- |
| `packages/db/src/comments-schema.ts`                                        | comments / comment_replies Drizzle 스키마         |
| `packages/types/src/comments.ts`                                            | 공유 타입 (CommentDto, ReplyDto, CommentEvent 등) |
| `apps/api/src/comments/comments.module.ts`                                  | NestJS 모듈                                       |
| `apps/api/src/comments/comments.controller.ts`                              | REST 7 엔드포인트                                 |
| `apps/api/src/comments/comments.service.ts`                                 | CRUD + Socket 브로드캐스트                        |
| `apps/api/src/comments/dto/create-comment.dto.ts`                           | 주석 생성 DTO                                     |
| `apps/api/src/comments/dto/create-reply.dto.ts`                             | 답글 생성 DTO                                     |
| `apps/api/src/comments/dto/update-comment-status.dto.ts`                    | 상태 변경 DTO                                     |
| `apps/api/src/comments/dto/update-reply.dto.ts`                             | 답글 수정 DTO                                     |
| `apps/api/src/comments/__tests__/comments.service.test.ts`                  | 서비스 단위 테스트                                |
| `apps/web/src/components/storyboard/comments/useComments.ts`                | fetch + Socket 구독 + 낙관적 업데이트             |
| `apps/web/src/components/storyboard/comments/CommentOverlay.tsx`            | SVG 오버레이 (PresenceLayer 패턴)                 |
| `apps/web/src/components/storyboard/comments/CommentPin.tsx`                | 개별 핀 (SVG foreignObject)                       |
| `apps/web/src/components/storyboard/comments/CommentPanel.tsx`              | 우측 슬라이드인 패널                              |
| `apps/web/src/components/storyboard/comments/CommentThread.tsx`             | 스레드 (주석 + 답글)                              |
| `apps/web/src/components/storyboard/comments/CommentInput.tsx`              | 입력창                                            |
| `apps/web/src/components/storyboard/comments/__tests__/useComments.test.ts` | 훅 단위 테스트                                    |

### 수정

| 파일                                                               | 변경 내용                                                                                         |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `packages/db/src/index.ts`                                         | comments-schema export 추가                                                                       |
| `packages/types/src/index.ts`                                      | comments.ts export 추가                                                                           |
| `apps/api/src/app.module.ts`                                       | CommentsModule import 추가                                                                        |
| `apps/api/src/collaboration/collaboration.gateway.ts`              | `server` prop을 `CommentsService`에 주입 가능하도록 `@WebSocketServer()` 공유                     |
| `apps/web/src/stores/editor-store.ts`                              | `isCommentMode` / `setCommentMode` / `activeCommentId` / `setActiveCommentId` 추가 (persist 제외) |
| `apps/web/src/components/storyboard/panels/toolbar.tsx`            | 주석 모드 버튼 추가                                                                               |
| `apps/web/src/components/storyboard/canvas.tsx`                    | `onPaneClick` prop 추가, `nodesDraggable` / `nodesConnectable` / `elementsSelectable` 조건부 전달 |
| `apps/web/src/components/storyboard/editor.tsx`                    | `useComments` 훅 연결, `CommentOverlay` / `CommentPanel` 렌더링, 주석 모드 분기                   |
| `apps/web/src/components/storyboard/hooks/use-editor-shortcuts.ts` | `C` 키 → 주석 모드 토글, `Escape` → 주석 모드 종료 추가                                           |

---

## Task 1: DB 스키마 — comments / comment_replies

**Files:**

- Create: `packages/db/src/comments-schema.ts`
- Modify: `packages/db/src/index.ts`

- [ ] **Step 1: 스키마 파일 작성**

```typescript
// packages/db/src/comments-schema.ts
import { sql } from "drizzle-orm";
import {
  pgTable,
  pgEnum,
  text,
  doublePrecision,
  timestamp,
  index,
  check,
} from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";
import { users } from "./schema";
import { storyboards } from "./schema";

export const anchorTypeEnum = pgEnum("anchor_type", ["node", "canvas"]);
export const commentStatusEnum = pgEnum("comment_status", ["open", "resolved"]);

export const comments = pgTable(
  "comments",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    storyboardId: text("storyboard_id")
      .notNull()
      .references(() => storyboards.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    anchorType: anchorTypeEnum("anchor_type").notNull(),
    anchorNodeId: text("anchor_node_id"),
    canvasX: doublePrecision("canvas_x"),
    canvasY: doublePrecision("canvas_y"),
    content: text("content").notNull(),
    status: commentStatusEnum("status").notNull().default("open"),
    resolvedBy: text("resolved_by").references(() => users.id, {
      onDelete: "set null",
    }),
    resolvedAt: timestamp("resolved_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_comments_storyboard_status").on(
      table.storyboardId,
      table.status,
    ),
    index("idx_comments_storyboard_created").on(
      table.storyboardId,
      table.createdAt,
    ),
    check(
      "anchor_node_check",
      sql`(anchor_type = 'node' AND anchor_node_id IS NOT NULL AND canvas_x IS NULL AND canvas_y IS NULL)
        OR (anchor_type = 'canvas' AND anchor_node_id IS NULL AND canvas_x IS NOT NULL AND canvas_y IS NOT NULL)`,
    ),
    check(
      "resolved_pair_check",
      sql`(resolved_by IS NULL) = (resolved_at IS NULL)`,
    ),
  ],
);

export const commentReplies = pgTable(
  "comment_replies",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    commentId: text("comment_id")
      .notNull()
      .references(() => comments.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_replies_comment_created").on(table.commentId, table.createdAt),
  ],
);
```

- [ ] **Step 2: index.ts에 export 추가**

`packages/db/src/index.ts`에서 기존 export 아래에 추가:

```typescript
export * from "./comments-schema";
```

- [ ] **Step 3: 마이그레이션 생성 및 실행**

```bash
pnpm --filter @repo/db db:generate
pnpm --filter @repo/db db:migrate
```

Expected: 마이그레이션 SQL 파일 생성, `comments` / `comment_replies` 테이블 생성 완료

- [ ] **Step 4: 커밋**

```bash
git add packages/db/src/comments-schema.ts packages/db/src/index.ts
git add packages/db/drizzle/  # 마이그레이션 파일
git commit -m "feat(db): add comments and comment_replies schema"
```

---

## Task 2: 공유 타입 추가

**Files:**

- Create: `packages/types/src/comments.ts`
- Modify: `packages/types/src/index.ts`

- [ ] **Step 1: 타입 파일 작성**

```typescript
// packages/types/src/comments.ts

export type AnchorType = "node" | "canvas";
export type CommentStatus = "open" | "resolved";

export interface CommentAuthor {
  id: string;
  name: string | null;
  image: string | null;
}

export interface CommentReplyDto {
  id: string;
  commentId: string;
  author: CommentAuthor;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface CommentDto {
  id: string;
  storyboardId: string;
  author: CommentAuthor;
  anchorType: AnchorType;
  anchorNodeId: string | null;
  canvasX: number | null;
  canvasY: number | null;
  content: string;
  status: CommentStatus;
  resolvedBy: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  replies: CommentReplyDto[];
}

// API request types
export interface CreateCommentDto {
  anchorType: AnchorType;
  anchorNodeId?: string;
  canvasX?: number;
  canvasY?: number;
  content: string;
}

export interface CreateReplyDto {
  content: string;
}

export interface UpdateCommentStatusDto {
  status: CommentStatus;
}

export interface UpdateReplyDto {
  content: string;
}

// Socket.io events
export interface CommentCreatedEvent {
  comment: CommentDto;
}

export interface CommentDeletedEvent {
  commentId: string;
}

export interface CommentStatusChangedEvent {
  commentId: string;
  status: CommentStatus;
  resolvedBy: string | null;
  resolvedAt: string | null;
}

export interface ReplyCreatedEvent {
  reply: CommentReplyDto;
}

export interface ReplyUpdatedEvent {
  reply: CommentReplyDto;
}

export interface ReplyDeletedEvent {
  replyId: string;
  commentId: string;
}
```

- [ ] **Step 2: index.ts에 export 추가**

`packages/types/src/index.ts`에 추가:

```typescript
export * from "./comments";
```

- [ ] **Step 3: 커밋**

```bash
git add packages/types/src/comments.ts packages/types/src/index.ts
git commit -m "feat(types): add comment and reply shared types"
```

---

## Task 3: NestJS CommentsModule — DTO + Service 기반

**Files:**

- Create: `apps/api/src/comments/dto/create-comment.dto.ts`
- Create: `apps/api/src/comments/dto/create-reply.dto.ts`
- Create: `apps/api/src/comments/dto/update-comment-status.dto.ts`
- Create: `apps/api/src/comments/dto/update-reply.dto.ts`
- Create: `apps/api/src/comments/comments.service.ts`
- Create: `apps/api/src/comments/__tests__/comments.service.test.ts`

- [ ] **Step 1: DTO 파일 4개 작성**

```typescript
// apps/api/src/comments/dto/create-comment.dto.ts
import {
  IsString,
  IsEnum,
  IsOptional,
  IsNumber,
  MaxLength,
} from "class-validator";
import type { CreateCommentDto as ICreateCommentDto } from "@repo/types";

export class CreateCommentDto implements ICreateCommentDto {
  @IsEnum(["node", "canvas"])
  anchorType!: "node" | "canvas";

  @IsOptional()
  @IsString()
  anchorNodeId?: string;

  @IsOptional()
  @IsNumber()
  canvasX?: number;

  @IsOptional()
  @IsNumber()
  canvasY?: number;

  @IsString()
  @MaxLength(2000)
  content!: string;
}
```

```typescript
// apps/api/src/comments/dto/create-reply.dto.ts
import { IsString, MaxLength } from "class-validator";
import type { CreateReplyDto as ICreateReplyDto } from "@repo/types";

export class CreateReplyDto implements ICreateReplyDto {
  @IsString()
  @MaxLength(2000)
  content!: string;
}
```

```typescript
// apps/api/src/comments/dto/update-comment-status.dto.ts
import { IsEnum } from "class-validator";
import type { UpdateCommentStatusDto as IUpdateCommentStatusDto } from "@repo/types";

export class UpdateCommentStatusDto implements IUpdateCommentStatusDto {
  @IsEnum(["open", "resolved"])
  status!: "open" | "resolved";
}
```

```typescript
// apps/api/src/comments/dto/update-reply.dto.ts
import { IsString, MaxLength } from "class-validator";
import type { UpdateReplyDto as IUpdateReplyDto } from "@repo/types";

export class UpdateReplyDto implements IUpdateReplyDto {
  @IsString()
  @MaxLength(2000)
  content!: string;
}
```

- [ ] **Step 2: 실패하는 테스트 작성**

```typescript
// apps/api/src/comments/__tests__/comments.service.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NotFoundException, ForbiddenException } from "@nestjs/common";
import { CommentsService } from "../comments.service";

vi.mock("drizzle-orm", () => ({
  eq: (col: unknown, val: unknown) => ({ col, val, op: "eq" }),
  and: (...conditions: unknown[]) => ({ conditions, op: "and" }),
  desc: (col: unknown) => ({ col, op: "desc" }),
}));

const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();

vi.mock("@repo/db", () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
    insert: (...args: unknown[]) => mockInsert(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  },
  comments: {
    id: "id",
    storyboardId: "storyboard_id",
    authorId: "author_id",
    anchorType: "anchor_type",
    anchorNodeId: "anchor_node_id",
    canvasX: "canvas_x",
    canvasY: "canvas_y",
    content: "content",
    status: "status",
    resolvedBy: "resolved_by",
    resolvedAt: "resolved_at",
  },
  commentReplies: {
    id: "id",
    commentId: "comment_id",
    authorId: "author_id",
    content: "content",
    updatedAt: "updated_at",
  },
  users: { id: "id", name: "name", image: "image" },
  storyboards: { id: "id", projectId: "project_id" },
  projects: { id: "id", orgId: "org_id" },
  orgMembers: { orgId: "org_id", userId: "user_id" },
}));

function createSelectChain(result: unknown) {
  return {
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockResolvedValue(result),
    limit: vi.fn().mockResolvedValue(result),
  };
}

function createInsertChain(result: unknown) {
  return {
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(result),
  };
}

function createUpdateChain(result: unknown) {
  return {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(result),
  };
}

function createDeleteChain() {
  return { where: vi.fn().mockResolvedValue([]) };
}

const mockServer = { to: vi.fn().mockReturnThis(), emit: vi.fn() };

describe("CommentsService", () => {
  let service: CommentsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new CommentsService();
    service.setServer(mockServer as unknown as import("socket.io").Server);
  });

  describe("getCommentsByStoryboard", () => {
    it("주석 목록을 storyboardId로 조회한다", async () => {
      const mockComments = [
        {
          id: "c1",
          storyboardId: "sb1",
          content: "test",
          anchorType: "node",
          anchorNodeId: "n1",
          canvasX: null,
          canvasY: null,
          status: "open",
          authorId: "u1",
          authorName: "김기획",
          authorImage: null,
          resolvedBy: null,
          resolvedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      mockSelect.mockReturnValue(createSelectChain(mockComments));

      const result = await service.getCommentsByStoryboard("sb1");
      expect(result).toHaveLength(1);
      expect(result[0]!.id).toBe("c1");
    });
  });

  describe("createComment", () => {
    it("node 앵커 주석을 생성하고 socket emit한다", async () => {
      const newComment = {
        id: "c1",
        storyboardId: "sb1",
        authorId: "u1",
        anchorType: "node",
        anchorNodeId: "n1",
        canvasX: null,
        canvasY: null,
        content: "hello",
        status: "open",
        resolvedBy: null,
        resolvedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockInsert.mockReturnValue(createInsertChain([newComment]));
      mockSelect.mockReturnValue(
        createSelectChain([{ id: "u1", name: "김기획", image: null }]),
      );

      const result = await service.createComment("sb1", "u1", {
        anchorType: "node",
        anchorNodeId: "n1",
        content: "hello",
      });
      expect(result.id).toBe("c1");
      expect(mockServer.to).toHaveBeenCalledWith("sb1");
      expect(mockServer.emit).toHaveBeenCalledWith(
        "comment:created",
        expect.objectContaining({
          comment: expect.objectContaining({ id: "c1" }),
        }),
      );
    });

    it("canvas 앵커 주석을 생성한다", async () => {
      const newComment = {
        id: "c2",
        storyboardId: "sb1",
        authorId: "u1",
        anchorType: "canvas",
        anchorNodeId: null,
        canvasX: 100,
        canvasY: 200,
        content: "canvas note",
        status: "open",
        resolvedBy: null,
        resolvedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockInsert.mockReturnValue(createInsertChain([newComment]));
      mockSelect.mockReturnValue(
        createSelectChain([{ id: "u1", name: "김기획", image: null }]),
      );

      const result = await service.createComment("sb1", "u1", {
        anchorType: "canvas",
        canvasX: 100,
        canvasY: 200,
        content: "canvas note",
      });
      expect(result.canvasX).toBe(100);
    });
  });

  describe("deleteComment", () => {
    it("작성자가 아니면 ForbiddenException을 던진다", async () => {
      mockSelect.mockReturnValue(
        createSelectChain([{ id: "c1", authorId: "u1" }]),
      );

      await expect(service.deleteComment("c1", "u2")).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("작성자가 삭제하면 socket emit한다", async () => {
      mockSelect.mockReturnValue(
        createSelectChain([{ id: "c1", authorId: "u1", storyboardId: "sb1" }]),
      );
      mockDelete.mockReturnValue(createDeleteChain());

      await service.deleteComment("c1", "u1");
      expect(mockServer.emit).toHaveBeenCalledWith("comment:deleted", {
        commentId: "c1",
      });
    });
  });

  describe("updateCommentStatus", () => {
    it("해결 처리 시 resolvedBy / resolvedAt이 설정된다", async () => {
      const updatedComment = {
        id: "c1",
        storyboardId: "sb1",
        authorId: "u1",
        anchorType: "node",
        anchorNodeId: "n1",
        canvasX: null,
        canvasY: null,
        content: "test",
        status: "resolved",
        resolvedBy: "u2",
        resolvedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockSelect.mockReturnValue(
        createSelectChain([{ id: "c1", storyboardId: "sb1" }]),
      );
      mockUpdate.mockReturnValue(createUpdateChain([updatedComment]));

      const result = await service.updateCommentStatus("c1", "u2", {
        status: "resolved",
      });
      expect(result.status).toBe("resolved");
      expect(result.resolvedBy).toBe("u2");
      expect(mockServer.emit).toHaveBeenCalledWith(
        "comment:status_changed",
        expect.objectContaining({ commentId: "c1", status: "resolved" }),
      );
    });

    it("재오픈 시 resolvedBy / resolvedAt이 null로 초기화된다", async () => {
      const updatedComment = {
        id: "c1",
        storyboardId: "sb1",
        status: "open",
        resolvedBy: null,
        resolvedAt: null,
        authorId: "u1",
        anchorType: "node",
        anchorNodeId: "n1",
        canvasX: null,
        canvasY: null,
        content: "test",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockSelect.mockReturnValue(
        createSelectChain([{ id: "c1", storyboardId: "sb1" }]),
      );
      mockUpdate.mockReturnValue(createUpdateChain([updatedComment]));

      const result = await service.updateCommentStatus("c1", "u2", {
        status: "open",
      });
      expect(result.resolvedBy).toBeNull();
    });
  });

  describe("createReply", () => {
    it("답글을 생성하고 socket emit한다", async () => {
      const newReply = {
        id: "r1",
        commentId: "c1",
        authorId: "u1",
        content: "reply",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockSelect
        .mockReturnValueOnce(
          createSelectChain([{ id: "c1", storyboardId: "sb1" }]),
        )
        .mockReturnValueOnce(
          createSelectChain([{ id: "u1", name: "김기획", image: null }]),
        );
      mockInsert.mockReturnValue(createInsertChain([newReply]));

      const result = await service.createReply("c1", "u1", {
        content: "reply",
      });
      expect(result.id).toBe("r1");
      expect(mockServer.emit).toHaveBeenCalledWith(
        "reply:created",
        expect.objectContaining({
          reply: expect.objectContaining({ id: "r1" }),
        }),
      );
    });
  });

  describe("deleteReply", () => {
    it("작성자가 아니면 ForbiddenException을 던진다", async () => {
      mockSelect.mockReturnValue(
        createSelectChain([{ id: "r1", authorId: "u1", commentId: "c1" }]),
      );
      const secondSelect = createSelectChain([
        { id: "c1", storyboardId: "sb1" },
      ]);
      mockSelect.mockReturnValueOnce(
        createSelectChain([{ id: "r1", authorId: "u1", commentId: "c1" }]),
      );

      await expect(service.deleteReply("r1", "u2")).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
```

- [ ] **Step 3: 테스트 실패 확인**

```bash
pnpm --filter api test -- --run comments.service
```

Expected: FAIL — `CommentsService` not found

- [ ] **Step 4: CommentsService 구현**

```typescript
// apps/api/src/comments/comments.service.ts
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { eq, and, desc } from "drizzle-orm";
import {
  db,
  comments,
  commentReplies,
  users,
  storyboards,
  projects,
  orgMembers,
} from "@repo/db";
import type { Server } from "socket.io";
import type {
  CommentDto,
  CommentReplyDto,
  CommentAuthor,
  CreateCommentDto,
  CreateReplyDto,
  UpdateCommentStatusDto,
  UpdateReplyDto,
} from "@repo/types";

@Injectable()
export class CommentsService {
  private server!: Server;

  setServer(server: Server) {
    this.server = server;
  }

  private formatAuthor(row: {
    id: string;
    name: string | null;
    image: string | null;
  }): CommentAuthor {
    return { id: row.id, name: row.name, image: row.image };
  }

  private formatComment(
    row: typeof comments.$inferSelect,
    author: CommentAuthor,
    replies: CommentReplyDto[] = [],
  ): CommentDto {
    return {
      id: row.id,
      storyboardId: row.storyboardId,
      author,
      anchorType: row.anchorType,
      anchorNodeId: row.anchorNodeId ?? null,
      canvasX: row.canvasX ?? null,
      canvasY: row.canvasY ?? null,
      content: row.content,
      status: row.status,
      resolvedBy: row.resolvedBy ?? null,
      resolvedAt: row.resolvedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      replies,
    };
  }

  private formatReply(
    row: typeof commentReplies.$inferSelect,
    author: CommentAuthor,
  ): CommentReplyDto {
    return {
      id: row.id,
      commentId: row.commentId,
      author,
      content: row.content,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async getCommentsByStoryboard(storyboardId: string): Promise<CommentDto[]> {
    const rows = await db
      .select()
      .from(comments)
      .where(eq(comments.storyboardId, storyboardId))
      .orderBy(desc(comments.createdAt));

    const result: CommentDto[] = [];
    for (const row of rows) {
      const [authorRow] = await db
        .select({ id: users.id, name: users.name, image: users.image })
        .from(users)
        .where(eq(users.id, row.authorId))
        .limit(1);
      const author = this.formatAuthor(
        authorRow ?? { id: row.authorId, name: null, image: null },
      );

      const replyRows = await db
        .select()
        .from(commentReplies)
        .where(eq(commentReplies.commentId, row.id))
        .orderBy(commentReplies.createdAt);

      const replies: CommentReplyDto[] = [];
      for (const reply of replyRows) {
        const [replyAuthorRow] = await db
          .select({ id: users.id, name: users.name, image: users.image })
          .from(users)
          .where(eq(users.id, reply.authorId))
          .limit(1);
        replies.push(
          this.formatReply(
            reply,
            this.formatAuthor(
              replyAuthorRow ?? { id: reply.authorId, name: null, image: null },
            ),
          ),
        );
      }

      result.push(this.formatComment(row, author, replies));
    }
    return result;
  }

  async createComment(
    storyboardId: string,
    userId: string,
    dto: CreateCommentDto,
  ): Promise<CommentDto> {
    const [inserted] = await db
      .insert(comments)
      .values({
        storyboardId,
        authorId: userId,
        anchorType: dto.anchorType,
        anchorNodeId: dto.anchorNodeId ?? null,
        canvasX: dto.canvasX ?? null,
        canvasY: dto.canvasY ?? null,
        content: dto.content,
      })
      .returning();
    if (!inserted) throw new Error("Insert failed");

    const [authorRow] = await db
      .select({ id: users.id, name: users.name, image: users.image })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    const comment = this.formatComment(
      inserted,
      this.formatAuthor(authorRow ?? { id: userId, name: null, image: null }),
    );

    this.server?.to(storyboardId).emit("comment:created", { comment });
    return comment;
  }

  async deleteComment(commentId: string, userId: string): Promise<void> {
    const [comment] = await db
      .select()
      .from(comments)
      .where(eq(comments.id, commentId))
      .limit(1);
    if (!comment) throw new NotFoundException("Comment not found");
    if (comment.authorId !== userId)
      throw new ForbiddenException("Not authorized");

    await db.delete(comments).where(eq(comments.id, commentId));
    this.server
      ?.to(comment.storyboardId)
      .emit("comment:deleted", { commentId });
  }

  async updateCommentStatus(
    commentId: string,
    userId: string,
    dto: UpdateCommentStatusDto,
  ): Promise<CommentDto> {
    const [comment] = await db
      .select()
      .from(comments)
      .where(eq(comments.id, commentId))
      .limit(1);
    if (!comment) throw new NotFoundException("Comment not found");

    const updateData =
      dto.status === "resolved"
        ? {
            status: "resolved" as const,
            resolvedBy: userId,
            resolvedAt: new Date(),
            updatedAt: new Date(),
          }
        : {
            status: "open" as const,
            resolvedBy: null,
            resolvedAt: null,
            updatedAt: new Date(),
          };

    const [updated] = await db
      .update(comments)
      .set(updateData)
      .where(eq(comments.id, commentId))
      .returning();
    if (!updated) throw new Error("Update failed");

    const [authorRow] = await db
      .select({ id: users.id, name: users.name, image: users.image })
      .from(users)
      .where(eq(users.id, updated.authorId))
      .limit(1);
    const result = this.formatComment(
      updated,
      this.formatAuthor(
        authorRow ?? { id: updated.authorId, name: null, image: null },
      ),
    );

    this.server?.to(comment.storyboardId).emit("comment:status_changed", {
      commentId,
      status: updated.status,
      resolvedBy: updated.resolvedBy ?? null,
      resolvedAt: updated.resolvedAt?.toISOString() ?? null,
    });
    return result;
  }

  async createReply(
    commentId: string,
    userId: string,
    dto: CreateReplyDto,
  ): Promise<CommentReplyDto> {
    const [comment] = await db
      .select()
      .from(comments)
      .where(eq(comments.id, commentId))
      .limit(1);
    if (!comment) throw new NotFoundException("Comment not found");

    const [inserted] = await db
      .insert(commentReplies)
      .values({ commentId, authorId: userId, content: dto.content })
      .returning();
    if (!inserted) throw new Error("Insert failed");

    const [authorRow] = await db
      .select({ id: users.id, name: users.name, image: users.image })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    const reply = this.formatReply(
      inserted,
      this.formatAuthor(authorRow ?? { id: userId, name: null, image: null }),
    );

    this.server?.to(comment.storyboardId).emit("reply:created", { reply });
    return reply;
  }

  async updateReply(
    replyId: string,
    userId: string,
    dto: UpdateReplyDto,
  ): Promise<CommentReplyDto> {
    const [reply] = await db
      .select()
      .from(commentReplies)
      .where(eq(commentReplies.id, replyId))
      .limit(1);
    if (!reply) throw new NotFoundException("Reply not found");
    if (reply.authorId !== userId)
      throw new ForbiddenException("Not authorized");

    const [comment] = await db
      .select()
      .from(comments)
      .where(eq(comments.id, reply.commentId))
      .limit(1);

    const [updated] = await db
      .update(commentReplies)
      .set({ content: dto.content, updatedAt: new Date() })
      .where(eq(commentReplies.id, replyId))
      .returning();
    if (!updated) throw new Error("Update failed");

    const [authorRow] = await db
      .select({ id: users.id, name: users.name, image: users.image })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    const result = this.formatReply(
      updated,
      this.formatAuthor(authorRow ?? { id: userId, name: null, image: null }),
    );

    if (comment) {
      this.server
        ?.to(comment.storyboardId)
        .emit("reply:updated", { reply: result });
    }
    return result;
  }

  async deleteReply(replyId: string, userId: string): Promise<void> {
    const [reply] = await db
      .select()
      .from(commentReplies)
      .where(eq(commentReplies.id, replyId))
      .limit(1);
    if (!reply) throw new NotFoundException("Reply not found");
    if (reply.authorId !== userId)
      throw new ForbiddenException("Not authorized");

    const [comment] = await db
      .select()
      .from(comments)
      .where(eq(comments.id, reply.commentId))
      .limit(1);

    await db.delete(commentReplies).where(eq(commentReplies.id, replyId));
    if (comment) {
      this.server
        ?.to(comment.storyboardId)
        .emit("reply:deleted", { replyId, commentId: reply.commentId });
    }
  }
}
```

- [ ] **Step 5: 테스트 통과 확인**

```bash
pnpm --filter api test -- --run comments.service
```

Expected: 모든 테스트 PASS

- [ ] **Step 6: 커밋**

```bash
git add apps/api/src/comments/
git commit -m "feat(api): add CommentsService with CRUD and socket broadcast"
```

---

## Task 4: CommentsController + Module + AppModule 등록

**Files:**

- Create: `apps/api/src/comments/comments.controller.ts`
- Create: `apps/api/src/comments/comments.module.ts`
- Modify: `apps/api/src/app.module.ts`
- Modify: `apps/api/src/collaboration/collaboration.gateway.ts`

- [ ] **Step 1: Controller 작성**

```typescript
// apps/api/src/comments/comments.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
} from "@nestjs/common";
import { CurrentUserId } from "../auth/current-user.decorator";
import { StoryboardsService } from "../storyboards/storyboards.service";
import { CommentsService } from "./comments.service";
import { CreateCommentDto } from "./dto/create-comment.dto";
import { CreateReplyDto } from "./dto/create-reply.dto";
import { UpdateCommentStatusDto } from "./dto/update-comment-status.dto";
import { UpdateReplyDto } from "./dto/update-reply.dto";

@Controller()
export class CommentsController {
  constructor(
    private readonly commentsService: CommentsService,
    private readonly storyboardsService: StoryboardsService,
  ) {}

  @Get("storyboards/:id/comments")
  async list(@Param("id") id: string, @CurrentUserId() userId: string) {
    await this.storyboardsService.ensureStoryboardAccess(id, userId);
    return this.commentsService.getCommentsByStoryboard(id);
  }

  @Post("storyboards/:id/comments")
  async create(
    @Param("id") id: string,
    @CurrentUserId() userId: string,
    @Body() body: CreateCommentDto,
  ) {
    await this.storyboardsService.ensureStoryboardAccess(id, userId);
    return this.commentsService.createComment(id, userId, body);
  }

  @Patch("comments/:id/status")
  async updateStatus(
    @Param("id") id: string,
    @CurrentUserId() userId: string,
    @Body() body: UpdateCommentStatusDto,
  ) {
    return this.commentsService.updateCommentStatus(id, userId, body);
  }

  @Delete("comments/:id")
  async delete(@Param("id") id: string, @CurrentUserId() userId: string) {
    await this.commentsService.deleteComment(id, userId);
    return { ok: true };
  }

  @Post("comments/:id/replies")
  async createReply(
    @Param("id") id: string,
    @CurrentUserId() userId: string,
    @Body() body: CreateReplyDto,
  ) {
    return this.commentsService.createReply(id, userId, body);
  }

  @Patch("replies/:id")
  async updateReply(
    @Param("id") id: string,
    @CurrentUserId() userId: string,
    @Body() body: UpdateReplyDto,
  ) {
    return this.commentsService.updateReply(id, userId, body);
  }

  @Delete("replies/:id")
  async deleteReply(@Param("id") id: string, @CurrentUserId() userId: string) {
    await this.commentsService.deleteReply(id, userId);
    return { ok: true };
  }
}
```

- [ ] **Step 2: Module 작성**

```typescript
// apps/api/src/comments/comments.module.ts
import { Module } from "@nestjs/common";
import { CommentsController } from "./comments.controller";
import { CommentsService } from "./comments.service";
import { StoryboardsModule } from "../storyboards/storyboards.module";

@Module({
  imports: [StoryboardsModule],
  controllers: [CommentsController],
  providers: [CommentsService],
  exports: [CommentsService],
})
export class CommentsModule {}
```

- [ ] **Step 3: AppModule에 등록**

`apps/api/src/app.module.ts` 수정 — imports 배열에 `CommentsModule` 추가:

```typescript
import { CommentsModule } from "./comments/comments.module";
// ...
imports: [
  // 기존 모듈들...
  CommentsModule,
],
```

- [ ] **Step 4: CollaborationGateway에서 CommentsService에 server 주입**

`apps/api/src/collaboration/collaboration.gateway.ts`에서 `OnGatewayInit` 구현 추가:

```typescript
import { OnGatewayDisconnect, OnGatewayInit } from "@nestjs/websockets";
import { CommentsService } from "../comments/comments.service";
// ...

export class CollaborationGateway
  implements OnGatewayInit, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly collaborationService: CollaborationService,
    private readonly commentsService: CommentsService,
  ) {}

  afterInit(server: Server) {
    this.commentsService.setServer(server);
  }
  // 나머지 기존 코드 유지
}
```

`CollaborationModule`에 `CommentsModule` import 추가:

```typescript
// apps/api/src/collaboration/collaboration.module.ts
import { CommentsModule } from "../comments/comments.module";
// imports에 CommentsModule 추가
```

- [ ] **Step 5: API 빌드 확인**

```bash
pnpm --filter api build
```

Expected: 빌드 성공 (에러 없음)

- [ ] **Step 6: 커밋**

```bash
git add apps/api/src/comments/comments.controller.ts
git add apps/api/src/comments/comments.module.ts
git add apps/api/src/app.module.ts
git add apps/api/src/collaboration/
git commit -m "feat(api): register CommentsModule and wire socket server"
```

---

## Task 5: editor-store에 주석 모드 상태 추가

**Files:**

- Modify: `apps/web/src/stores/editor-store.ts`

- [ ] **Step 1: 스토어에 주석 모드 상태 추가**

`apps/web/src/stores/editor-store.ts`에서 `EditorState` 인터페이스에 추가:

```typescript
// EditorState 인터페이스에 추가
isCommentMode: boolean;
activeCommentId: string | null;
setCommentMode: (active: boolean) => void;
setActiveCommentId: (id: string | null) => void;
```

`create` 함수 내 초기값 추가:

```typescript
isCommentMode: false,
activeCommentId: null,
setCommentMode: (active) => set({ isCommentMode: active, ...(active ? {} : { activeCommentId: null }) }),
setActiveCommentId: (id) => set({ activeCommentId: id }),
```

`partialize`에는 추가하지 않음 (persist 제외).

- [ ] **Step 2: 타입 체크**

```bash
pnpm check-types
```

Expected: 타입 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add apps/web/src/stores/editor-store.ts
git commit -m "feat(web): add isCommentMode and activeCommentId to editor store"
```

---

## Task 6: useComments 훅 구현

**Files:**

- Create: `apps/web/src/components/storyboard/comments/useComments.ts`
- Create: `apps/web/src/components/storyboard/comments/__tests__/useComments.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

```typescript
// apps/web/src/components/storyboard/comments/__tests__/useComments.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useComments } from "../useComments";
import type { CommentDto } from "@repo/types";

const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockSocket = {
  on: vi.fn(),
  off: vi.fn(),
};

describe("useComments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("초기 로드 시 comments를 fetch한다", async () => {
    const fakeComments: CommentDto[] = [
      {
        id: "c1",
        storyboardId: "sb1",
        author: { id: "u1", name: "김기획", image: null },
        anchorType: "node",
        anchorNodeId: "n1",
        canvasX: null,
        canvasY: null,
        content: "test",
        status: "open",
        resolvedBy: null,
        resolvedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        replies: [],
      },
    ];
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => fakeComments,
    });

    const { result } = renderHook(() =>
      useComments({
        storyboardId: "sb1",
        socket: mockSocket as unknown as import("socket.io-client").Socket,
      }),
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(result.current.comments).toHaveLength(1);
    expect(result.current.comments[0]!.id).toBe("c1");
  });

  it("addComment 호출 시 낙관적 업데이트 후 fetch한다", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => [] }) // initial load
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "c2",
          storyboardId: "sb1",
          author: { id: "u1", name: "김기획", image: null },
          anchorType: "canvas",
          anchorNodeId: null,
          canvasX: 100,
          canvasY: 200,
          content: "new",
          status: "open",
          resolvedBy: null,
          resolvedAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          replies: [],
        }),
      });

    const { result } = renderHook(() =>
      useComments({
        storyboardId: "sb1",
        socket: mockSocket as unknown as import("socket.io-client").Socket,
      }),
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    await act(async () => {
      await result.current.addComment({
        anchorType: "canvas",
        canvasX: 100,
        canvasY: 200,
        content: "new",
      });
    });

    // 낙관적 업데이트로 즉시 1개 추가됨
    expect(result.current.comments.length).toBeGreaterThanOrEqual(1);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
pnpm --filter web test -- --run useComments
```

Expected: FAIL — `useComments` not found

- [ ] **Step 3: useComments 훅 구현**

```typescript
// apps/web/src/components/storyboard/comments/useComments.ts
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Socket } from "socket.io-client";
import type {
  CommentDto,
  CommentReplyDto,
  CreateCommentDto,
  CreateReplyDto,
  UpdateCommentStatusDto,
  UpdateReplyDto,
  CommentCreatedEvent,
  CommentDeletedEvent,
  CommentStatusChangedEvent,
  ReplyCreatedEvent,
  ReplyUpdatedEvent,
  ReplyDeletedEvent,
} from "@repo/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4001";

interface UseCommentsOptions {
  storyboardId: string;
  socket: Socket | null;
}

export function useComments({ storyboardId, socket }: UseCommentsOptions) {
  const [comments, setComments] = useState<CommentDto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const optimisticIdRef = useRef(0);

  const fetchComments = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/storyboards/${storyboardId}/comments`,
        {
          credentials: "include",
        },
      );
      if (!res.ok) return;
      const data: CommentDto[] = await res.json();
      setComments(data);
    } finally {
      setIsLoading(false);
    }
  }, [storyboardId]);

  useEffect(() => {
    void fetchComments();
  }, [fetchComments]);

  // Socket 이벤트 구독
  useEffect(() => {
    if (!socket) return;

    const onCommentCreated = ({ comment }: CommentCreatedEvent) => {
      setComments((prev) => {
        // 낙관적 임시 항목 교체 또는 앞에 추가
        const withoutOptimistic = prev.filter(
          (c) => !c.id.startsWith("optimistic-"),
        );
        return [
          comment,
          ...withoutOptimistic.filter((c) => c.id !== comment.id),
        ];
      });
    };

    const onCommentDeleted = ({ commentId }: CommentDeletedEvent) => {
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    };

    const onCommentStatusChanged = ({
      commentId,
      status,
      resolvedBy,
      resolvedAt,
    }: CommentStatusChangedEvent) => {
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId ? { ...c, status, resolvedBy, resolvedAt } : c,
        ),
      );
    };

    const onReplyCreated = ({ reply }: ReplyCreatedEvent) => {
      setComments((prev) =>
        prev.map((c) =>
          c.id === reply.commentId
            ? {
                ...c,
                replies: [...c.replies.filter((r) => r.id !== reply.id), reply],
              }
            : c,
        ),
      );
    };

    const onReplyUpdated = ({ reply }: ReplyUpdatedEvent) => {
      setComments((prev) =>
        prev.map((c) =>
          c.id === reply.commentId
            ? {
                ...c,
                replies: c.replies.map((r) => (r.id === reply.id ? reply : r)),
              }
            : c,
        ),
      );
    };

    const onReplyDeleted = ({ replyId, commentId }: ReplyDeletedEvent) => {
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId
            ? { ...c, replies: c.replies.filter((r) => r.id !== replyId) }
            : c,
        ),
      );
    };

    socket.on("comment:created", onCommentCreated);
    socket.on("comment:deleted", onCommentDeleted);
    socket.on("comment:status_changed", onCommentStatusChanged);
    socket.on("reply:created", onReplyCreated);
    socket.on("reply:updated", onReplyUpdated);
    socket.on("reply:deleted", onReplyDeleted);

    return () => {
      socket.off("comment:created", onCommentCreated);
      socket.off("comment:deleted", onCommentDeleted);
      socket.off("comment:status_changed", onCommentStatusChanged);
      socket.off("reply:created", onReplyCreated);
      socket.off("reply:updated", onReplyUpdated);
      socket.off("reply:deleted", onReplyDeleted);
    };
  }, [socket]);

  const addComment = useCallback(
    async (dto: CreateCommentDto): Promise<CommentDto | null> => {
      // 낙관적 업데이트
      const optimisticId = `optimistic-${++optimisticIdRef.current}`;
      const optimistic: CommentDto = {
        id: optimisticId,
        storyboardId,
        author: { id: "", name: null, image: null },
        anchorType: dto.anchorType,
        anchorNodeId: dto.anchorNodeId ?? null,
        canvasX: dto.canvasX ?? null,
        canvasY: dto.canvasY ?? null,
        content: dto.content,
        status: "open",
        resolvedBy: null,
        resolvedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        replies: [],
      };
      setComments((prev) => [optimistic, ...prev]);

      try {
        const res = await fetch(
          `${API_BASE}/storyboards/${storyboardId}/comments`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(dto),
          },
        );
        if (!res.ok) {
          setComments((prev) => prev.filter((c) => c.id !== optimisticId));
          return null;
        }
        const comment: CommentDto = await res.json();
        setComments((prev) =>
          prev.map((c) => (c.id === optimisticId ? comment : c)),
        );
        return comment;
      } catch {
        setComments((prev) => prev.filter((c) => c.id !== optimisticId));
        return null;
      }
    },
    [storyboardId],
  );

  const deleteComment = useCallback(async (commentId: string) => {
    await fetch(`${API_BASE}/comments/${commentId}`, {
      method: "DELETE",
      credentials: "include",
    });
    // socket 이벤트로 상태 갱신
  }, []);

  const updateCommentStatus = useCallback(
    async (commentId: string, dto: UpdateCommentStatusDto) => {
      await fetch(`${API_BASE}/comments/${commentId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(dto),
      });
    },
    [],
  );

  const addReply = useCallback(
    async (
      commentId: string,
      dto: CreateReplyDto,
    ): Promise<CommentReplyDto | null> => {
      const res = await fetch(`${API_BASE}/comments/${commentId}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(dto),
      });
      if (!res.ok) return null;
      return res.json();
    },
    [],
  );

  const updateReply = useCallback(
    async (
      replyId: string,
      dto: UpdateReplyDto,
    ): Promise<CommentReplyDto | null> => {
      const res = await fetch(`${API_BASE}/replies/${replyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(dto),
      });
      if (!res.ok) return null;
      return res.json();
    },
    [],
  );

  const deleteReply = useCallback(async (replyId: string) => {
    await fetch(`${API_BASE}/replies/${replyId}`, {
      method: "DELETE",
      credentials: "include",
    });
  }, []);

  return {
    comments,
    isLoading,
    addComment,
    deleteComment,
    updateCommentStatus,
    addReply,
    updateReply,
    deleteReply,
  };
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
pnpm --filter web test -- --run useComments
```

Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add apps/web/src/components/storyboard/comments/
git commit -m "feat(web): add useComments hook with optimistic updates and socket sync"
```

---

## Task 7: CommentOverlay + CommentPin 구현

**Files:**

- Create: `apps/web/src/components/storyboard/comments/CommentPin.tsx`
- Create: `apps/web/src/components/storyboard/comments/CommentOverlay.tsx`

- [ ] **Step 1: CommentPin 작성**

```tsx
// apps/web/src/components/storyboard/comments/CommentPin.tsx
"use client";

import type { CommentDto } from "@repo/types";

interface CommentPinProps {
  comment: CommentDto;
  x: number;
  y: number;
  isActive: boolean;
  onClick: (commentId: string) => void;
}

export function CommentPin({
  comment,
  x,
  y,
  isActive,
  onClick,
}: CommentPinProps) {
  const replyCount = comment.replies.length;
  const isResolved = comment.status === "resolved";

  return (
    <foreignObject
      x={x - 12}
      y={y - 12}
      width={isResolved ? 24 : replyCount > 0 ? 36 : 24}
      height={24}
      style={{ overflow: "visible", pointerEvents: "auto", cursor: "pointer" }}
      onClick={(e) => {
        e.stopPropagation();
        onClick(comment.id);
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 2,
          background: isActive ? "#89b4fa" : isResolved ? "#a6e3a1" : "#f38ba8",
          borderRadius: 12,
          padding: "2px 6px",
          fontSize: 10,
          fontWeight: 700,
          color: "#1e1e2e",
          border: `2px solid ${isActive ? "#74c7ec" : "transparent"}`,
          boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
          whiteSpace: "nowrap",
          userSelect: "none",
        }}
      >
        {isResolved ? "✓" : replyCount > 0 ? `💬 ${replyCount}` : "💬"}
      </div>
    </foreignObject>
  );
}
```

- [ ] **Step 2: CommentOverlay 작성**

```tsx
// apps/web/src/components/storyboard/comments/CommentOverlay.tsx
"use client";

import { useViewport, useNodes } from "@xyflow/react";
import type { CommentDto } from "@repo/types";
import { CommentPin } from "./CommentPin";

interface CommentOverlayProps {
  comments: CommentDto[];
  activeCommentId: string | null;
  onPinClick: (commentId: string) => void;
  showResolved: boolean;
}

export function CommentOverlay({
  comments,
  activeCommentId,
  onPinClick,
  showResolved,
}: CommentOverlayProps) {
  const { x, y, zoom } = useViewport();
  const nodes = useNodes();

  const visible = showResolved
    ? comments
    : comments.filter((c) => c.status === "open");

  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
      style={{ zIndex: 20 }}
    >
      <g transform={`translate(${x}, ${y}) scale(${zoom})`}>
        {visible.map((comment) => {
          let pinX: number;
          let pinY: number;

          if (comment.anchorType === "node" && comment.anchorNodeId) {
            const node = nodes.find((n) => n.id === comment.anchorNodeId);
            if (!node) return null;
            pinX = node.position.x + (node.measured?.width ?? 180) / 2;
            pinY = node.position.y - 8;
          } else {
            pinX = comment.canvasX ?? 0;
            pinY = comment.canvasY ?? 0;
          }

          return (
            <CommentPin
              key={comment.id}
              comment={comment}
              x={pinX}
              y={pinY}
              isActive={comment.id === activeCommentId}
              onClick={onPinClick}
            />
          );
        })}
      </g>
    </svg>
  );
}
```

- [ ] **Step 3: 타입 체크**

```bash
pnpm check-types
```

Expected: 에러 없음

- [ ] **Step 4: 커밋**

```bash
git add apps/web/src/components/storyboard/comments/CommentPin.tsx
git add apps/web/src/components/storyboard/comments/CommentOverlay.tsx
git commit -m "feat(web): add CommentPin and CommentOverlay SVG components"
```

---

## Task 8: CommentInput + CommentThread + CommentPanel 구현

**Files:**

- Create: `apps/web/src/components/storyboard/comments/CommentInput.tsx`
- Create: `apps/web/src/components/storyboard/comments/CommentThread.tsx`
- Create: `apps/web/src/components/storyboard/comments/CommentPanel.tsx`

- [ ] **Step 1: CommentInput 작성**

```tsx
// apps/web/src/components/storyboard/comments/CommentInput.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface CommentInputProps {
  placeholder?: string;
  onSubmit: (content: string) => Promise<void>;
  onCancel?: () => void;
  autoFocus?: boolean;
}

export function CommentInput({
  placeholder = "주석을 입력하세요...",
  onSubmit,
  onCancel,
  autoFocus = false,
}: CommentInputProps) {
  const [value, setValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!value.trim()) return;
    setIsSubmitting(true);
    try {
      await onSubmit(value.trim());
      setValue("");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        rows={3}
        className="resize-none text-sm"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            void handleSubmit();
          }
        }}
      />
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button variant="ghost" size="sm" onClick={onCancel}>
            취소
          </Button>
        )}
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={!value.trim() || isSubmitting}
        >
          {isSubmitting ? "전송 중..." : "전송"}
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: CommentThread 작성**

```tsx
// apps/web/src/components/storyboard/comments/CommentThread.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CommentInput } from "./CommentInput";
import type { CommentDto, CommentReplyDto } from "@repo/types";

interface CommentThreadProps {
  comment: CommentDto;
  currentUserId: string;
  onDelete: (commentId: string) => Promise<void>;
  onStatusChange: (
    commentId: string,
    status: "open" | "resolved",
  ) => Promise<void>;
  onAddReply: (commentId: string, content: string) => Promise<void>;
  onUpdateReply: (replyId: string, content: string) => Promise<void>;
  onDeleteReply: (replyId: string) => Promise<void>;
}

function ReplyItem({
  reply,
  currentUserId,
  onUpdate,
  onDelete,
}: {
  reply: CommentReplyDto;
  currentUserId: string;
  onUpdate: (replyId: string, content: string) => Promise<void>;
  onDelete: (replyId: string) => Promise<void>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const isAuthor = reply.author.id === currentUserId;

  return (
    <div className="flex flex-col gap-1 border-l-2 border-border pl-3 py-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium">
          {reply.author.name ?? "알 수 없음"}
        </span>
        <span className="text-xs text-muted-foreground">
          {new Date(reply.createdAt).toLocaleDateString("ko-KR")}
        </span>
      </div>
      {isEditing ? (
        <CommentInput
          placeholder="답글 수정..."
          onSubmit={async (content) => {
            await onUpdate(reply.id, content);
            setIsEditing(false);
          }}
          onCancel={() => setIsEditing(false)}
          autoFocus
        />
      ) : (
        <p className="text-sm">{reply.content}</p>
      )}
      {isAuthor && !isEditing && (
        <div className="flex gap-2">
          <button
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setIsEditing(true)}
          >
            수정
          </button>
          <button
            className="text-xs text-muted-foreground hover:text-destructive"
            onClick={() => void onDelete(reply.id)}
          >
            삭제
          </button>
        </div>
      )}
    </div>
  );
}

export function CommentThread({
  comment,
  currentUserId,
  onDelete,
  onStatusChange,
  onAddReply,
  onUpdateReply,
  onDeleteReply,
}: CommentThreadProps) {
  const [showReplyInput, setShowReplyInput] = useState(false);
  const isAuthor = comment.author.id === currentUserId;
  const isResolved = comment.status === "resolved";

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium">
            {comment.author.name ?? "알 수 없음"}
          </span>
          <span className="text-xs text-muted-foreground">
            {new Date(comment.createdAt).toLocaleDateString("ko-KR")}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {isResolved ? (
            <span className="rounded-full bg-green-500/20 px-2 py-0.5 text-xs text-green-600">
              해결됨
            </span>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() =>
              void onStatusChange(comment.id, isResolved ? "open" : "resolved")
            }
          >
            {isResolved ? "재오픈" : "해결"}
          </Button>
          {isAuthor && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-destructive hover:text-destructive"
              onClick={() => void onDelete(comment.id)}
            >
              삭제
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <p className="text-sm">{comment.content}</p>

      {/* Replies */}
      {comment.replies.length > 0 && (
        <div className="flex flex-col gap-2">
          {comment.replies.map((reply) => (
            <ReplyItem
              key={reply.id}
              reply={reply}
              currentUserId={currentUserId}
              onUpdate={onUpdateReply}
              onDelete={onDeleteReply}
            />
          ))}
        </div>
      )}

      {/* Reply Input */}
      {showReplyInput ? (
        <CommentInput
          placeholder="답글을 입력하세요..."
          onSubmit={async (content) => {
            await onAddReply(comment.id, content);
            setShowReplyInput(false);
          }}
          onCancel={() => setShowReplyInput(false)}
          autoFocus
        />
      ) : (
        <button
          className="self-start text-xs text-muted-foreground hover:text-foreground"
          onClick={() => setShowReplyInput(true)}
        >
          + 답글
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 3: CommentPanel 작성**

```tsx
// apps/web/src/components/storyboard/comments/CommentPanel.tsx
"use client";

import { useRef, useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CommentThread } from "./CommentThread";
import type { CommentDto } from "@repo/types";

interface CommentPanelProps {
  comments: CommentDto[];
  activeCommentId: string | null;
  currentUserId: string;
  showResolved: boolean;
  onToggleResolved: () => void;
  onClose: () => void;
  onDelete: (commentId: string) => Promise<void>;
  onStatusChange: (
    commentId: string,
    status: "open" | "resolved",
  ) => Promise<void>;
  onAddReply: (commentId: string, content: string) => Promise<void>;
  onUpdateReply: (replyId: string, content: string) => Promise<void>;
  onDeleteReply: (replyId: string) => Promise<void>;
}

export function CommentPanel({
  comments,
  activeCommentId,
  currentUserId,
  showResolved,
  onToggleResolved,
  onClose,
  onDelete,
  onStatusChange,
  onAddReply,
  onUpdateReply,
  onDeleteReply,
}: CommentPanelProps) {
  const activeRef = useRef<HTMLDivElement | null>(null);

  const visible = showResolved
    ? comments
    : comments.filter((c) => c.status === "open");

  useEffect(() => {
    if (activeCommentId && activeRef.current) {
      activeRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [activeCommentId]);

  return (
    <div
      className="absolute right-0 top-0 z-30 flex h-full w-80 flex-col border-l border-border bg-card shadow-lg"
      style={{ animation: "slideIn 0.2s ease-out" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold">주석 ({visible.length})</h3>
        <div className="flex items-center gap-2">
          <button
            className={`text-xs ${showResolved ? "text-foreground" : "text-muted-foreground"} hover:text-foreground`}
            onClick={onToggleResolved}
          >
            {showResolved ? "미해결만" : "전체 보기"}
          </button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* List */}
      <div className="flex flex-col gap-3 overflow-y-auto p-3">
        {visible.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {showResolved ? "주석이 없습니다." : "미해결 주석이 없습니다."}
          </p>
        )}
        {visible.map((comment) => (
          <div
            key={comment.id}
            ref={comment.id === activeCommentId ? activeRef : null}
            className={
              comment.id === activeCommentId
                ? "ring-2 ring-primary rounded-lg"
                : ""
            }
          >
            <CommentThread
              comment={comment}
              currentUserId={currentUserId}
              onDelete={onDelete}
              onStatusChange={onStatusChange}
              onAddReply={onAddReply}
              onUpdateReply={onUpdateReply}
              onDeleteReply={onDeleteReply}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: globals.css에 slideIn 애니메이션 추가**

`apps/web/src/app/globals.css`에 추가:

```css
@keyframes slideIn {
  from {
    transform: translateX(100%);
  }
  to {
    transform: translateX(0);
  }
}
```

- [ ] **Step 5: 타입 체크**

```bash
pnpm check-types
```

Expected: 에러 없음

- [ ] **Step 6: 커밋**

```bash
git add apps/web/src/components/storyboard/comments/
git add apps/web/src/app/globals.css
git commit -m "feat(web): add CommentInput, CommentThread, CommentPanel components"
```

---

## Task 9: Toolbar에 주석 모드 버튼 추가

**Files:**

- Modify: `apps/web/src/components/storyboard/panels/toolbar.tsx`

- [ ] **Step 1: Toolbar 수정**

```tsx
// apps/web/src/components/storyboard/panels/toolbar.tsx
// 기존 import에 추가:
import { MessageSquare } from "lucide-react";

// ToolbarProps에 추가:
interface ToolbarProps {
  onAddNode: (type: StoryboardNodeType) => void;
  onOpenTemplates?: () => void;
  isCommentMode?: boolean;
  onToggleCommentMode?: () => void;
}

// 기존 버튼 목록 끝에 주석 모드 버튼 추가 (return JSX 안):
{
  onToggleCommentMode && (
    <>
      <div className="mx-1 h-5 w-px bg-border" />
      <Button
        type="button"
        variant={isCommentMode ? "default" : "outline"}
        size="sm"
        onClick={onToggleCommentMode}
        className="gap-1.5"
        title="주석 모드 (C)"
      >
        <MessageSquare className="h-3.5 w-3.5" />
        주석
      </Button>
    </>
  );
}
```

- [ ] **Step 2: 타입 체크**

```bash
pnpm check-types
```

Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add apps/web/src/components/storyboard/panels/toolbar.tsx
git commit -m "feat(web): add comment mode toggle button to toolbar"
```

---

## Task 10: Canvas에 주석 모드 props 추가

**Files:**

- Modify: `apps/web/src/components/storyboard/canvas.tsx`

- [ ] **Step 1: Canvas props 확장**

`apps/web/src/components/storyboard/canvas.tsx`에서:

```tsx
// CanvasProps에 추가
interface CanvasProps {
  // ... 기존 props ...
  onPaneClick?: (event: React.MouseEvent) => void;
  isCommentMode?: boolean;
  children?: React.ReactNode;
}

// Canvas 함수 시그니처에 추가
export function Canvas({
  // ... 기존 props ...
  onPaneClick,
  isCommentMode = false,
  children,
}: CanvasProps) {
```

`<ReactFlow>` 컴포넌트에 props 추가:

```tsx
<ReactFlow
  // ... 기존 props ...
  onPaneClick={onPaneClick}
  nodesDraggable={!isCommentMode}
  nodesConnectable={!isCommentMode}
  elementsSelectable={!isCommentMode}
>
  {/* 기존 Background, MiniMap, Controls */}
  {children}
</ReactFlow>
```

- [ ] **Step 2: 타입 체크**

```bash
pnpm check-types
```

Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add apps/web/src/components/storyboard/canvas.tsx
git commit -m "feat(web): add comment mode props to Canvas component"
```

---

## Task 11: useEditorShortcuts에 C 키 / Escape 추가

**Files:**

- Modify: `apps/web/src/components/storyboard/hooks/use-editor-shortcuts.ts`

- [ ] **Step 1: 단축키 추가**

`apps/web/src/components/storyboard/hooks/use-editor-shortcuts.ts`에서 `UseEditorShortcutsOptions`에 추가:

```typescript
interface UseEditorShortcutsOptions {
  // 기존 ...
  onToggleCommentMode?: () => void;
  onExitCommentMode?: () => void;
}
```

`handleKeyDown` 함수 맨 위(mod 체크 이전)에 추가:

```typescript
// C 키: 주석 모드 토글 (Ctrl/Cmd 없이)
if (!mod && !e.shiftKey && e.key.toLowerCase() === "c") {
  // input/textarea 포커스 중이면 무시
  if (
    document.activeElement?.tagName === "INPUT" ||
    document.activeElement?.tagName === "TEXTAREA"
  )
    return;
  e.preventDefault();
  onToggleCommentMode?.();
  return;
}

// Escape: 주석 모드 종료
if (e.key === "Escape") {
  onExitCommentMode?.();
  return;
}
```

- [ ] **Step 2: 타입 체크**

```bash
pnpm check-types
```

Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add apps/web/src/components/storyboard/hooks/use-editor-shortcuts.ts
git commit -m "feat(web): add C key and Escape shortcuts for comment mode"
```

---

## Task 12: editor.tsx 통합 — 주석 모드 분기 및 컴포넌트 연결

**Files:**

- Modify: `apps/web/src/components/storyboard/editor.tsx`

- [ ] **Step 1: import 추가**

`editor.tsx` import 섹션에 추가:

```typescript
import { useComments } from "./comments/useComments";
import { CommentOverlay } from "./comments/CommentOverlay";
import { CommentPanel } from "./comments/CommentPanel";
```

- [ ] **Step 2: 스토어에서 주석 상태 추출**

기존 `useEditorStore` 구조분해에 추가:

```typescript
const {
  // ... 기존 상태들 ...
  isCommentMode,
  activeCommentId,
  setCommentMode,
  setActiveCommentId,
} = useEditorStore();
```

- [ ] **Step 3: showResolved 로컬 상태 추가**

```typescript
const [showResolved, setShowResolved] = useState(false);
```

- [ ] **Step 4: useComments 훅 연결**

`useCollaboration` 아래에 추가:

```typescript
const socketRef = ... // 기존 collaboration에서 socket을 얻거나 useCollaboration 반환값 활용
// useCollaboration에서 socket 인스턴스 접근이 필요한 경우:
// useCollaboration이 socketRef를 반환하도록 변경하거나, socketRef를 직접 사용

// 임시: socket은 useCollaboration 훅에서 ref로 노출 필요
// 아래는 개념 코드 — 실제 socketRef는 useCollaboration 내부에 있음
const { emit: collabEmit, updatePresence, socketRef } = useCollaboration({ ... });

const { comments, isLoading: commentsLoading, addComment, deleteComment, updateCommentStatus, addReply, updateReply, deleteReply } = useComments({
  storyboardId: storyboardId ?? "",
  socket: socketRef?.current ?? null,
});
```

> **주의:** `use-collaboration.ts`에서 `socketRef`를 반환값에 추가해야 합니다:
>
> ```typescript
> return { emit, updatePresence, socketRef };
> ```

- [ ] **Step 5: 주석 모드 핸들러 추가**

```typescript
const handlePaneClickForComment = useCallback(
  (event: React.MouseEvent) => {
    if (!isCommentMode || !reactFlowInstance) return;
    const pos = reactFlowInstance.screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });
    void addComment({
      anchorType: "canvas",
      canvasX: pos.x,
      canvasY: pos.y,
      content: "",
    });
    // 빈 content로 주석 생성 후 즉시 패널 열기 — 실제로는 먼저 입력창을 띄운 후 submit 시 생성
    // 대안: 좌표를 state에 저장 후 CommentInput 팝업 표시
  },
  [isCommentMode, reactFlowInstance, addComment],
);

const handleNodeClickForComment = useCallback(
  (_: React.MouseEvent, node: Node) => {
    if (!isCommentMode) return;
    void addComment({ anchorType: "node", anchorNodeId: node.id, content: "" });
  },
  [isCommentMode, addComment],
);
```

> **구현 참고:** `addComment`를 즉시 빈 content로 호출하면 안 됩니다. 대신 pending 주석 상태를 별도로 관리하고 CommentInput 팝업으로 content 입력 후 `addComment` 호출하는 방식을 권장합니다. 구체적으로:
>
> 1. `pendingAnchor` 상태로 클릭 좌표/노드 ID 저장
> 2. CommentInput 모달 표시
> 3. 입력 submit 시 `addComment({ ...pendingAnchor, content })`
> 4. 취소 시 `pendingAnchor` 초기화

- [ ] **Step 6: useEditorShortcuts에 주석 모드 콜백 연결**

```typescript
useEditorShortcuts({
  // 기존 ...
  onToggleCommentMode: () => setCommentMode(!isCommentMode),
  onExitCommentMode: () => setCommentMode(false),
});
```

- [ ] **Step 7: Canvas props 연결 및 CommentOverlay 렌더링**

기존 `<Canvas>` 컴포넌트에 props 추가:

```tsx
<Canvas
  // ... 기존 props ...
  isCommentMode={isCommentMode}
  onPaneClick={isCommentMode ? handlePaneClickForComment : undefined}
>
  <PresenceLayer />
  <CommentOverlay
    comments={comments}
    activeCommentId={activeCommentId}
    onPinClick={(id) => setActiveCommentId(id)}
    showResolved={showResolved}
  />
</Canvas>
```

- [ ] **Step 8: CommentPanel 조건부 렌더링**

캔버스 래퍼 div 안에 추가:

```tsx
{
  activeCommentId && (
    <CommentPanel
      comments={comments}
      activeCommentId={activeCommentId}
      currentUserId={userId ?? ""}
      showResolved={showResolved}
      onToggleResolved={() => setShowResolved((prev) => !prev)}
      onClose={() => setActiveCommentId(null)}
      onDelete={async (id) => {
        await deleteComment(id);
        setActiveCommentId(null);
      }}
      onStatusChange={async (id, status) => {
        await updateCommentStatus(id, { status });
      }}
      onAddReply={async (commentId, content) => {
        await addReply(commentId, { content });
      }}
      onUpdateReply={async (replyId, content) => {
        await updateReply(replyId, { content });
      }}
      onDeleteReply={async (replyId) => {
        await deleteReply(replyId);
      }}
    />
  );
}
```

- [ ] **Step 9: Toolbar에 주석 모드 버튼 연결**

기존 `<Toolbar>` 사용처에 props 추가:

```tsx
<Toolbar
  // 기존 props...
  isCommentMode={isCommentMode}
  onToggleCommentMode={() => setCommentMode(!isCommentMode)}
/>
```

- [ ] **Step 10: blueprint 모드 시 주석 비활성화**

`isBlueprint` 조건부로 `useComments` 결과를 비활성화:

```typescript
const effectiveComments = isBlueprint ? [] : comments;
```

CommentOverlay와 CommentPanel에 `effectiveComments` 사용.

- [ ] **Step 11: 전체 타입 체크 + 빌드**

```bash
pnpm check-types
pnpm --filter web build
```

Expected: 에러 없음

- [ ] **Step 12: 커밋**

```bash
git add apps/web/src/components/storyboard/editor.tsx
git add apps/web/src/hooks/use-collaboration.ts
git commit -m "feat(web): integrate comment mode into editor — overlay, panel, shortcuts"
```

---

## Task 13: use-collaboration.ts에서 socketRef 노출

**Files:**

- Modify: `apps/web/src/hooks/use-collaboration.ts`

- [ ] **Step 1: 반환값에 socketRef 추가**

`use-collaboration.ts`에서 `return` 문에 `socketRef` 추가:

```typescript
return { emit, updatePresence, socketRef };
```

- [ ] **Step 2: 타입 체크**

```bash
pnpm check-types
```

Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add apps/web/src/hooks/use-collaboration.ts
git commit -m "feat(web): expose socketRef from useCollaboration"
```

---

## Task 14: 최종 검증

- [ ] **Step 1: 모든 테스트 통과**

```bash
pnpm --filter api test -- --run
pnpm --filter web test -- --run
```

Expected: 전체 PASS

- [ ] **Step 2: 전체 빌드 통과**

```bash
pnpm build
```

Expected: 에러 없음

- [ ] **Step 3: Docker + 마이그레이션 확인**

```bash
docker compose up -d
pnpm --filter @repo/db db:migrate
```

Expected: 마이그레이션 성공

- [ ] **Step 4: 수동 E2E 시나리오 확인**

```bash
pnpm dev
```

1. 브라우저 2개 탭에서 같은 스토리보드 열기
2. Tab1: `C` 키로 주석 모드 진입 → 커서 변경 확인
3. Tab1: 빈 캔버스 클릭 → 주석 입력 → 전송
4. Tab2: 실시간으로 핀 생성 확인
5. Tab1: 핀 클릭 → 우측 패널 슬라이드인 확인
6. Tab1: 답글 추가 → Tab2에서 실시간 반영 확인
7. Tab1: 주석 해결 → 핀 색상 변경 (분홍 → 초록) 확인
8. `Escape` → 주석 모드 종료 확인

- [ ] **Step 5: lint 통과**

```bash
pnpm lint
```

Expected: 에러 없음

- [ ] **Step 6: 최종 커밋**

```bash
git add .
git commit -m "feat: comments and feedback system MVP"
```
