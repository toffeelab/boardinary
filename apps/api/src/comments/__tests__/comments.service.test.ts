import { describe, it, expect, vi, beforeEach } from "vitest";
import { ForbiddenException } from "@nestjs/common";
import { CommentsService } from "../comments.service";

vi.mock("drizzle-orm", () => ({
  eq: (col: unknown, val: unknown) => ({ col, val, op: "eq" }),
  and: (...conditions: unknown[]) => ({ conditions, op: "and" }),
  desc: (col: unknown) => ({ col, op: "desc" }),
  inArray: (col: unknown, vals: unknown) => ({ col, vals, op: "inArray" }),
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
      const now = new Date();
      const mockCommentRows = [
        {
          comment: {
            id: "c1",
            storyboardId: "sb1",
            content: "test",
            anchorType: "node",
            anchorNodeId: "n1",
            canvasX: null,
            canvasY: null,
            status: "open",
            authorId: "u1",
            resolvedBy: null,
            resolvedAt: null,
            createdAt: now,
            updatedAt: now,
          },
          authorId: "u1",
          authorName: "김기획",
          authorImage: null,
        },
      ];

      // Query 1: comments + authors
      mockSelect.mockReturnValueOnce(createSelectChain(mockCommentRows));
      // Query 2: replies + authors (empty)
      mockSelect.mockReturnValueOnce(createSelectChain([]));

      const result = await service.getCommentsByStoryboard("sb1");
      expect(result).toHaveLength(1);
      expect(result[0]!.id).toBe("c1");
      expect(result[0]!.author.name).toBe("김기획");
      expect(result[0]!.replies).toHaveLength(0);
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
      mockSelect.mockReturnValueOnce(
        createSelectChain([{ id: "r1", authorId: "u1", commentId: "c1" }]),
      );

      await expect(service.deleteReply("r1", "u2")).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
