# 실시간 협업 편집 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** NestJS WebSocket Gateway + Redis를 사용한 실시간 협업 편집 시스템 구축 — 노드/엣지 동기화, 프레즌스(커서/선택), 오프라인 큐 재연결 포함

**Architecture:** Redis를 source of truth로 사용해 노드 단위 원자적 업데이트(HSET)를 수행하고 PostgreSQL은 30초 주기 async flush. NestJS Socket.IO Gateway가 룸 관리 및 브로드캐스트를 담당하고, Next.js 클라이언트는 socket.io-client로 연결. 협업 토큰은 Next.js Server Action이 HMAC-SHA256으로 서명하고 NestJS WsAuthGuard가 검증.

**Tech Stack:** `@nestjs/websockets`, `@nestjs/platform-socket.io`, `socket.io`, `ioredis`, `socket.io-client`, Zustand, @xyflow/react `useViewport`/`screenToFlowPosition`

**Spec:** `docs/superpowers/specs/2026-04-09-realtime-collaboration.md`

---

## File Structure

### New Files

**Backend**

- `apps/api/src/collaboration/collaboration.module.ts` — NestJS 모듈
- `apps/api/src/collaboration/collaboration.gateway.ts` — Socket.IO 게이트웨이
- `apps/api/src/collaboration/collaboration.service.ts` — Redis 읽기/쓰기, 충돌 감지, DB flush
- `apps/api/src/collaboration/collaboration-redis.service.ts` — ioredis 연결 + Redis key 헬퍼
- `apps/api/src/collaboration/guards/ws-auth.guard.ts` — 협업 토큰 검증
- `apps/api/src/collaboration/dto/join-room.dto.ts`
- `apps/api/src/collaboration/dto/node-event.dto.ts`
- `apps/api/src/collaboration/dto/edge-event.dto.ts`
- `apps/api/src/collaboration/dto/presence-event.dto.ts`
- `apps/api/src/collaboration/dto/sync-event.dto.ts`
- `apps/api/src/collaboration/dto/replay-event.dto.ts`
- `apps/api/src/collaboration/__tests__/collaboration.service.test.ts`

**Frontend**

- `packages/types/src/collaboration.ts` — 공유 타입 (UserPresence, Operation, CollabToken)
- `apps/web/src/actions/get-collab-token-action.ts` — 협업 토큰 발급 Server Action
- `apps/web/src/stores/collaboration-slice.ts` — Zustand 프레즌스 슬라이스
- `apps/web/src/lib/offline-queue.ts` — 오프라인 큐 재전송 필터 순수 함수
- `apps/web/src/lib/__tests__/offline-queue.test.ts` — TDD 테스트
- `apps/web/src/hooks/use-collaboration.ts` — Socket.IO 연결 + 오프라인 큐 + 재연결
- `apps/web/src/components/storyboard/presence-layer.tsx` — SVG 오버레이

### Modified Files

- `docker-compose.yml` — Redis 서비스 추가
- `packages/types/src/index.ts` — collaboration export 추가
- `apps/api/package.json` — WebSocket + Redis 패키지 추가
- `apps/api/src/app.module.ts` — CollaborationModule import
- `apps/api/src/auth/internal-auth.guard.ts` — WS 컨텍스트 스킵
- `apps/api/src/main.ts` — enableShutdownHooks, Socket.IO maxHttpBufferSize
- `apps/web/package.json` — socket.io-client 추가
- `apps/web/src/components/storyboard/editor.tsx` — useCollaboration 통합, isRemoteUpdateRef, PresenceLayer 삽입
- `apps/web/src/components/storyboard/canvas.tsx` — nodeClassName prop 추가

---

## Task 1: 인프라 — Redis + 패키지 설치

**Files:**

- Modify: `docker-compose.yml`
- Modify: `apps/api/package.json`
- Modify: `apps/web/package.json`

- [ ] **Step 1: docker-compose.yml에 Redis 추가**

```yaml
# docker-compose.yml 기존 services: 블록에 추가
redis:
  image: redis:7-alpine
  container_name: boardinary-redis
  restart: unless-stopped
  ports:
    - "6379:6379"
  command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru
```

- [ ] **Step 2: API 패키지 설치**

Run: `pnpm --filter api add @nestjs/websockets @nestjs/platform-socket.io socket.io ioredis`

- [ ] **Step 3: Web 패키지 설치**

Run: `pnpm --filter web add socket.io-client`

- [ ] **Step 4: Redis 실행 확인**

Run: `docker compose up -d redis && docker compose ps redis`
Expected: `boardinary-redis` Up 상태

- [ ] **Step 5: API env 파일에 환경변수 추가**

`apps/api/.env` (또는 `.env.local`)에 추가:

```
REDIS_URL=redis://localhost:6379
COLLAB_FLUSH_INTERVAL_MS=30000
SOCKET_MAX_PAYLOAD_MB=5
```

`apps/web/.env.local`에 추가:

```
NEXT_PUBLIC_WS_URL=http://localhost:4001
```

- [ ] **Step 6: 커밋**

```bash
git add docker-compose.yml apps/api/package.json apps/web/package.json pnpm-lock.yaml apps/api/.env apps/web/.env.local
git commit -m "chore: add Redis infra and WebSocket packages"
```

---

## Task 2: 공유 타입 추가

**Files:**

- Create: `packages/types/src/collaboration.ts`
- Modify: `packages/types/src/index.ts`

- [ ] **Step 1: collaboration.ts 생성**

```typescript
// packages/types/src/collaboration.ts

export interface UserPresence {
  userId: string;
  name: string;
  color: string;
  cursor: { x: number; y: number } | null;
  selectedNodeIds: string[];
  lastSeen: number;
}

export type OperationType =
  | "node:update"
  | "node:add"
  | "node:delete"
  | "edge:add"
  | "edge:update"
  | "edge:delete";

export interface Operation {
  id: string;
  type: OperationType;
  payload: unknown;
  clientVersion: number;
  timestamp: number;
  retryCount: number;
}

export interface CollabTokenPayload {
  userId: string;
  name: string;
  exp: number;
}

export interface RoomStatePayload {
  content: Record<string, unknown> | null;
  version: number;
  presence: UserPresence[];
}
```

- [ ] **Step 2: index.ts에 export 추가**

```typescript
// packages/types/src/index.ts 기존 내용 끝에 추가
export * from "./collaboration";
```

- [ ] **Step 3: 타입 체크**

Run: `pnpm check-types`
Expected: 0 errors

- [ ] **Step 4: 커밋**

```bash
git add packages/types/src/collaboration.ts packages/types/src/index.ts
git commit -m "feat: add shared collaboration types"
```

---

## Task 3: CollaborationRedisService (TDD)

**Files:**

- Create: `apps/api/src/collaboration/collaboration-redis.service.ts`
- Create: `apps/api/src/collaboration/__tests__/collaboration-redis.service.test.ts`

- [ ] **Step 1: RED — 실패하는 테스트 작성**

```typescript
// apps/api/src/collaboration/__tests__/collaboration-redis.service.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CollaborationRedisService } from "../collaboration-redis.service";

const mockRedis = {
  hset: vi.fn(),
  hget: vi.fn(),
  hgetall: vi.fn(),
  hdel: vi.fn(),
  incr: vi.fn(),
  get: vi.fn(),
  set: vi.fn(),
  setex: vi.fn(),
  del: vi.fn(),
  expire: vi.fn(),
  keys: vi.fn(),
  multi: vi.fn(),
};

describe("CollaborationRedisService", () => {
  let service: CollaborationRedisService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new CollaborationRedisService(mockRedis as never);
  });

  describe("setNode", () => {
    it("노드를 Redis Hash에 저장한다", async () => {
      mockRedis.hset.mockResolvedValue(1);
      await service.setNode("sb1", "node1", { id: "node1", type: "scene" });
      expect(mockRedis.hset).toHaveBeenCalledWith(
        "storyboard:sb1:nodes",
        "node1",
        JSON.stringify({ id: "node1", type: "scene" }),
      );
    });
  });

  describe("deleteNode", () => {
    it("노드를 Redis Hash에서 삭제한다", async () => {
      mockRedis.hdel.mockResolvedValue(1);
      await service.deleteNode("sb1", "node1");
      expect(mockRedis.hdel).toHaveBeenCalledWith(
        "storyboard:sb1:nodes",
        "node1",
      );
    });
  });

  describe("getAllNodes", () => {
    it("모든 노드를 파싱하여 반환한다", async () => {
      mockRedis.hgetall.mockResolvedValue({
        node1: JSON.stringify({ id: "node1", type: "scene" }),
        node2: JSON.stringify({ id: "node2", type: "event" }),
      });
      const result = await service.getAllNodes("sb1");
      expect(result).toEqual([
        { id: "node1", type: "scene" },
        { id: "node2", type: "event" },
      ]);
    });

    it("노드가 없으면 빈 배열을 반환한다", async () => {
      mockRedis.hgetall.mockResolvedValue(null);
      const result = await service.getAllNodes("sb1");
      expect(result).toEqual([]);
    });
  });

  describe("incrementVersion", () => {
    it("버전을 1 증가시키고 새 버전을 반환한다", async () => {
      mockRedis.incr.mockResolvedValue(5);
      const version = await service.incrementVersion("sb1");
      expect(version).toBe(5);
      expect(mockRedis.incr).toHaveBeenCalledWith("storyboard:sb1:version");
    });
  });

  describe("getVersion", () => {
    it("현재 버전을 숫자로 반환한다", async () => {
      mockRedis.get.mockResolvedValue("3");
      const version = await service.getVersion("sb1");
      expect(version).toBe(3);
    });

    it("버전이 없으면 0을 반환한다", async () => {
      mockRedis.get.mockResolvedValue(null);
      const version = await service.getVersion("sb1");
      expect(version).toBe(0);
    });
  });

  describe("setLastWriter", () => {
    it("nodeId에 lastWriter를 300ms TTL로 저장한다", async () => {
      mockRedis.setex.mockResolvedValue("OK");
      await service.setLastWriter("sb1", "node1", "socket123");
      expect(mockRedis.setex).toHaveBeenCalledWith(
        "storyboard:sb1:nodes:node1:lastWriter",
        1,
        "socket123",
      );
    });
  });

  describe("getLastWriter", () => {
    it("lastWriter socketId를 반환한다", async () => {
      mockRedis.get.mockResolvedValue("socket456");
      const result = await service.getLastWriter("sb1", "node1");
      expect(result).toBe("socket456");
    });

    it("없으면 null을 반환한다", async () => {
      mockRedis.get.mockResolvedValue(null);
      const result = await service.getLastWriter("sb1", "node1");
      expect(result).toBeNull();
    });
  });

  describe("markDirty / getDirtyStoryboardIds", () => {
    it("dirty 플래그를 설정한다", async () => {
      mockRedis.set.mockResolvedValue("OK");
      await service.markDirty("sb1");
      expect(mockRedis.set).toHaveBeenCalledWith("storyboard:sb1:dirty", "1");
    });

    it("dirty 스토리보드 ID 목록을 반환한다", async () => {
      mockRedis.keys.mockResolvedValue([
        "storyboard:sb1:dirty",
        "storyboard:sb2:dirty",
      ]);
      const ids = await service.getDirtyStoryboardIds();
      expect(ids).toEqual(["sb1", "sb2"]);
    });
  });
});
```

