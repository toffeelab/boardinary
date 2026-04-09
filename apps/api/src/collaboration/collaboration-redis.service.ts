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

  async getAuthCache(socketId: string): Promise<{
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
