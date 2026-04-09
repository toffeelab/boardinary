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