- [ ] **Step 2: RED 확인**

Run: `pnpm --filter api test`
Expected: FAIL — `CollaborationRedisService` not found

- [ ] **Step 3: GREEN — 구현**

```typescript
// apps/api/src/collaboration/collaboration-redis.service.ts
import { Injectable } from "@nestjs/common";
import type Redis from "ioredis";

@Injectable()
export class CollaborationRedisService {
  constructor(private readonly redis: Redis) {}

  // --- Node ---
  async setNode(
    storyboardId: string,
    nodeId: string,
    node: unknown,
  ): Promise<void> {
    await this.redis.hset(
      `storyboard:${storyboardId}:nodes`,
      nodeId,
      JSON.stringify(node),
    );
  }

  async deleteNode(storyboardId: string, nodeId: string): Promise<void> {
    await this.redis.hdel(`storyboard:${storyboardId}:nodes`, nodeId);
  }

  async getAllNodes(storyboardId: string): Promise<unknown[]> {
    const raw = await this.redis.hgetall(`storyboard:${storyboardId}:nodes`);
    if (!raw) return [];
    return Object.values(raw).map((v) => JSON.parse(v) as unknown);
  }

  // --- Edge ---
  async setEdge(
    storyboardId: string,
    edgeId: string,
    edge: unknown,
  ): Promise<void> {
    await this.redis.hset(
      `storyboard:${storyboardId}:edges`,
      edgeId,
      JSON.stringify(edge),
    );
  }

  async deleteEdge(storyboardId: string, edgeId: string): Promise<void> {
    await this.redis.hdel(`storyboard:${storyboardId}:edges`, edgeId);
  }

  async getAllEdges(storyboardId: string): Promise<unknown[]> {
    const raw = await this.redis.hgetall(`storyboard:${storyboardId}:edges`);
    if (!raw) return [];
    return Object.values(raw).map((v) => JSON.parse(v) as unknown);
  }

  // --- Version ---
  async incrementVersion(storyboardId: string): Promise<number> {
    return this.redis.incr(`storyboard:${storyboardId}:version`);
  }

  async getVersion(storyboardId: string): Promise<number> {
    const v = await this.redis.get(`storyboard:${storyboardId}:version`);
    return v ? parseInt(v, 10) : 0;
  }

  // --- Conflict detection ---
  async setLastWriter(
    storyboardId: string,
    nodeId: string,
    socketId: string,
  ): Promise<void> {
    // TTL 1초 (300ms면 충분하지만 Redis SETEX는 정수 초 단위)
    await this.redis.setex(
      `storyboard:${storyboardId}:nodes:${nodeId}:lastWriter`,
      1,
      socketId,
    );
  }

  async getLastWriter(
    storyboardId: string,
    nodeId: string,
  ): Promise<string | null> {
    return this.redis.get(
      `storyboard:${storyboardId}:nodes:${nodeId}:lastWriter`,
    );
  }

  // --- Presence ---
  async setPresence(
    storyboardId: string,
    userId: string,
    presence: unknown,
  ): Promise<void> {
    await this.redis.hset(
      `storyboard:${storyboardId}:presence`,
      userId,
      JSON.stringify(presence),
    );
  }

  async removePresence(storyboardId: string, userId: string): Promise<void> {
    await this.redis.hdel(`storyboard:${storyboardId}:presence`, userId);
  }

  async getAllPresence(storyboardId: string): Promise<unknown[]> {
    const raw = await this.redis.hgetall(`storyboard:${storyboardId}:presence`);
    if (!raw) return [];
    return Object.values(raw).map((v) => JSON.parse(v) as unknown);
  }

  // --- Auth cache ---
  async setAuthCache(
    socketId: string,
    userId: string,
    name: string,
    storyboardId: string,
  ): Promise<void> {
    await this.redis.setex(
      `auth:${socketId}`,
      300, // 5분
      JSON.stringify({ userId, name, authorizedRooms: [storyboardId] }),
    );
  }

  async getAuthCache(
    socketId: string,
  ): Promise<{
    userId: string;
    name: string;
    authorizedRooms: string[];
  } | null> {
    const raw = await this.redis.get(`auth:${socketId}`);
    if (!raw) return null;
    return JSON.parse(raw) as {
      userId: string;
      name: string;
      authorizedRooms: string[];
    };
  }

  async deleteAuthCache(socketId: string): Promise<void> {
    await this.redis.del(`auth:${socketId}`);
  }

  // --- Dirty flag ---
  async markDirty(storyboardId: string): Promise<void> {
    await this.redis.set(`storyboard:${storyboardId}:dirty`, "1");
  }

  async clearDirty(storyboardId: string): Promise<void> {
    await this.redis.del(`storyboard:${storyboardId}:dirty`);
  }

  async getDirtyStoryboardIds(): Promise<string[]> {
    const keys = await this.redis.keys("storyboard:*:dirty");
    return keys.map((k) => k.split(":")[1]!);
  }

  // --- TTL management ---
  async setRoomTtl(storyboardId: string, seconds: number): Promise<void> {
    const keys = [
      `storyboard:${storyboardId}:nodes`,
      `storyboard:${storyboardId}:edges`,
      `storyboard:${storyboardId}:version`,
      `storyboard:${storyboardId}:presence`,
    ];
    for (const key of keys) {
      await this.redis.expire(key, seconds);
    }
  }
}
```

- [ ] **Step 4: GREEN 확인**

Run: `pnpm --filter api test`
Expected: 모든 테스트 통과

- [ ] **Step 5: 커밋**

```bash
git add apps/api/src/collaboration/
git commit -m "feat: add CollaborationRedisService with TDD"
```

---

## Task 4: WsAuthGuard + 협업 토큰

**Files:**

- Create: `apps/api/src/collaboration/guards/ws-auth.guard.ts`
- Create: `apps/web/src/actions/get-collab-token-action.ts`
- Modify: `apps/api/src/auth/internal-auth.guard.ts`

- [ ] **Step 1: InternalAuthGuard — WS 컨텍스트 스킵**

`apps/api/src/auth/internal-auth.guard.ts`의 `canActivate` 메서드 첫 줄에 추가:

```typescript
canActivate(context: ExecutionContext): boolean {
  // WS 컨텍스트는 WsAuthGuard가 처리 — 전역 HTTP Guard 스킵
  if (context.getType() === "ws") return true;

  // ... 기존 코드 그대로
```

- [ ] **Step 2: WsAuthGuard 생성**

```typescript
// apps/api/src/collaboration/guards/ws-auth.guard.ts
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac } from "crypto";
import type { Socket } from "socket.io";
import type { CollabTokenPayload } from "@repo/types";

@Injectable()
export class WsAuthGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client: Socket = context.switchToWs().getClient();
    const token = client.handshake.auth["token"] as string | undefined;

    if (!token) throw new UnauthorizedException("Missing collab token");

    const payload = this.verifyToken(token);
    if (!payload) throw new UnauthorizedException("Invalid collab token");

    // 소켓에 userId, name 저장 (이후 핸들러에서 참조)
    client.data["userId"] = payload.userId;
    client.data["name"] = payload.name;
    return true;
  }

  verifyToken(token: string): CollabTokenPayload | null {
    const parts = token.split(".");
    if (parts.length !== 2) return null;

    const [payloadB64, sig] = parts as [string, string];
    const secret = this.config.get<string>("INTERNAL_API_SECRET") ?? "";
    const expected = createHmac("sha256", secret)
      .update(payloadB64)
      .digest("hex");

    if (sig !== expected) return null;

    let payload: CollabTokenPayload;
    try {
      payload = JSON.parse(
        Buffer.from(payloadB64, "base64url").toString("utf8"),
      ) as CollabTokenPayload;
    } catch {
      return null;
    }

    if (Date.now() > payload.exp) return null;
    return payload;
  }
}
```

