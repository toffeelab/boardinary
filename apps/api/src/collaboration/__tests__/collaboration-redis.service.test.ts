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
