import { describe, it, expect, vi, beforeEach } from "vitest";
import { CollaborationService } from "../collaboration.service";
import type { CollaborationRedisService } from "../collaboration-redis.service";

const mockRedis = {
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

const mockVersionsService = {
  createSnapshot: vi.fn().mockResolvedValue(undefined),
  pruneAutoVersions: vi.fn().mockResolvedValue(undefined),
};

vi.mock("@repo/db", () => ({}));

describe("CollaborationService", () => {
  let service: CollaborationService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new CollaborationService(
      mockRedis as unknown as CollaborationRedisService,
      mockStoryboardsService as never,
      mockVersionsService as never,
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