- [ ] **Step 3: 협업 토큰 Server Action 생성**

```typescript
// apps/web/src/actions/get-collab-token-action.ts
"use server";

import { auth } from "@/auth";
import { createHmac } from "crypto";
import type { CollabTokenPayload } from "@repo/types";

export async function getCollabTokenAction(): Promise<
  { token: string } | { error: string }
> {
  const session = await auth();
  if (!session?.user?.id || !session.user.name) {
    return { error: "Unauthorized" };
  }

  const secret = process.env.INTERNAL_API_SECRET ?? "";
  const payload: CollabTokenPayload = {
    userId: session.user.id,
    name: session.user.name,
    exp: Date.now() + 60_000, // 60초 유효
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", secret).update(payloadB64).digest("hex");

  return { token: `${payloadB64}.${sig}` };
}
```

- [ ] **Step 4: 타입 체크**

Run: `pnpm check-types`
Expected: 0 errors

- [ ] **Step 5: 커밋**

```bash
git add apps/api/src/collaboration/guards/ apps/api/src/auth/internal-auth.guard.ts apps/web/src/actions/get-collab-token-action.ts
git commit -m "feat: add WsAuthGuard and collab token Server Action"
```

---

## Task 5: CollaborationService (TDD)

**Files:**

- Create: `apps/api/src/collaboration/collaboration.service.ts`
- Modify: `apps/api/src/collaboration/__tests__/collaboration.service.test.ts`

- [ ] **Step 1: RED — CollaborationService 테스트 작성**

```typescript
// apps/api/src/collaboration/__tests__/collaboration.service.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CollaborationService } from "../collaboration.service";
import type { CollaborationRedisService } from "../collaboration-redis.service";

const mockRedis: Partial<CollaborationRedisService> = {
  setNode: vi.fn().mockResolvedValue(undefined),
  deleteNode: vi.fn().mockResolvedValue(undefined),
  getAllNodes: vi.fn().mockResolvedValue([]),
  setEdge: vi.fn().mockResolvedValue(undefined),
  deleteEdge: vi.fn().mockResolvedValue(undefined),
  getAllEdges: vi.fn().mockResolvedValue([]),
  incrementVersion: vi.fn().mockResolvedValue(1),
  getVersion: vi.fn().mockResolvedValue(0),
  setLastWriter: vi.fn().mockResolvedValue(undefined),
  getLastWriter: vi.fn().mockResolvedValue(null),
  setPresence: vi.fn().mockResolvedValue(undefined),
  removePresence: vi.fn().mockResolvedValue(undefined),
  getAllPresence: vi.fn().mockResolvedValue([]),
  setAuthCache: vi.fn().mockResolvedValue(undefined),
  getAuthCache: vi.fn().mockResolvedValue(null),
  deleteAuthCache: vi.fn().mockResolvedValue(undefined),
  markDirty: vi.fn().mockResolvedValue(undefined),
  clearDirty: vi.fn().mockResolvedValue(undefined),
  getDirtyStoryboardIds: vi.fn().mockResolvedValue([]),
  setRoomTtl: vi.fn().mockResolvedValue(undefined),
};

const mockStoryboardsService = {
  ensureStoryboardAccess: vi.fn().mockResolvedValue(undefined),
  getStoryboardById: vi.fn().mockResolvedValue({
    id: "sb1",
    content: {
      version: 1,
      nodes: [],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    },
    contentVersion: 0,
  }),
  updateStoryboard: vi.fn().mockResolvedValue(undefined),
};

vi.mock("@repo/db", () => ({}));

describe("CollaborationService", () => {
  let service: CollaborationService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new CollaborationService(
      mockRedis as CollaborationRedisService,
      mockStoryboardsService as never,
    );
  });

  describe("handleNodeUpdate", () => {
    it("노드를 Redis에 저장하고 버전을 증가시킨다", async () => {
      mockRedis.incrementVersion!.mockResolvedValue(2);
      const result = await service.handleNodeUpdate("sb1", "socket1", {
        id: "node1",
        type: "scene",
      });
      expect(mockRedis.setNode).toHaveBeenCalledWith("sb1", "node1", {
        id: "node1",
        type: "scene",
      });
      expect(mockRedis.markDirty).toHaveBeenCalledWith("sb1");
      expect(result.version).toBe(2);
    });

    it("이전 writer가 다른 소켓이면 conflict socketId를 반환한다", async () => {
      mockRedis.getLastWriter!.mockResolvedValue("otherSocket");
      mockRedis.incrementVersion!.mockResolvedValue(3);
      const result = await service.handleNodeUpdate("sb1", "socket1", {
        id: "node1",
        type: "scene",
      });
      expect(result.conflictSocketId).toBe("otherSocket");
    });

    it("이전 writer가 없으면 conflictSocketId가 undefined이다", async () => {
      mockRedis.getLastWriter!.mockResolvedValue(null);
      mockRedis.incrementVersion!.mockResolvedValue(1);
      const result = await service.handleNodeUpdate("sb1", "socket1", {
        id: "node1",
        type: "scene",
      });
      expect(result.conflictSocketId).toBeUndefined();
    });
  });

  describe("getRoomState", () => {
    it("version이 같으면 content를 null로 반환한다", async () => {
      mockRedis.getVersion!.mockResolvedValue(5);
      mockRedis.getAllPresence!.mockResolvedValue([]);
      const result = await service.getRoomState("sb1", 5);
      expect(result.content).toBeNull();
      expect(result.version).toBe(5);
    });

    it("version이 다르면 노드/엣지를 포함한 content를 반환한다", async () => {
      mockRedis.getVersion!.mockResolvedValue(5);
      mockRedis.getAllNodes!.mockResolvedValue([{ id: "n1" }]);
      mockRedis.getAllEdges!.mockResolvedValue([{ id: "e1" }]);
      mockRedis.getAllPresence!.mockResolvedValue([]);
      const result = await service.getRoomState("sb1", 3);
      expect(result.content).toEqual({
        nodes: [{ id: "n1" }],
        edges: [{ id: "e1" }],
      });
    });
  });
});
```

- [ ] **Step 2: RED 확인**

Run: `pnpm --filter api test`
Expected: FAIL — `CollaborationService` not found

- [ ] **Step 3: GREEN — CollaborationService 구현**

```typescript
// apps/api/src/collaboration/collaboration.service.ts
import { Injectable } from "@nestjs/common";
import { CollaborationRedisService } from "./collaboration-redis.service";
import { StoryboardsService } from "../storyboards/storyboards.service";
import type { RoomStatePayload, UserPresence } from "@repo/types";

const PRESENCE_COLORS = [
  "#8b5cf6",
  "#10b981",
  "#f59e0b",
  "#3b82f6",
  "#ef4444",
  "#ec4899",
  "#14b8a6",
  "#f97316",
];

@Injectable()
export class CollaborationService {
  private readonly roomColors = new Map<string, Map<string, string>>(); // storyboardId → userId → color

  constructor(
    private readonly redis: CollaborationRedisService,
    private readonly storyboardsService: StoryboardsService,
  ) {}

  /** 룸 입장 시 색상 배정 */
  assignColor(storyboardId: string, userId: string): string {
    if (!this.roomColors.has(storyboardId)) {
      this.roomColors.set(storyboardId, new Map());
    }
    const roomMap = this.roomColors.get(storyboardId)!;
    if (roomMap.has(userId)) return roomMap.get(userId)!;

    const used = new Set(roomMap.values());
    const color =
      PRESENCE_COLORS.find((c) => !used.has(c)) ?? PRESENCE_COLORS[0]!;
    roomMap.set(userId, color);
    return color;
  }

  releaseColor(storyboardId: string, userId: string): void {
    this.roomColors.get(storyboardId)?.delete(userId);
  }

  /** 권한 확인 (캐시 → DB 폴백) */
  async checkAccess(
    socketId: string,
    storyboardId: string,
    userId: string,
  ): Promise<boolean> {
    const cached = await this.redis.getAuthCache(socketId);
    if (cached?.authorizedRooms.includes(storyboardId)) return true;

    try {
      await this.storyboardsService.ensureStoryboardAccess(
        storyboardId,
        userId,
      );
      await this.redis.setAuthCache(socketId, userId, "", storyboardId);
      return true;
    } catch {
      return false;
    }
  }

  /** 룸 현재 상태 반환 (version 동일하면 content null) */
  async getRoomState(
    storyboardId: string,
    clientVersion: number,
  ): Promise<RoomStatePayload> {
    const version = await this.redis.getVersion(storyboardId);
    const presenceRaw = await this.redis.getAllPresence(storyboardId);
    const presence = presenceRaw as UserPresence[];

    if (version === clientVersion) {
      return { content: null, version, presence };
    }

    const nodes = await this.redis.getAllNodes(storyboardId);
    const edges = await this.redis.getAllEdges(storyboardId);
    return { content: { nodes, edges }, version, presence };
  }

  /** 초기 룸 진입 시 DB에서 Redis로 상태 로드 */
  async initRoomFromDb(storyboardId: string): Promise<number> {
    const existing = await this.redis.getVersion(storyboardId);
    if (existing > 0) return existing;

    const storyboard =
      await this.storyboardsService.getStoryboardById(storyboardId);
    const content = storyboard.content as {
      nodes?: Array<{ id: string }>;
      edges?: Array<{ id: string }>;
    };

    for (const node of content.nodes ?? []) {
      await this.redis.setNode(storyboardId, node.id, node);
    }
    for (const edge of content.edges ?? []) {
      await this.redis.setEdge(storyboardId, edge.id, edge);
    }

    const version = storyboard.contentVersion;
    // version을 Redis에 초기화
    for (let i = 0; i < version; i++) {
      await this.redis.incrementVersion(storyboardId);
    }
    return version;
  }

  /** 노드 업데이트 — conflict 감지 포함 */
  async handleNodeUpdate(
    storyboardId: string,
    socketId: string,
    node: Record<string, unknown>,
  ): Promise<{ version: number; conflictSocketId?: string }> {
    const nodeId = node["id"] as string;
    const prevWriter = await this.redis.getLastWriter(storyboardId, nodeId);
    const conflictSocketId =
      prevWriter && prevWriter !== socketId ? prevWriter : undefined;

    await this.redis.setNode(storyboardId, nodeId, node);
    await this.redis.setLastWriter(storyboardId, nodeId, socketId);
    await this.redis.markDirty(storyboardId);
    const version = await this.redis.incrementVersion(storyboardId);

    return { version, conflictSocketId };
  }

  async handleNodeDelete(
    storyboardId: string,
    nodeId: string,
  ): Promise<number> {
    await this.redis.deleteNode(storyboardId, nodeId);
    await this.redis.markDirty(storyboardId);
    return this.redis.incrementVersion(storyboardId);
  }

  async handleEdgeUpdate(
    storyboardId: string,
    edge: Record<string, unknown>,
  ): Promise<number> {
    const edgeId = edge["id"] as string;
    await this.redis.setEdge(storyboardId, edgeId, edge);
    await this.redis.markDirty(storyboardId);
    return this.redis.incrementVersion(storyboardId);
  }

  async handleEdgeDelete(
    storyboardId: string,
    edgeId: string,
  ): Promise<number> {
    await this.redis.deleteEdge(storyboardId, edgeId);
    await this.redis.markDirty(storyboardId);
    return this.redis.incrementVersion(storyboardId);
  }

  /** 프레즌스 업데이트 (DB 저장 없음) */
  async updatePresence(
    storyboardId: string,
    presence: UserPresence,
  ): Promise<void> {
    await this.redis.setPresence(storyboardId, presence.userId, {
      ...presence,
      lastSeen: Date.now(),
    });
  }

  /** DB flush — dirty 스토리보드의 Redis 상태를 PostgreSQL에 저장 */
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
      contentVersion: version - 1, // optimistic lock bypass: use version - 1
    });

    await this.redis.clearDirty(storyboardId);
  }

  async flushAllDirtyRooms(): Promise<void> {
    const ids = await this.redis.getDirtyStoryboardIds();
    await Promise.all(
      ids.map((id) => this.flushStoryboard(id).catch(() => undefined)),
    );
  }

  async onUserLeave(
    storyboardId: string,
    userId: string,
    socketId: string,
    isLastUser: boolean,
  ): Promise<void> {
    await this.redis.removePresence(storyboardId, userId);
    await this.redis.deleteAuthCache(socketId);
    this.releaseColor(storyboardId, userId);

    if (isLastUser) {
      await this.flushStoryboard(storyboardId).catch(() => undefined);
      await this.redis.setRoomTtl(storyboardId, 600); // 10분
    }
  }
}
```

- [ ] **Step 4: GREEN 확인**

Run: `pnpm --filter api test`
Expected: 모든 테스트 통과

- [ ] **Step 5: 커밋**

```bash
git add apps/api/src/collaboration/collaboration.service.ts apps/api/src/collaboration/__tests__/collaboration.service.test.ts
git commit -m "feat: add CollaborationService with TDD"
```

---

## Task 6: CollaborationGateway + Module

**Files:**

- Create: `apps/api/src/collaboration/dto/*.dto.ts` (6개)
- Create: `apps/api/src/collaboration/collaboration.gateway.ts`
- Create: `apps/api/src/collaboration/collaboration.module.ts`
- Modify: `apps/api/src/app.module.ts`
- Modify: `apps/api/src/main.ts`

- [ ] **Step 1: DTO 파일 생성**

```typescript
// apps/api/src/collaboration/dto/join-room.dto.ts
import { IsString } from "class-validator";
export class JoinRoomDto {
  @IsString() storyboardId!: string;
}

// apps/api/src/collaboration/dto/sync-event.dto.ts
import { IsNumber, IsString } from "class-validator";
export class SyncEventDto {
  @IsString() storyboardId!: string;
  @IsNumber() version!: number;
}

// apps/api/src/collaboration/dto/node-event.dto.ts
import { IsObject, IsOptional, IsString } from "class-validator";
export class NodeEventDto {
  @IsString() storyboardId!: string;
  @IsObject() node!: Record<string, unknown>;
  @IsOptional() @IsString() nodeId?: string;
}

// apps/api/src/collaboration/dto/edge-event.dto.ts
import { IsObject, IsOptional, IsString } from "class-validator";
export class EdgeEventDto {
  @IsString() storyboardId!: string;
  @IsObject() @IsOptional() edge?: Record<string, unknown>;
  @IsOptional() @IsString() edgeId?: string;
}

// apps/api/src/collaboration/dto/presence-event.dto.ts
import { IsArray, IsOptional, IsObject } from "class-validator";
export class PresenceEventDto {
  @IsOptional() @IsObject() cursor?: { x: number; y: number } | null;
  @IsArray() selectedNodeIds!: string[];
}

// apps/api/src/collaboration/dto/replay-event.dto.ts
import { IsArray, IsString } from "class-validator";
export class ReplayEventDto {
  @IsString() storyboardId!: string;
  @IsArray() ops!: unknown[];
}
```

- [ ] **Step 2: CollaborationGateway 생성**

```typescript
// apps/api/src/collaboration/collaboration.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayDisconnect,
} from "@nestjs/websockets";
import { UseGuards, UsePipes, ValidationPipe } from "@nestjs/common";
import { Server, Socket } from "socket.io";
import { OnEvent } from "@nestjs/event-emitter";
import { WsAuthGuard } from "./guards/ws-auth.guard";
import { CollaborationService } from "./collaboration.service";
import { JoinRoomDto } from "./dto/join-room.dto";
import { SyncEventDto } from "./dto/sync-event.dto";
import { NodeEventDto } from "./dto/node-event.dto";
import { EdgeEventDto } from "./dto/edge-event.dto";
import { PresenceEventDto } from "./dto/presence-event.dto";
import { ReplayEventDto } from "./dto/replay-event.dto";
import type { UserPresence, Operation } from "@repo/types";

@WebSocketGateway({
  cors: {
    origin: process.env.WEB_URL ?? "http://localhost:4000",
    credentials: true,
  },
  maxHttpBufferSize:
    parseInt(process.env.SOCKET_MAX_PAYLOAD_MB ?? "5") * 1024 * 1024,
})
@UseGuards(WsAuthGuard)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class CollaborationGateway implements OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  // socketId → storyboardId (단일 룸 가정)
  private readonly socketRoom = new Map<string, string>();

  constructor(private readonly collaborationService: CollaborationService) {}

  @SubscribeMessage("room:join")
  async handleJoin(
    @MessageBody() dto: JoinRoomDto,
    @ConnectedSocket() client: Socket,
  ) {
    const userId = client.data["userId"] as string;
    const name = client.data["name"] as string;

    const canAccess = await this.collaborationService.checkAccess(
      client.id,
      dto.storyboardId,
      userId,
    );
    if (!canAccess) {
      client.emit("error", { message: "Access denied" });
      return;
    }

    await this.collaborationService.initRoomFromDb(dto.storyboardId);

    client.join(dto.storyboardId);
    this.socketRoom.set(client.id, dto.storyboardId);

    const color = this.collaborationService.assignColor(
      dto.storyboardId,
      userId,
    );
    const version = await this.collaborationService["redis"].getVersion(
      dto.storyboardId,
    );
    const state = await this.collaborationService.getRoomState(
      dto.storyboardId,
      -1,
    );

    client.emit("room:state", state);

    // 입장 알림
    client
      .to(dto.storyboardId)
      .emit("room:user-joined", { userId, name, color });

    // 이 소켓의 presence 초기화
    const presence: UserPresence = {
      userId,
      name,
      color,
      cursor: null,
      selectedNodeIds: [],
      lastSeen: Date.now(),
    };
    await this.collaborationService.updatePresence(dto.storyboardId, presence);
  }

  @SubscribeMessage("room:leave")
  async handleLeave(
    @MessageBody() dto: JoinRoomDto,
    @ConnectedSocket() client: Socket,
  ) {
    await this.leaveRoom(client, dto.storyboardId);
  }

  @SubscribeMessage("room:sync")
  async handleSync(
    @MessageBody() dto: SyncEventDto,
    @ConnectedSocket() client: Socket,
  ) {
    const state = await this.collaborationService.getRoomState(
      dto.storyboardId,
      dto.version,
    );
    client.emit("room:state", state);
  }

  @SubscribeMessage("node:update")
  async handleNodeUpdate(
    @MessageBody() dto: NodeEventDto,
    @ConnectedSocket() client: Socket,
  ) {
    const { version, conflictSocketId } =
      await this.collaborationService.handleNodeUpdate(
        dto.storyboardId,
        client.id,
        dto.node,
      );

    if (conflictSocketId) {
      this.server.to(conflictSocketId).emit("collab:conflict", {
        nodeId: dto.node["id"] as string,
      });
    }

    client
      .to(dto.storyboardId)
      .emit("node:update", { node: dto.node, version });
    client.emit("node:update:ack", { version });
  }

  @SubscribeMessage("node:add")
  async handleNodeAdd(
    @MessageBody() dto: NodeEventDto,
    @ConnectedSocket() client: Socket,
  ) {
    const { version } = await this.collaborationService.handleNodeUpdate(
      dto.storyboardId,
      client.id,
      dto.node,
    );
    client.to(dto.storyboardId).emit("node:add", { node: dto.node, version });
    client.emit("node:add:ack", { version });
  }

  @SubscribeMessage("node:delete")
  async handleNodeDelete(
    @MessageBody() dto: NodeEventDto,
    @ConnectedSocket() client: Socket,
  ) {
    const nodeId = dto.nodeId ?? (dto.node["id"] as string);
    const version = await this.collaborationService.handleNodeDelete(
      dto.storyboardId,
      nodeId,
    );
    client.to(dto.storyboardId).emit("node:delete", { nodeId, version });
    client.emit("node:delete:ack", { version });
  }

  @SubscribeMessage("edge:add")
  async handleEdgeAdd(
    @MessageBody() dto: EdgeEventDto,
    @ConnectedSocket() client: Socket,
  ) {
    const version = await this.collaborationService.handleEdgeUpdate(
      dto.storyboardId,
      dto.edge!,
    );
    client.to(dto.storyboardId).emit("edge:add", { edge: dto.edge, version });
    client.emit("edge:add:ack", { version });
  }

  @SubscribeMessage("edge:update")
  async handleEdgeUpdate(
    @MessageBody() dto: EdgeEventDto,
    @ConnectedSocket() client: Socket,
  ) {
    const version = await this.collaborationService.handleEdgeUpdate(
      dto.storyboardId,
      dto.edge!,
    );
    client
      .to(dto.storyboardId)
      .emit("edge:update", { edge: dto.edge, version });
    client.emit("edge:update:ack", { version });
  }

  @SubscribeMessage("edge:delete")
  async handleEdgeDelete(
    @MessageBody() dto: EdgeEventDto,
    @ConnectedSocket() client: Socket,
  ) {
    const version = await this.collaborationService.handleEdgeDelete(
      dto.storyboardId,
      dto.edgeId!,
    );
    client
      .to(dto.storyboardId)
      .emit("edge:delete", { edgeId: dto.edgeId, version });
    client.emit("edge:delete:ack", { version });
  }

  @SubscribeMessage("presence:update")
  async handlePresence(
    @MessageBody() dto: PresenceEventDto,
    @ConnectedSocket() client: Socket,
  ) {
    const storyboardId = this.socketRoom.get(client.id);
    if (!storyboardId) return;

    const userId = client.data["userId"] as string;
    const name = client.data["name"] as string;
    const color = this.collaborationService.assignColor(storyboardId, userId);

    const presence: UserPresence = {
      userId,
      name,
      color,
      cursor: dto.cursor ?? null,
      selectedNodeIds: dto.selectedNodeIds,
      lastSeen: Date.now(),
    };

    await this.collaborationService.updatePresence(storyboardId, presence);
    client.to(storyboardId).emit("presence:update", presence);
  }

  @SubscribeMessage("room:replay")
  async handleReplay(
    @MessageBody() dto: ReplayEventDto,
    @ConnectedSocket() client: Socket,
  ) {
    const ops = dto.ops as Operation[];
    for (const op of ops) {
      try {
        if (op.type === "node:update" || op.type === "node:add") {
          const { version } = await this.collaborationService.handleNodeUpdate(
            dto.storyboardId,
            client.id,
            op.payload as Record<string, unknown>,
          );
          client.to(dto.storyboardId).emit(op.type, {
            node: op.payload,
            version,
          });
        } else if (op.type === "node:delete") {
          const payload = op.payload as { nodeId: string };
          const version = await this.collaborationService.handleNodeDelete(
            dto.storyboardId,
            payload.nodeId,
          );
          client.to(dto.storyboardId).emit("node:delete", {
            nodeId: payload.nodeId,
            version,
          });
        } else if (op.type === "edge:add" || op.type === "edge:update") {
          const version = await this.collaborationService.handleEdgeUpdate(
            dto.storyboardId,
            op.payload as Record<string, unknown>,
          );
          client
            .to(dto.storyboardId)
            .emit(op.type, { edge: op.payload, version });
        } else if (op.type === "edge:delete") {
          const payload = op.payload as { edgeId: string };
          const version = await this.collaborationService.handleEdgeDelete(
            dto.storyboardId,
            payload.edgeId,
          );
          client.to(dto.storyboardId).emit("edge:delete", {
            edgeId: payload.edgeId,
            version,
          });
        }
      } catch {
        // 실패한 operation은 skip
      }
    }
    client.emit("room:replay:done");
  }

  async handleDisconnect(client: Socket) {
    const storyboardId = this.socketRoom.get(client.id);
    if (!storyboardId) return;

    const userId = client.data["userId"] as string;
    const name = client.data["name"] as string;

    const roomSize =
      this.server.sockets.adapter.rooms.get(storyboardId)?.size ?? 0;
    const isLastUser = roomSize <= 1;

    await this.collaborationService.onUserLeave(
      storyboardId,
      userId,
      client.id,
      isLastUser,
    );

    this.socketRoom.delete(client.id);
    client.to(storyboardId).emit("room:user-left", { userId, name });
  }

  @OnEvent("app.shutdown")
  async onShutdown() {
    this.server.emit("room:closing");
    await new Promise((r) => setTimeout(r, 1000));
    await this.collaborationService.flushAllDirtyRooms();
    this.server.disconnectSockets();
  }

  private async leaveRoom(client: Socket, storyboardId: string) {
    const userId = client.data["userId"] as string;
    const name = client.data["name"] as string;
    const roomSize =
      this.server.sockets.adapter.rooms.get(storyboardId)?.size ?? 0;
    const isLastUser = roomSize <= 1;

    client.leave(storyboardId);
    this.socketRoom.delete(client.id);

    await this.collaborationService.onUserLeave(
      storyboardId,
      userId,
      client.id,
      isLastUser,
    );
    client.to(storyboardId).emit("room:user-left", { userId, name });
  }
}
```

- [ ] **Step 3: CollaborationModule 생성**

```typescript
// apps/api/src/collaboration/collaboration.module.ts
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import Redis from "ioredis";
import { CollaborationGateway } from "./collaboration.gateway";
import { CollaborationService } from "./collaboration.service";
import { CollaborationRedisService } from "./collaboration-redis.service";
import { WsAuthGuard } from "./guards/ws-auth.guard";
import { StoryboardsModule } from "../storyboards/storyboards.module";

@Module({
  imports: [ConfigModule, StoryboardsModule],
  providers: [
    {
      provide: "REDIS_CLIENT",
      useFactory: (config: ConfigService) =>
        new Redis(config.get<string>("REDIS_URL") ?? "redis://localhost:6379"),
      inject: [ConfigService],
    },
    {
      provide: CollaborationRedisService,
      useFactory: (redis: Redis) => new CollaborationRedisService(redis),
      inject: ["REDIS_CLIENT"],
    },
    CollaborationService,
    CollaborationGateway,
    WsAuthGuard,
  ],
})
export class CollaborationModule {}
```

- [ ] **Step 4: StoryboardsModule exports 추가**

`apps/api/src/storyboards/storyboards.module.ts`에 `exports: [StoryboardsService]` 추가:

```typescript
// apps/api/src/storyboards/storyboards.module.ts
import { Module } from "@nestjs/common";
import { StoryboardsController } from "./storyboards.controller";
import { StoryboardsService } from "./storyboards.service";

@Module({
  controllers: [StoryboardsController],
  providers: [StoryboardsService],
  exports: [StoryboardsService],
})
export class StoryboardsModule {}
```

- [ ] **Step 5: AppModule에 CollaborationModule + EventEmitterModule 추가**

```typescript
// apps/api/src/app.module.ts
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { AuthModule } from "./auth/auth.module";
import { BlueprintsModule } from "./blueprints/blueprints.module";
import { CollaborationModule } from "./collaboration/collaboration.module";
import { HealthController } from "./health.controller";
import { OrganizationsModule } from "./organizations/organizations.module";
import { ProjectsModule } from "./projects/projects.module";
import { StoryboardsModule } from "./storyboards/storyboards.module";
import { UsersModule } from "./users/users.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env", ".env.local"],
    }),
    EventEmitterModule.forRoot(),
    AuthModule,
    UsersModule,
    OrganizationsModule,
    ProjectsModule,
    StoryboardsModule,
    BlueprintsModule,
    CollaborationModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
```

- [ ] **Step 6: main.ts에 shutdown hooks 추가**

`apps/api/src/main.ts`의 `bootstrap` 함수에 추가:

```typescript
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks(); // 추가
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
```

- [ ] **Step 7: @nestjs/event-emitter 패키지 설치**

Run: `pnpm --filter api add @nestjs/event-emitter`

- [ ] **Step 8: 빌드 확인**

Run: `pnpm --filter api build`
Expected: exit 0

- [ ] **Step 9: 커밋**

```bash
git add apps/api/src/collaboration/ apps/api/src/storyboards/storyboards.module.ts apps/api/src/app.module.ts apps/api/src/main.ts apps/api/package.json pnpm-lock.yaml
git commit -m "feat: add CollaborationGateway and CollaborationModule"
```

---

## Task 7: DB Flush 스케줄러

**Files:**

- Modify: `apps/api/src/collaboration/collaboration.module.ts`
- Modify: `apps/api/package.json`

- [ ] **Step 1: @nestjs/schedule 설치**

Run: `pnpm --filter api add @nestjs/schedule`

- [ ] **Step 2: CollaborationService에 flush 스케줄러 추가**

`apps/api/src/collaboration/collaboration.service.ts`에 추가:

```typescript
// 파일 상단 import에 추가
import { Injectable } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";

// 클래스 내부에 추가 (기존 flushAllDirtyRooms 아래)
@Cron("*/30 * * * * *") // 30초마다
async scheduledFlush(): Promise<void> {
  await this.flushAllDirtyRooms();
}
```

- [ ] **Step 3: ScheduleModule을 CollaborationModule에 추가**

```typescript
// apps/api/src/collaboration/collaboration.module.ts
import { ScheduleModule } from "@nestjs/schedule";

@Module({
  imports: [ConfigModule, StoryboardsModule, ScheduleModule.forRoot()],
  // ... 나머지 동일
})
```

- [ ] **Step 4: 빌드 확인**

Run: `pnpm --filter api build`
Expected: exit 0

- [ ] **Step 5: 커밋**

```bash
git add apps/api/src/collaboration/ apps/api/package.json pnpm-lock.yaml
git commit -m "feat: add 30s scheduled DB flush for dirty storyboards"
```

---

## Task 8: 오프라인 큐 유틸 (TDD)

**Files:**

- Create: `apps/web/src/lib/offline-queue.ts`
- Create: `apps/web/src/lib/__tests__/offline-queue.test.ts`

- [ ] **Step 1: RED — 테스트 작성**

```typescript
// apps/web/src/lib/__tests__/offline-queue.test.ts
import { describe, it, expect } from "vitest";
import { filterQueueAfterVersion } from "../offline-queue";
import type { Operation } from "@repo/types";

const makeOp = (id: string, clientVersion: number): Operation => ({
  id,
  type: "node:update",
  payload: { id: "node1" },
  clientVersion,
  timestamp: Date.now(),
  retryCount: 0,
});

describe("filterQueueAfterVersion", () => {
  it("서버 버전 이후의 operation만 반환한다", () => {
    const ops = [
      makeOp("a", 1),
      makeOp("b", 2),
      makeOp("c", 3),
      makeOp("d", 4),
    ];
    const result = filterQueueAfterVersion(ops, 2);
    expect(result.map((o) => o.id)).toEqual(["c", "d"]);
  });

  it("서버 버전보다 큰 것이 없으면 빈 배열 반환", () => {
    const ops = [makeOp("a", 1), makeOp("b", 2)];
    const result = filterQueueAfterVersion(ops, 5);
    expect(result).toEqual([]);
  });

  it("큐가 비어있으면 빈 배열 반환", () => {
    expect(filterQueueAfterVersion([], 3)).toEqual([]);
  });

  it("모든 operation이 서버 버전보다 크면 전부 반환", () => {
    const ops = [makeOp("a", 5), makeOp("b", 6)];
    const result = filterQueueAfterVersion(ops, 4);
    expect(result.map((o) => o.id)).toEqual(["a", "b"]);
  });
});
```

- [ ] **Step 2: RED 확인**

Run: `pnpm --filter web test`
Expected: FAIL — `offline-queue` not found

- [ ] **Step 3: GREEN — 구현**

```typescript
// apps/web/src/lib/offline-queue.ts
import type { Operation } from "@repo/types";

/**
 * 오프라인 큐에서 serverVersion보다 큰 clientVersion을 가진 operation만 필터링.
 * 재연결 시 서버 상태 이후의 로컬 작업만 재전송하는 데 사용.
 */
export function filterQueueAfterVersion(
  queue: Operation[],
  serverVersion: number,
): Operation[] {
  return queue.filter((op) => op.clientVersion > serverVersion);
}
```

- [ ] **Step 4: GREEN 확인**

Run: `pnpm --filter web test`
Expected: offline-queue 테스트 4개 통과

- [ ] **Step 5: 커밋**

```bash
git add apps/web/src/lib/offline-queue.ts apps/web/src/lib/__tests__/offline-queue.test.ts
git commit -m "feat: add filterQueueAfterVersion util with TDD"
```

---

## Task 9: collaborationSlice + useCollaboration hook

**Files:**

- Create: `apps/web/src/stores/collaboration-slice.ts`
- Create: `apps/web/src/hooks/use-collaboration.ts`

- [ ] **Step 1: collaborationSlice 생성**

```typescript
// apps/web/src/stores/collaboration-slice.ts
import { create } from "zustand";
import type { UserPresence } from "@repo/types";

interface CollaborationState {
  // 연결 상태
  isConnected: boolean;
  collabToken: string | null;

  // 프레즌스 (userId → UserPresence)
  presence: Record<string, UserPresence>;

  // 액션
  setConnected: (connected: boolean) => void;
  setCollabToken: (token: string) => void;
  setPresence: (userId: string, presence: UserPresence) => void;
  removePresence: (userId: string) => void;
  clearPresence: () => void;
}

export const useCollaborationStore = create<CollaborationState>()((set) => ({
  isConnected: false,
  collabToken: null,
  presence: {},

  setConnected: (connected) => set({ isConnected: connected }),
  setCollabToken: (token) => set({ collabToken: token }),
  setPresence: (userId, presence) =>
    set((s) => ({ presence: { ...s.presence, [userId]: presence } })),
  removePresence: (userId) =>
    set((s) => {
      const next = { ...s.presence };
      delete next[userId];
      return { presence: next };
    }),
  clearPresence: () => set({ presence: {} }),
}));
```

- [ ] **Step 2: useCollaboration hook 생성**

```typescript
// apps/web/src/hooks/use-collaboration.ts
"use client";

import { useEffect, useRef, useCallback } from "react";
import { io, type Socket } from "socket.io-client";
import type { Node, Edge } from "@xyflow/react";
import type { Operation, RoomStatePayload, UserPresence } from "@repo/types";
import { useCollaborationStore } from "@/stores/collaboration-slice";
import { useEditorStore } from "@/stores/editor-store";
import { filterQueueAfterVersion } from "@/lib/offline-queue";
import { getCollabTokenAction } from "@/actions/get-collab-token-action";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "http://localhost:4001";

interface UseCollaborationOptions {
  storyboardId: string;
  isRemoteUpdateRef: React.MutableRefObject<boolean>;
  onNodesUpdate: (nodes: Node[]) => void;
  onEdgesUpdate: (edges: Edge[]) => void;
  onNodeRemote: (node: Record<string, unknown>, version: number) => void;
  onNodeDeleteRemote: (nodeId: string, version: number) => void;
  onEdgeRemote: (edge: Record<string, unknown>, version: number) => void;
  onEdgeDeleteRemote: (edgeId: string, version: number) => void;
}

export function useCollaboration({
  storyboardId,
  isRemoteUpdateRef,
  onNodesUpdate,
  onEdgesUpdate,
  onNodeRemote,
  onNodeDeleteRemote,
  onEdgeRemote,
  onEdgeDeleteRemote,
}: UseCollaborationOptions) {
  const socketRef = useRef<Socket | null>(null);
  const offlineQueueRef = useRef<Operation[]>([]);
  const isOfflineRef = useRef(false);

  const {
    setConnected,
    setPresence,
    removePresence,
    clearPresence,
    setCollabToken,
  } = useCollaborationStore();
  const { setContentVersion } = useEditorStore();

  const applyRoomState = useCallback(
    (state: RoomStatePayload) => {
      if (state.content) {
        isRemoteUpdateRef.current = true;
        const content = state.content as { nodes?: Node[]; edges?: Edge[] };
        if (content.nodes) onNodesUpdate(content.nodes);
        if (content.edges) onEdgesUpdate(content.edges);
        isRemoteUpdateRef.current = false;
      }
      setContentVersion(state.version);

      clearPresence();
      for (const p of state.presence) {
        setPresence(p.userId, p);
      }
    },
    [
      isRemoteUpdateRef,
      onNodesUpdate,
      onEdgesUpdate,
      setContentVersion,
      clearPresence,
      setPresence,
    ],
  );

  useEffect(() => {
    let socket: Socket;

    async function connect() {
      const result = await getCollabTokenAction();
      if ("error" in result) return;

      setCollabToken(result.token);

      socket = io(WS_URL, {
        auth: { token: result.token },
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
      });
      socketRef.current = socket;

      socket.on("connect", () => {
        setConnected(true);

        if (isOfflineRef.current) {
          // 재연결 흐름
          const lastVersion = useEditorStore.getState().contentVersion;
          socket.emit("room:sync", { storyboardId, version: lastVersion });
        } else {
          socket.emit("room:join", { storyboardId });
        }
        isOfflineRef.current = false;
      });

      socket.on("disconnect", () => {
        setConnected(false);
        isOfflineRef.current = true;
      });

      socket.on("room:state", (state: RoomStatePayload) => {
        const serverVersion = state.version;
        applyRoomState(state);

        // 오프라인 큐 replay
        const toReplay = filterQueueAfterVersion(
          offlineQueueRef.current,
          serverVersion,
        );
        if (toReplay.length > 0) {
          socket.emit("room:replay", { storyboardId, ops: toReplay });
        }
        offlineQueueRef.current = [];

        // 재연결 후 presence 재전송
        if (isOfflineRef.current) {
          socket.emit("presence:update", { cursor: null, selectedNodeIds: [] });
        }
      });

      socket.on("room:closing", () => {
        setConnected(false);
      });

      // 노드 이벤트
      socket.on(
        "node:update",
        ({
          node,
          version,
        }: {
          node: Record<string, unknown>;
          version: number;
        }) => {
          isRemoteUpdateRef.current = true;
          onNodeRemote(node, version);
          setContentVersion(version);
          isRemoteUpdateRef.current = false;
        },
      );

      socket.on(
        "node:add",
        ({
          node,
          version,
        }: {
          node: Record<string, unknown>;
          version: number;
        }) => {
          isRemoteUpdateRef.current = true;
          onNodeRemote(node, version);
          setContentVersion(version);
          isRemoteUpdateRef.current = false;
        },
      );

      socket.on(
        "node:delete",
        ({ nodeId, version }: { nodeId: string; version: number }) => {
          isRemoteUpdateRef.current = true;
          onNodeDeleteRemote(nodeId, version);
          setContentVersion(version);
          isRemoteUpdateRef.current = false;
        },
      );

      // 엣지 이벤트
      socket.on(
        "edge:add",
        ({
          edge,
          version,
        }: {
          edge: Record<string, unknown>;
          version: number;
        }) => {
          isRemoteUpdateRef.current = true;
          onEdgeRemote(edge, version);
          setContentVersion(version);
          isRemoteUpdateRef.current = false;
        },
      );

      socket.on(
        "edge:update",
        ({
          edge,
          version,
        }: {
          edge: Record<string, unknown>;
          version: number;
        }) => {
          isRemoteUpdateRef.current = true;
          onEdgeRemote(edge, version);
          setContentVersion(version);
          isRemoteUpdateRef.current = false;
        },
      );

      socket.on(
        "edge:delete",
        ({ edgeId, version }: { edgeId: string; version: number }) => {
          isRemoteUpdateRef.current = true;
          onEdgeDeleteRemote(edgeId, version);
          setContentVersion(version);
          isRemoteUpdateRef.current = false;
        },
      );

      // 프레즌스
      socket.on("presence:update", (presence: UserPresence) => {
        setPresence(presence.userId, presence);
      });

      socket.on(
        "room:user-joined",
        ({
          userId,
          name,
          color,
        }: {
          userId: string;
          name: string;
          color: string;
        }) => {
          // 토스트는 editor.tsx에서 처리
          window.dispatchEvent(
            new CustomEvent("collab:user-joined", {
              detail: { userId, name, color },
            }),
          );
        },
      );

      socket.on(
        "room:user-left",
        ({ userId, name }: { userId: string; name: string }) => {
          removePresence(userId);
          window.dispatchEvent(
            new CustomEvent("collab:user-left", { detail: { userId, name } }),
          );
        },
      );

      socket.on("collab:conflict", ({ nodeId }: { nodeId: string }) => {
        window.dispatchEvent(
          new CustomEvent("collab:conflict", { detail: { nodeId } }),
        );
      });
    }

    void connect();

    return () => {
      socket?.emit("room:leave", { storyboardId });
      socket?.disconnect();
      setConnected(false);
      clearPresence();
    };
  }, [storyboardId]); // eslint-disable-line react-hooks/exhaustive-deps

  // 오프라인 중 큐에 적재하는 emit 래퍼
  const emit = useCallback(
    (
      event: string,
      data: Record<string, unknown> & { storyboardId: string },
    ) => {
      const socket = socketRef.current;
      if (!socket || !socket.connected) {
        if (event.startsWith("node:") || event.startsWith("edge:")) {
          const op: Operation = {
            id: crypto.randomUUID(),
            type: event as Operation["type"],
            payload: data,
            clientVersion: useEditorStore.getState().contentVersion,
            timestamp: Date.now(),
            retryCount: 0,
          };
          offlineQueueRef.current.push(op);
        }
        return;
      }
      socket.emit(event, data);
    },
    [],
  );

  const updatePresence = useCallback(
    (cursor: { x: number; y: number } | null, selectedNodeIds: string[]) => {
      socketRef.current?.emit("presence:update", { cursor, selectedNodeIds });
    },
    [],
  );

  return { emit, updatePresence };
}
```

- [ ] **Step 3: 타입 체크**

Run: `pnpm --filter web check-types`
Expected: 0 errors

- [ ] **Step 4: 커밋**

```bash
git add apps/web/src/stores/collaboration-slice.ts apps/web/src/hooks/use-collaboration.ts
git commit -m "feat: add collaborationSlice and useCollaboration hook"
```

---

## Task 10: editor.tsx 통합

**Files:**

- Modify: `apps/web/src/components/storyboard/editor.tsx`

- [ ] **Step 1: isRemoteUpdateRef + useCollaboration 추가**

`editor.tsx`에서 `useUndoRedo` import 아래에 추가:

```typescript
// 기존 imports 아래에 추가
import { useCollaboration } from "@/hooks/use-collaboration";
import { useCollaborationStore } from "@/stores/collaboration-slice";
import { PresenceLayer } from "./presence-layer";
import { useToast } from "@/components/ui/use-toast"; // shadcn toast
```

`StoryboardEditorInner` 컴포넌트 내부 (`useUndoRedo()` 호출 아래):

```typescript
// isRemoteUpdate ref — 원격 변경 시 Undo 스택 오염 방지
const isRemoteUpdateRef = useRef(false);

// useCollaboration 통합
const { emit: collabEmit, updatePresence } = useCollaboration({
  storyboardId,
  isRemoteUpdateRef,
  onNodesUpdate: (remoteNodes) => {
    setNodes(remoteNodes as Node[]);
  },
  onEdgesUpdate: (remoteEdges) => {
    setEdges(remoteEdges as Edge[]);
  },
  onNodeRemote: (remoteNode, version) => {
    setNodes((nds) => {
      const exists = nds.find((n) => n.id === (remoteNode["id"] as string));
      if (exists) {
        return nds.map((n) =>
          n.id === remoteNode["id"] ? { ...n, ...remoteNode } : n,
        );
      }
      return [...nds, remoteNode as Node];
    });
  },
  onNodeDeleteRemote: (nodeId) => {
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
  },
  onEdgeRemote: (remoteEdge) => {
    setEdges((eds) => {
      const exists = eds.find((e) => e.id === (remoteEdge["id"] as string));
      if (exists) {
        return eds.map((e) =>
          e.id === remoteEdge["id"] ? { ...e, ...remoteEdge } : e,
        );
      }
      return [...eds, remoteEdge as Edge];
    });
  },
  onEdgeDeleteRemote: (edgeId) => {
    setEdges((eds) => eds.filter((e) => e.id !== edgeId));
  },
});
```

- [ ] **Step 2: pushSnapshot에 isRemoteUpdateRef 가드 추가**

`editor.tsx`에서 `useUndoRedo`가 반환하는 `pushSnapshot` 대신, 래핑 버전 사용:

```typescript
const { pushSnapshot: _pushSnapshot, undo, redo } = useUndoRedo();

const pushSnapshot = useCallback(
  (nodes: Node[], edges: Edge[]) => {
    if (isRemoteUpdateRef.current) return; // 원격 변경은 스킵
    _pushSnapshot(nodes, edges);
  },
  [_pushSnapshot],
);
```

- [ ] **Step 3: 노드/엣지 변경 시 collabEmit 추가**

기존 `markDirtyAndSave` 호출 주변에 collab emit 추가. `handleNodesChange` 함수에서 `position` 변경 시:

```typescript
// handleNodeDragStop 함수 내 (기존 markDirtyAndSave 호출 아래)
for (const node of nodes) {
  collabEmit("node:update", {
    storyboardId,
    node: { id: node.id, position: node.position },
  });
}
```

`handleNodeDataChange` 함수 내 (기존 setNodes 아래):

```typescript
collabEmit("node:update", {
  storyboardId,
  node: { id: nodeId, data: newData },
});
```

`handleAddNode` 함수 내 (새 노드 생성 후):

```typescript
collabEmit("node:add", { storyboardId, node: newNode });
```

`handleConnect` 함수 내 (새 엣지 생성 후):

```typescript
collabEmit("edge:add", { storyboardId, edge: newEdge });
```

- [ ] **Step 4: 토스트 이벤트 처리 추가**

```typescript
// useEffect로 collab 커스텀 이벤트 구독
useEffect(() => {
  function onUserJoined(e: Event) {
    const { name } = (e as CustomEvent<{ name: string }>).detail;
    // shadcn toast 또는 간단한 알림
    console.info(`${name} 님이 입장했습니다`);
  }
  function onUserLeft(e: Event) {
    const { name } = (e as CustomEvent<{ name: string }>).detail;
    console.info(`${name} 님이 퇴장했습니다`);
  }
  function onConflict(e: Event) {
    const { nodeId } = (e as CustomEvent<{ nodeId: string }>).detail;
    console.warn(`노드 ${nodeId}: 다른 사용자가 수정했습니다`);
  }
  window.addEventListener("collab:user-joined", onUserJoined);
  window.addEventListener("collab:user-left", onUserLeft);
  window.addEventListener("collab:conflict", onConflict);
  return () => {
    window.removeEventListener("collab:user-joined", onUserJoined);
    window.removeEventListener("collab:user-left", onUserLeft);
    window.removeEventListener("collab:conflict", onConflict);
  };
}, []);
```

- [ ] **Step 5: PresenceLayer를 Canvas 위에 삽입**

canvas div 내부에 `PresenceLayer` 추가:

```tsx
{/* Canvas div 내부 */}
<div className="h-full w-full" onContextMenu={handleContextMenu}>
  <Canvas ... />
  <PresenceLayer /> {/* 추가 */}
  {contextMenu && <ContextMenu ... />}
</div>
```

- [ ] **Step 6: 타입 체크**

Run: `pnpm --filter web check-types`
Expected: 0 errors (PresenceLayer 없으면 다음 Task 완료 후 재확인)

- [ ] **Step 7: 커밋**

```bash
git add apps/web/src/components/storyboard/editor.tsx
git commit -m "feat: integrate useCollaboration into editor — remote sync and presence"
```

---

## Task 11: PresenceLayer 컴포넌트

**Files:**

- Create: `apps/web/src/components/storyboard/presence-layer.tsx`
- Modify: `apps/web/src/components/storyboard/canvas.tsx`

- [ ] **Step 1: PresenceLayer 생성**

```tsx
// apps/web/src/components/storyboard/presence-layer.tsx
"use client";

import { useEffect, useRef } from "react";
import { useViewport } from "@xyflow/react";
import { useCollaborationStore } from "@/stores/collaboration-slice";
import type { UserPresence } from "@repo/types";

export function PresenceLayer() {
  const { x, y, zoom } = useViewport();
  const presence = useCollaborationStore((s) => s.presence);
  const users = Object.values(presence);

  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
      style={{ zIndex: 10 }}
    >
      <g transform={`translate(${x}, ${y}) scale(${zoom})`}>
        {users.map((user) => (
          <UserCursor key={user.userId} presence={user} zoom={zoom} />
        ))}
      </g>
    </svg>
  );
}

function UserCursor({
  presence,
  zoom,
}: {
  presence: UserPresence;
  zoom: number;
}) {
  const isStale = Date.now() - presence.lastSeen > 5000;
  const opacity = isStale ? 0 : 1;

  if (!presence.cursor) return null;

  const { x, y } = presence.cursor;
  const scale = 1 / zoom; // 줌 무관하게 커서 크기 유지

  return (
    <g
      transform={`translate(${x}, ${y})`}
      style={{ opacity, transition: "opacity 0.5s" }}
    >
      {/* 커서 화살표 */}
      <g transform={`scale(${scale})`}>
        <path
          d="M0 0 L0 16 L4 12 L7 19 L9 18 L6 11 L11 11 Z"
          fill={presence.color}
          stroke="white"
          strokeWidth="1"
        />
        {/* 이름 태그 */}
        <foreignObject x={12} y={0} width={100} height={24}>
          <div
            style={{
              backgroundColor: presence.color,
              color: "white",
              fontSize: "11px",
              padding: "2px 6px",
              borderRadius: "4px",
              whiteSpace: "nowrap",
              display: "inline-block",
            }}
          >
            {presence.name}
          </div>
        </foreignObject>
      </g>
    </g>
  );
}
```

- [ ] **Step 2: 선택 노드 하이라이트 — Canvas에 nodeClassName 추가**

`canvas.tsx`의 `CanvasProps`에 추가:

```typescript
interface CanvasProps {
  // ... 기존 props
  nodeClassName?: (node: Node) => string;
}
```

`<ReactFlow>` 컴포넌트에 `nodeClassName` prop 전달:

```tsx
<ReactFlow
  // ... 기존 props
  nodeClassName={nodeClassName}
/>
```

- [ ] **Step 3: editor.tsx에서 nodeClassName 계산 후 Canvas에 전달**

```typescript
// editor.tsx 내 (collaborationStore에서 presence 구독)
const presenceMap = useCollaborationStore((s) => s.presence);

const nodeClassName = useCallback(
  (node: Node): string => {
    for (const p of Object.values(presenceMap)) {
      if (p.selectedNodeIds.includes(node.id)) {
        // Tailwind 동적 클래스 — tailwind.config에 safelist 추가 필요
        // 여기서는 인라인 스타일 방식 대신 data-attr 활용
        return `ring-2 ring-[${p.color}]`;
      }
    }
    return "";
  },
  [presenceMap],
);
```

Canvas 호출부에 `nodeClassName={nodeClassName}` 추가.

- [ ] **Step 4: canvas.tsx에 마우스 이동 → updatePresence 연결**

`canvas.tsx`에 `onMouseMove` prop 추가:

```typescript
interface CanvasProps {
  // ... 기존 props
  nodeClassName?: (node: Node) => string;
  onMouseMoveOnCanvas?: (e: React.MouseEvent) => void;
}
```

`<ReactFlow>` 래퍼 div에 `onMouseMove={onMouseMoveOnCanvas}` 추가.

`editor.tsx`에서 100ms throttle + `screenToFlowPosition`으로 변환 후 전송:

```typescript
// editor.tsx 내부 — useReactFlow()에서 screenToFlowPosition 추출
const { screenToFlowPosition } = useReactFlow();
const lastPresenceSendRef = useRef(0);

const handleCanvasMouseMove = useCallback(
  (e: React.MouseEvent) => {
    const now = Date.now();
    if (now - lastPresenceSendRef.current < 100) return; // 100ms throttle
    lastPresenceSendRef.current = now;

    const flowPos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    const selectedIds = nodes.filter((n) => n.selected).map((n) => n.id);
    updatePresence(flowPos, selectedIds);
  },
  [screenToFlowPosition, nodes, updatePresence],
);
```

Canvas 호출부에 `onMouseMoveOnCanvas={handleCanvasMouseMove}` 전달.

- [ ] **Step 5: 스테일 커서 정리 (5초 타이머)**

`PresenceLayer` 내부에 추가:

```typescript
// 5초마다 stale presence 정리
const removePresence = useCollaborationStore((s) => s.removePresence);
useEffect(() => {
  const interval = setInterval(() => {
    for (const [userId, p] of Object.entries(presence)) {
      if (Date.now() - p.lastSeen > 5000) {
        removePresence(userId);
      }
    }
  }, 1000);
  return () => clearInterval(interval);
}, [presence, removePresence]);
```

- [ ] **Step 5: 타입 체크 + 테스트**

Run: `pnpm --filter web check-types && pnpm --filter web test`
Expected: 0 errors, 모든 테스트 통과

- [ ] **Step 6: 커밋**

```bash
git add apps/web/src/components/storyboard/presence-layer.tsx apps/web/src/components/storyboard/canvas.tsx apps/web/src/components/storyboard/editor.tsx
git commit -m "feat: add PresenceLayer — cursor display and node selection highlight"
```

---

## Task 12: 전체 검증

- [ ] **Step 1: 테스트 전체 실행**

Run: `pnpm --filter web test && pnpm --filter api test`
Expected: web 전체 통과, api 전체 통과

- [ ] **Step 2: Lint**

Run: `pnpm lint`
Expected: 0 errors

- [ ] **Step 3: 타입 체크**

Run: `pnpm check-types`
Expected: 0 errors

- [ ] **Step 4: API 빌드**

Run: `pnpm --filter api build`
Expected: exit 0

- [ ] **Step 5: 로컬 통합 테스트**

```bash
docker compose up -d
pnpm --filter @repo/db db:migrate
# 터미널 1
pnpm --filter api dev
# 터미널 2
pnpm --filter web dev
```

두 브라우저 탭에서 같은 스토리보드 열고:

1. 탭 A에서 노드 추가 → 탭 B에서 즉시 반영 확인
2. 탭 A에서 노드 드래그 → 탭 B에서 이동 확인
3. 탭 A 커서 이동 → 탭 B에서 커서 표시 확인
4. 탭 A 오프라인(네트워크 끊기) → 노드 편집 → 재연결 → 탭 B에서 반영 확인

- [ ] **Step 6: 최종 커밋**

```bash
git add -A
git commit -m "feat: Phase 3 — real-time collaboration with Redis, WebSocket, presence"
```
